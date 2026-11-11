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
let localeDictionaries = {}
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
    register(namespace, dictionaries) {
      // F-32：把真实字典留下来。渲染文本里出现的是 locale key，但「AI 那条含 AI」这句话
      // 只有在真实文案上才有意义，所以这里既断言 pack 的返回值，也断言上架的那句中文。
      if (dictionaries && typeof dictionaries === 'object') localeDictionaries = dictionaries
    },
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
    // 结构断言（F1 置灰、F3 可点 chip）需要读属性，文字探针对它们无能为力。
    if (out.elements) out.elements.push({ tag: type, props })
    renderNode(props.children, depth, out)
    return
  }
  // React 元素形状兜底（万一内部用了 React.createElement 的其它来源）
  if (node.$$typeof && props.children !== undefined) renderNode(props.children, depth, out)
}

function renderPanel(label, seeds) {
  resetHooks(seeds)
  const out = { text: '', tags: {}, components: new Set(), elements: [] }
  try {
    const tree = panel.component({})
    renderNode(tree, 0, out)
    drawCalls.push({ label, ok: true, text: out.text, tags: Object.keys(out.tags).length, nodes: Object.values(out.tags).reduce((a, b) => a + b, 0), textLength: out.text.length, components: [...out.components].join(','), elements: out.elements })
    console.log('[render] %s ok tags=%d nodes=%d text=%d components=%s', label, Object.keys(out.tags).length, Object.values(out.tags).reduce((a, b) => a + b, 0), out.text.length, [...out.components].join(','))
    return tree
  } catch (error) {
    drawCalls.push({ label, ok: false, error: String(error && error.stack ? error.stack.split('\n').slice(0, 4).join(' | ') : error) })
    console.error('[render] %s FAILED %s', label, error && error.stack ? error.stack.split('\n').slice(0, 6).join('\n') : error)
    return null
  }
}

const anyBook = dataset.books.find((book) => (book.noteCount || 0) + (book.reviewCount || 0) > 0) || dataset.books[0]

// 写作侧（craft.json）的样例：形状与 GET /craft 完全一致，来源 id 全部取自
// 真实 dataset，所以「来源」chip 能解析出原文而不是 id。
const EMPTY_CRAFT_FIXTURE = { hasCraft: false, revision: 0, updatedAt: 0, counts: { responses: 0, materials: 0, topics: 0, works: 0 }, responses: [], materials: [], topics: [], works: [], bookIndex: [] }
function smokeCraft() {
  const stamp = Math.floor(Date.now() / 1000) - 3600
  const book = anyBook || { bookId: 'weread:book/1', title: '书名', author: '作者' }
  const note = (dataset.notes || []).find((item) => item.bookId === book.bookId) || (dataset.notes || [])[0] || { id: 'n_1', text: '划线原文', bookId: book.bookId }
  const thought = (dataset.thoughts || []).find((item) => item.bookId === book.bookId) || (dataset.thoughts || [])[0] || null
  const responseId = 'r_smoke1'
  const materialId = 'm_smoke1'
  const topicId = 't_smoke1'
  const workId = 'w_smoke1'
  return {
    hasCraft: true,
    revision: 7,
    updatedAt: stamp,
    counts: { responses: 1, materials: 1, topics: 1, works: 1 },
    responses: [{
      id: responseId,
      bookId: book.bookId,
      bookTitle: book.title,
      author: book.author || '',
      sourceIds: [`note:${note.id}`],
      text: '这句回应是从对话里采纳下来的。',
      origin: 'think',
      containsAI: true,
      model: 'gpt-4o-mini',
      promptVersion: 'think-v1',
      adoptedAt: stamp,
      createdAt: stamp,
    }],
    materials: [{
      id: materialId,
      type: '金句',
      text: note.text || '素材正文',
      bookId: book.bookId,
      bookTitle: book.title,
      author: book.author || '',
      sourceIds: [`note:${note.id}`],
      authorType: 'ai',
      origin: 'craft',
      containsAI: true,
      verification: { status: 'ok', checkedAt: stamp, hash: 'abc123', snapshot: (note.text || '').slice(0, 40) },
      createdAt: stamp,
      updatedAt: stamp,
    }],
    topics: [{
      id: topicId,
      statement: '想写清楚「为什么读过的书记不住」这件事。',
      materialIds: [materialId],
      bookIds: [book.bookId],
      gapNote: '还缺一组反例。',
      candidates: [],
      createdAt: stamp,
      updatedAt: stamp,
    }],
    works: [{
      id: workId,
      title: '为什么读过的书记不住',
      status: 'draft',
      exportId: `craft:work/${workId}`,
      containsAI: true,
      paragraphs: [{
        id: 'p_smoke1',
        text: '第一段：先把问题摆出来。',
        sourceIds: [`material:${materialId}`],
        ai: true,
        aiOriginIds: [responseId],
        editedAt: 0,
      }],
      createdAt: stamp,
      updatedAt: stamp,
      confirmedAt: 0,
    }],
    bookIndex: [{
      bookId: book.bookId,
      bookTitle: book.title,
      author: book.author || '',
      counts: { responses: 1, materials: 1, topics: 1, works: 1 },
      cached: true,
    }],
  }
}
// 一本书的素材 + 另一本书的素材被同一个选题引用：时间线上这条必须降级成「跨书」。
function crossCraft() {
  const base = smokeCraft()
  const other = 'weread:book/888888888'
  const material = base.materials[0]
  base.materials = base.materials.concat([Object.assign({}, material, { id: 'm_smoke2', bookId: other, bookTitle: '另一本书' })])
  base.topics = base.topics.concat([{
    id: 't_smoke2',
    statement: '跨两本书的选题',
    materialIds: [material.id, 'm_smoke2'],
    bookIds: [base.bookIndex[0].bookId, other],
    gapNote: '',
    candidates: [],
    createdAt: base.updatedAt,
    updatedAt: base.updatedAt,
  }])
  return base
}
// StudyPanel 的 useState 调用顺序（改动 client.js 里那段 state 声明时必须同步这里）：
// state, data, error, view, activeBookId, bookTab, query, showSettings, booting, craft, craftState, craftError, scopeBookId
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
    it.craft === undefined ? smokeCraft() : it.craft,
    it.craftState === undefined ? 'ready' : it.craftState,
    it.craftError === undefined ? '' : it.craftError,
    it.scopeBookId === undefined ? '' : it.scopeBookId,
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
// 1.2.1 四段旅程的内页：THINK 1 + CREATE 3 + GROW 2，外加空库、取数失败、按书过滤、书掉出缓存。
renderPanel('responses', seedBase('responses'))
renderPanel('materials', seedBase('materials'))
renderPanel('topics', seedBase('topics'))
renderPanel('works', seedBase('works'))
renderPanel('timeline', seedBase('timeline'))
renderPanel('annual', seedBase('annual'))
renderPanel('craft-empty', seeds({ view: 'materials', craft: EMPTY_CRAFT_FIXTURE }))
renderPanel('craft-empty-think', seeds({ view: 'responses', craft: EMPTY_CRAFT_FIXTURE }))
renderPanel('craft-empty-topics', seeds({ view: 'topics', craft: EMPTY_CRAFT_FIXTURE }))
renderPanel('craft-empty-works', seeds({ view: 'works', craft: EMPTY_CRAFT_FIXTURE }))
renderPanel('craft-empty-grow', seeds({ view: 'timeline', craft: EMPTY_CRAFT_FIXTURE }))
renderPanel('craft-failed', seeds({ view: 'materials', craft: EMPTY_CRAFT_FIXTURE, craftState: 'failed', craftError: '网络开小差了' }))
renderPanel('craft-scoped', seeds({ view: 'materials', scopeBookId: anyBook.bookId }))
// F2：换一本书进 CREATE，别的书的稿子不能跟过来。用一本夹具里不存在的书做
// 反证——按 scope 过滤后必须落到空态，而不是把 A 书的稿子留在屏幕上。
renderPanel('works-scoped-other', seeds({ view: 'works', scopeBookId: 'weread:book/999999999' }))
// B1/B4：时间线的事件行要能回到书；跨书选题降级；按书筛只留这本书的事件。
renderPanel('timeline-scoped', seeds({ view: 'timeline', scopeBookId: anyBook.bookId }))
renderPanel('timeline-scoped-other', seeds({ view: 'timeline', scopeBookId: 'weread:book/999999999' }))
renderPanel('timeline-cross', seeds({ view: 'timeline', craft: crossCraft() }))
renderPanel('book-chain-degraded', seeds({
  view: 'book',
  bookId: anyBook.bookId,
  craft: Object.assign({}, smokeCraft(), {
    bookIndex: [{ bookId: anyBook.bookId, bookTitle: anyBook.title, author: '', counts: { responses: 0, materials: 0, topics: 0, works: 0 }, cached: false }],
  }),
}))
// F-28 外观：没有「跟随 DSH」这一档了 —— 没设置（或写了不认识的名字）就渲染默认的 glacier。
const paletteState = (palette) => Object.assign({}, statePayload, { palette })
renderPanel('palette-default', seeds({ view: 'overview', state: paletteState('') }))
renderPanel('palette-night', seeds({ view: 'overview', state: paletteState('night') }))
renderPanel('palette-unknown', seeds({ view: 'overview', state: paletteState('neon-bogus') }))

// 导出面板只在点击之后才出现，所以直接拿模块里的组件挂载一次。
function renderStandalone(label, component, props, hookSeeds) {
  resetHooks(hookSeeds)
  const out = { text: '', tags: {}, components: new Set(), elements: [] }
  try {
    const tree = component(props)
    renderNode(tree, 0, out)
    drawCalls.push({ label, ok: true, text: out.text, tags: Object.keys(out.tags).length, nodes: Object.values(out.tags).reduce((a, b) => a + b, 0), textLength: out.text.length, components: [...out.components].join(','), elements: out.elements })
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

// 想法卡：墙视图长文折叠、来源完整、同章上下文按钮。
// ThoughtRow 的 useState 顺序：expanded, threadOpen
const thoughtGuards = []
if (typeof smoke.ThoughtRow !== 'function') thoughtGuards.push('client module 未暴露 ThoughtRow')
const longText = '关于这本书的这一段，我想了很久：' .repeat(20)
const thoughtBase = {
  id: 't1',
  bookId: 'b1',
  bookTitle: '一本名字很长很长的书，长到足以验证来源不会被截断',
  chapterName: '第一章',
  content: longText,
  createTime: 1794193279,
  star: -1,
}
const shortThought = { ...thoughtBase, id: 't2', content: '短想法' }
const contextNotes = [1, 2, 3].map((i) => ({ id: `n${i}`, text: `同章划线 ${i}`, createTime: 1794193279 }))
renderStandalone('thought-wall-long', smoke.ThoughtRow, { thought: thoughtBase, wall: true }, [false, false])
renderStandalone('thought-wall-expanded', smoke.ThoughtRow, { thought: thoughtBase, wall: true }, [true, false])
renderStandalone('thought-wall-short', smoke.ThoughtRow, { thought: shortThought, wall: true }, [false, false])
renderStandalone('thought-context-toggle', smoke.ThoughtRow, { thought: thoughtBase, wall: true, context: contextNotes }, [false, false])
renderStandalone('thought-context-open', smoke.ThoughtRow, { thought: thoughtBase, wall: true, context: contextNotes }, [false, true])
const longDraw = byLabel0('thought-wall-long')
if (!longDraw) thoughtGuards.push('thought-wall-long: 未渲染')
else {
  if (!longDraw.text.includes('thought.expand')) thoughtGuards.push('thought-wall-long: 长想法缺展开按钮')
  if (!longDraw.text.includes('一本名字很长很长的书')) thoughtGuards.push('thought-wall-long: 来源书名没有完整渲染')
}
const expandedDraw = byLabel0('thought-wall-expanded')
if (!expandedDraw) thoughtGuards.push('thought-wall-expanded: 未渲染')
else if (!expandedDraw.text.includes('thought.collapse')) thoughtGuards.push('thought-wall-expanded: 展开态缺收起按钮')
// 渲染桩会把超过 120 字的字符串截断，所以只能断言「展开按钮消失」，不能比长度。
else if (expandedDraw.text.includes('thought.expand')) thoughtGuards.push('thought-wall-expanded: 展开后仍显示展开按钮')
const shortDraw = byLabel0('thought-wall-short')
if (shortDraw && shortDraw.text.includes('thought.expand')) thoughtGuards.push('thought-wall-short: 短想法不该出现展开按钮')
if (byLabel0('thought-context-toggle') && !byLabel0('thought-context-toggle').text.includes('thought.contextToggle')) thoughtGuards.push('thought-context-toggle: 缺同章上下文按钮')
if (byLabel0('thought-context-open') && !byLabel0('thought-context-open').text.includes('thought.contextTitle')) thoughtGuards.push('thought-context-open: 展开后缺上下文标题')

// 来源包：字段齐、原文带引用、想法带同章上下文、缺书名不瞎猜、长文被截断。
const packGuards = []
if (typeof smoke.buildSourcePack !== 'function') packGuards.push('client module 未暴露 buildSourcePack')
else {
  const note = {
    id: 'n1',
    bookId: 'b1',
    bookTitle: '顾随诗词讲记',
    author: '顾随',
    chapterTitle: '开场白',
    text: '诗根本不是教训人的，是感动人的。'.repeat(80),
    createTime: 1794193279,
  }
  const notePack = smoke.buildSourcePack({ entry: note, kind: 'note', question: '这段话在说什么？' })
  for (const needle of ['think.packHead', 'think.packBook', '《顾随诗词讲记》', 'think.packAuthor', 'think.packChapter', 'think.packKindNote', 'think.packOriginal', 'think.packFoot']) {
    if (!notePack.includes(needle)) packGuards.push(`note pack: 缺 ${needle}`)
  }
  if (!notePack.includes('\n> ')) packGuards.push('note pack: 原文没有用引用块')
  if (!notePack.trimEnd().endsWith('这段话在说什么？')) packGuards.push('note pack: 问题没有放到末尾')
  if (notePack.length > 1600) packGuards.push(`note pack: 太长（${notePack.length} 字），原文没截断`)

  const thought = { id: 't1', bookId: 'b1', bookTitle: '书名', chapterName: '第一章', content: '我的想法', createTime: 1794193279 }
  const thoughtPack = smoke.buildSourcePack({
    entry: thought,
    kind: 'thought',
    context: [1, 2, 3, 4].map((i) => ({ id: `n${i}`, text: `同章 ${i}` })),
  })
  for (const needle of ['think.packKindThought', 'think.packMine', 'think.packContext', '1. 同章 1']) {
    if (!thoughtPack.includes(needle)) packGuards.push(`thought pack: 缺 ${needle}`)
  }
  if (thoughtPack.includes('4. 同章 4')) packGuards.push('thought pack: 上下文条数没有上限')

  const bare = smoke.buildSourcePack({ entry: { id: 'n2', text: '没有书名的划线' }, kind: 'note' })
  if (!bare.includes('think.packUnknown')) packGuards.push('bare pack: 缺书名时没有写明未记录')
  if (bare.includes('undefined') || bare.includes('null')) packGuards.push('bare pack: 出现了 undefined/null')

  // F-29：来源包按类型标角色——金句是书里的原文，不是我的想法。
  if (typeof smoke.packKindLabel !== 'function') packGuards.push('client module 未暴露 packKindLabel')
  else {
    const labels = ['note', 'thought', 'response', 'material'].map((kind) => smoke.packKindLabel(kind, '金句'))
    if (new Set(labels).size !== 4) packGuards.push(`角色标签有重复：${labels.join(' | ')}`)
    if (smoke.packKindLabel('note', '') !== 'think.packKindNote') packGuards.push('note 没落到「书里的原文」')
    if (smoke.packKindLabel('thought', '') !== 'think.packKindThought') packGuards.push('thought 没落到「我的想法」')
    if (smoke.packKindLabel('response', '') !== 'think.packKindResponse') packGuards.push('response 没落到「我采纳的 AI 回应」')
    const quoteLabel = smoke.packKindLabel('material', '金句')
    if (quoteLabel === 'think.packKindThought') packGuards.push('金句素材被标成了「我的想法」')
    for (const needle of ['think.packKindMaterialOf', 'think.packKindMaterial']) {
      if (!quoteLabel.includes(needle)) packGuards.push(`金句素材标签缺 ${needle}`)
    }
    if (!quoteLabel.includes('mat.type.quote')) packGuards.push('金句素材标签没带类型键')
    if (smoke.packKindLabel('mystery', '') !== smoke.packKindLabel('material', '')) {
      packGuards.push('判不出来的来源没有降级为「我整理的素材」')
    }
    const bogusLabel = smoke.packKindLabel('material', '读书笔记')
    if (bogusLabel !== 'think.packKindMaterial') packGuards.push(`未知素材类型没走中性标签：${bogusLabel}`)
    if (bogusLabel.includes('think.packKindMaterialOf')) packGuards.push('未知素材类型仍带了括号类型')
    if (smoke.packKindLabel('material', '观点').indexOf('mat.type.idea') < 0) packGuards.push('真「观点」素材反而丢了类型键')
    const quotePack = smoke.buildSourcePack({
      entry: { id: 'm1', bookTitle: '书名', text: '金句正文' },
      kind: 'material',
      type: '金句',
    })
    for (const needle of ['think.packKindMaterialOf', 'mat.type.quote', 'think.packFiled', '金句正文', 'think.packFoot']) {
      if (!quotePack.includes(needle)) packGuards.push(`金句 pack: 缺 ${needle}`)
    }
    if (quotePack.includes('think.packMine') || quotePack.includes('think.packOriginal')) {
      packGuards.push('金句 pack: 冒充了「我的想法」或「原文」')
    }
    const adoptedPack = smoke.buildSourcePack({ entry: { content: '采纳的回应的正文', bookTitle: '书名' }, kind: 'response' })
    for (const needle of ['think.packKindResponse', 'think.packAdopted']) {
      if (!adoptedPack.includes(needle)) packGuards.push(`回应 pack: 缺 ${needle}`)
    }
    if (adoptedPack.includes('think.packMine')) packGuards.push('回应 pack: 被标成了「我的想法」')
    const mixedPack = smoke.buildSourcePack({
      entry: note,
      kind: 'note',
      context: [
        { text: '同章想法', kind: 'thought' },
        { text: '金句素材', kind: 'material', type: '金句' },
      ],
    })
    if (!mixedPack.includes('think.packContextMixed')) packGuards.push('混合来源 pack: 缺「其他来源」抬头')
    if (!mixedPack.includes('1. think.packKindThought')) packGuards.push('混合来源 pack: 第 1 条没标角色')
    if (!mixedPack.includes('2. think.packKindMaterialOf')) packGuards.push('混合来源 pack: 第 2 条没标角色')
    const limits = smoke.THINK_LIMITS
    if (!limits || limits.body !== 600 || limits.context !== 3 || limits.contextEach !== 200) {
      packGuards.push('THINK_LIMITS 变了（应仍是 600/3/200）')
    }

    // F-32：同 type 的两条素材，一条是采纳 AI 回应整理出来的、一条是自己写的，
    // 进包以后标签必须不同，AI 那条必须带「AI」。取的是 buildSourcePack 的真实返回值。
    const aiMaterialPack = smoke.buildSourcePack({
      entry: { id: 'm-ai', bookTitle: '书名', text: 'AI 采纳来的金句' },
      kind: 'material',
      type: '金句',
      authorType: 'ai',
    })
    const humanMaterialPack = smoke.buildSourcePack({
      entry: { id: 'm-human', bookTitle: '书名', text: '自己写的金句' },
      kind: 'material',
      type: '金句',
      authorType: 'human',
    })
    const kindLineOf = (pack) => pack.split('\n').find((line) => line.startsWith('think.packKind')) || ''
    const aiKindLine = kindLineOf(aiMaterialPack)
    const humanKindLine = kindLineOf(humanMaterialPack)
    if (aiKindLine === '' || humanKindLine === '') packGuards.push('F-32: 素材 pack 没有内容类型行')
    else if (aiKindLine === humanKindLine) packGuards.push(`F-32: AI 素材与自写素材同标签（${aiKindLine}）`)
    if (aiKindLine.indexOf('AI') < 0) packGuards.push(`F-32: AI 素材标签不含「AI」（${aiKindLine}）`)
    if (humanKindLine.indexOf('AI') >= 0) packGuards.push(`F-32: 自写素材被标成了 AI（${humanKindLine}）`)
    if (!aiMaterialPack.includes('think.packFiledAI')) packGuards.push('F-32: AI 素材正文没有独立抬头')
    if (humanMaterialPack.includes('think.packFiledAI')) packGuards.push('F-32: 自写素材正文用了 AI 抬头')
    // 正文也不能挤在同一个标签下：两段正文各自跟随自己的抬头。
    const aiBodyIndex = aiMaterialPack.indexOf('AI 采纳来的金句')
    const aiHeadIndex = aiMaterialPack.indexOf('think.packFiledAI')
    if (aiHeadIndex < 0 || aiBodyIndex < 0 || aiHeadIndex > aiBodyIndex) {
      packGuards.push('F-32: AI 素材正文没跟在 AI 抬头后面')
    }
    // 缺字段 / 写错值一律按自写处理——宁可漏标，不能把用户的话标成 AI。
    for (const value of [undefined, '', 'human', 'AI', 'model', null]) {
      const label = smoke.packKindLabel('material', '金句', value)
      if (String(label).indexOf('AI') >= 0) packGuards.push(`F-32: authorType=${String(value)} 被误标成 AI`)
    }
    if (smoke.packKindLabel('material', '金句', 'ai') === smoke.packKindLabel('material', '金句', undefined)) {
      packGuards.push('F-32: 显式 ai 与缺省值没分开')
    }
    // 上下文条目也要分身份：同一条 pack 里 AI 素材与自写素材逐条带标。
    const aiContextPack = smoke.buildSourcePack({
      entry: note,
      kind: 'note',
      context: [
        { text: 'AI 侧素材', kind: 'material', type: '金句', authorType: 'ai' },
        { text: '自写侧素材', kind: 'material', type: '金句', authorType: 'human' },
      ],
    })
    const numbered = aiContextPack.split('\n').filter((line) => /^\d+\. /.test(line))
    if (numbered.length < 2) packGuards.push('F-32: 上下文条目没有逐条渲染')
    else {
      if (numbered[0].indexOf('AI') < 0) packGuards.push(`F-32: 上下文第 1 条（AI 素材）没有 AI 标记（${numbered[0]}）`)
      if (numbered[1].indexOf('AI') >= 0) packGuards.push(`F-32: 上下文第 2 条（自写素材）被标成 AI（${numbered[1]}）`)
      if (numbered[0] === numbered[1]) packGuards.push('F-32: 上下文中 AI 与自写素材同标签')
    }
    if (typeof smoke.materialAuthorIsAI !== 'function') packGuards.push('client module 未暴露 materialAuthorIsAI')
    else {
      if (smoke.materialAuthorIsAI('ai') !== true) packGuards.push('F-32: materialAuthorIsAI 认不出 ai')
      for (const value of ['AI', 'ai ', 'human', '', undefined, null, 'Ai'])
        if (smoke.materialAuthorIsAI(value) !== false) packGuards.push(`F-32: materialAuthorIsAI(${String(value)}) 误判为 true`)
    }
    // 上架的那句中文：AI 素材的说法里真的要出现「AI」，自写素材的说法里不能出现。
    const zhDict = (localeDictionaries && localeDictionaries.zh) || {}
    const enDict = (localeDictionaries && localeDictionaries.en) || {}
    for (const [name, dict] of [['zh', zhDict], ['en', enDict]]) {
      const aiText = String(dict['think.packKindMaterialAI'] || '')
      const humanText = String(dict['think.packKindMaterial'] || '')
      if (aiText === '') packGuards.push(`F-32: ${name} 缺 think.packKindMaterialAI`)
      else if (aiText.indexOf('AI') < 0) packGuards.push(`F-32: ${name} 的 AI 素材标签里没有「AI」（${aiText}）`)
      if (humanText.indexOf('AI') >= 0) packGuards.push(`F-32: ${name} 的自写素材标签里出现了「AI」（${humanText}）`)
      if (String(dict['think.packFiledAI'] || '').indexOf('AI') < 0) packGuards.push(`F-32: ${name} 的 AI 素材正文抬头没写「AI」`)
    }
    // 包尾：写了「其余 N 类」，括号里就得正好列 N 个角色；新增标签不能把这句话变成错数。
    const footZh = String(zhDict['think.packFoot'] || '')
    const footMatch = footZh.match(/其余([一二三四五六])类（([^）]+)）/)
    const countWord = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 }
    if (footZh === '') packGuards.push('F-32: zh 缺 think.packFoot')
    else if (!footMatch) packGuards.push('F-32: 包尾没有「其余 N 类（…）」句式，无法核对数量')
    else if (footMatch[2].split('/').length !== countWord[footMatch[1]]) {
      packGuards.push(`F-32: 包尾说「其余${footMatch[1]}类」但列了 ${footMatch[2].split('/').length} 个`)
    }
    if (footZh.indexOf('AI') < 0) packGuards.push('F-32: 包尾没有说明「带 AI 字样的素材来自采纳」')

    // 真正的漏洞点在 paragraphSourceEntry：它曾经把 authorType 丢掉。这里走
    // buildParagraphPack 的完整链路（sourceId → 素材 → pack），而不是直接调 buildSourcePack。
    if (typeof smoke.buildParagraphPack !== 'function') packGuards.push('client module 未暴露 buildParagraphPack')
    else {
      // 正文别带「AI」两个字：这里要验的是标签，不是素材正文里的巧合。
      const aiMat = { id: 'm_ai', type: '金句', text: '采纳来的金句', bookTitle: '书名', author: '作者', authorType: 'ai', createdAt: 1794193279 }
      const humanMat = { id: 'm_h', type: '金句', text: '我自己写的金句', bookTitle: '书名', author: '作者', authorType: 'human', createdAt: 1794193279 }
      const plainMat = { id: 'm_plain', type: '金句', text: '没写作者身份的素材', bookTitle: '书名', author: '作者', createdAt: 1794193279 }
      const paraLookup = {
        note: new Map(),
        thought: new Map(),
        response: new Map(),
        material: new Map([[aiMat.id, aiMat], [humanMat.id, humanMat], [plainMat.id, plainMat]]),
      }
      const chainPack = smoke.buildParagraphPack({
        sourceIds: [`material:${plainMat.id}`, `material:${humanMat.id}`, `material:${aiMat.id}`],
        lookup: paraLookup,
        titleOf: () => '书名',
      })
      const chainLines = chainPack.split('\n').filter((line) => /^\d+\. /.test(line))
      if (chainLines.length < 2) packGuards.push('F-32: buildParagraphPack 没有带出两条上下文')
      else {
        if (chainLines[0].indexOf('AI') >= 0) packGuards.push(`F-32: buildParagraphPack 把自写素材标成了 AI（${chainLines[0]}）`)
        if (chainLines[1].indexOf('AI') < 0) packGuards.push(`F-32: buildParagraphPack 丢了 AI 素材的身份（${chainLines[1]}）`)
      }
      // 段落只有一条 AI 素材时，正文抬头也得是 AI 那一句。
      const aiOnly = smoke.buildParagraphPack({ sourceIds: [`material:${aiMat.id}`], lookup: paraLookup, titleOf: () => '书名' })
      if (!aiOnly.includes('think.packFiledAI')) packGuards.push('F-32: 单条 AI 素材的段落没有 AI 正文抬头')
      // 身份缺失的素材按自写处理。
      const plainOnly = smoke.buildParagraphPack({ sourceIds: [`material:${plainMat.id}`], lookup: paraLookup, titleOf: () => '书名' })
      if (plainOnly.indexOf('AI') >= 0) packGuards.push('F-32: 没写 authorType 的素材被标成了 AI')
    }
  }
}

// 内联对话卡：原地弹出、带上下文、有 ×、有输入框、等待态有提示。
// AskCard 的 useState 顺序：messages, draft, busy, error, model, packOpen
const askGuards = []
if (typeof smoke.AskCard !== 'function') askGuards.push('client module 未暴露 AskCard')
const packText = smoke.buildSourcePack
  ? smoke.buildSourcePack({ entry: thoughtBase, kind: 'thought', context: contextNotes })
  : '【书房来源包】'
renderStandalone('ask-empty', smoke.AskCard, { pack: packText, entry: thoughtBase, kind: 'thought', question: '', anchor: { x: 40, y: 120 }, onClose() {} }, [[], '', false, '', '', ''])
renderStandalone('ask-answer', smoke.AskCard, { pack: packText, entry: thoughtBase, kind: 'thought', question: '', anchor: { x: 40, y: 120 }, onClose() {} }, [[{ role: 'user', text: '这句话怎么理解' }, { role: 'assistant', text: '它在说诗要打动人' }], '', false, '', 'deepseek-flash', 'explain'])
renderStandalone('ask-busy', smoke.AskCard, { pack: packText, entry: thoughtBase, kind: 'thought', question: '', anchor: { x: 40, y: 120 }, onClose() {} }, [[{ role: 'user', text: '再想想' }, { role: 'assistant', text: '' }], '', true, '', '', ''])
const askEmpty = byLabel0('ask-empty')
if (!askEmpty) askGuards.push('ask-empty: 未渲染')
else {
  for (const needle of ['×', 'think.empty', 'think.send', 'think.aiNote', 'think.mode.explain', 'think.mode.custom'])
    if (!askEmpty.text.includes(needle)) askGuards.push('ask-empty: 缺 ' + needle)
  if (!askEmpty.text.includes('一本名字很长很长的书')) askGuards.push('ask-empty: 缺书名上下文')
  if (!askEmpty.text.includes('第一章')) askGuards.push('ask-empty: 缺章节上下文')
}
const askAnswer = byLabel0('ask-answer')
if (!askAnswer) askGuards.push('ask-answer: 未渲染')
else {
  for (const needle of ['这句话怎么理解', '它在说诗要打动人', 'deepseek-flash', '×'])
    if (!askAnswer.text.includes(needle)) askGuards.push('ask-answer: 缺 ' + needle)
}
if (askAnswer && !askAnswer.text.includes('ask.adoptHint')) askGuards.push('ask-answer: 缺采纳出口（F-20）')
const askBusy = byLabel0('ask-busy')
if (askBusy && !askBusy.text.includes('think.thinking')) askGuards.push('ask-busy: 等待态缺提示')

// 预检已经拆掉：入口永远可点，失败由真实请求给出错误 + 一次重试。
// 这里渲染「已经失败过一轮」的卡片：错误原文与重试按钮都在，四个胶囊与发送键都不置灰。
renderStandalone(
  'ask-error',
  smoke.AskCard,
  { pack: packText, entry: thoughtBase, kind: 'thought', question: '', anchor: { x: 40, y: 120 }, onClose() {} },
  [[{ role: 'user', text: '这句话怎么理解' }, { role: 'assistant', text: '' }], '写点什么', false, 'provider rate limited (429)', '', ''],
)
{
  const errorDraw = byLabel0('ask-error')
  if (!errorDraw) askGuards.push('ask-error: 未渲染')
  else {
    const elements = errorDraw.elements || []
    const chips = elements.filter((el) => String(el.props.className || '').indexOf('wr-ask-chip') >= 0)
    const sends = elements.filter((el) => String(el.props.className || '') === 'wr-ask-send')
    const retries = elements.filter((el) => String(el.props.className || '') === 'wr-ask-retry')
    if (chips.length < 4) askGuards.push(`ask-error: 只有 ${chips.length} 个胶囊`)
    else if (chips.some((el) => el.props.disabled === true)) askGuards.push('ask-error: 出错后胶囊被置灰（入口不该不可点）')
    if (sends.length === 0) askGuards.push('ask-error: 找不到发送键')
    else if (!sends.every((el) => el.props.disabled === false)) askGuards.push('ask-error: 出错后发送键被置灰')
    if (!errorDraw.text.includes('provider rate limited (429)')) askGuards.push('ask-error: 没有显示真实错误原文')
    if (retries.length !== 1) askGuards.push(`ask-error: 重试按钮数量是 ${retries.length}`)
    else if (retries[0].tag !== 'button' || typeof retries[0].props.onClick !== 'function')
      askGuards.push('ask-error: 重试按钮不可点')
    if (errorDraw.text.includes('wr-ask-offline')) askGuards.push('ask-error: 不该再有置灰提示条')
    // 就地展开：卡片只是记录卡里的普通块，不再按视口坐标浮起来。
    const card = elements.find((el) => String(el.props.className || '') === 'wr-ask')
    if (!card) askGuards.push('ask-error: 找不到对话卡根节点')
    else {
      if (card.props['data-inline'] !== 'true') askGuards.push('ask-error: 对话卡没有就地展开标记（data-inline）')
      if (card.props.style !== undefined) askGuards.push('ask-error: 对话卡还带着浮层定位的内联坐标')
    }
  }
}
// 布局只能从样式表看：.wr-ask 必须是文档流里的块，且自带 max-height + 内部滚动。
const askCssBlock = (() => {
  const at = code.indexOf('.wr-ask{')
  if (at < 0) return ''
  const end = code.indexOf('}', at)
  return end > at ? code.slice(at, end) : ''
})()
if (askCssBlock === '') {
  askGuards.push('CSS: 找不到 .wr-ask 规则')
} else {
  if (askCssBlock.indexOf('position:fixed') >= 0) askGuards.push('CSS: .wr-ask 还是 position:fixed 浮层')
  if (askCssBlock.indexOf('position:relative') < 0) askGuards.push('CSS: .wr-ask 不在文档流里（缺 position:relative）')
  if (askCssBlock.indexOf('max-height') < 0) askGuards.push('CSS: .wr-ask 没有 max-height，长回答会把输入框顶出屏幕')
  if (askCssBlock.indexOf('max-width:480px') < 0) askGuards.push('CSS: .wr-ask 的宽度上限不是 480px')
}
if (code.indexOf('askPosition') >= 0) askGuards.push('CSS: 还在按视口坐标摆卡片（askPosition 未删）')
if (code.indexOf("request('/chat/models')") >= 0) askGuards.push('预检: 客户端还在请求 /chat/models')

// F3：段落、回应、素材、选题上的来源 chip 都要能点回原物（带出处定位）。
const worksDraw = byLabel0('works')
if (worksDraw) {
  const srcChips = (worksDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-src' || String(el.props.className || '') === 'wr-src wr-src-empty')
  const clickable = srcChips.filter((el) => el.tag === 'button' && typeof el.props.onClick === 'function')
  if (srcChips.length === 0) askGuards.push('works: 段落没有渲染来源 chip')
  else if (clickable.length !== srcChips.length) askGuards.push(`works: ${srcChips.length} 个来源 chip 只有 ${clickable.length} 个可点（F3）`)
} else {
  askGuards.push('works: 未渲染，无法断言来源 chip')
}

// F-20 第二个出口：从想法直接收为素材，降级①要能看到「同章摘录」选择器与跳过。
if (typeof smoke.MaterialPicker === 'function') {
  renderStandalone('material-picker', smoke.MaterialPicker, { entry: thoughtBase, kind: 'thought', context: contextNotes, onClose() {} }, ['观点', '', false, ''])
  const picker = byLabel0('material-picker')
  if (!picker) askGuards.push('material-picker: 未渲染')
  else {
    for (const needle of ['mat.picker.title', 'mat.picker.skip', 'mat.picker.save', 'mat.type.idea'])
      if (!picker.text.includes(needle)) askGuards.push('material-picker: 缺 ' + needle)
    if (!picker.text.includes('同章划线 1')) askGuards.push('material-picker: 缺同章摘录上下文')
  }
} else {
  askGuards.push('client module 未暴露 MaterialPicker')
}

// F-23：段落行上的「AI 补写这一段」。三种状态都要能一眼看出：能写、无模型、
// 没有出处；草稿在采纳之前只是草稿（带 AI 标记与三个出口）。
const paragraphGuards = []
if (typeof smoke.ParagraphAI === 'function') {
  const aiCraft = smokeCraft()
  const aiMaterial = aiCraft.materials[0]
  const aiLookup = {
    note: new Map(),
    thought: new Map(),
    response: new Map(),
    material: new Map([[aiMaterial.id, aiMaterial]]),
  }
  const aiProps = {
    work: { id: aiCraft.works[0].id, title: aiCraft.works[0].title },
    paragraph: aiCraft.works[0].paragraphs[0],
    sourceIds: [`material:${aiMaterial.id}`],
    lookup: aiLookup,
    titleOf: () => aiMaterial.bookTitle,
    onAdopt: () => Promise.resolve(),
  }
  renderStandalone('paragraph-ai', smoke.ParagraphAI, aiProps, [true, 'done', '秩序感先给画面，再给判断。', '', false])
  renderStandalone('paragraph-ai-error', smoke.ParagraphAI, aiProps, [true, 'error', '', 'provider rate limited (429)', false])
  renderStandalone('paragraph-ai-nosource', smoke.ParagraphAI, Object.assign({}, aiProps, { sourceIds: [] }), [false, '', '', '', false])
  const aiDraw = byLabel0('paragraph-ai')
  if (!aiDraw) paragraphGuards.push('paragraph-ai: 未渲染')
  else {
    for (const needle of ['work.aiDraft', 'work.aiAdopt', 'work.aiRetry', 'work.aiDiscard', '秩序感先给画面'])
      if (!aiDraw.text.includes(needle)) paragraphGuards.push('paragraph-ai: 缺 ' + needle)
    const triggers = (aiDraw.elements || []).filter((el) => String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
    if (triggers.length === 0) paragraphGuards.push('paragraph-ai: 缺「AI 补写这一段」入口')
    else if (triggers.some((el) => el.tag !== 'button' || typeof el.props.onClick !== 'function'))
      paragraphGuards.push('paragraph-ai: 入口不是可点的 button')
    const keeps = (aiDraw.elements || []).filter((el) => el.tag === 'button' && String(el.props.children || '') === 'work.aiAdopt')
    if (keeps.length === 0) paragraphGuards.push('paragraph-ai: 草稿没有「采纳」出口')
  }
  const aiError = byLabel0('paragraph-ai-error')
  if (!aiError) paragraphGuards.push('paragraph-ai-error: 未渲染')
  else {
    const triggers = (aiError.elements || []).filter((el) => String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
    if (triggers.length === 0) paragraphGuards.push('paragraph-ai-error: 缺入口')
    else if (triggers.some((el) => el.props.disabled === true)) paragraphGuards.push('paragraph-ai-error: 失败后入口被置灰（预检已拆，入口该一直可点）')
    if (!aiError.text.includes('provider rate limited (429)')) paragraphGuards.push('paragraph-ai-error: 没有显示真实错误原文')
    const retries = (aiError.elements || []).filter((el) => el.tag === 'button' && String(el.props.children || '') === 'work.aiRetry')
    if (retries.length === 0) paragraphGuards.push('paragraph-ai-error: 失败后没有重试按钮')
    else if (typeof retries[0].props.onClick !== 'function') paragraphGuards.push('paragraph-ai-error: 重试按钮不可点')
  }
  const aiNoSource = byLabel0('paragraph-ai-nosource')
  if (!aiNoSource) paragraphGuards.push('paragraph-ai-nosource: 未渲染')
  else {
    const triggers = (aiNoSource.elements || []).filter((el) => String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
    if (triggers.length === 0) paragraphGuards.push('paragraph-ai-nosource: 缺入口')
    else if (!triggers.every((el) => el.props.disabled === true)) paragraphGuards.push('paragraph-ai-nosource: 没出处时入口没有置灰')
    if (!aiNoSource.text.includes('work.aiNeedSource')) paragraphGuards.push('paragraph-ai-nosource: 没出处时没有说明')
  }
} else {
  paragraphGuards.push('client module 未暴露 ParagraphAI')
}

// F-28 外观：只有一支选择器、五套预设，默认就是 glacier（没有「跟随 DSH」这一档）。
// SettingsModal 的 useState 顺序：key, maxBooks, notesPerBook, busy, message, dir, dataMessage, pending, busyData
const paletteGuards = []
if (typeof smoke.SettingsModal !== 'function') {
  paletteGuards.push('client module 未暴露 SettingsModal')
} else {
  renderStandalone('settings-palette', smoke.SettingsModal, {
    state: Object.assign({}, statePayload, { palette: 'night' }),
    onClose() {},
    onChanged() {},
    onDataChanged() {},
    onSyncStarted() {},
    onPalette() {},
  }, ['', '60', '200', false, '', 'D:/tmp/exports', '', null, false])
  const settingsDraw = byLabel0('settings-palette')
  if (!settingsDraw) paletteGuards.push('settings-palette: 未渲染')
  else {
    for (const needle of ['appearance.title', 'appearance.hint', 'appearance.glacier', 'appearance.night'])
      if (!settingsDraw.text.includes(needle)) paletteGuards.push('settings-palette: 缺 ' + needle)
    for (const gone of ['appearance.follow', 'appearance.cream'])
      if (settingsDraw.text.includes(gone)) paletteGuards.push('settings-palette: 退役选项又出现了 —— ' + gone)
    const selects = (settingsDraw.elements || []).filter((el) => el.tag === 'select' && String(el.props.className || '').indexOf('wr-palette-select') >= 0)
    if (selects.length !== 1) paletteGuards.push(`settings-palette: 期望 1 支外观选择器，实际 ${selects.length}`)
    else {
      const options = (settingsDraw.elements || []).filter((el) => el.tag === 'option')
      const values = [...new Set(options.map((el) => el.props.value))]
      const expected = ['glacier', 'mint', 'night', 'mist', 'iris']
      if (values.length !== expected.length || expected.some((name) => values.indexOf(name) < 0))
        paletteGuards.push(`settings-palette: 选项不是五套（${values.join(',')}）`)
      if (selects[0].props.value !== 'night') paletteGuards.push('settings-palette: 选择器没跟着 state.palette 走')
      if (typeof selects[0].props.onChange !== 'function') paletteGuards.push('settings-palette: 选择器不可选')
    }
    // 除此之外不能再有第二个主题开关（深色/字重之类）。
    const switches = (settingsDraw.elements || []).filter((el) => ['checkbox', 'radio'].indexOf(el.props.type) >= 0)
    if (switches.length > 0) paletteGuards.push('settings-palette: 多出了第二个主题开关')
  }
}
const paletteOf = smoke.paletteOf
if (typeof paletteOf !== 'function') paletteGuards.push('client module 未暴露 paletteOf')
else {
  if (paletteOf('night') !== 'night') paletteGuards.push('paletteOf: 认不出 night')
  if (paletteOf('neon-bogus') !== 'glacier') paletteGuards.push('paletteOf: 未知值没有回落 glacier')
  if (paletteOf(undefined) !== 'glacier') paletteGuards.push('paletteOf: 缺省不是 glacier')
  if (paletteOf('cream') !== 'glacier') paletteGuards.push('paletteOf: 退役的 cream 没有回落到 glacier')
  if (paletteOf('follow') !== 'glacier') paletteGuards.push('paletteOf: 退役的 follow 没有回落到 glacier')
}
const rootOf = (label) => {
  const draw = byLabel0(label)
  if (!draw) return null
  return (draw.elements || []).find((el) => String(el.props.className || '') === 'wr-root') || null
}
const defaultRoot = rootOf('palette-default')
if (!defaultRoot) paletteGuards.push('palette-default: 没找到根节点')
else if (defaultRoot.props['data-palette'] !== 'glacier') paletteGuards.push('palette-default: 没设置时根节点不是 glacier')
const nightRoot = rootOf('palette-night')
if (!nightRoot) paletteGuards.push('palette-night: 没找到根节点')
else if (nightRoot.props['data-palette'] !== 'night') paletteGuards.push('palette-night: 根节点没有 data-palette=night')
const unknownRoot = rootOf('palette-unknown')
if (!unknownRoot) paletteGuards.push('palette-unknown: 没找到根节点')
else if (unknownRoot.props['data-palette'] !== 'glacier') paletteGuards.push('palette-unknown: 未知配色没有回落 glacier')
// 样式表里不许再留 cream 的 token 块（整套退役），也不许再出现 follow 这个状态。
if (code.indexOf('.wr-root[data-palette="cream"]') >= 0) paletteGuards.push('CSS: cream 的 token 块还在')
if (code.indexOf("data-palette', name") >= 0 && code.indexOf("=== 'follow' ? {}") >= 0) paletteGuards.push('CSS: 跟随 DSH 的分支还在')

// 四段旅程：二层导航、六个内页、三个空/失败态、书页链路块。
// 这里只声明断言队列，真正的求值放到 guards 初始化之后（checkJourneys）。
const journeyGuards = []
const CRAFT_STAGE = { responses: 'think', materials: 'create', topics: 'create', works: 'create', timeline: 'grow', annual: 'grow' }
function checkJourneys(guards, byLabel, bookDraw) {
  for (const label of ['responses', 'materials', 'topics', 'works', 'timeline', 'annual']) {
    const draw = byLabel(label)
    if (!draw) { journeyGuards.push(`${label}: 未渲染`); continue }
    // 两层导航在每一个内页上都得在：第一行四个旅程 + 第二行当前旅程的口径说明。
    for (const needle of ['nav.read', 'nav.think', 'nav.create', 'nav.grow']) {
      if (!draw.text.includes(needle)) journeyGuards.push(`${label}: 缺旅程标签 ${needle}`)
    }
    const stage = CRAFT_STAGE[label]
    if (!draw.text.includes(`journey.${stage}.hint`)) journeyGuards.push(`${label}: 第二行导航缺 journey.${stage}.hint`)
  }
  if (byLabel('responses') && !byLabel('responses').text.includes('thinkView.hint')) journeyGuards.push('responses: 缺「对话不落盘」的口径')
  if (byLabel('materials') && !byLabel('materials').text.includes('mat.type.quote')) journeyGuards.push('materials: 缺类型筛选')
  if (byLabel('topics') && !byLabel('topics').text.includes('topic.count')) journeyGuards.push('topics: 缺计数')
  if (byLabel('works') && !byLabel('works').text.includes('work.export')) journeyGuards.push('works: 缺导出按钮')
  if (byLabel('timeline') && !byLabel('timeline').text.includes('grow.total')) journeyGuards.push('timeline: 缺事件总数')
  if (byLabel('annual') && !byLabel('annual').text.includes('grow.annual.title')) journeyGuards.push('annual: 缺年度回顾标题')
  // 空库：每段都是一句下一步 + 一个按钮，不能只剩一个「暂无数据」。
  const emptyExpect = {
    'craft-empty': ['mat.empty.title', 'mat.empty.next', 'mat.empty.action'],
    'craft-empty-think': ['thinkView.empty.title', 'thinkView.empty.next', 'thinkView.empty.action'],
    'craft-empty-topics': ['topic.empty.title', 'topic.empty.next', 'topic.empty.action'],
    'craft-empty-works': ['work.empty.title', 'work.empty.next', 'work.empty.action'],
    'craft-empty-grow': ['grow.empty.title', 'grow.empty.next'],
  }
  for (const [label, needles] of Object.entries(emptyExpect)) {
    const draw = byLabel(label)
    if (!draw) { journeyGuards.push(`${label}: 未渲染`); continue }
    for (const needle of needles) if (!draw.text.includes(needle)) journeyGuards.push(`${label}: 缺 ${needle}`)
  }
  const failedDraw = byLabel('craft-failed')
  if (!failedDraw) journeyGuards.push('craft-failed: 未渲染')
  else {
    for (const needle of ['craft.failed', 'craft.retry'])
      if (!failedDraw.text.includes(needle)) journeyGuards.push(`craft-failed: 缺 ${needle}`)
    // 写作侧取数失败不能污染 READ：旅程导航仍然在。
    if (!failedDraw.text.includes('nav.read')) journeyGuards.push('craft-failed: 旅程导航被拖垮')
  }
  if (byLabel('craft-scoped') && !byLabel('craft-scoped').text.includes('thinkView.backBook')) journeyGuards.push('craft-scoped: 按书过滤时没写明「回到哪本书」')
  // 书页的六段链路块，以及「书已掉出同步窗口」的降级交代。
  if (bookDraw && !bookDraw.text.includes('chain.title')) guards.push('book: 缺「这本书的读写链路」')
  if (bookDraw && !bookDraw.text.includes('synced.at')) guards.push('book: 缺微读更新时间')
  const degradedDraw = byLabel('book-chain-degraded')
  if (!degradedDraw) journeyGuards.push('book-chain-degraded: 未渲染')
  else {
    if (!degradedDraw.text.includes('chain.cached')) journeyGuards.push('book-chain-degraded: 掉出缓存时没有交代')
    if (!degradedDraw.text.includes('chain.title')) journeyGuards.push('book-chain-degraded: 缺链路块')
  }
  // 页脚两个时间各说各话。
  if (byLabel('materials') && !byLabel('materials').text.includes('synced.craftAt')) journeyGuards.push('materials: 缺创作更新时间')

  // B1：时间线的每一条都得能回到产生它的那本书，跨书的事件降级成不可点而不是假装可点。
  const tlItems = (label) =>
    ((byLabel(label) || {}).elements || []).filter((el) => String(el.props.className || '').split(' ').includes('wr-tl-item'))
  const timelineItems = tlItems('timeline')
  if (timelineItems.length < 4) journeyGuards.push(`timeline: 事件行太少（${timelineItems.length}）`)
  if (timelineItems.some((el) => el.tag !== 'button')) journeyGuards.push('timeline: 事件行不是可点 button')
  if (!timelineItems.some((el) => el.tag === 'button' && typeof el.props.onClick === 'function' && el.props.disabled !== true))
    journeyGuards.push('timeline: 没有任何一条能点回书页')
  if (!timelineItems.some((el) => el.props['data-kind'] === 'work' && el.props.disabled !== true))
    journeyGuards.push('timeline: 作品事件不能点回书页')
  const crossItems = tlItems('timeline-cross')
  if (!crossItems.some((el) => el.props['data-cross'] === 'true' && el.props.disabled === true))
    journeyGuards.push('timeline-cross: 跨书事件没有降级为不可点')
  if (byLabel('timeline-cross') && !byLabel('timeline-cross').text.includes('grow.cross')) journeyGuards.push('timeline-cross: 缺「跨书」标注')

  // B4：把一本书放进 GROW，时间线只留这本书的事件；别的书进来必须是空态。
  const scopedTimeline = tlItems('timeline-scoped')
  if (scopedTimeline.length !== timelineItems.length) journeyGuards.push(`timeline-scoped: 该书的 4 条事件没全留下（${scopedTimeline.length}）`)
  if (scopedTimeline.some((el) => el.props['data-cross'] === 'true')) journeyGuards.push('timeline-scoped: 按书过滤后不该还有跨书事件')
  if (byLabel('timeline-scoped') && !byLabel('timeline-scoped').text.includes('thinkView.scope')) journeyGuards.push('timeline-scoped: 没写明只看这本书')
  if (byLabel('timeline-scoped-other') && !byLabel('timeline-scoped-other').text.includes('grow.empty.title'))
    journeyGuards.push('timeline-scoped-other: 别的书的事件串进了这本书的时间线')

  // B3：素材类型可以在原位改，不需要另开编辑面板。
  const typeSwitches = ((byLabel('materials') || {}).elements || []).filter((el) =>
    String(el.props.className || '').split(' ').includes('wr-type-switch'),
  )
  if (typeSwitches.length === 0) journeyGuards.push('materials: 素材没有改类型的入口')
  else {
    const sw = typeSwitches[0]
    if (sw.tag !== 'select' || typeof sw.props.onChange !== 'function') journeyGuards.push('materials: 改类型入口不是可用的 select')
    const options = ((byLabel('materials') || {}).elements || []).filter((el) => el.tag === 'option')
    if (options.length < 6) journeyGuards.push(`materials: 改类型只有 ${options.length} 个选项`)
  }

  // B5：选题上的书名是回到那本书的入口。
  const topicBookButtons = ((byLabel('topics') || {}).elements || []).filter(
    (el) => el.tag === 'button' && String(el.props.className || '').split(' ').includes('wr-chip') && typeof el.props.onClick === 'function',
  )
  if (topicBookButtons.length === 0) journeyGuards.push('topics: 书名不是可点的入口')

  // B6：年度回顾要能说出「这一年」，也要能把这一年导出去。
  const annualDraw = byLabel('annual')
  if (annualDraw) {
    for (const needle of ['grow.annual.title', 'grow.annual.export', 'grow.annual.note']) {
      if (!annualDraw.text.includes(needle)) journeyGuards.push(`annual: 缺 ${needle}`)
    }
    const exportButton = (annualDraw.elements || []).find(
      (el) => el.tag === 'button' && typeof el.props.onClick === 'function' && String(el.props.title || '').includes('grow.annual'),
    )
    if (!exportButton) journeyGuards.push('annual: 没有「导出这一年」按钮')
  }

  // F2：作品按「段落 → 来源 → 书」推导归属；换一本书进 CREATE 时，
  // A 书的稿子不能出现在 B 书的链路里（空态才是正确答案）。
  const worksAll = byLabel('works')
  const worksOther = byLabel('works-scoped-other')
  const smokeWorkTitle = '为什么读过的书记不住'
  if (!worksAll) journeyGuards.push('works: 未渲染')
  else if (!worksAll.text.includes(smokeWorkTitle)) journeyGuards.push('works: 不按书过滤时应列出全部稿子')
  if (!worksOther) journeyGuards.push('works-scoped-other: 未渲染')
  else {
    if (worksOther.text.includes(smokeWorkTitle)) journeyGuards.push('works-scoped-other: 按书过滤后仍出现别的书的稿子（F2）')
    if (!worksOther.text.includes('work.empty.title')) journeyGuards.push('works-scoped-other: 没有落到空态')
  }
}

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
for (const item of thoughtGuards) guards.push(item)
for (const item of packGuards) guards.push(item)
for (const item of askGuards) guards.push(item)
checkJourneys(guards, byLabel, bookDraw)
for (const item of journeyGuards) guards.push(item)
for (const item of paragraphGuards) guards.push(item)
for (const item of paletteGuards) guards.push(item)
console.log('[guards] %s', guards.length === 0 ? 'ok' : guards.join(' | '))

const failed = drawCalls.filter((item) => !item.ok)
console.log('\n=== summary ===')
console.log('rendered %d/%d views, %d failed', drawCalls.length - failed.length, drawCalls.length, failed.length)
for (const item of failed) console.log(' - %s: %s', item.label, item.error)
process.exit(failed.length === 0 && guards.length === 0 ? 0 : 1)