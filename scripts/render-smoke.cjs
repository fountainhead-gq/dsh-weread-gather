// 渲染冒烟测试：用极简 hooks 运行时把客户端的各个视图真跑一遍。
// 目的：在没有浏览器（GUI 需要登录 URL）的情况下，抓住组件里的引用错误、
// 空数据崩溃、map 未保护等问题。用法：node scripts/render-smoke.cjs
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')

const root = path.join(__dirname, '..')
const code = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
// 需要一个已经同步过的数据集；可用 WEREAD_DATA 指到别处（例如测试夹具）。
const dataPath = process.env.WEREAD_DATA || path.join(os.homedir(), '.dsh', 'weread-gather', 'data.json')
const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

// --- 极简 React 兼容层 -------------------------------------------------------
function makeH() {
  return function h(type, props, ...children) {
    const merged = Object.assign({}, props || {})
    if (children.length === 1) merged.children = children[0]
    else if (children.length > 1) merged.children = children
    return { type, props: merged }
  }
}

let hookSeeds = []
let hookIndex = 0
function resetHooks(seeds) {
  hookSeeds = seeds || []
  hookIndex = 0
}
const ReactShim = {
  Fragment: '__fragment__',
  createElement: makeH(),
  useState(initial) {
    const seeded = hookSeeds[hookIndex]
    hookIndex += 1
    return [seeded === undefined ? initial : seeded, () => {}]
  },
  useRef(initial) {
    return { current: initial }
  },
  useEffect() {},
  useLayoutEffect() {},
  useMemo(fn) {
    return fn()
  },
  useCallback(fn) {
    return fn
  },
  useId() {
    return 'id'
  },
  memo(fn) {
    return fn
  },
  Children: {
    toArray(value) {
      if (value === undefined || value === null) return []
      return Array.isArray(value) ? value : [value]
    },
    map: (value, fn) => ReactShim.Children.toArray(value).map(fn),
    count: (value) => ReactShim.Children.toArray(value).length,
    only: (value) => ReactShim.Children.toArray(value)[0],
  },
}

// --- 极简 DOM / fetch 桩 -----------------------------------------------------
function stubElement() {
  const node = {
    style: { setProperty() {} },
    dataset: {},
    children: [],
    textContent: '',
    innerHTML: '',
    setAttribute() {},
    removeAttribute() {},
    appendChild(child) {
      node.children.push(child)
      return child
    },
    removeChild() {},
    addEventListener() {},
    removeEventListener() {},
    insertBefore(child) {
      return child
    },
    get firstChild() {
      return node.children[0] || null
    },
  }
  return node
}
const documentStub = {
  head: stubElement(),
  body: stubElement(),
  createElement: () => stubElement(),
  createTextNode: () => stubElement(),
  querySelector: () => null,
  getElementById: () => null,
  addEventListener() {},
  removeEventListener() {},
  documentElement: stubElement(),
}

const payload = {
  ok: true,
  hasData: true,
  updatedAt: dataset.updatedAt,
  books: dataset.books,
  categories: dataset.categories,
  archives: dataset.archives || [],
  shelfTotal: dataset.shelfTotal,
  notes: dataset.notes,
  thoughts: dataset.thoughts,
  dashboard: dataset.dashboard,
  warnings: dataset.warnings || [],
  counts: { books: dataset.books.length, notes: dataset.notes.length, thoughts: dataset.thoughts.length, booksWithNotes: 0 },
}
const statePayload = {
  ok: true,
  configured: true,
  fromEnv: true,
  maskedKey: 'wrk-…5gAA',
  hasData: true,
  updatedAt: dataset.updatedAt,
  counts: payload.counts,
  maxBooks: 60,
  notesPerBook: 200,
  metaLimit: 400,
  dir: 'D:/tmp',
  sync: { running: false },
}

let loaded = null
let loadedModule = null
const exportPreview = {
  ok: true,
  markdown: [
    '---',
    'title: "示例书"',
    'author: "示例作者"',
    'source: "weread"',
    'exportedAt: "2026-11-08T19:00:00+08:00"',
    'excerptCount: 1',
    'thoughtCount: 1',
    'containsAI: false',
    '---',
    '',
    '# 示例书',
    '',
    '*示例作者*',
    '',
    '## 第一章',
    '',
    '> 原文只有一行。',
    '> — 2026-07-28 12:52',
    '',
    '**想法**（2026-07-28 12:55）',
    '',
    '这里是我的想法。',
  ].join('\n'),
  filename: '示例书 - 示例作者.md',
  exportId: 'weread:book/1',
  contentHash: 'sha256:0000',
  excerpts: 1,
  thoughts: 1,
  books: 1,
  bytes: 512,
}
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  fetch: async (url) => {
    const text = String(url)
    let body = payload
    if (text.includes('/state')) body = statePayload
    else if (text.includes('/export/dir')) body = { ok: true, dir: 'D:/tmp/exports', exists: true }
    else if (text.includes('/export')) body = exportPreview
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
  },
  location: { href: 'http://127.0.0.1:6622/', origin: 'http://127.0.0.1:6622' },
  document: documentStub,
  navigator: { language: 'zh-CN', userAgent: 'node' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  cancelAnimationFrame: () => {},
  CustomEvent: class {},
  window: {
    __ModuleLoader__: {
      load(entry) {
        loaded = entry
        loadedModule = entry.factory(sandbox.require)
        return loadedModule
      },
    },
    addEventListener() {},
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    location: { href: 'http://127.0.0.1:6622/' },
  },
}
sandbox.require = (id) => {
  if (id === 'react') return ReactShim
  if (id === 'react-dom') return { createPortal: (node) => node }
  throw new Error(`unexpected require(${id})`)
}
sandbox.globalThis = sandbox
sandbox.self = sandbox

vm.runInNewContext(code, sandbox, { filename: 'client.js' })

if (!loaded) {
  console.error('FAIL: client.js never called window.__ModuleLoader__.load')
  process.exit(1)
}

// --- 注册 & 渲染 -------------------------------------------------------------
const registrations = []
const drawCalls = []
const ctx = {
  slots: {
    inject(name, factory) {
      return factory()
    },
    register(registration, component) {
      registrations.push({ registration, component })
      return () => {}
    },
  },
  locale: {
    register() {},
    bind() {
      return (key, params) => (params ? `${key}(${Object.values(params).join(',')})` : key)
    },
    current: 'zh',
  },
  layout: { selectPanel() {}, openPanel() {} },
  theme: { subscribe: () => () => {}, get: () => ({}) },
  effect(fn) {
    if (typeof fn === 'function') fn()
    return () => {}
  },
  logger: console,
  console: { info() {}, warn() {}, error() {} },
}

loadedModule.apply(ctx)
console.log('[register] count=%d ids=%s', registrations.length, registrations.map((r) => r.registration.id || r.registration.key).join(','))

const panel = registrations.find((r) => r.registration.key === 'weread')
if (!panel) {
  console.error('FAIL: no main panel registered for key "weread"')
  process.exit(1)
}

function renderNode(node, depth, out) {
  if (node === null || node === undefined || node === false || node === true) return
  if (typeof node === 'string' || typeof node === 'number') {
    out.text += String(node.length > 120 ? `${String(node).slice(0, 120)}…` : node)
    return
  }
  if (Array.isArray(node)) {
    for (const child of node) renderNode(child, depth, out)
    return
  }
  const type = node.type
  const props = node.props || {}
  if (type === '__fragment__') {
    renderNode(props.children, depth, out)
    return
  }
  if (typeof type === 'function') {
    out.components.add(type.name || 'anonymous')
    const rendered = type(props)
    renderNode(rendered, depth + 1, out)
    return
  }
  if (typeof type === 'string') {
    out.tags[type] = (out.tags[type] || 0) + 1
    renderNode(props.children, depth, out)
    return
  }
  // React 元素形状兜底（万一内部用了 React.createElement 的其它来源）
  if (node.$$typeof && props.children !== undefined) renderNode(props.children, depth, out)
}

function renderPanel(label, seeds) {
  resetHooks(seeds)
  const out = { text: '', tags: {}, components: new Set() }
  try {
    const tree = panel.component({})
    renderNode(tree, 0, out)
    drawCalls.push({ label, ok: true, text: out.text, tags: Object.keys(out.tags).length, nodes: Object.values(out.tags).reduce((a, b) => a + b, 0), textLength: out.text.length, components: [...out.components].join(',') })
    console.log('[render] %s ok tags=%d nodes=%d text=%d components=%s', label, Object.keys(out.tags).length, Object.values(out.tags).reduce((a, b) => a + b, 0), out.text.length, [...out.components].join(','))
    return tree
  } catch (error) {
    drawCalls.push({ label, ok: false, error: String(error && error.stack ? error.stack.split('\n').slice(0, 4).join(' | ') : error) })
    console.error('[render] %s FAILED %s', label, error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : error)
    return null
  }
}

const anyBook = dataset.books.find((book) => (book.noteCount || 0) + (book.reviewCount || 0) > 0) || dataset.books[0]
// StudyPanel 的 useState 调用顺序（改动 client.js 里那段 state 声明时必须同步这里）：
// state, data, error, view, activeBookId, bookTab, query, showSettings, booting
function seeds(input) {
  const it = input || {}
  return [
    it.state === undefined ? statePayload : it.state,
    it.data === undefined ? payload : it.data,
    it.error === undefined ? '' : it.error,
    it.view === undefined ? 'overview' : it.view,
    it.bookId === undefined ? '' : it.bookId,
    it.bookTab === undefined ? 'notes' : it.bookTab,
    it.query === undefined ? '' : it.query,
    it.showSettings === undefined ? false : it.showSettings,
    it.booting === undefined ? false : it.booting,
  ]
}
const seedBase = (view, extra) => seeds({ view, bookId: extra && extra.bookId, query: extra && extra.query })

renderPanel('overview', seedBase('overview'))
renderPanel('shelf', seedBase('shelf'))
renderPanel('notes', seedBase('notes'))
renderPanel('thoughts', seedBase('thoughts'))
renderPanel('book', seedBase('book', { bookId: anyBook.bookId }))
renderPanel('search', seedBase('shelf', { query: '中国' }))
renderPanel('setup(no key)', seeds({ state: Object.assign({}, statePayload, { configured: false }), data: null }))
renderPanel('empty(no data)', seeds({ state: Object.assign({}, statePayload, { hasData: false }), data: null }))
renderPanel('error-banner', seeds({ error: '网络开小差了' }))
renderPanel('sync-running', seeds({ state: Object.assign({}, statePayload, { sync: { running: true, phase: 'meta', label: '补全书籍信息', done: 120, total: 400, message: '已补全 120/400 本' } }) }))

// 导出面板只在点击之后才出现，所以直接拿模块里的组件挂载一次。
function renderStandalone(label, component, props, hookSeeds) {
  resetHooks(hookSeeds)
  const out = { text: '', tags: {}, components: new Set() }
  try {
    const tree = component(props)
    renderNode(tree, 0, out)
    drawCalls.push({ label, ok: true, text: out.text, tags: Object.keys(out.tags).length, nodes: Object.values(out.tags).reduce((a, b) => a + b, 0), textLength: out.text.length, components: [...out.components].join(',') })
    console.log('[render] %s ok tags=%d nodes=%d text=%d components=%s', label, Object.keys(out.tags).length, Object.values(out.tags).reduce((a, b) => a + b, 0), out.text.length, [...out.components].join(','))
  } catch (error) {
    drawCalls.push({ label, ok: false, error: String(error && error.stack ? error.stack.split('\n').slice(0, 4).join(' | ') : error) })
    console.error('[render] %s FAILED %s', label, error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : error)
  }
}

const smoke = loadedModule.__smoke || {}
if (typeof smoke.ExportPanel !== 'function') {
  console.error('FAIL: client module did not expose __smoke.ExportPanel')
  process.exit(1)
}
// ExportPanel 的 useState 顺序：options, preview, busy, saving, message, dir
renderStandalone('export-panel', smoke.ExportPanel, { selector: { noteIds: [dataset.notes[0].id] }, onClose() {} }, [
  { excerpts: true, thoughts: true, meta: true, chapter: true, star: true, sourceUrl: true },
  exportPreview,
  false,
  false,
  '',
  'D:/tmp/exports',
])

// 同步提示条：进行中必须常驻且带关闭键；结束后同样可以手动关掉。
// SyncBanner 的 useState 顺序：dismissed, expired
const bannerGuards = []
const byLabel0 = (label) => drawCalls.find((item) => item.label === label && item.ok)
if (typeof smoke.SyncBanner !== 'function') bannerGuards.push('client module 未暴露 SyncBanner')
const bannerDone = { phase: 'done', message: '更新 0 本 · 跳过 470 本', running: false }
const bannerRun = { running: true, phase: 'meta', label: '补全书籍信息', done: 120, total: 400, message: '已补全 120/400 本' }
renderStandalone('banner-running', smoke.SyncBanner, { sync: bannerRun }, [false, false])
renderStandalone('banner-done', smoke.SyncBanner, { sync: bannerDone }, [false, false])
renderStandalone('banner-dismissed', smoke.SyncBanner, { sync: bannerDone }, [true, false])
for (const label of ['banner-running', 'banner-done']) {
  const draw = byLabel0(label)
  if (!draw) { bannerGuards.push(`${label}: 未渲染`); continue }
  // 关闭键的文案就是 ×，aria-label 不进渲染文本，所以断言这个字符。
  if (!draw.text.includes('×')) bannerGuards.push(`${label}: 缺关闭按钮`)
}
if (byLabel0('banner-running') && !byLabel0('banner-running').text.includes('sync.running')) bannerGuards.push('banner-running: 缺进度文案')
if (byLabel0('banner-done') && !byLabel0('banner-done').text.includes('sync.done')) bannerGuards.push('banner-done: 缺完成文案')
const dismissedDraw = byLabel0('banner-dismissed')
if (dismissedDraw && dismissedDraw.text.length > 0) bannerGuards.push('banner-dismissed: 关闭后仍然有内容')

// 断言：页面没有退化成「加载中」空壳，分页与复制控件确实渲染出来了
const guards = []
const byLabel = (label) => drawCalls.find((item) => item.label === label && item.ok)
for (const label of ['overview', 'shelf', 'notes', 'thoughts', 'book', 'search']) {
  const draw = byLabel(label)
  if (!draw) { guards.push(`${label}: 未渲染`); continue }
  if (draw.text.length < 500) guards.push(`${label}: 只渲染出 ${draw.text.length} 字，疑似退回加载态`)
}
for (const label of ['notes', 'thoughts']) {
  const draw = byLabel(label)
  if (draw && !draw.text.includes('pager.page')) guards.push(`${label}: 缺分页控件`)
  if (draw && !draw.text.includes('action.copy')) guards.push(`${label}: 缺复制按钮`)
}
const bookDraw = byLabel('book')
if (bookDraw && !bookDraw.text.includes('action.copy')) guards.push('book: 缺复制按钮')
const exportDraw = byLabel('export-panel')
if (!exportDraw) guards.push('export-panel: 未渲染')
else {
  if (process.env.SMOKE_DUMP) console.log('[export-panel text]', exportDraw.text)
  // 预览容器里的长文本会被渲染桩截断，所以断言前 120 字里一定出现的东西。
  for (const needle of ['export.opt.excerpts', 'export.previewLabel', 'export.save', 'export.download', 'title:', 'exportedAt'])
    if (!exportDraw.text.includes(needle)) guards.push(`export-panel: 缺 ${needle}`)
}
const searchDraw = byLabel('search')
if (searchDraw && !searchDraw.text.includes('search.typeAll')) guards.push('search: 缺类型筛选')
// 书籍下拉的选项必须截断，否则原生弹层会被长书名撑满窗口。
if (typeof smoke.clip !== 'function') guards.push('client module 未暴露 clip')
else {
  const short = '顾随诗词讲记'
  const long = '这一本书的书名特别长特别长特别长特别长特别长特别长特别长特别长'
  if (smoke.clip(short, 24) !== short) guards.push('clip: 短标题不该被改动')
  const cut = smoke.clip(long, 24)
  if (cut.length > 24 || !cut.endsWith('…')) guards.push(`clip: 长标题没截断（${cut.length} 字）`)
}
const overviewDraw = byLabel('overview')
if (overviewDraw && !overviewDraw.text.includes('dash.heat.none')) guards.push('overview: 热力图图例缺「无阅读」')
for (const item of bannerGuards) guards.push(item)
console.log('[guards] %s', guards.length === 0 ? 'ok' : guards.join(' | '))

const failed = drawCalls.filter((item) => !item.ok)
console.log('\n=== summary ===')
console.log('rendered %d/%d views, %d failed', drawCalls.length - failed.length, drawCalls.length, failed.length)
for (const item of failed) console.log(' - %s: %s', item.label, item.error)
process.exit(failed.length === 0 && guards.length === 0 ? 0 : 1)