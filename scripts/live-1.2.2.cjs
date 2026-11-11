// 真机走查（真模型部分）：用真实模型跑 /chat 与「作品段落 AI 补写」，给 F-29 取证。
//
// 默认跳过：只有运行环境里存在模型 Key 时才会发出真实请求，没有 Key 就打印跳过原因并以 0 退出。
//   QUANR_AI_API_KEY  模型网关的 Key（DSH 运行时按 llm-pi-ai.providers 配置注入）
//   LIVE_BASE_URL     可选，默认 http://llm.api.corp.qunar.com/v1
//   LIVE_MODEL        可选，默认 aliyun/deepseek-v4.1-flash-1017
//   LIVE_OUT          可选，把 JSON 结果写到这个路径
//
// 安全约定：不打印 Key、不打印任何以 wrk-/sk- 开头的串；所有读写都在 mkdtemp 出来的临时
// DSH_HOME 里完成，真实 ~/.dsh/weread-gather 只被只读复制；结束时删临时目录（KEEP=1 保留）。
// 真实请求最多 3 次：一次问答、一次段落补写、一次混入素材的来源包。
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const vm = require('vm')
const { pathToFileURL } = require('url')

const root = path.join(__dirname, '..')
const KEY = String(process.env.QUANR_AI_API_KEY || '')
const BASE = String(process.env.LIVE_BASE_URL || 'http://llm.api.corp.qunar.com/v1').replace(/\/+$/, '')
const MODEL = String(process.env.LIVE_MODEL || 'aliyun/deepseek-v4.1-flash-1017')
const MAX_CALLS = 3

function redact(text) {
  return String(text)
    .replace(/\bwrk-[A-Za-z0-9_-]{8,}/g, 'wrk-<redacted>')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-<redacted>')
    .replace(new RegExp(KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '<key>')
}

if (KEY === '') {
  console.log('[live-1.2.2] SKIP 没有可用的模型 Key（环境变量 QUANR_AI_API_KEY 为空）')
  console.log('[live-1.2.2] 这一步需要真实模型，跳过而不是失败。')
  console.log('[live-1.2.2] 在注入了 Key 的终端里重跑：')
  console.log("  PowerShell:  $env:QUANR_AI_API_KEY='<你的 key>'; node scripts/live-1.2.2.cjs")
  console.log('  bash:        QUANR_AI_API_KEY=... node scripts/live-1.2.2.cjs')
  console.log(`[live-1.2.2] 计划：${BASE} / ${MODEL}，最多 ${MAX_CALLS} 次真实调用。`)
  process.exit(0)
}

// --- 临时 DSH_HOME：只读复制真实数据，之后的写全在临时目录 --------------------
const realHome = path.join(os.homedir(), '.dsh', 'weread-gather')
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-live-1.2.2-'))
const tempDir = path.join(tempHome, 'weread-gather')
fs.mkdirSync(tempDir, { recursive: true })
for (const name of ['config.json', 'data.json']) {
  const from = path.join(realHome, name)
  if (fs.existsSync(from)) fs.copyFileSync(from, path.join(tempDir, name))
}
const realDataHash = fs.existsSync(path.join(realHome, 'data.json'))
  ? require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(realHome, 'data.json'))).digest('hex')
  : ''
process.env.DSH_HOME = tempHome

const results = []
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: detail === undefined ? '' : redact(String(detail)).slice(0, 400) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` — ${redact(String(detail)).slice(0, 300)}`}`)
}

// --- client.js 的站内桩（只为拿 buildSourcePack / buildParagraphPack 两个真实载荷器）---
function makeH() {
  return function h(type, props, ...children) {
    const merged = Object.assign({}, props || {})
    if (children.length === 1) merged.children = children[0]
    else if (children.length > 1) merged.children = children
    return { type, props: merged }
  }
}
const noop = () => {}
let hookSeeds = []
let hookIndex = 0
const ReactShim = {
  Fragment: '__fragment__',
  createElement: makeH(),
  useState(initial) {
    const seeded = hookSeeds[hookIndex]
    hookIndex += 1
    return [seeded === undefined ? initial : seeded, noop]
  },
  useRef(initial) {
    return { current: initial }
  },
  useEffect: noop,
  useLayoutEffect: noop,
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useId: () => 'id',
  memo: (fn) => fn,
  Children: {
    toArray(value) {
      if (value === undefined || value === null) return []
      return Array.isArray(value) ? value : [value]
    },
  },
}
function stubElement() {
  return {
    style: { setProperty: noop },
    dataset: {},
    children: [],
    textContent: '',
    innerHTML: '',
    setAttribute: noop,
    removeAttribute: noop,
    appendChild(child) { return child },
    removeChild: noop,
    addEventListener: noop,
    removeEventListener: noop,
    insertBefore(child) { return child },
    get firstChild() { return null },
  }
}
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' }),
  location: { href: 'http://127.0.0.1:1/', origin: 'http://127.0.0.1:1' },
  document: {
    head: stubElement(),
    body: stubElement(),
    createElement: () => stubElement(),
    createTextNode: () => stubElement(),
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    documentElement: stubElement(),
  },
  navigator: { language: 'zh-CN', userAgent: 'node' },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: noop,
  CustomEvent: class {},
  window: {
    __ModuleLoader__: { load() {} },
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    location: { href: 'http://127.0.0.1:1/' },
  },
}
sandbox.require = (id) => {
  if (id === 'react') return ReactShim
  if (id === 'react-dom') return { createPortal: (node) => node }
  throw new Error(`unexpected require(${id})`)
}
sandbox.globalThis = sandbox
sandbox.self = sandbox
let clientEntry = null
sandbox.window.__ModuleLoader__.load = (entry) => { clientEntry = entry }
vm.runInNewContext(fs.readFileSync(path.join(root, 'client.js'), 'utf8'), sandbox, { filename: 'client.js' })
if (!clientEntry) {
  console.error('FAIL client.js 没有调用 window.__ModuleLoader__.load')
  process.exit(1)
}
const clientModule = clientEntry.factory(sandbox.require)
// 客户端把自己的 zh/en 字典在 apply 时注册进来；抓住它，载荷器才出中文。
let dict = {}
const translate = (key, params) => {
  let text = typeof dict[key] === 'string' ? dict[key] : key
  if (params) for (const [k, v] of Object.entries(params)) text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
  return text
}
const plugin = clientModule.apply({
  effect(fn) {
    try {
      return fn()
    } catch {
      return undefined
    }
  },
  slots: { inject: (name, factory) => factory(), register: noop },
  locale: {
    register(first, second) {
      const passed = second || first
      const table = passed && (passed.zh || passed)
      dict = table && typeof table === 'object' ? table : {}
      if (process.env.DEBUG_DICT === '1') console.log(`[debug] locale.register keys=${Object.keys(dict).length}`)
    },
    bind: () => translate,
  },
  log: { info: noop, warn: noop, error: noop },
  services: new Map(),
})
const smoke = (plugin && plugin.__smoke) || clientModule.__smoke || null
if (!smoke || typeof smoke.buildSourcePack !== 'function' || typeof smoke.buildParagraphPack !== 'function') {
  console.error('FAIL client.js 没有导出 buildSourcePack / buildParagraphPack')
  process.exit(1)
}

// --- 真实宿主的 llm 适配器：DSH 的 llm 服务在 app 内，脚本里按它的契约接真实网关 ---
function textOf(chunk) {
  const content = chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content
  return typeof content === 'string' ? content : ''
}
const llm = {
  async listProviders() {
    return [{ id: 'live-gateway', name: 'live-gateway' }]
  },
  async listModels() {
    return [{ id: MODEL, name: MODEL }]
  },
  async *stream(input) {
    const response = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: input.model,
        stream: true,
        max_tokens: input.maxTokens,
        temperature: 0.4,
        messages: [
          { role: 'system', content: input.system },
          ...(input.messages || []),
        ],
      }),
      signal: input.signal,
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`HTTP ${response.status} ${redact(body).slice(0, 200)}`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const frame of parts) {
        for (const line of frame.split('\n')) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '' || payload === '[DONE]') continue
          const chunk = JSON.parse(payload)
          const text = textOf(chunk)
          if (text !== '') yield { type: 'text-delta', text }
        }
      }
    }
    yield { type: 'finish', reason: 'stop' }
  },
}

// --- 起真实 index.js 的路由 ---------------------------------------------------
let server = null
let callCount = 0
async function main() {
  const mod = await import(pathToFileURL(path.join(root, 'index.js')).href)
  const I = mod.__internals
  const host = I.createHost({})
  const ctx = {
    get(name) {
      if (name === 'connection') return { requestRejection: () => undefined }
      if (name === 'llm') return llm
      return null
    },
  }
  const routes = I.makeRoutes(host, ctx)
  server = http.createServer((req, res) => routes[0].handler(req, res))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const base = `http://127.0.0.1:${port}/dsh-weread/api`
  const call = async (route, options) => {
    const response = await fetch(base + route, options)
    const text = await response.text()
    let json = null
    try { json = JSON.parse(text) } catch { json = null }
    return { status: response.status, text, json }
  }

  const data = await call('/data')
  const dataset = data.json || {}
  const notes = Array.isArray(dataset.notes) ? dataset.notes : []
  const note = notes.find((item) => String(item.text || '').trim().length >= 40) || notes[0]
  check('/data 有真实笔记可做来源', Boolean(note), `notes=${notes.length}`)

  const models = await call('/chat/models')
  const providers = models.json && Array.isArray(models.json.providers) ? models.json.providers : []
  const resolved = providers[0] && providers[0].models && providers[0].models[0] ? providers[0].models[0].id : ''
  check('/chat/models 解析出模型名', models.status === 200 && Boolean(resolved), `${models.status} providers=${providers.length} model=${resolved}`)

  const entry = {
    id: note.id,
    kind: 'note',
    text: note.text,
    chapterTitle: note.chapterTitle || note.chapterName || '',
    bookTitle: note.bookTitle || (note.book && note.book.title) || '',
    author: note.author || (note.book && note.book.author) || '',
    createTime: note.createTime,
  }
  const pack = smoke.buildSourcePack({ kind: 'note', entry, context: [], question: '这段话在说什么' })
  check('来源包带书名与原文', pack.includes('来源包') && pack.includes('原文'), `packLen=${pack.length} head=${pack.slice(0, 120).replace(/\n/g, ' / ')}`)

  const first = await streamChat(call, { pack, history: [], question: '这段话在说什么' })
  check('问答：SSE 有 open→text→done', first.frames.includes('open') && first.frames.includes('text') && first.frames.includes('done'), `frames=${first.frames.join(',')}`)
  check('问答：文本非空且无错误帧', first.text.trim() !== '' && first.error === '', `chars=${first.text.length} error=${first.error}`)
  console.log(`[live] 问答 model=${first.model} 首字节=${first.firstByteMs}ms 总耗时=${first.totalMs}ms 输出=${first.text.length}字`)
  console.log(`[live] 样例：${redact(first.text).slice(0, 300)}`)

  // 第二枪：作品段落 AI 补写（F-23 的真实场景），用真实 note 做这一段挂的出处。
  const paraPack = smoke.buildParagraphPack({
    sourceIds: [`note:${note.id}`],
    lookup: new Map([[`note:${note.id}`, entry]]),
    titleOf: () => entry.bookTitle,
  })
  const second = await streamChat(call, { pack: paraPack, history: [], question: translate('work.aiPrompt') })
  const titles = [...new Set([...second.text.matchAll(/《([^》]{1,20})》/g)].map((m) => m[1]))]
  const stray = titles.filter((title) => title !== entry.bookTitle)
  check('补写：SSE 有 open→text→done', second.frames.includes('open') && second.frames.includes('text') && second.frames.includes('done'), `frames=${second.frames.join(',')}`)
  check('补写：贴着出处（没有别的书名）', second.text.trim() !== '' && stray.length === 0, `chars=${second.text.length} 出现的书名=${titles.join('/') || '无'}`)
  console.log(`[live] 补写 model=${second.model} 首字节=${second.firstByteMs}ms 总耗时=${second.totalMs}ms 输出=${second.text.length}字`)
  console.log(`[live] 样例：${redact(second.text).slice(0, 300)}`)

  // 第三枪：F-29 —— 来源里混一条「素材/金句」，看模型会不会把它当成用户自己的话。
  const materialText = String((note.text || '').trim()).slice(0, 120)
  const mixedEntry = {
    id: 'm_live1',
    kind: 'material',
    type: '金句',
    text: materialText,
    chapterName: entry.chapterTitle,
    bookTitle: entry.bookTitle,
    author: entry.author,
  }
  const mixedPack = smoke.buildSourcePack({
    kind: 'material',
    type: '金句',
    entry: mixedEntry,
    context: [{ kind: 'note', text: entry.text, chapter: entry.chapterTitle }],
    question: '请把上面的内容写成一段可以直接放进初稿的话。',
  })
  const third = await streamChat(call, { pack: mixedPack, history: [], question: '请把上面的内容写成一段可以直接放进初稿的话。' })
  if (process.env.DEBUG_PACK === '1') console.log(`[debug] F-29 来源包：${mixedPack.replace(/\n/g, ' / ').slice(0, 320)}`)
  const quoted = third.text.includes(materialText.slice(0, 24))
  check('F-29：混入素材后仍有回答', third.text.trim() !== '', `chars=${third.text.length}`)
  console.log(`[live] F-29 输入里的素材：${redact(materialText).slice(0, 120)}`)
  console.log(`[live] F-29 输出：${redact(third.text).slice(0, 300)}`)
  console.log(`[live] F-29 观察：输出${quoted ? '包含' : '未包含'}素材原文的连续片段；是否把它当「用户自己的话」需要人读这段输出下结论。`)

  const secondHash = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(realHome, 'data.json'))).digest('hex')
  check('真实数据目录未被写入（data.json 哈希不变）', realDataHash === secondHash, `${realDataHash.slice(0, 12)}…`)

  const summary = {
    base: BASE,
    model: first.model || MODEL,
    calls: callCount,
    checks: results,
    samples: {
      chat: redact(first.text).slice(0, 300),
      paragraph: redact(second.text).slice(0, 300),
      f29Input: redact(materialText).slice(0, 120),
      f29Output: redact(third.text).slice(0, 300),
    },
    timings: {
      chat: { firstByteMs: first.firstByteMs, totalMs: first.totalMs },
      paragraph: { firstByteMs: second.firstByteMs, totalMs: second.totalMs },
    },
  }
  if (process.env.LIVE_OUT) fs.writeFileSync(process.env.LIVE_OUT, JSON.stringify(summary, null, 2))
  const failed = results.filter((item) => !item.ok)
  console.log(`[live-1.2.2] pass=${results.length - failed.length} fail=${failed.length} calls=${callCount}`)
  if (failed.length > 0) process.exitCode = 1
}

async function streamChat(call, body) {
  if (callCount >= MAX_CALLS) throw new Error(`超过真实调用上限 ${MAX_CALLS}`)
  callCount += 1
  const started = Date.now()
  const response = await new Promise((resolve, reject) => {
    const request = http.request(
      { host: '127.0.0.1', port: server.address().port, path: '/dsh-weread/api/chat', method: 'POST', headers: { 'content-type': 'application/json' } },
      resolve,
    )
    request.on('error', reject)
    request.end(JSON.stringify(body))
  })
  const frames = []
  let text = ''
  let error = ''
  let model = ''
  let firstByteMs = 0
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of response) {
    if (firstByteMs === 0) firstByteMs = Date.now() - started
    buffer += decoder.decode(chunk, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''
    for (const frame of parts) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '') continue
        const event = JSON.parse(payload)
        if (event.type === 'open') { frames.push('open'); model = event.model || '' }
        else if (event.type === 'text') { frames.push('text'); text += String(event.text || '') }
        else if (event.type === 'error') { frames.push('error'); error = String(event.error || '') }
        else if (event.type === 'done') frames.push('done')
      }
    }
  }
  return { frames: [...new Set(frames)], text, error, model, firstByteMs, totalMs: Date.now() - started }
}

main()
  .catch((error) => {
    console.error(`FAIL ${redact(error && error.message ? error.message : error)}`)
    process.exitCode = 1
  })
  .finally(() => {
    if (server) server.close()
    if (process.env.KEEP === '1') console.log(`[live-1.2.2] 保留临时目录 ${tempHome}`)
    else fs.rmSync(tempHome, { recursive: true, force: true })
  })