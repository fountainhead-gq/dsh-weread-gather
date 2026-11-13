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
// Setters are no-ops here (nothing re-renders), but recording them lets a guard
// tell "this button calls setState" from "this button does nothing".
let smokeSetters = []
function resetHooks(seeds) {
  hookSeeds = seeds || []
  hookIndex = 0
  smokeSetters = []
}
const ReactShim = {
  Fragment: '__fragment__',
  createElement: makeH(),
  useState(initial) {
    const at = hookIndex
    const seeded = hookSeeds[hookIndex]
    hookIndex += 1
    return [
      seeded === undefined ? initial : seeded,
      (updater) => {
        smokeSetters.push({ at, updater })
      },
    ]
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
// F-35：默认渲染文本里出现的是 locale key（断言好写），但「标签是不是中文、
// 有没有把 src.xxx 直接印出来」这类事故只有用真实文案才看得见，所以留一个开关。
let localeText = false
const localeDictionaries = {}
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
      if (dictionaries && typeof dictionaries === 'object') {
        localeDictionaries.zh = dictionaries.zh || localeDictionaries.zh
        localeDictionaries.en = dictionaries.en || localeDictionaries.en
      }
    },
    bind() {
      return (key, params) => {
        if (localeText) {
          const template = (localeDictionaries.zh || {})[key]
          if (typeof template === 'string') {
            if (!params) return template
            return template.replace(/\{(\w+)\}/g, (all, name) => (params[name] === undefined ? all : String(params[name])))
          }
        }
        return params ? `${key}(${Object.values(params).join(',')})` : key
      }
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
const EMPTY_CRAFT_FIXTURE = { hasCraft: false, revision: 0, updatedAt: 0, counts: { responses: 0, materials: 0, topics: 0, works: 0 }, responses: [], materials: [], topics: [], works: [], relations: [], threads: [], bookIndex: [] }
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
    // 1.2.2：素材/选题还在文件里（旧作品的溯源链要用），但界面不再显示它们。
    // 夹具故意留着这两类数据，这样「时间线/链路/计数里没有它们」是可验证的。
    bookIndex: [{
      bookId: book.bookId,
      bookTitle: book.title,
      author: book.author || '',
      counts: { responses: 1, materials: 1, topics: 1, works: 1 },
      cached: true,
    }],
    relations: [],
    threads: [],
  }
}
// 一本书的素材 + 另一本书的素材被同一篇初稿引用：时间线上这条必须降级成「跨书」。
function crossCraft() {
  const base = smokeCraft()
  const other = 'weread:book/888888888'
  const material = base.materials[0]
  base.materials = base.materials.concat([Object.assign({}, material, { id: 'm_smoke2', bookId: other, bookTitle: '另一本书' })])
  const work = base.works[0]
  base.works = [Object.assign({}, work, {
    id: 'w_smoke2',
    title: '跨两本书的初稿',
    paragraphs: work.paragraphs.concat([{
      id: 'p_smoke2',
      text: '第二段：引另一本书。',
      sourceIds: ['material:m_smoke2'],
      ai: false,
      aiOriginIds: [],
      editedAt: 0,
    }]),
  })].concat(base.works)
  return base
}
// 时间线夹具：三个月、四种动作、一条没有书归属、一篇跨两本书的稿子。
// 时间写死，月份分组才是可断言的（不跟着今天跑）。
function timelineFixture() {
  const at = (iso) => Math.floor(Date.parse(iso) / 1000)
  const bookA = { bookId: 'weread:book/T1', title: '时间线之书', author: '作者甲' }
  const bookB = { bookId: 'weread:book/T2', title: '另一本', author: '作者乙' }
  const data = {
    books: [bookA, bookB],
    notes: [],
    thoughts: [
      { id: 'th_t1', bookId: bookA.bookId, chapterName: '第一卷', content: '三月的想法：把整段文字放上来，看它会不会在第二行被截断。'.repeat(2), createTime: at('2026-03-05T10:20:00Z') },
      { id: 'th_t2', bookId: bookA.bookId, chapterName: '第二卷', content: '一月的想法。', createTime: at('2026-01-09T08:05:00Z') },
      { id: 'th_t3', bookId: '', chapterName: '', content: '没有书归属的想法。', createTime: at('2026-01-02T09:00:00Z') },
    ],
    counts: { notes: 0, thoughts: 3 },
  }
  const craft = {
    hasCraft: true,
    revision: 3,
    updatedAt: at('2026-03-06T00:00:00Z'),
    counts: { responses: 1, materials: 0, topics: 0, works: 2 },
    responses: [{
      id: 'r_t1',
      bookId: bookA.bookId,
      bookTitle: bookA.title,
      author: bookA.author,
      sourceIds: [],
      text: '采纳的一句回应。',
      origin: 'think',
      containsAI: true,
      model: 'gpt-4o-mini',
      promptVersion: 'think-v1',
      adoptedAt: at('2026-03-06T21:40:00Z'),
      createdAt: at('2026-03-06T21:40:00Z'),
    }],
    materials: [],
    topics: [],
    works: [
      // 更新更早的那篇更新，默认选中它是第一次；从时间线点它时 focusWorkId 必须赢。
      { id: 'w_t1', title: '单书初稿', status: 'confirmed', exportId: 'craft:work/w_t1', containsAI: false, paragraphs: [{ id: 'p_t1', text: '单书的一段。', sourceIds: ['note:n_t1'], ai: false, aiOriginIds: [], editedAt: 0 }], createdAt: at('2026-02-20T11:00:00Z'), updatedAt: at('2026-02-20T11:00:00Z'), confirmedAt: at('2026-02-20T11:30:00Z') },
      { id: 'w_t2', title: '跨两本书的初稿', status: 'draft', exportId: 'craft:work/w_t2', containsAI: false, paragraphs: [{ id: 'p_t2', text: '两本书的一段。', sourceIds: ['note:n_t1', 'note:n_t2'], ai: false, aiOriginIds: [], editedAt: 0 }], createdAt: at('2026-02-11T09:00:00Z'), updatedAt: at('2026-02-11T09:00:00Z'), confirmedAt: 0 },
    ],
    bookIndex: [],
    relations: [],
    threads: [],
  }
  const bookIdOf = (sourceId) => {
    const id = String(sourceId || '')
    if (id === 'note:n_t1') return bookA.bookId
    if (id === 'note:n_t2') return bookB.bookId
    return ''
  }
  return { data, craft, bookIdOf }
}
// 已存下来的关系：对照行上的标签要能读回来（改标签、删除都靠它）。
function relatedCraft() {
  const base = smokeCraft()
  const noteId = String(base.responses[0].sourceIds[0] || '').split(':')[1] || ''
  base.relations = [{
    id: 'rel_smoke1',
    bookId: base.bookIndex[0].bookId,
    from: { kind: 'note', id: noteId },
    to: { kind: 'thought', id: 'th_smoke1' },
    label: '呼应',
    reason: '都在说诗先给人画面。',
    origin: 'ai',
    createdAt: base.updatedAt,
  }]
  return base
}
// 我的阅读脉络：一条线索 = 一串已确认的关系。证据必须落到真实记录上，
// 校验靠的就是这两个 Map —— 编号对不上时，那一整条线索都不该出现。
function threadsCraft() {
  const base = relatedCraft()
  const relation = base.relations[0]
  base.responses = base.responses.concat([{
    id: 'r_smoke2',
    bookId: base.bookIndex[0].bookId,
    bookTitle: base.bookIndex[0].bookTitle,
    author: '',
    sourceIds: [`note:${relation.from.id}`],
    text: '我读诗的时候，先要一个画面。',
    origin: 'think',
    containsAI: true,
    model: 'gpt-4o-mini',
    promptVersion: 'think-v1',
    adoptedAt: base.updatedAt,
    createdAt: base.updatedAt,
  }])
  base.threads = [{
    id: 'th_smoke1',
    bookId: base.bookIndex[0].bookId,
    title: '读诗时我总先要一个画面',
    why: '两次都停在「先看见」这件事上。',
    relationIds: [relation.id],
    coverage: { chapters: ['开场白'], notes: 3, thoughts: 1, hasFullText: false },
    createdAt: base.updatedAt,
    updatedAt: base.updatedAt,
  }]
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
// 1.2.2：CREATE 只剩作品；素材篮与选题板退场，所以它们不再有面板视图。
renderPanel('responses', seedBase('responses'))
renderPanel('works', seedBase('works'))
renderPanel('timeline', seedBase('timeline'))
renderPanel('annual', seedBase('annual'))
renderPanel('craft-empty', seeds({ view: 'works', craft: EMPTY_CRAFT_FIXTURE }))
renderPanel('craft-empty-think', seeds({ view: 'responses', craft: EMPTY_CRAFT_FIXTURE }))
renderPanel('craft-empty-works', seeds({ view: 'works', craft: EMPTY_CRAFT_FIXTURE }))
renderPanel('craft-empty-grow', seeds({ view: 'timeline', craft: EMPTY_CRAFT_FIXTURE, data: Object.assign({}, payload, { notes: [], thoughts: [], books: [], counts: {} }) }))
renderPanel('craft-failed', seeds({ view: 'works', craft: EMPTY_CRAFT_FIXTURE, craftState: 'failed', craftError: '网络开小差了' }))
renderPanel('craft-scoped', seeds({ view: 'works', scopeBookId: anyBook.bookId }))
// F2：换一本书进 CREATE，别的书的稿子不能跟过来。用一本夹具里不存在的书做
// 反证——按 scope 过滤后必须落到空态，而不是把 A 书的稿子留在屏幕上。
renderPanel('works-scoped-other', seeds({ view: 'works', scopeBookId: 'weread:book/999999999' }))
// B1/B4：时间线的事件行要能回到书；跨书选题降级；按书筛只留这本书的事件。
renderPanel('timeline-scoped', seeds({ view: 'timeline', scopeBookId: anyBook.bookId }))
renderPanel('timeline-scoped-other', seeds({ view: 'timeline', scopeBookId: 'weread:book/999999999' }))
renderPanel('timeline-cross', seeds({ view: 'timeline', craft: crossCraft() }))
// 1.2.2：书页的六格计数块换成「我的阅读脉络」。书页本身仍要能打开、能读。
renderPanel('book-threads', seeds({ view: 'book', bookId: anyBook.bookId, craft: threadsCraft() }))
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

// 「我的阅读脉络」是书页里的一块，只在书页出现，所以这里单独挂载它。
// 播种顺序与 BookThreads 的 useState 一致：busy, error, notice, suggests, adopting, saving, expand
const threadBook = anyBook || { bookId: 'weread:book/1', title: '书名', author: '作者' }
const threadsProps = (craft, extra) =>
  Object.assign(
    {
      book: threadBook,
      data: payload,
      craft,
      craftState: 'ready',
      write: () => Promise.resolve({}),
      onOpenSource: () => {},
      onSwitchToWorks: () => {},
    },
    extra || {},
  )

renderStandalone('threads-result', smoke.BookThreads, threadsProps(threadsCraft()), [false, '', '', [], false, false, false])
// 记录太少：这本书一条划线都没有，按钮不出来，只给一句「先划一句」。
renderStandalone(
  'threads-empty',
  smoke.BookThreads,
  threadsProps(smokeCraft(), { data: Object.assign({}, payload, { notes: (payload.notes || []).filter((item) => item.bookId !== threadBook.bookId) }) }),
  [false, '', '', [], false, false, false],
)
renderStandalone('threads-error', smoke.BookThreads, threadsProps(threadsCraft()), [false, 'provider rate limited (429)', '', [], false, false, false])
renderStandalone('threads-capped', smoke.BookThreads, threadsProps(threadsCraft()), [false, '', 'thread.capped(3)', [], false, false, false])
renderStandalone(
  'threads-suggest',
  smoke.BookThreads,
  threadsProps(smokeCraft(), { craftState: 'ready' }),
  [false, '', '', [{ thread: { title: '两个声音在打架', why: '都在说读诗要慢下来。', relations: [], suggest: [['note:smoke_a', 'thought:smoke_b']] } }], false, false, false],
)
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

// 同章划线：默认收起，展开是一块有界的小面板，条数只在入口出现一次、引文不带日期。
const byClass = (draw, name) => (draw && draw.elements ? draw.elements : []).filter((el) => String(el.props.className || '').split(/\s+/).indexOf(name) !== -1)
const toggleDraw = byLabel0('thought-context-toggle')
const openDraw = byLabel0('thought-context-open')
if (toggleDraw) {
  const triggers = (toggleDraw.text.match(/thought\.contextToggle/g) || []).length
  if (triggers !== 1) thoughtGuards.push(`thought-context-toggle: 入口条数出现 ${triggers} 次（应为 1）`)
  if (toggleDraw.text.includes('thought.contextTitle')) thoughtGuards.push('thought-context-toggle: 默认就展开了')
  if (byClass(toggleDraw, 'wr-thread-pop').length !== 0) thoughtGuards.push('thought-context-toggle: 默认收起时不该有面板')
}
if (openDraw) {
  const pops = byClass(openDraw, 'wr-thread-pop')
  if (pops.length !== 1) thoughtGuards.push(`thought-context-open: 面板数量是 ${pops.length}`)
  const closes = byClass(openDraw, 'wr-thread-pop-close')
  if (closes.length !== 1) thoughtGuards.push('thought-context-open: 没有唯一的关闭按钮')
  else if (closes[0].tag !== 'button' || typeof closes[0].props.onClick !== 'function') thoughtGuards.push('thought-context-open: 关闭按钮不可点')
  if (openDraw.text.includes('thought.contextToggle')) thoughtGuards.push('thought-context-open: 展开后入口还在（条数会重复）')
  if (byClass(openDraw, 'wr-thread-date').length !== 0) thoughtGuards.push('thought-context-open: 引文还带日期（与卡片脚重复）')
  if (openDraw.text.includes('> 同章划线')) thoughtGuards.push('thought-context-open: 还在用 > 引文堆叠')
  const quotes = byClass(openDraw, 'wr-thread-quote')
  if (quotes.length !== contextNotes.length) thoughtGuards.push(`thought-context-open: 引文 ${quotes.length} 条（应为 ${contextNotes.length}）`)
}
const popCss = (() => {
  const at = code.indexOf('.wr-thread-pop{')
  return at < 0 ? '' : code.slice(at, code.indexOf('}', at))
})()
if (popCss === '') thoughtGuards.push('CSS: 找不到 .wr-thread-pop 规则')
else {
  if (popCss.indexOf('max-height:240px') < 0) thoughtGuards.push('CSS: 同章划线的面板没有上限高度')
  if (popCss.indexOf('overflow:hidden') < 0) thoughtGuards.push('CSS: 同章划线的面板没有裁掉溢出')
}
const popBodyCss = (() => {
  const at = code.indexOf('.wr-thread-pop-body{')
  return at < 0 ? '' : code.slice(at, code.indexOf('}', at))
})()
if (popBodyCss === '') thoughtGuards.push('CSS: 找不到 .wr-thread-pop-body 规则')
else if (popBodyCss.indexOf('overflow-y:auto') < 0) thoughtGuards.push('CSS: 同章划线的面板不能内部滚动')
if (code.indexOf('.wr-thread-date') >= 0) thoughtGuards.push('CSS: 旧的引文日期样式还在')

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

// 「放回书里看」：四胶囊只剩一个入口，卡片就地展开，编号先在候选集里校验。
// RelateCard 的 useState 顺序：draft, busy, error, answer, kept, saved, rowBusy, rowError
const relateGuards = []
if (typeof smoke.RelateCard !== 'function') relateGuards.push('client module 未暴露 RelateCard')
if (typeof smoke.RelateBar !== 'function') relateGuards.push('client module 未暴露 RelateBar')
if (typeof smoke.relateCandidates !== 'function') relateGuards.push('client module 未暴露 relateCandidates')
if (typeof smoke.buildRelateAsk !== 'function') relateGuards.push('client module 未暴露 buildRelateAsk')
if (typeof smoke.parseRelateAnswer !== 'function') relateGuards.push('client module 未暴露 parseRelateAnswer')
if (typeof smoke.relateBridge !== 'object' || smoke.relateBridge === null) relateGuards.push('client module 未暴露 relateBridge')

// 真实 dataset 里这本书的划线与想法就是候选集；桥接一下，卡片的 useMemo 才看得见它们。
const relateBook = anyBook
const relateNote = (dataset.notes || []).find((item) => item.bookId === relateBook.bookId) || null
const relateThought = (dataset.thoughts || []).find((item) => item.bookId === relateBook.bookId) || null
const relateEntry = {
  id: relateNote ? relateNote.id : 'note_fixture',
  bookId: relateBook.bookId,
  bookTitle: relateBook.title,
  author: relateBook.author || '',
  chapterTitle: relateNote ? relateNote.chapterTitle || '' : '第一章',
  text: relateNote ? relateNote.text : '夹具里的一条划线',
  createTime: relateNote ? relateNote.createTime : 1794193279,
}
const relateLookup = {
  note: new Map([(relateNote ? relateNote.id : relateEntry.id)].concat((dataset.notes || []).filter((n) => n.bookId === relateBook.bookId).map((n) => n.id)).map((id) => [String(id), (dataset.notes || []).find((n) => String(n.id) === String(id)) || relateEntry])),
  thought: new Map((dataset.thoughts || []).filter((t) => t.bookId === relateBook.bookId).map((t) => [String(t.id), t])),
  response: new Map(((smokeCraft().responses) || []).map((item) => [String(item.id), item])),
  material: new Map(((smokeCraft().materials) || []).map((item) => [String(item.id), item])),
}
const relateOpened = []
smoke.relateBridge.data = payload
smoke.relateBridge.craft = smokeCraft()
smoke.relateBridge.lookup = relateLookup
smoke.relateBridge.openSource = (id) => { relateOpened.push(id) }
const relateCandidates = smoke.relateCandidates({ entry: relateEntry, kind: 'note', data: payload, craft: smokeCraft() }) || []
if (relateCandidates.length === 0) relateGuards.push('relate: 候选集是空的，后续断言无从谈起')
if (process.env.RELATE_DEBUG) console.error('[debug] candidates', relateCandidates.length, relateCandidates.map((row) => row.id).slice(0, 4), 'book', relateBook.bookId, 'notes', (dataset.notes || []).filter((n) => String(n.bookId) === String(relateBook.bookId)).length)
const firstRow = relateCandidates[0] || { id: 'note:missing', rawId: 'missing' }
if (process.env.RELATE_DEBUG) console.error('[debug] first/second', relateCandidates[0] && relateCandidates[0].id, relateCandidates[1] && relateCandidates[1].id)
const secondRow = relateCandidates[1] || firstRow

// 「问：」建议 + 两条合法对照行；另有一条模型编造的编号，必须整行丢弃。
const relateAnswer = [
  '这两条都在说同一件事：先给画面，再给判断。',
  `[${firstRow.id}] 它把「读」和「懂」的顺序说清楚了。`,
  `[${secondRow.id}] 这条更偏方法，可以和上面那条并读。`,
  '[thought:made_up_id_9999] 这条是模型编的，不该出现。',
  '问：如果要写出来，这两条哪个该放前面？',
].join('\n')

const savedCraftBridge = smoke.craftBridge.craft
smoke.craftBridge.craft = smokeCraft()
renderStandalone('relate-empty', smoke.RelateCard, { entry: relateEntry, kind: 'note', onToggle() {} }, ['', false, '', '', '', {}, '', ''])
renderStandalone('note-row-tail', smoke.NoteRow, { note: relateEntry }, [false])
renderStandalone('relate-sending', smoke.RelateCard, { entry: relateEntry, kind: 'note', onToggle() {} }, ['想先问一句', true, '', '', '', {}, '', ''])
if (process.env.RELATE_DEBUG) console.error('[debug] parse', JSON.stringify((smoke.parseRelateAnswer(relateAnswer, relateCandidates) || {}).rows ? (smoke.parseRelateAnswer(relateAnswer, relateCandidates).rows.length) : -1), JSON.stringify(relateAnswer.slice(0, 120)))
renderStandalone('relate-result', smoke.RelateCard, { entry: relateEntry, kind: 'note', onToggle() {} }, ['', false, '', relateAnswer, '', {}, '', ''])
renderStandalone('relate-dropped-id', smoke.RelateCard, { entry: relateEntry, kind: 'note', onToggle() {} }, ['', false, '', relateAnswer, '', {}, '', ''])
// L1: 模型给编号加列表符号（「- [note:x] …」「1. [note:x] …」）仍然是候选行，不许退化成散文。
const bulletAnswer = [`- [${firstRow.id}] 这两条都在讲同一件事。`, `1. [${secondRow.id}] 这一条只是换个说法。`].join('\n')
renderStandalone('relate-bullet', smoke.RelateCard, { entry: relateEntry, kind: 'note', onToggle() {} }, ['', false, '', bulletAnswer, '', {}, '', ''])
// L3: 记录已经不在 lookup 里时，这一行必须降级成不可点的状态，而不是一个按了没反应的按钮。
const savedRelateLookup = smoke.relateBridge.lookup
smoke.relateBridge.lookup = { note: new Map(), thought: new Map(), response: new Map(), material: new Map() }
renderStandalone('relate-missing', smoke.RelateCard, { entry: relateEntry, kind: 'note', onToggle() {} }, ['', false, '', relateAnswer, '', {}, '', ''])
smoke.relateBridge.lookup = savedRelateLookup
renderStandalone('relate-error', smoke.RelateCard, { entry: relateEntry, kind: 'note', onToggle() {} }, ['想问的问题', false, 'provider rate limited (429)', '', '', {}, '', ''])
renderStandalone('relate-saved', smoke.RelateCard, { entry: relateEntry, kind: 'note', onToggle() {} }, ['', false, '', relateAnswer, '', { [firstRow.id]: { id: 'rel_smoke1', label: '呼应' } }, '', ''])
renderStandalone(
  'relate-toofew',
  smoke.RelateCard,
  { entry: Object.assign({}, relateEntry, { bookId: 'weread:book/123123123', bookTitle: '只有一条记录的书' }), kind: 'note', onToggle() {} },
  ['', false, '', '', '', {}, '', ''],
)
renderStandalone(
  'relate-nobook',
  smoke.RelateCard,
  { entry: Object.assign({}, relateEntry, { bookId: '' }), kind: 'note', onToggle() {} },
  ['', false, '', '', '', {}, '', ''],
)
smoke.craftBridge.craft = savedCraftBridge
// 就地展开：卡片在记录卡里，记录卡自己加宽；四胶囊与浮层都不该回来。
renderStandalone('relate-modal-note', smoke.RelateBar, { entry: relateEntry, kind: 'note', open: true, onToggle() {} }, ['', false, '', '', '', {}, '', '', false])
renderStandalone('relate-modal-thought', smoke.RelateBar, { entry: relateThought || relateEntry, kind: 'thought', open: true, onToggle() {} }, ['', false, '', '', '', {}, '', '', false])
// 很长的回答：卡片停在 max-height、正文区内部滚动，而不是把卡片撑出屏幕。
const longAnswer = relateAnswer + '\n' + '这一段是我自己补的解释，用来把正文撑长。'.repeat(40)
renderStandalone('relate-modal-long', smoke.RelateCard, { entry: relateEntry, kind: 'note', open: true, onToggle() {} }, ['', false, '', longAnswer, '', {}, '', '', false])
// 用户手动上滚之后：不再抢滚动条，改成给一个「回到底部」的入口。
renderStandalone('relate-modal-stuck', smoke.RelateCard, { entry: relateEntry, kind: 'note', open: true, onToggle() {} }, ['', false, '', longAnswer, '', {}, '', '', true])
renderStandalone('relate-modal-error', smoke.RelateCard, { entry: relateEntry, kind: 'note', open: true, onToggle() {} }, ['想问的问题', false, 'provider rate limited (429)', '', '', {}, '', '', false])
// 初稿页：整篇删除在「⋯」菜单里，两步确认；预览是开关，不是常驻块。
const draftCraft = smokeCraft()
const draftWork = draftCraft.works[0]
const draftWrite = () => Promise.resolve({})
const draftBase = {
  craft: draftCraft,
  data: dataset,
  scopeBookId: '',
  bookIdOf: (sourceId) => smoke.craftSourceHit(sourceId, { note: new Map(), thought: new Map(), response: new Map(), material: new Map() }) ? '' : '',
  onOpenSource() {},
  onGoShelf() {},
  write: draftWrite,
}
{
  const deletes = []
  const menuProps = { work: draftWork, busy: false, onDelete: () => deletes.push(1) }
  renderStandalone('work-menu-closed', smoke.WorkMenu, menuProps, [false, false])
  renderStandalone('work-menu-open', smoke.WorkMenu, menuProps, [true, false])
  renderStandalone('work-menu-armed', smoke.WorkMenu, menuProps, [true, true])
  const closed = byLabel0('work-menu-closed')
  if (!closed) relateGuards.push('work-menu-closed: 未渲染')
  else if ((closed.elements || []).filter((el) => String(el.props.className || '') === 'wr-menu-panel').length !== 0) relateGuards.push('work-menu-closed: 菜单默认是展开的')
  const armed = byLabel0('work-menu-armed')
  const opened = byLabel0('work-menu-open')
  if (!armed) relateGuards.push('work-menu-armed: 未渲染')
  if (!opened) relateGuards.push('work-menu-open: 未渲染')
  else {
    const first = (opened.elements || []).filter((el) => String(el.props.className || '') === 'wr-menu-danger')
    if (first.length !== 1) relateGuards.push(`work-menu-open: 删除项数量是 ${first.length}`)
    else {
      // 第一步只把按钮换成「再点一次」，绝不发请求。
      if (String(first[0].props.children || '') !== 'work.deleteWhole') relateGuards.push('work-menu-open: 第一步没有说清删的是整篇')
      first[0].props.onClick()
      if (deletes.length !== 0) relateGuards.push('work-menu-open: 第一次点就删了（没有二次确认）')
      if (first[0].props['data-armed'] !== 'false') relateGuards.push('work-menu-open: 第一步就把按钮标成了已确认')
    }
  }
  if (armed) {
    const danger = (armed.elements || []).filter((el) => String(el.props.className || '') === 'wr-menu-danger')
    if (danger.length !== 1) relateGuards.push(`work-menu-armed: 删除项数量是 ${danger.length}`)
    else {
      if (String(danger[0].props.children || '') !== 'work.deleteConfirm') relateGuards.push('work-menu-armed: 第二次点之前没有换成确认文案')
      danger[0].props.onClick()
      if (deletes.length !== 1) relateGuards.push('work-menu-armed: 确认后没有发删除')
    }
  }
}
renderStandalone('work-draft-short', smoke.WorkBoard, Object.assign({}, draftBase, {}), [draftWork.id, '', false, '', [], false, '', '', ''])
renderStandalone('work-draft-long', smoke.WorkBoard, Object.assign({}, draftBase, {}), [draftWork.id, '', false, '很长的段落草稿。'.repeat(30), [], false, '', '', ''])
renderStandalone('work-preview-open', smoke.WorkBoard, Object.assign({}, draftBase, {}), [draftWork.id, '', false, '', [], false, '', '## 预览\n正文', ''])
{
  const shortDraw = byLabel0('work-draft-short')
  const longDraw = byLabel0('work-draft-long')
  for (const [label, draw] of [['work-draft-short', shortDraw], ['work-draft-long', longDraw]]) {
    if (!draw) { relateGuards.push(label + ': 未渲染'); continue }
    const areas = (draw.elements || []).filter((el) => el.tag === 'textarea' && String(el.props.className || '').indexOf('wr-line-input') >= 0)
    if (areas.length !== 1) relateGuards.push(`${label}: 新段落输入框数量是 ${areas.length}`)
    const want = label === 'work-draft-short' ? 1 : 6
    if (areas.length === 1 && areas[0].props.rows !== want) relateGuards.push(`${label}: 输入框 rows 是 ${areas[0].props.rows}（应为 ${want}）`)
    // 入参为空时不该有 100px 的固定高度占位。
    if (areas.length === 1 && areas[0].props.style && areas[0].props.style.height) relateGuards.push(`${label}: 输入框写死了高度`)
  }
  const opened = byLabel0('work-preview-open')
  if (!opened) relateGuards.push('work-preview-open: 未渲染')
  else {
    if ((opened.elements || []).filter((el) => String(el.props.className || '') === 'wr-draft-export').length !== 1) relateGuards.push('work-preview-open: 预览区没有打开')
    const toggle = (opened.elements || []).find((el) => el.tag === 'button' && String(el.props.children || '') === 'work.hidePreview')
    if (!toggle) relateGuards.push('work-preview-open: 没有「隐藏预览」按钮')
    else if (toggle.props['aria-expanded'] !== 'true') relateGuards.push('work-preview-open: 按钮没有标成已展开')
  }
  if (shortDraw) {
    if ((shortDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-draft-export').length !== 0) relateGuards.push('work-draft-short: 预览默认没有收起')
    const previewBtn = (shortDraw.elements || []).find((el) => el.tag === 'button' && String(el.props.children || '') === 'work.exportPreview')
    if (!previewBtn) relateGuards.push('work-draft-short: 找不到预览按钮')
    else if (previewBtn.props['aria-expanded'] !== 'false') relateGuards.push('work-draft-short: 预览按钮没有标成收起')
  }
  // 整篇删除不能出现在「加这一段」那一排。
  if (shortDraw) {
    const forms = (shortDraw.elements || []).filter((el) => String(el.props.className || '').indexOf('wr-form-row') >= 0)
    const dangerInRow = forms.some((el) => JSON.stringify(el.props).indexOf('wr-menu-danger') >= 0)
    if (dangerInRow) relateGuards.push('work-draft-short: 删除还在按钮排里')
    const menu = (shortDraw.elements || []).filter((el) => String(el.props.className || '').indexOf('wr-menu-btn') >= 0)
    if (menu.length !== 1) relateGuards.push(`work-draft-short: 作品头部没有「⋯」入口（${menu.length}）`)
  }
  // rows 的纯函数：一行起、六行封顶。
  if (typeof smoke.textareaRows !== 'function') relateGuards.push('client module 未暴露 textareaRows')
  else {
    if (smoke.textareaRows('') !== 1) relateGuards.push('textareaRows: 空内容是 ' + smoke.textareaRows(''))
    if (smoke.textareaRows('一行') !== 1) relateGuards.push('textareaRows: 单行被算成了多行')
    if (smoke.textareaRows('a\nb\nc') !== 3) relateGuards.push('textareaRows: 三行被算成 ' + smoke.textareaRows('a\nb\nc'))
    if (smoke.textareaRows('x'.repeat(400)) !== 6) relateGuards.push('textareaRows: 长文本没有封顶到 6')
    if (smoke.textareaRows('a\n'.repeat(30)) !== 6) relateGuards.push('textareaRows: 很多换行没有封顶到 6')
  }
}

{
  const emptyDraw = byLabel0('relate-empty')
  if (!emptyDraw) relateGuards.push('relate-empty: 未渲染')
  else {
    for (const needle of ['relate.send', 'relate.thisNote'])
      if (!emptyDraw.text.includes(needle)) relateGuards.push('relate-empty: 缺 ' + needle)
    const inputs = (emptyDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-input')
    if (inputs.length !== 1) relateGuards.push(`relate-empty: 输入框数量是 ${inputs.length}`)
    else if (inputs[0].props.placeholder !== 'relate.placeholder') relateGuards.push('relate-empty: 输入框没有占位说明')
    // 四胶囊必须真的没了：连文案都不该出现。
    for (const needle of ['think.mode.explain', 'think.mode.reframe', 'think.mode.deeper', 'think.mode.custom'])
      if (emptyDraw.text.includes(needle)) relateGuards.push('relate-empty: 旧的四胶囊又出现了 —— ' + needle)
    const sends = (emptyDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-send')
    if (sends.length !== 1) relateGuards.push(`relate-empty: 发送键数量是 ${sends.length}`)
    else if (sends[0].tag !== 'button' || typeof sends[0].props.onClick !== 'function') relateGuards.push('relate-empty: 发送键不可点')
  }
}
{
  const sending = byLabel0('relate-sending')
  if (!sending) relateGuards.push('relate-sending: 未渲染')
  else {
    if (!sending.text.includes('relate.thinking')) relateGuards.push('relate-sending: 等待态缺「正在对照…」')
    const sends = (sending.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-send')
    if (sends.length > 0 && !sends.every((el) => el.props.disabled === true)) relateGuards.push('relate-sending: 等待中发送键还能点')
  }
}
{
  const result = byLabel0('relate-result')
  if (!result) relateGuards.push('relate-result: 未渲染')
  else {
    for (const needle of ['relate.together', 'relate.why', 'relate.followup', 'relate.askPrefix', 'relate.keepThought', 'relate.collapse'])
      if (!result.text.includes(needle)) relateGuards.push('relate-result: 缺 ' + needle)
    const chips = (result.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-chip')
    const clickable = chips.filter((el) => el.tag === 'button' && typeof el.props.onClick === 'function')
    if (chips.length < 2) relateGuards.push(`relate-result: 对照行只有 ${chips.length} 个编号 chip`)
    else if (clickable.length !== chips.length) relateGuards.push(`relate-result: ${chips.length} 个 chip 只有 ${clickable.length} 个可点`)
    const labels = (result.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-label')
    for (const needle of ['relate.label.echo', 'relate.label.contrast', 'relate.label.mine', 'relate.label.check'])
      if (!result.text.includes(needle)) relateGuards.push('relate-result: 缺标签 ' + needle)
    if (labels.length === 0) relateGuards.push('relate-result: 没有标签按钮')
    else if (!labels.every((el) => el.tag === 'button' && typeof el.props.onClick === 'function')) relateGuards.push('relate-result: 标签按钮不可点')
    const asks = (result.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-ask')
    if (asks.length === 0) relateGuards.push('relate-result: 「问：」建议没有渲染成按钮')
  }
}
{
  // 渲染前就丢：编造的编号不许出现在文本里，也不许变成 chip 或被存成关系。
  const dropped = byLabel0('relate-dropped-id')
  if (!dropped) relateGuards.push('relate-dropped-id: 未渲染')
  else {
    if (dropped.text.includes('made_up_id_9999')) relateGuards.push('relate-dropped-id: 模型编造的编号被渲染出来了')
    const chips = (dropped.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-chip')
    if (chips.some((el) => String(el.props.title || '').includes('made_up_id_9999'))) relateGuards.push('relate-dropped-id: 编造的编号成了 chip')
    if (chips.length !== 2) relateGuards.push(`relate-dropped-id: 该留 2 条对照行，实际 ${chips.length}`)
  }
}
{
  // L1: 列表符号不能把候选行吃掉。
  const bulletDraw = byLabel0('relate-bullet')
  if (!bulletDraw) relateGuards.push('relate-bullet: 未渲染')
  else {
    const parsed = smoke.parseRelateAnswer(bulletAnswer, relateCandidates) || {}
    const parsedRows = Array.isArray(parsed.rows) ? parsed.rows : []
    if (parsedRows.length !== 2)
      relateGuards.push(`relate-bullet: 带列表符号的编号只解析出 ${parsedRows.length} 条对照行（应为 2）`)
    if (parsedRows.some((row) => row.id !== firstRow.id && row.id !== secondRow.id))
      relateGuards.push('relate-bullet: 解析出的编号对不上候选集')
    if (String(parsed.prose || '').includes(firstRow.id)) relateGuards.push('relate-bullet: 编号落进了散文')
    const chips = (bulletDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-chip')
    if (chips.length !== 2) relateGuards.push(`relate-bullet: 卡片里只有 ${chips.length} 个来源 chip（应为 2）`)
    if (bulletDraw.text.includes('- [' + firstRow.id)) relateGuards.push('relate-bullet: 列表符号被原样渲染出来了')
  }
}
{
  // L3: lookup 与 rows 不同步时，降级分支必须真的走到。
  const missingDraw = byLabel0('relate-missing')
  if (!missingDraw) relateGuards.push('relate-missing: 未渲染')
  else {
    const chips = (missingDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-chip')
    const buttons = chips.filter((el) => el.tag === 'button')
    const spans = chips.filter((el) => el.tag === 'span' && el.props['data-missing'] === 'true')
    if (chips.length === 0) relateGuards.push('relate-missing: 一条 chip 都没有，无从判断降级')
    else if (buttons.length > 0) relateGuards.push(`relate-missing: 有 ${buttons.length} 个 chip 仍可点，点了不会有反应`)
    if (chips.length > 0 && spans.length !== chips.length)
      relateGuards.push(`relate-missing: ${chips.length} 个 chip 里只有 ${spans.length} 个带缺失状态`)
    if (!missingDraw.text.includes('mat.status.missing')) relateGuards.push('relate-missing: 没有写出「来源没找到」')
    const items = (missingDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-item')
    if (items.length > 0 && !items.every((el) => el.props['data-missing'] === 'true'))
      relateGuards.push('relate-missing: 行级 data-missing 没有标成 true')
  }
}
{
  const failure = byLabel0('relate-error')
  if (!failure) relateGuards.push('relate-error: 未渲染')
  else {
    if (!failure.text.includes('provider rate limited (429)')) relateGuards.push('relate-error: 没显示真实错误原文')
    const retries = (failure.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-ask')
    if (retries.length === 0) relateGuards.push('relate-error: 失败后没有重试入口')
    else if (typeof retries[0].props.onClick !== 'function') relateGuards.push('relate-error: 重试入口不可点')
  }
}
{
  const saved = byLabel0('relate-saved')
  if (!saved) relateGuards.push('relate-saved: 未渲染')
  else {
    const onLabels = (saved.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-label' && el.props['data-on'] === 'true')
    if (onLabels.length !== 1) relateGuards.push(`relate-saved: 已存标签高亮数量是 ${onLabels.length}`)
    if (!saved.text.includes('relate.remove')) relateGuards.push('relate-saved: 已存的关系没有删除入口')
    if (!saved.text.includes('relate.saved')) relateGuards.push('relate-saved: 已存状态没有写出来')
  }
}
{
  const few = byLabel0('relate-toofew')
  if (!few) relateGuards.push('relate-toofew: 未渲染')
  else {
    if (!few.text.includes('relate.tooFew')) relateGuards.push('relate-toofew: 记录太少时没有给出下一步')
    if (few.text.includes('relate.send')) relateGuards.push('relate-toofew: 记录太少时不该给发送按钮')
    const inputs = (few.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-input')
    if (inputs.length > 0) relateGuards.push('relate-toofew: 记录太少时不该给输入框')
  }
}
{
  const noBook = byLabel0('relate-nobook')
  if (!noBook) relateGuards.push('relate-nobook: 未渲染')
  else if (!noBook.text.includes('relate.noBook')) relateGuards.push('relate-nobook: 没书时没有说明原因')
}
// 浮层：遮罩 + 居中卡片。卡片高度随内容，宽度与上限都写在渲染出来的 style 上。
{
  const cap = typeof smoke.relateCardCap === 'function' ? smoke.relateCardCap(900) : 0
  for (const label of ['relate-modal-note', 'relate-modal-thought']) {
    const draw = byLabel0(label)
    if (!draw) { relateGuards.push(`${label}: 未渲染`); continue }
    const elements = draw.elements || []
    const modals = elements.filter((el) => String(el.props.className || '') === 'wr-relate-modal')
    if (modals.length !== 1) relateGuards.push(`${label}: 没有浮层遮罩（找到 ${modals.length} 层）`)
    else {
      if (modals[0].props['data-backdrop'] !== 'true') relateGuards.push(`${label}: 遮罩没有标成 backdrop`)
      if (modals[0].props.role !== 'dialog' || modals[0].props['aria-modal'] !== 'true') relateGuards.push(`${label}: 遮罩不是 dialog/aria-modal`)
      if (typeof modals[0].props.onClick !== 'function') relateGuards.push(`${label}: 点遮罩关不掉（没有 onClick）`)
      if (typeof modals[0].props.onKeyDown !== 'function') relateGuards.push(`${label}: Esc 关不掉（没有 onKeyDown）`)
    }
    const cards = elements.filter((el) => String(el.props.className || '') === 'wr-relate-card')
    if (cards.length !== 1) relateGuards.push(`${label}: 浮层里没有卡片（找到 ${cards.length} 张）`)
    else {
      const style = cards[0].props.style || {}
      if (String(style.maxHeight || '') !== `${cap}px`) relateGuards.push(`${label}: 卡片上限是 ${style.maxHeight || '无'}（应为 ${cap}px）`)
      if (style.height !== undefined) relateGuards.push(`${label}: 卡片写死了高度，短回答也会被撑满`)
    }
    const bodies = elements.filter((el) => String(el.props.className || '') === 'wr-relate-body')
    if (bodies.length !== 1) relateGuards.push(`${label}: 没有内部滚动区`)
    else if (typeof bodies[0].props.onScroll !== 'function') relateGuards.push(`${label}: 内部滚动区没有 onScroll，跟不了底`)
    const rowWide = elements.filter((el) => el.props['data-wide'] !== undefined)
    if (rowWide.length > 0) relateGuards.push(`${label}: 记录卡还在用 data-wide 就地加宽`)
  }
}
// 两个方向都要有证据：短回答不撑满，长回答停在 cap 且内部滚动。
if (typeof smoke.relateCardBox !== 'function') relateGuards.push('client module 未暴露 relateCardBox')
else {
  const shortBox = smoke.relateCardBox({ contentHeight: 220, viewportHeight: 900 })
  if (!(shortBox.height < shortBox.cap) || shortBox.capped) relateGuards.push(`尺寸: 短回答被撑满了（${JSON.stringify(shortBox)}）`)
  const tallBox = smoke.relateCardBox({ contentHeight: 4200, viewportHeight: 900 })
  if (tallBox.height !== tallBox.cap || !tallBox.capped) relateGuards.push(`尺寸: 长回答没有停在 cap（${JSON.stringify(tallBox)}）`)
  const emptyBox = smoke.relateCardBox({ contentHeight: 0, viewportHeight: 900 })
  if (emptyBox.height !== 0) relateGuards.push('尺寸: 空内容也占了高度')
}
{
  const longDraw = byLabel0('relate-modal-long')
  if (!longDraw) relateGuards.push('relate-modal-long: 未渲染')
  else {
    const cards = (longDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-card')
    const cap = typeof smoke.relateCardCap === 'function' ? `${smoke.relateCardCap(900)}px` : ''
    if (cards.length !== 1) relateGuards.push('relate-modal-long: 找不到卡片')
    else if (String((cards[0].props.style || {}).maxHeight || '') !== cap) relateGuards.push('relate-modal-long: 长回答时上限变了')
    if (longDraw.text.length < 400) relateGuards.push(`relate-modal-long: 长回答只渲染出 ${longDraw.text.length} 字`)
  }
  const stuckDraw = byLabel0('relate-modal-stuck')
  if (!stuckDraw) relateGuards.push('relate-modal-stuck: 未渲染')
  else {
    const jump = (stuckDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-jump')
    if (jump.length !== 1) relateGuards.push(`relate-modal-stuck: 「回到底部」入口数量是 ${jump.length}`)
    else if (jump[0].tag !== 'button' || typeof jump[0].props.onClick !== 'function') relateGuards.push('relate-modal-stuck: 「回到底部」入口不可点')
    if (!stuckDraw.text.includes('relate.toBottom')) relateGuards.push('relate-modal-stuck: 没有「回到底部」文案')
  }
  const errorDraw = byLabel0('relate-modal-error')
  if (!errorDraw) relateGuards.push('relate-modal-error: 未渲染')
  else {
    if (!errorDraw.text.includes('provider rate limited (429)')) relateGuards.push('relate-modal-error: 没有显示真实错误')
    if (!errorDraw.text.includes('think.retry')) relateGuards.push('relate-modal-error: 没有重试入口')
  }
}
// 收起时只有一个入口按钮：点它就是「放回书里看」。
renderStandalone('relate-bar-closed', smoke.RelateBar, { entry: relateEntry, kind: 'note', open: false, onToggle() {} }, ['', false, ''])
{
  const barDraw = byLabel0('relate-bar-closed')
  if (!barDraw) relateGuards.push('relate-bar-closed: 未渲染')
  else {
    if (!barDraw.text.includes('nav.relate')) relateGuards.push('relate-bar-closed: 入口文案不是 nav.relate')
    const go = (barDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-go')
    if (go.length !== 1) relateGuards.push(`relate-bar-closed: 入口按钮数量是 ${go.length}`)
    else if (go[0].tag !== 'button' || typeof go[0].props.onClick !== 'function') relateGuards.push('relate-bar-closed: 入口按钮不可点')
    if (barDraw.text.includes('wr-relate-card')) relateGuards.push('relate-bar-closed: 收起时不该有关系卡')
  }
}
// 浮层这张卡自己不再占位：记录卡保持原尺寸，只是浮层盖在上面。
{
  const thoughtRow = dataset.thoughts && dataset.thoughts[0]
  renderStandalone('relate-thought-row', smoke.ThoughtRow, { thought: thoughtRow, wall: true, context: [] }, [false, false, true])
  const rowDraw = byLabel0('relate-thought-row')
  if (!rowDraw) relateGuards.push('ThoughtRow: 未渲染')
  else {
    const rowCards = (rowDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-thought')
    if (rowCards.length === 0) relateGuards.push('ThoughtRow: 找不到想法卡')
    else if (rowCards[0].props['data-wide'] !== undefined) relateGuards.push('ThoughtRow: 记录卡还在就地加宽（data-wide）')
  }
}
// 布局从样式表看：遮罩 fixed 铺满，卡片 auto 高 + max-height + 内部滚动区。
const relateCss = (name) => {
  const at = code.indexOf(`.${name}{`)
  if (at < 0) return ''
  const end = code.indexOf('}', at)
  return end > at ? code.slice(at, end) : ''
}
const modalCss = relateCss('wr-relate-modal')
if (modalCss === '') relateGuards.push('CSS: 找不到 .wr-relate-modal 规则')
else {
  if (modalCss.indexOf('position:fixed') < 0) relateGuards.push('CSS: 遮罩不是 fixed')
  if (modalCss.indexOf('inset:0') < 0) relateGuards.push('CSS: 遮罩没有铺满视口')
  if (modalCss.indexOf('z-index') < 0) relateGuards.push('CSS: 遮罩没有抬高层级')
}
const cardCss = relateCss('wr-relate-card')
if (cardCss === '') relateGuards.push('CSS: 找不到 .wr-relate-card 规则')
else {
  if (cardCss.indexOf('position:fixed') >= 0) relateGuards.push('CSS: 卡片自己 fixed 了（应该是遮罩 fixed）')
  if (cardCss.indexOf('max-height') < 0) relateGuards.push('CSS: 卡片没有 max-height')
  if (cardCss.indexOf('min(600px') < 0) relateGuards.push('CSS: 卡片宽度不是 min(600px, …)')
  if (cardCss.indexOf('display:flex') < 0 || cardCss.indexOf('flex-direction:column') < 0) relateGuards.push('CSS: 卡片不是纵向 flex')
}
const bodyCss = relateCss('wr-relate-body')
if (bodyCss === '') relateGuards.push('CSS: 找不到 .wr-relate-body 规则')
else {
  if (bodyCss.indexOf('overflow-y:auto') < 0) relateGuards.push('CSS: 正文区不是内部滚动')
  if (bodyCss.indexOf('flex:1 1 auto') < 0) relateGuards.push('CSS: 正文区没有吃掉剩余高度')
}
const composeCss = relateCss('wr-relate-compose')
if (composeCss === '') relateGuards.push('CSS: 找不到 .wr-relate-compose 规则')
else if (composeCss.indexOf('flex:none') < 0) relateGuards.push('CSS: 输入区会跟着内容长，没有固定在底部')
if (code.indexOf('askPosition') >= 0) relateGuards.push('CSS: 还在按视口坐标摆卡片（askPosition 未删）')
if (code.indexOf('wr-ask{') >= 0) relateGuards.push('CSS: 旧的 .wr-ask 样式还在')
if (code.indexOf("request('/chat/models')") >= 0) relateGuards.push('预检: 客户端还在请求 /chat/models')

// 高度随内容：卡片只给上限、不给高度；正文区没有写死的高度，由内容决定。
if (cardCss !== '' && /(^|;)\s*height:/.test(cardCss)) relateGuards.push('CSS: 卡片写死了高度（应该只给 max-height）')
if (bodyCss !== '' && /(^|;)\s*height:/.test(bodyCss)) relateGuards.push('CSS: 正文区写死了高度')
if (bodyCss !== '' && bodyCss.indexOf('max-height') >= 0) relateGuards.push('CSS: 正文区写了 max-height（应该由卡片上限约束）')
const emptyCard = byLabel0('relate-empty')
if (emptyCard) {
  const cards = (emptyCard.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-card')
  if (cards.length !== 1) relateGuards.push('relate-empty: 找不到卡片')
  else if ((cards[0].props.style || {}).height !== undefined) relateGuards.push('relate-empty: 卡片带了固定 height')
}

// 输入区与按钮分两排：compose 是纵向列，按钮行有自己的留白与间距。
if (composeCss !== '' && composeCss.indexOf('flex-direction:column') < 0) relateGuards.push('CSS: 输入区与按钮没有分层（compose 不是纵向列）')
if (composeCss !== '' && composeCss.indexOf('gap:8px') < 0) relateGuards.push('CSS: 输入区内部间距不足 8px')
const actionsCss = relateCss('wr-relate-actions')
if (actionsCss === '') relateGuards.push('CSS: 找不到 .wr-relate-actions 规则')
else if (actionsCss.indexOf('gap:8px') < 0) relateGuards.push('CSS: 按钮行间距不足 8px')
const footCss = relateCss('wr-relate-foot')
if (footCss === '' ) relateGuards.push('CSS: 找不到 .wr-relate-foot 规则')
else if (footCss.indexOf('padding-top:8px') < 0) relateGuards.push('CSS: 按钮行没有独立留白')

// 「记成想法」只在真的有可采纳内容时出现。
const keepButton = (draw) => (draw && draw.elements ? draw.elements : []).filter((el) => String(el.props.className || '').indexOf('wr-btn-quiet') !== -1 && String((el.props.children || '')).indexOf('relate.keepThought') !== -1)
if (emptyCard && keepButton(emptyCard).length !== 0) relateGuards.push('relate-empty: 没有可采纳内容时仍显示「记成想法」')
const resultCard = byLabel0('relate-result')
if (resultCard && keepButton(resultCard).length !== 1) relateGuards.push('relate-result: 有内容时「记成想法」应该出现且只有一个')
const sendCount = (draw) => (draw && draw.elements ? draw.elements : []).filter((el) => String(el.props.className || '') === 'wr-relate-send').length
if (emptyCard && sendCount(emptyCard) !== 1) relateGuards.push('relate-empty: 发送键数量不是 1')
if (resultCard && sendCount(resultCard) !== 1) relateGuards.push('relate-result: 发送键数量不是 1')

// 「放回书里看」在记录卡的右侧那一组，不再占正文下方一行。
const tailDraw = byLabel0('note-row-tail')
if (!tailDraw) relateGuards.push('note-row-tail: 未渲染')
else {
  const bars = (tailDraw.elements || []).filter((el) => String(el.props.className || '').split(/\s+/).indexOf('wr-relate') !== -1)
  if (bars.length !== 1) relateGuards.push(`note-row-tail: 入口容器数量是 ${bars.length}`)
  else if (bars[0].props['data-in-tail'] !== 'true') relateGuards.push('note-row-tail: 「放回书里看」不在右侧那一组')
  const guides = (tailDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-go')
  if (guides.length !== 1) relateGuards.push('note-row-tail: 找不到「放回书里看」按钮')
}
if (code.indexOf('.wr-quote-tail .wr-relate{margin-top:0}') < 0) relateGuards.push('CSS: 右侧那一组里的入口没有去掉上边距')
const thoughtRowDraw = byLabel0('relate-thought-row')
if (thoughtRowDraw) {
  const bars = (thoughtRowDraw.elements || []).filter((el) => String(el.props.className || '').split(/\s+/).indexOf('wr-relate') !== -1)
  if (bars.length === 0 || bars[0].props['data-in-tail'] !== 'true') relateGuards.push('relate-thought-row: 想法卡的入口不在右侧那一组')
}

// 请求体照设计稿 §4 组：自然话 + 带编号的候选 + mode:'relate'。
if (typeof smoke.buildRelateAsk === 'function' && relateCandidates.length > 0) {
  const ask = smoke.buildRelateAsk({ entry: relateEntry, kind: 'note', question: '', candidates: relateCandidates, data: payload })
  if (!ask || typeof ask.pack !== 'string' || typeof ask.question !== 'string') {
    relateGuards.push('buildRelateAsk: 返回值不是 {pack, question}')
  } else {
    for (const needle of ['relate.packHead', 'relate.packNote', 'relate.packList', 'relate.packRule', 'relate.packFollowRule', 'relate.packDefault'])
      if (!ask.pack.includes(needle) && !ask.question.includes(needle)) relateGuards.push('请求体: 缺 ' + needle)
    if (!ask.pack.includes(firstRow.id)) relateGuards.push('请求体: 候选没有带编号')
    if (ask.pack.includes('material:')) relateGuards.push('请求体: 候选里混进了素材（素材已下线）')
    if (relateCandidates.length > 12) relateGuards.push(`请求体: 候选 ${relateCandidates.length} 条，超过 12`)
    if (relateCandidates.some((row) => String(row.id) === `note:${relateEntry.id}`)) relateGuards.push('请求体: 候选里混进了当前这条')
    if (smoke.buildRelateAsk({ entry: relateEntry, kind: 'note', question: '怎么理解？', candidates: relateCandidates, data: payload }).question.indexOf('relate.packWant') < 0)
      relateGuards.push('请求体: 用户填了问题却没用 relate.packWant')
  }
}

// F3：段落上的来源 chip 能点回原物；material: 因为素材下线，只能是纯文本。
const worksDraw = byLabel0('works')
if (worksDraw) {
  const chips = (worksDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-src')
  const retired = chips.filter((el) => el.props['data-retired'] === 'true')
  const live = chips.filter((el) => el.props['data-retired'] !== 'true')
  if (chips.length === 0) relateGuards.push('works: 段落没有渲染来源 chip')
  else {
    if (retired.length === 0) relateGuards.push('works: 素材来源没有按「已下线」渲染成纯文本')
    if (retired.some((el) => el.tag === 'button')) relateGuards.push('works: 素材来源仍然是可点按钮')
    if (live.some((el) => el.tag !== 'button' || typeof el.props.onClick !== 'function'))
      relateGuards.push('works: 划线/想法来源 chip 不可点（F3）')
  }
} else {
  relateGuards.push('works: 未渲染，无法断言来源 chip')
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
    // 说明搬进按钮的 title，不在正文里另占一行灰字。
    else if (!triggers.every((el) => String(el.props.title || '') === 'work.aiNeedSource')) paragraphGuards.push('paragraph-ai-nosource: 没出处时按钮没有 title 说明')
    const hintNodes = (aiNoSource.elements || []).filter((el) => String(el.props.className || '') === 'wr-ai-hint')
    if (hintNodes.length > 0) paragraphGuards.push('paragraph-ai-nosource: 正文里还留着「先挑素材」的灰字')
  }
} else {
  paragraphGuards.push('client module 未暴露 ParagraphAI')
}

// 段落可编辑（t39）：点正文进编辑态、Esc/失焦/快捷键、失败不丢输入；出处只能从
// 这本书的记录里挂，不再读已经下线的 materials。
const editGuards = paragraphGuards
if (typeof smoke.ParagraphRow === 'function') {
  const editCraft = smokeCraft()
  const editParagraph = Object.assign({}, editCraft.works[0].paragraphs[0], {
    text: '秩序感先给画面，再给判断。',
    sourceIds: ['note:n_smoke1'],
  })
  const editRows = smoke.sourcePoolOf(payload, editCraft, editParagraph.bookId === undefined ? '' : editParagraph.bookId)
  const editProps = {
    paragraph: editParagraph,
    index: 0,
    work: { id: editCraft.works[0].id, title: editCraft.works[0].title },
    lookup: { note: new Map(), thought: new Map(), response: new Map(), material: new Map() },
    titleOf: () => '示例书',
    sourcePool: editRows,
    onOpenSource: () => {},
    onSave: () => Promise.resolve(),
    onAttachSources: () => Promise.resolve(),
    onDelete: () => {},
    onAdopt: () => Promise.resolve(),
  }
  renderStandalone('paragraph-read', smoke.ParagraphRow, editProps, [false, '', false, ''])
  renderStandalone('paragraph-edit', smoke.ParagraphRow, editProps, [true, '改过的句子，还没保存。', false, ''])
  renderStandalone('paragraph-edit-failed', smoke.ParagraphRow, editProps, [true, '改过的句子，保存失败了。', false, 'provider rate limited (429)'])

  const readDraw = byLabel0('paragraph-read')
  if (!readDraw) editGuards.push('paragraph-read: 未渲染')
  else {
    const texts = (readDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-item-text')
    if (texts.length === 0) editGuards.push('paragraph-read: 正文没有渲染')
    else {
      if (texts[0].props['data-editable'] !== 'true') editGuards.push('paragraph-read: 正文没有标成可编辑')
      if (typeof texts[0].props.onClick !== 'function') editGuards.push('paragraph-read: 点正文不进编辑态')
      if (String(texts[0].props.title || '') !== 'work.editHint') editGuards.push('paragraph-read: 正文没有说明「点一下就能改」')
      if (typeof texts[0].props.onClick === 'function') {
        const before = smokeSetters.length
        texts[0].props.onClick({ currentTarget: { textContent: '秩序感先给画面，再给判断。', contains: () => true }, clientX: 0, clientY: 0 })
        if (smokeSetters.length === before) editGuards.push('paragraph-read: 点正文没有触发任何状态变化（进不了编辑态）')
      }
    }
    if ((readDraw.elements || []).some((el) => el.tag === 'textarea')) editGuards.push('paragraph-read: 未进入编辑态却渲染了输入框')
    for (const needle of ['work.attach', 'action.edit']) if (!readDraw.text.includes(needle)) editGuards.push('paragraph-read: 缺 ' + needle)
  }

  const editDraw = byLabel0('paragraph-edit')
  if (!editDraw) editGuards.push('paragraph-edit: 未渲染')
  else {
    const areas = (editDraw.elements || []).filter((el) => el.tag === 'textarea')
    if (areas.length === 0) editGuards.push('paragraph-edit: 编辑态没有输入框')
    else {
      if (String(areas[0].props.value || '') !== '改过的句子，还没保存。') editGuards.push('paragraph-edit: 输入框没有带上正在改的文字')
      if (typeof areas[0].props.onChange !== 'function') editGuards.push('paragraph-edit: 输入框不可编辑')
      if (typeof areas[0].props.onBlur !== 'function') editGuards.push('paragraph-edit: 失焦不保存')
      if (typeof areas[0].props.onKeyDown !== 'function') editGuards.push('paragraph-edit: 没有键盘处理（Esc / Ctrl+Enter）')
    }
    const buttons = (editDraw.elements || []).filter((el) => el.tag === 'button')
    const hasSave = buttons.some((el) => String(el.props.children || '') === 'action.save' && typeof el.props.onClick === 'function')
    const hasCancel = buttons.some((el) => String(el.props.children || '') === 'action.cancel' && typeof el.props.onClick === 'function')
    if (!hasSave) editGuards.push('paragraph-edit: 编辑态没有「保存」按钮')
    if (!hasCancel) editGuards.push('paragraph-edit: 编辑态没有「取消」按钮')
    if (editDraw.text.indexOf('action.edit') >= 0) editGuards.push('paragraph-edit: 编辑态还留着「编辑」按钮')
  }

  const failedDraw = byLabel0('paragraph-edit-failed')
  if (!failedDraw) editGuards.push('paragraph-edit-failed: 未渲染')
  else {
    if (!failedDraw.text.includes('provider rate limited (429)')) editGuards.push('paragraph-edit-failed: 保存失败没有显示原因')
    const areas = (failedDraw.elements || []).filter((el) => el.tag === 'textarea')
    if (areas.length === 0) editGuards.push('paragraph-edit-failed: 失败后输入框消失了')
    else if (String(areas[0].props.value || '') !== '改过的句子，保存失败了。') editGuards.push('paragraph-edit-failed: 失败后把用户改的文字丢了')
  }

  // 出处选择器：三类记录都能挂，且不接受 material:（那条线已经下线）。
  if (typeof smoke.ParagraphSources === 'function') {
    const pool = [
      { sourceId: 'note:n_smoke1', kind: 'note', chapter: '开场白', text: '诗是生命的流露。', at: 3 },
      { sourceId: 'thought:t_smoke1', kind: 'thought', chapter: '开场白', text: '读诗要先把自己放进去。', at: 2 },
      { sourceId: 'response:r_smoke1', kind: 'response', chapter: '', text: '秩序感先给画面。', at: 1 },
    ]
    renderStandalone('paragraph-sources', smoke.ParagraphSources, { paragraph: editParagraph, pool, onAttach: () => Promise.resolve() }, [true, [], false, ''])
    const sourceDraw = byLabel0('paragraph-sources')
    if (!sourceDraw) editGuards.push('paragraph-sources: 未渲染')
    else {
      const rows = (sourceDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-pickrow')
      if (rows.length !== 3) editGuards.push(`paragraph-sources: 出处行数 ${rows.length}（应为 3）`)
      for (const needle of ['src.note', 'src.thought', 'src.response'])
        if (!sourceDraw.text.includes(needle)) editGuards.push('paragraph-sources: 缺 ' + needle)
      if (sourceDraw.text.indexOf('material:') >= 0) editGuards.push('paragraph-sources: 还在用已经下线的 material: 来源')
      if (rows.some((el) => typeof el.props.onClick !== 'function')) editGuards.push('paragraph-sources: 出处行不可点')
    }
  } else {
    editGuards.push('client module 未暴露 ParagraphSources')
  }

  // composer 里的出处选择器：换掉恒空的 materials，改列这本书的划线/想法/回应。
  const composerDraw = byLabel0('works')
  if (!composerDraw) editGuards.push('works: 未渲染，无法断言 composer 的出处选择器')
  else {
    const rows = (composerDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-pickrow')
    if (rows.length === 0) editGuards.push('works: composer 没有渲染出处选择器')
    const kinds = new Set(rows.map((el) => (String(el.props.key || '').split(':')[0] || '')))
    if (![...kinds].every((kind) => ['note', 'thought', 'response'].indexOf(kind) >= 0))
      editGuards.push('works: composer 的出处里混进了 ' + [...kinds].filter((kind) => ['note', 'thought', 'response'].indexOf(kind) < 0).join(','))
    if (!composerDraw.text.includes('work.pickSource')) editGuards.push('works: composer 没有出处选择器的说明')
  }
} else {
  editGuards.push('client module 未暴露 ParagraphRow')
}

if (typeof smoke.sourcePoolOf !== 'function') editGuards.push('client module 未暴露 sourcePoolOf')
else {
  const poolCraft = smokeCraft()
  const poolRows = smoke.sourcePoolOf(payload, poolCraft, '')
  if (poolRows.length === 0) editGuards.push('sourcePoolOf: 没有从真实数据里取出任何记录')
  if (poolRows.length > 40) editGuards.push('sourcePoolOf: 超过 40 条上限')
  if (poolRows.some((row) => String(row.sourceId).indexOf('material:') === 0)) editGuards.push('sourcePoolOf: 素材不该再出现在出处里')
  const firstBookId = poolRows.length > 0 ? payload.notes.find((note) => `note:${note.id}` === poolRows[0].sourceId) : null
  if (firstBookId) {
    const scopedRows = smoke.sourcePoolOf(payload, poolCraft, firstBookId.bookId)
    if (scopedRows.some((row) => !String(row.sourceId).startsWith('note:') && !String(row.sourceId).startsWith('thought:')))
      editGuards.push('sourcePoolOf: 按书过滤后混进了别的书的记录')
  }
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
const CRAFT_STAGE = { responses: 'think', works: 'create', timeline: 'grow', annual: 'grow' }
function checkJourneys(guards, byLabel, bookDraw) {
  for (const label of ['responses', 'works', 'timeline', 'annual']) {
    const draw = byLabel(label)
    if (!draw) { journeyGuards.push(`${label}: 未渲染`); continue }
    // 两层导航在每一个内页上都得在：第一行四个旅程 + 第二行当前旅程的口径说明。
    for (const needle of ['nav.read', 'nav.think', 'nav.create', 'nav.grow']) {
      if (!draw.text.includes(needle)) journeyGuards.push(`${label}: 缺旅程标签 ${needle}`)
    }
    const stage = CRAFT_STAGE[label]
    if (!draw.text.includes(`journey.${stage}.hint`)) journeyGuards.push(`${label}: 第二行导航缺 journey.${stage}.hint`)
  }
  if (byLabel('responses')) {
    // 「对话本身不落盘」那句说明已按用户要求删掉；这一页要留的是出处与采纳时间。
    if (!byLabel('responses').text.includes('thinkView.adoptedAt')) journeyGuards.push('responses: 缺采纳时间')
    if (byLabel('responses').text.includes('thinkView.hint')) journeyGuards.push('responses: 那句「对话不落盘」的提示还在')
  }
  if (byLabel('works') && !byLabel('works').text.includes('work.export')) journeyGuards.push('works: 缺导出按钮')
  const worksDraw = byLabel('works')
  if (worksDraw) {
    if (worksDraw.text.indexOf('work.confirm') >= 0) journeyGuards.push('works: 还渲染了「确认初稿」按钮')
    if (worksDraw.text.indexOf('work.confirmed') >= 0) journeyGuards.push('works: 还渲染了「已确认」标签')
    const confirmButton = (worksDraw.elements || []).some((el) => el.tag === 'button' && (el.props.children || '') === 'work.confirm')
    if (confirmButton) journeyGuards.push('works: 「确认初稿」按钮仍在')
  }
  if (byLabel('annual') && !byLabel('annual').text.includes('grow.annual.title')) journeyGuards.push('annual: 缺年度回顾标题')
  // 空库：每段都是一句下一步 + 一个按钮，不能只剩一个「暂无数据」。
  const emptyExpect = {
    'craft-empty': ['work.empty.title', 'work.empty.next', 'work.empty.action'],
    'craft-empty-think': ['thinkView.empty.title', 'thinkView.empty.next', 'thinkView.empty.action'],
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
  if (bookDraw && !bookDraw.text.includes('thread.title')) journeyGuards.push('book: 缺「我的阅读脉络」')
if (bookDraw && bookDraw.text.includes('chain.title')) journeyGuards.push('book: 六格计数块应该已经退场')
const threadsDraw = byLabel('book-threads')
if (!threadsDraw) journeyGuards.push('book-threads: 未渲染')
else {
  // 覆盖行的每个数字都来自宿主 coverage，不是前端自己数的。
  if (!threadsDraw.text.includes('thread.coverage')) journeyGuards.push('book-threads: 缺覆盖行')
  if (!threadsDraw.text.includes('读诗时我总先要一个画面')) journeyGuards.push('book-threads: 线索标题没渲染')
  if (!threadsDraw.text.includes('thread.lastAt')) journeyGuards.push('book-threads: 缺生成时间')
  const records = (threadsDraw.elements || []).filter((item) => item.tag === 'button' && String(item.props.className || '').split(/\s+/).indexOf('wr-thread-record') !== -1)
  if (records.length === 0) journeyGuards.push('book-threads: 证据没有可点回原文的入口')
  if (!records.every((item) => typeof item.props.onClick === 'function')) journeyGuards.push('book-threads: 有证据点不回去')
}
const threadsResult = byLabel('threads-result')
if (!threadsResult) journeyGuards.push('threads-result: 未渲染')
else {
  if (!threadsResult.text.includes('thread.coverage')) journeyGuards.push('threads-result: 缺覆盖行')
  if (!threadsResult.text.includes('thread.why')) journeyGuards.push('threads-result: 缺「为什么值得回看」')
  if (!threadsResult.text.includes('thread.write')) journeyGuards.push('threads-result: 缺「写进作品」')
  const recordButtons = (threadsResult.elements || []).filter((item) => item.tag === 'button' && String(item.props.className || '').split(/\s+/).indexOf('wr-thread-record') !== -1)
  if (recordButtons.length === 0) journeyGuards.push('threads-result: 证据没渲染成按钮')
}
const threadsEmpty = byLabel('threads-empty')
if (!threadsEmpty) journeyGuards.push('threads-empty: 未渲染')
else {
  if (!threadsEmpty.text.includes('thread.emptyNone')) journeyGuards.push('threads-empty: 没交代「先划一句」')
  if (threadsEmpty.text.includes('thread.build')) journeyGuards.push('threads-empty: 记录不够却给了梳理按钮')
  const gates = (threadsEmpty.elements || []).filter((item) => item.tag === 'button' && String(item.props.className || '').indexOf('wr-threads-build') !== -1)
  if (gates.length !== 0) journeyGuards.push('threads-empty: 门槛没拦住按钮')
}
const threadsError = byLabel('threads-error')
if (!threadsError) journeyGuards.push('threads-error: 未渲染')
else {
  if (!threadsError.text.includes('provider rate limited (429)')) journeyGuards.push('threads-error: 没显示真实错误')
  if (!threadsError.text.includes('think.retry')) journeyGuards.push('threads-error: 没有重试')
}
const threadsCapped = byLabel('threads-capped')
if (!threadsCapped) journeyGuards.push('threads-capped: 未渲染')
else if (!threadsCapped.text.includes('thread.capped')) journeyGuards.push('threads-capped: 超上限没有提示')
const threadsSuggest = byLabel('threads-suggest')
if (!threadsSuggest) journeyGuards.push('threads-suggest: 未渲染')
else {
  if (!threadsSuggest.text.includes('thread.suggestTitle')) journeyGuards.push('threads-suggest: 建议对没显示')
  const adoptButtons = (threadsSuggest.elements || []).filter((item) => item.tag === 'button' && String(item.props.className || '').indexOf('wr-thread-adopt') !== -1)
  if (adoptButtons.length === 0) journeyGuards.push('threads-suggest: 建议对没有采纳入口')
  if (!adoptButtons.every((item) => typeof item.props.onClick === 'function')) journeyGuards.push('threads-suggest: 采纳按钮点不动')
}
  if (bookDraw && !bookDraw.text.includes('synced.at')) guards.push('book: 缺微读更新时间')
  // 1.2.2：六格计数块整块退场，「我的阅读脉络」接手；旧视图不该再被渲染。
  if (byLabel('book-chain-degraded')) journeyGuards.push('book-chain-degraded: 这个视图应该已经退场')
  // 页脚两个时间各说各话。
  if (byLabel('works') && !byLabel('works').text.includes('synced.craftAt')) journeyGuards.push('works: 缺创作更新时间')

  // B1：时间线的每一条都得能回到产生它的那本书，跨书的事件降级成不可点而不是假装可点。
  const tlItems = (label) =>
    ((byLabel(label) || {}).elements || []).filter((el) => String(el.props.className || '').split(' ').includes('wr-tl-item'))
  const timelineItems = tlItems('timeline')
  if (timelineItems.length < 2) journeyGuards.push(`timeline: 事件行太少（${timelineItems.length}）`)
  if (timelineItems.some((el) => el.tag !== 'button')) journeyGuards.push('timeline: 事件行不是可点 button')
  if (!timelineItems.some((el) => el.tag === 'button' && typeof el.props.onClick === 'function' && el.props.disabled !== true))
    journeyGuards.push('timeline: 没有任何一条能点回书页')
  if (!timelineItems.some((el) => el.props['data-kind'] === 'work' && el.props.disabled !== true))
    journeyGuards.push('timeline: 作品事件不能点回书页')
  if (byLabel('timeline-cross') && byLabel('timeline-cross').text.includes('grow.cross'))
    journeyGuards.push('timeline-cross: 还在显示「跨书」这种后台标签')
  if (byLabel('timeline-cross') && byLabel('timeline-cross').text.indexOf('grow.multiBooks') < 0)
    journeyGuards.push('timeline-cross: 跨两本书的稿子没写「等 N 本」')

  // B4：把一本书放进 GROW，时间线只留这本书的事件；别的书进来必须是空态。
  const scopedTimeline = tlItems('timeline-scoped')
  if (scopedTimeline.length === 0) journeyGuards.push('timeline-scoped: 这本书的事件一条都没留下')
  if (scopedTimeline.length >= timelineItems.length) journeyGuards.push(`timeline-scoped: 按书过滤后行数没有变少（${scopedTimeline.length}/${timelineItems.length}）`)
  const scopedBookTitle = String((anyBook && anyBook.title) || '')
  const whereOf = (el) => {
    const kids = (el.props.children || []).filter((kid) => kid && typeof kid === 'object')
    const where = kids[2]
    return where ? nodeText(where) : ''
  }
  if (scopedBookTitle !== '' && scopedTimeline.some((el) => whereOf(el).indexOf(scopedBookTitle) < 0))
    journeyGuards.push('timeline-scoped: 混进了别的书的记录')
  if (byLabel('timeline-scoped-other') && !byLabel('timeline-scoped-other').text.includes('grow.empty.title'))
    journeyGuards.push('timeline-scoped-other: 别的书的事件串进了这本书的时间线')


  // B6：年度回顾要能说出「这一年」，也要能把这一年导出去。
  const annualDraw = byLabel('annual')
  if (annualDraw) {
    for (const needle of ['grow.annual.title', 'grow.annual.export']) {
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

// F-35：来源标签是 `t(`src.${kind}`)` 拼出来的，静态 grep 看不见它取了哪些键。
// 用真实中文文案渲染一条 response: 与一条 material: 来源，确认标签是中文，
// 而不是把 key 本身（src.response · …）印到界面上。
const sourceGuards = []
if (typeof smoke.SourceTags !== 'function') sourceGuards.push('client module 未暴露 SourceTags')
else {
  const sourceLookup = {
    note: new Map(),
    thought: new Map(),
    response: new Map([['r_source', { id: 'r_source', text: '秩序感先给画面，再给判断。' }]]),
    material: new Map([['m_source', { id: 'm_source', type: '金句', text: '诗是生命的流露。' }]]),
  }
  localeText = true
  renderStandalone('source-tags-real', smoke.SourceTags, {
    sourceIds: ['response:r_source', 'material:m_source'],
    lookup: sourceLookup,
  }, [])
  localeText = false
  const sourceDraw = byLabel0('source-tags-real')
  if (!sourceDraw) sourceGuards.push('source-tags-real: 未渲染')
  else {
    if (sourceDraw.text.includes('src.')) sourceGuards.push(`source-tags-real: 来源标签把 locale key 印出来了（${sourceDraw.text.slice(0, 60)}）`)
    if (!sourceDraw.text.includes('我采纳的 AI 回应')) sourceGuards.push('source-tags-real: 回应的来源标签不是中文')
    if (!sourceDraw.text.includes('我整理的素材')) sourceGuards.push('source-tags-real: 素材的来源标签不是中文')
    if (!sourceDraw.text.includes('秩序感先给画面')) sourceGuards.push('source-tags-real: 回应正文没渲染出来')
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
// 从渲染树里取纯文本：children 可能是字符串、数组或嵌套节点。
const nodeText = (node) => {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  const kids = node && node.props ? node.props.children : undefined
  return kids === undefined ? '' : nodeText(kids)
}
// 时间线：按月分组、每条三行、整行可点（作品带 focusWorkId 的那一篇）。
const timelineGuards = []
if (typeof smoke.GrowTimeline === 'function') {
  const fixture = timelineFixture()
  const opened = []
  const timelineProps = {
    craft: fixture.craft,
    craftState: 'ready',
    craftError: '',
    data: fixture.data,
    bookIdOf: fixture.bookIdOf,
    scopeBookId: '',
    onOpenSource: (sourceId) => opened.push(sourceId),
    onOpenWork: (workId) => opened.push(`work:${workId}`),
    onOpenBook: (bookId) => opened.push(`book:${bookId}`),
    onGoShelf: () => {},
    onRetry: () => {},
  }
  renderStandalone('timeline-rows', smoke.GrowTimeline, timelineProps, [0])
  const draw = byLabel0('timeline-rows')
  const elements = (draw && draw.elements) || []
  const itemOf = (el) => String(el.props.className || '').split(' ').includes('wr-tl-item')
  const items = elements.filter(itemOf)
  if (items.length !== 6) timelineGuards.push(`timeline-rows: 事件行 ${items.length}（应为 6）`)
  // 一条 = 三行：时间+动作 / 正文 / 书名·章节。
  for (const item of items) {
    const kids = (item.props.children || []).filter((kid) => kid && typeof kid === 'object')
    if (kids.length !== 3) timelineGuards.push(`timeline-rows: 一条记录不是三行（${kids.length}）`)
    const classes = kids.map((kid) => String((kid.props && kid.props.className) || ''))
    if (classes.join(',') !== 'wr-tl-meta,wr-tl-body,wr-tl-where') timelineGuards.push('timeline-rows: 三行的层级不是 meta/body/where')
    const meta = kids[0] && (kids[0].props.children || []).filter((kid) => kid && typeof kid === 'object')
    if (!meta || meta.length !== 2) timelineGuards.push('timeline-rows: 第一行不是「时间 + 动作」')
    if (item.tag !== 'button' || typeof item.props.onClick !== 'function' || item.props.disabled === true)
      timelineGuards.push('timeline-rows: 事件行不可点')
  }
  // 月份标题一行就说完：月份 + 该月条数；不再有「共 N 条」。
  const months = elements.filter((el) => String(el.props.className || '') === 'wr-tl-month')
  if (months.length !== 3) timelineGuards.push(`timeline-rows: 月份分组 ${months.length}（应为 3）`)
  if (months[0]) {
    const kids = (months[0].props.children || []).filter((kid) => kid && typeof kid === 'object')
    const texts = kids.map(nodeText)
    if (kids.length !== 2) timelineGuards.push('timeline-rows: 月份标题不是「月份 + 条数」')
    if (!String(texts[0] || '').includes('grow.monthLabel')) timelineGuards.push('timeline-rows: 月份标题缺月份')
    if (!String(texts[1] || '').includes('grow.monthCountInline')) timelineGuards.push('timeline-rows: 月份标题缺条数')
  }
  if (draw && draw.text.includes('grow.total')) timelineGuards.push('timeline-rows: 还在显示「共 N 条」')
  if (draw && draw.text.includes('grow.cross')) timelineGuards.push('timeline-rows: 还在显示「跨书」')
  if (draw && draw.text.indexOf('grow.noBook') < 0) timelineGuards.push('timeline-rows: 没有书归属的记录没写「未关联书」')
  if (draw && draw.text.indexOf('grow.multiBooks') < 0) timelineGuards.push('timeline-rows: 跨两本书的稿子没写「等 N 本」')
  // 三种动作都要出现过（「确认初稿」这一类已随状态退场）。
  for (const key of ['grow.event.thought', 'grow.event.response', 'grow.event.work'])
    if (draw && draw.text.indexOf(key) < 0) timelineGuards.push(`timeline-rows: 缺动作 ${key}`)
  if (draw && draw.text.indexOf('grow.event.workConfirmed') >= 0) timelineGuards.push('timeline-rows: 还在显示「确认初稿」这类动作')
  // 点一行 = 回到它该去的地方：想法/回应带 sourceId，作品带 workId。
  const click = (kind, needle) => {
    const row = items.find((el) => el.props['data-kind'] === kind && (!needle || String(el.props.title || '').includes(needle)))
    if (!row) {
      timelineGuards.push(`timeline-rows: 找不到 ${kind} 行`)
      return
    }
    row.props.onClick({ stopPropagation() {} })
  }
  click('thought')
  click('response')
  click('work', '跨两本书')
  if (opened[0] !== 'thought:th_t1') timelineGuards.push(`timeline-rows: 想法行没回到原记录（${opened[0]}）`)
  if (opened[1] !== 'response:r_t1') timelineGuards.push(`timeline-rows: 回应行没回到原记录（${opened[1]}）`)
  if (opened[2] !== 'work:w_t2') timelineGuards.push(`timeline-rows: 作品行没带 focusWorkId（${opened[2]}）`)
} else {
  timelineGuards.push('client module 未暴露 GrowTimeline')
}

// 作品页：带着 focusWorkId 进来时必须选中的就是那一篇（否则多书作品会开错篇）。
if (typeof smoke.WorkBoard === 'function') {
  const fixture = timelineFixture()
  const writes = []
  renderStandalone(
    'works-focus',
    smoke.WorkBoard,
    {
      craft: fixture.craft,
      craftState: 'ready',
      craftError: '',
      data: fixture.data,
      bookIdOf: fixture.bookIdOf,
      scopeBookId: '',
      focusWorkId: 'w_t2',
      lookup: {},
      write: (op, resPayload) => {
        writes.push([op, resPayload])
        return Promise.resolve({})
      },
      onOpenSource: () => {},
      onOpenBook: () => {},
    },
    [],
  )
  const activeTitle = (label) => {
    const draw = byLabel0(label)
    const head = ((draw && draw.elements) || []).find((el) => String(el.props.className || '') === 'wr-draft-head-title')
    if (!head) return null
    const kids = head.props.children || []
    return nodeText(kids)
  }
  const focusTitle = activeTitle('works-focus')
  if (focusTitle === null) timelineGuards.push('works-focus: 未渲染')
  else {
    if (focusTitle.indexOf('跨两本书的初稿') < 0) timelineGuards.push(`works-focus: 没打开 focusWorkId 指定的那一篇（${focusTitle}）`)
    if (focusTitle.indexOf('单书初稿') >= 0) timelineGuards.push('works-focus: 打开了另一篇（focusWorkId 没生效）')
  }
  // 反向：不传 focusWorkId 时，默认选中更新时间最新的那篇。
  renderStandalone(
    'works-nofocus',
    smoke.WorkBoard,
    Object.assign({}, {
      craft: fixture.craft,
      data: fixture.data,
      bookIdOf: fixture.bookIdOf,
      lookup: {},
      write: () => Promise.resolve({}),
      onOpenSource: () => {},
      onOpenBook: () => {},
    }, { focusWorkId: '' }),
    [],
  )
  const noFocusTitle = activeTitle('works-nofocus')
  if (noFocusTitle === null || noFocusTitle.indexOf('单书初稿') < 0) timelineGuards.push(`works-nofocus: 没有 focusWorkId 时应选中最近更新的一篇（${noFocusTitle}）`)
}

// 年度回顾：不再挂常驻说明，也不再重复画一次热力图。
const annualDraw2 = byLabel('annual')
if (annualDraw2) {
  if (annualDraw2.text.includes('grow.annual.note')) journeyGuards.push('annual: 还挂着常驻说明')
  const hasHeat = (annualDraw2.elements || []).some((el) => String(el.props.className || '').indexOf('wr-heat') >= 0)
  if (hasHeat) journeyGuards.push('annual: 又画了一次热力图（总览里已经有了）')
}
for (const item of bannerGuards) guards.push(item)
for (const item of timelineGuards) guards.push(item)
for (const item of thoughtGuards) guards.push(item)
for (const item of packGuards) guards.push(item)
for (const item of relateGuards) guards.push(item)
for (const item of sourceGuards) guards.push(item)
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