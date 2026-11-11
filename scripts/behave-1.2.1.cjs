// 1.2.1 放行门槛 · 客户端行为自检（无需浏览器）
//
// 目的：在真实 client.js 上把「四段旅程导航 / 按书过滤 / 出处可点回 / 无模型置灰 /
// 对话流式 / 空态与降级」这些只有点下去才知道的行为跑一遍。它不替代真浏览器验收，
// 但把「读代码觉得没问题」换成「渲染出来的元素真的长这样」。
//
// 用法（仓库根目录一条命令）：
//   node scripts/behave-1.2.1.cjs
//
// 安全：数据来自脚本内固定的两本书夹具，写进 mkdtemp 出来的临时 DSH_HOME，
// 不读也不写 ~/.dsh/weread-gather。KEEP=1 可保留临时目录以便排查。

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { pathToFileURL } = require('node:url')

const root = path.join(__dirname, '..')
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-behave121-'))
const workDir = path.join(home, 'weread-gather')
fs.mkdirSync(workDir, { recursive: true })

// --- 固定的两本书夹具（示例数据，不来自任何人的书架） -----------------------
const BOOK_A = { bookId: '3300043210', title: '诗经', author: '佚名', category: '文学', noteCount: 2, reviewCount: 1, readUpdateTime: 1762000000, cover: '' }
const BOOK_B = { bookId: '900001', title: '另一本书', author: '某作者', category: '社会', noteCount: 1, reviewCount: 1, readUpdateTime: 1762000001, cover: '' }
const NOTE_A1 = { id: 'nt_a1', bookId: BOOK_A.bookId, bookTitle: BOOK_A.title, author: BOOK_A.author, chapterTitle: '周南·关雎', text: '关关雎鸠，在河之洲。窈窕淑女，君子好逑。', createTime: 1762000100, star: 1 }
const NOTE_A2 = { id: 'nt_a2', bookId: BOOK_A.bookId, bookTitle: BOOK_A.title, author: BOOK_A.author, chapterTitle: '周南·关雎', text: '参差荇菜，左右流之。', createTime: 1762000101, star: 0 }
const NOTE_B1 = { id: 'nt_b1', bookId: BOOK_B.bookId, bookTitle: BOOK_B.title, author: BOOK_B.author, chapterTitle: '第一章', text: '这一段只属于第二本书。', createTime: 1762000102, star: 0 }
const THOUGHT_A = { id: 'th_a1', bookId: BOOK_A.bookId, bookTitle: BOOK_A.title, author: BOOK_A.author, chapterName: '周南·关雎', content: '读起来像在讲一种自然的秩序。', createTime: 1762000200, star: -1 }
const THOUGHT_B = { id: 'th_b1', bookId: BOOK_B.bookId, bookTitle: BOOK_B.title, author: BOOK_B.author, chapterName: '第一章', content: '第二本书的想法。', createTime: 1762000201, star: -1 }

const dataset = {
  updatedAt: 1762000300,
  shelfTotal: 2,
  books: [BOOK_A, BOOK_B],
  notes: [NOTE_A1, NOTE_A2, NOTE_B1],
  thoughts: [THOUGHT_A, THOUGHT_B],
  archives: [],
  dashboard: { totalBooks: 2, totalNotes: 3, totalThoughts: 2, readDays: 2 },
  warnings: [],
  years: [{ year: 2026, total: 12 }],
}
fs.writeFileSync(path.join(workDir, 'data.json'), JSON.stringify(dataset, null, 2), 'utf8')
fs.writeFileSync(path.join(workDir, 'config.json'), JSON.stringify({ apiKey: '' }, null, 2), 'utf8')

// --- 断言小工具 --------------------------------------------------------------
const results = []
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: detail === undefined ? '' : String(detail) })
  return Boolean(ok)
}
function eq(name, actual, expected) {
  return check(name, actual === expected, `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)
}
function has(name, haystack, needle) {
  const text = String(haystack === undefined || haystack === null ? '' : haystack)
  return check(name, text.includes(needle), `缺少 ${JSON.stringify(needle)}`)
}
function missing(name, haystack, needle) {
  const text = String(haystack === undefined || haystack === null ? '' : haystack)
  return check(name, !text.includes(needle), `不应出现 ${JSON.stringify(needle)}`)
}

// --- 极简 React 兼容层：useState 按调用位置播种，setter 记录下来供重放 ------
const makeH = () =>
  function h(type, props, ...children) {
    const merged = Object.assign({}, props || {})
    if (children.length === 1) merged.children = children[0]
    else if (children.length > 1) merged.children = children
    return { type, props: merged }
  }
let hookSeeds = []
let hookIndex = 0
let setterLog = []
function resetHooks(seeds) {
  hookSeeds = seeds || []
  hookIndex = 0
  setterLog = []
}
const ReactShim = {
  Fragment: '__fragment__',
  createElement: makeH(),
  useState(initial) {
    const at = hookIndex
    const seeded = hookSeeds[hookIndex]
    hookIndex += 1
    return [seeded === undefined ? initial : seeded, (updater) => setterLog.push({ at, updater })]
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

// fetch 桩：/chat/models 的可达性由 net.modelsAvailable 控制；/chat 返回一段 SSE。
const net = { modelsAvailable: false, chatFrames: [], chatStatus: 200, calls: [] }
function sseResponse(frames) {
  const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('')
  const bytes = new TextEncoder().encode(body)
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        let used = false
        return {
          async read() {
            if (used) return { done: true, value: undefined }
            used = true
            return { done: false, value: bytes }
          },
        }
      },
    },
  }
}

async function main() {
  process.env.DSH_HOME = home
  const mod = await import(pathToFileURL(path.join(root, 'index.js')).href)
  const I = mod.__internals
  const host = I.createHost({})

  // --- 真实的 A/B 两本书链路：不是手搓对象，而是走 craftOp 真写一遍 ----------
  const write = (op, payload) => host.craftOp(op, payload, host.craftSummary().revision)
  const responseA = write('response.add', { text: '对话里采纳的一句：秩序感先给画面。', sourceIds: [`note:${NOTE_A1.id}`] }).created.response
  const materialA = write('material.add', { type: '观点', text: '先给画面，再给判断。', sourceIds: [`note:${NOTE_A1.id}`, `response:${responseA.id}`] }).created.material
  write('topic.add', { statement: '《诗经》里的秩序感', materialIds: [materialA.id], gapNote: '还缺反例' })
  const workA = write('work.add', { title: 'A 书的稿子' }).created.work
  write('work.paragraph.add', { id: workA.id, text: '第一段：先是鸟鸣。', sourceIds: [`material:${materialA.id}`], ai: true, aiOriginIds: [responseA.id] })

  const responseB = write('response.add', { text: '第二本书的回应。', sourceIds: [`note:${NOTE_B1.id}`] }).created.response
  const materialB = write('material.add', { type: '案例', text: '第二本书的案例。', sourceIds: [`note:${NOTE_B1.id}`, `response:${responseB.id}`] }).created.material
  write('topic.add', { statement: '第二本书的选题', materialIds: [materialB.id] })
  const workB = write('work.add', { title: 'B 书的稿子' }).created.work
  write('work.paragraph.add', { id: workB.id, text: '手写一段，没有 AI 参与。', sourceIds: [`material:${materialB.id}`] })

  const craft = host.craftView()
  check('夹具：A/B 两本书各有一篇稿', craft.works.length === 2, JSON.stringify(craft.works.map((item) => item.title)))
  check('夹具：书页链路计数由宿主给出', craft.bookIndex.length === 2, JSON.stringify(craft.bookIndex.map((item) => item.bookId)))

  const lookup = {
    note: new Map(dataset.notes.map((item) => [item.id, item])),
    thought: new Map(dataset.thoughts.map((item) => [item.id, item])),
    response: new Map(craft.responses.map((item) => [item.id, item])),
    material: new Map(craft.materials.map((item) => [item.id, item])),
  }
  const byBook = (sourceId) => {
    const raw = String(sourceId || '')
    const cut = raw.indexOf(':')
    const kind = cut < 0 ? '' : raw.slice(0, cut)
    const id = cut < 0 ? raw : raw.slice(cut + 1)
    const hit = lookup[kind] ? lookup[kind].get(id) : null
    return hit && hit.bookId ? String(hit.bookId) : ''
  }

  const statePayload = {
    ok: true,
    configured: true,
    fromEnv: false,
    maskedKey: '',
    hasData: true,
    updatedAt: dataset.updatedAt,
    counts: { books: 2, notes: 3, thoughts: 2, booksWithNotes: 2 },
    maxBooks: 60,
    notesPerBook: 200,
    metaLimit: 400,
    dir: workDir,
    exportDir: path.join(workDir, 'exports'),
    craft: { hasCraft: true, revision: craft.revision, updatedAt: craft.updatedAt, counts: craft.counts },
    sync: { running: false },
  }
  const dataPayload = {
    ok: true,
    hasData: true,
    updatedAt: dataset.updatedAt,
    books: dataset.books,
    categories: dataset.categories,
    archives: [],
    shelfTotal: dataset.shelfTotal,
    notes: dataset.notes,
    thoughts: dataset.thoughts,
    dashboard: dataset.dashboard,
    years: dataset.years,
    warnings: [],
    counts: statePayload.counts,
  }

  let clientModule = null
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    TextDecoder,
    TextEncoder,
    AbortController,
    fetch: async (url, init) => {
      const text = String(url)
      net.calls.push({ url: text, body: init && init.body ? String(init.body) : '' })
      if (text.includes('/chat/models')) {
        const body = net.modelsAvailable
          ? { ok: true, available: true, providers: [{ id: 'fake', name: 'Fake', models: [{ id: 'fake-1', name: 'Fake One' }] }], current: { provider: 'fake', model: 'fake-1' } }
          : { ok: true, available: false, providers: [], current: null }
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
      }
      if (text.includes('/chat')) {
        if (net.chatStatus !== 200) {
          return { ok: false, status: net.chatStatus, json: async () => ({ ok: false, error: '429 Too Many Requests' }) }
        }
        return sseResponse(net.chatFrames)
      }
      if (text.includes('/craft/export')) {
        const body = { ok: true, document: { markdown: '# 稿子', filename: '稿子 - 初稿.md', exportId: 'craft:work/w1', contentHash: 'sha256:0', containsAI: true } }
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
      }
      if (text.includes('/craft')) {
        const body = craft
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
      }
      if (text.includes('/heat')) {
        const body = { ok: true, year: 2026, days: {}, annual: { total: 12 }, cached: false }
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
      }
      if (text.includes('/state')) {
        const body = statePayload
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
      }
      const body = dataPayload
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
    },
    location: { href: 'http://127.0.0.1:6072/', origin: 'http://127.0.0.1:6072' },
    document: documentStub,
    navigator: { language: 'zh-CN', userAgent: 'node' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: () => {},
    CustomEvent: class {},
    window: {
      __ModuleLoader__: {
        load(entry) {
          clientModule = entry.factory(sandbox.require)
          return clientModule
        },
      },
      addEventListener() {},
      removeEventListener() {},
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      location: { href: 'http://127.0.0.1:6072/' },
    },
  }
  sandbox.require = (id) => {
    if (id === 'react') return ReactShim
    if (id === 'react-dom') return { createPortal: (node) => node }
    throw new Error(`unexpected require(${id})`)
  }
  sandbox.globalThis = sandbox
  sandbox.self = sandbox

  vm.runInNewContext(fs.readFileSync(path.join(root, 'client.js'), 'utf8'), sandbox, { filename: 'client.js' })
  check('client.js 调用了 __ModuleLoader__.load', Boolean(clientModule))

  const registrations = []
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
  clientModule.apply(ctx)
  const smoke = clientModule.__smoke || {}
  const panel = registrations.find((item) => item.registration.key === 'weread')
  check('主面板注册为 weread', Boolean(panel), registrations.map((item) => item.registration.key).join(','))
  if (!panel) throw new Error('client.js 没有注册 weread 面板')

  // --- 渲染 ------------------------------------------------------------------
  function renderNode(node, out) {
    if (node === null || node === undefined || node === false || node === true) return
    if (typeof node === 'string' || typeof node === 'number') {
      out.text += String(node).length > 120 ? `${String(node).slice(0, 120)}…` : String(node)
      return
    }
    if (Array.isArray(node)) {
      for (const child of node) renderNode(child, out)
      return
    }
    const type = node.type
    const props = node.props || {}
    if (type === '__fragment__') {
      renderNode(props.children, out)
      return
    }
    if (typeof type === 'function') {
      out.components.add(type.name || 'anonymous')
      renderNode(type(props), out)
      return
    }
    if (typeof type === 'string') {
      out.tags[type] = (out.tags[type] || 0) + 1
      out.elements.push({ tag: type, props })
      renderNode(props.children, out)
      return
    }
    if (node && node.$$typeof && props.children !== undefined) renderNode(props.children, out)
  }

  // StudyPanel 的 13 个 useState 顺序（与 render-smoke 保持一致）：
  // state,data,error,view,activeBookId,bookTab,query,showSettings,booting,craft,craftState,craftError,scopeBookId
  function seeds(input) {
    const it = input || {}
    return [
      it.state === undefined ? statePayload : it.state,
      it.data === undefined ? dataPayload : it.data,
      it.error === undefined ? '' : it.error,
      it.view === undefined ? 'overview' : it.view,
      it.bookId === undefined ? '' : it.bookId,
      it.bookTab === undefined ? 'notes' : it.bookTab,
      it.query === undefined ? '' : it.query,
      it.showSettings === undefined ? false : it.showSettings,
      it.booting === undefined ? false : it.booting,
      it.craft === undefined ? craft : it.craft,
      it.craftState === undefined ? 'ready' : it.craftState,
      it.craftError === undefined ? '' : it.craftError,
      it.scopeBookId === undefined ? '' : it.scopeBookId,
    ]
  }

  function renderPanel(label, input) {
    resetHooks(seeds(input))
    const out = { text: '', tags: {}, components: new Set(), elements: [] }
    try {
      renderNode(panel.component({}), out)
      return Object.assign({ label, ok: true }, out)
    } catch (error) {
      return { label, ok: false, error: String(error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error), text: '', elements: [], components: new Set(), tags: {} }
    }
  }

  function renderComp(label, component, props, hookSeeds) {
    resetHooks(hookSeeds)
    const out = { text: '', tags: {}, components: new Set(), elements: [] }
    try {
      renderNode(component(props), out)
      return Object.assign({ label, ok: true }, out)
    } catch (error) {
      return { label, ok: false, error: String(error && error.stack ? error.stack.split('\n').slice(0, 3).join(' | ') : error), text: '', elements: [], components: new Set(), tags: {} }
    }
  }

  const get = (label, input) => {
    const draw = renderPanel(label, input)
    if (!draw.ok) check(`渲染 ${label}`, false, draw.error)
    return draw
  }

  // --- 1. 两层导航与 READ 四页 ----------------------------------------------
  const overview = get('overview', { view: 'overview' })
  for (const needle of ['nav.read', 'nav.think', 'nav.create', 'nav.grow']) has('第一行四个旅程标签', overview.text, needle)
  for (const needle of ['nav.overview', 'nav.shelf', 'nav.notes', 'nav.thoughts']) has('READ 第二行四个内页', overview.text, needle)
  has('第二行带本段口径说明', overview.text, 'journey.read.hint')
  const stageIds = (smoke.STAGES || []).map((item) => (Array.isArray(item) ? item[0] : item && item.id))
  eq('STAGES 四段顺序', JSON.stringify(stageIds), JSON.stringify(['read', 'think', 'create', 'grow']))
  const viewCounts = ['read', 'think', 'create', 'grow'].map((stage) => (smoke.STAGE_VIEWS && smoke.STAGE_VIEWS[stage] ? smoke.STAGE_VIEWS[stage].length : -1))
  eq('视图数与 IA 冻结一致（4+1+3+2）', JSON.stringify(viewCounts), JSON.stringify([4, 1, 3, 2]))

  const shelf = get('shelf', { view: 'shelf' })
  // 夹具只有两本书，书架本来就不长；这里验「渲染出内容 + 两本都在」，不拿真实书架的篇幅当门槛。
  check('书架渲染出真实内容', shelf.ok && shelf.text.length >= 200, shelf.text.length)
  has('书架能看到 A 书', shelf.text, BOOK_A.title)
  has('书架能看到 B 书', shelf.text, BOOK_B.title)
  const notesDraw = get('notes', { view: 'notes' })
  check('笔记页渲染出真实内容', notesDraw.ok && notesDraw.text.length >= 200, notesDraw.text.length)
  has('笔记页列出划线原文', notesDraw.text, '关关雎鸠')
  const thoughtsDraw = get('thoughts', { view: 'thoughts' })
  check('想法页渲染出真实内容', thoughtsDraw.ok && thoughtsDraw.text.length >= 500, thoughtsDraw.text.length)
  const searchDraw = get('search', { view: 'shelf', query: '关雎' })
  has('全局搜索命中书名/正文', searchDraw.text, '关雎')
  has('搜索保留类型筛选', searchDraw.text, 'search.typeAll')

  const bookDraw = get('book', { view: 'book', bookId: BOOK_A.bookId })
  has('书页有六段链路块', bookDraw.text, 'chain.title')
  for (const needle of ['chain.notes', 'chain.thoughts', 'chain.responses', 'chain.materials', 'chain.topics', 'chain.works']) {
    has(`书页链路六格：${needle}`, bookDraw.text, needle)
  }
  missing('在架的书不显示「不在缓存」', bookDraw.text, 'chain.cached')

  // --- 2. 按书过滤（F2 + 三类列表） -----------------------------------------
  const materialsA = get('materials-scoped-a', { view: 'materials', scopeBookId: BOOK_A.bookId })
  has('素材按 A 书过滤：留下 A 的素材', materialsA.text, '先给画面，再给判断')
  missing('素材按 A 书过滤：不出现 B 的素材', materialsA.text, '第二本书的案例')
  const materialsB = get('materials-scoped-b', { view: 'materials', scopeBookId: BOOK_B.bookId })
  has('素材按 B 书过滤：留下 B 的素材', materialsB.text, '第二本书的案例')
  missing('素材按 B 书过滤：不出现 A 的素材', materialsB.text, '先给画面，再给判断')
  const responsesA = get('responses-scoped-a', { view: 'responses', scopeBookId: BOOK_A.bookId })
  has('回应按 A 书过滤：留下 A 的回应', responsesA.text, '秩序感先给画面')
  missing('回应按 A 书过滤：不出现 B 的回应', responsesA.text, '第二本书的回应')
  const topicsA = get('topics-scoped-a', { view: 'topics', scopeBookId: BOOK_A.bookId })
  has('选题按 A 书过滤：留下 A 的选题', topicsA.text, '《诗经》里的秩序感')
  missing('选题按 A 书过滤：不出现 B 的选题', topicsA.text, '第二本书的选题')

  const worksAll = get('works-all', { view: 'works' })
  has('F2 无范围时列出 A 的稿', worksAll.text, 'A 书的稿子')
  has('F2 无范围时列出 B 的稿', worksAll.text, 'B 书的稿子')
  const worksA = get('works-scoped-a', { view: 'works', scopeBookId: BOOK_A.bookId })
  has('F2 带 A 范围时出现 A 的稿', worksA.text, 'A 书的稿子')
  missing('F2 带 A 范围时不出现 B 的稿', worksA.text, 'B 书的稿子')
  const worksB = get('works-scoped-b', { view: 'works', scopeBookId: BOOK_B.bookId })
  has('F2 带 B 范围时出现 B 的稿', worksB.text, 'B 书的稿子')
  missing('F2 带 B 范围时不出现 A 的稿', worksB.text, 'A 书的稿子')
  const worksNone = get('works-scoped-none', { view: 'works', scopeBookId: 'weread:book/999999' })
  has('F2 未知书范围落到空态', worksNone.text, 'work.empty.title')
  missing('F2 未知书范围不残留任何稿', worksNone.text, 'A 书的稿子')

  // --- 3. F3：出处 chip 可点回 ----------------------------------------------
  const chips = (draw) => (draw.elements || []).filter((el) => String(el.props.className || '').split(' ').includes('wr-src'))
  const paragraphChips = chips(worksA)
  check('F3 初稿段落渲染了出处 chip', paragraphChips.length > 0, paragraphChips.length)
  check('F3 每个段落 chip 都是可点的 button', paragraphChips.length > 0 && paragraphChips.every((el) => el.tag === 'button' && typeof el.props.onClick === 'function'), paragraphChips.map((el) => el.tag).join(','))

  const craftProps = {
    craft,
    craftState: 'ready',
    craftError: '',
    lookup,
    data: dataPayload,
    scopeBookId: '',
    focusId: '',
    bookIdOf: byBook,
    onOpenSource: null,
    onRetry() {},
    onOpenBook() {},
    onGoShelf() {},
    onGoMaterials() {},
    onGoTopics() {},
    write: () => Promise.resolve(),
    onDraft() {},
    onDelete() {},
  }
  const clickFirst = (draw, filter) => {
    const target = (draw.elements || []).find((el) => el.tag === 'button' && String(el.props.className || '').split(' ').includes('wr-src') && (!filter || filter(el)))
    if (!target) return null
    let got = null
    target.props.onClick({ stopPropagation() {} })
    return { got }
  }
  const opened = []
  const spyProps = Object.assign({}, craftProps, {
    onOpenSource(id) {
      opened.push(String(id))
    },
  })
  const workBoard = renderComp('work-board', smoke.WorkBoard, spyProps, [])
  clickFirst(workBoard)
  check('F3 点段落 chip 会打开素材', opened.length > 0 && opened[0].startsWith('material:'), JSON.stringify(opened))
  const materialBoard = renderComp('material-board', smoke.MaterialBoard, spyProps, [])
  clickFirst(materialBoard, (el) => el.props['data-kind'] === 'note')
  check('F3 点素材 chip 会回到摘录', opened.length > 1 && opened[opened.length - 1].startsWith('note:'), JSON.stringify(opened))
  const topicBoard = renderComp('topic-board', smoke.TopicBoard, spyProps, [])
  clickFirst(topicBoard)
  check('F3 点选题 chip 会回到素材', opened.length > 2 && opened[opened.length - 1].startsWith('material:'), JSON.stringify(opened))

  const openedMissing = []
  const missingTags = renderComp(
    'source-tags-missing',
    smoke.SourceTags,
    { sourceIds: ['note:nt_gone'], lookup: { note: new Map() }, onOpenSource: (id) => openedMissing.push(id) },
    [],
  )
  const missingChip = (missingTags.elements || []).find((el) => String(el.props.className || '').split(' ').includes('wr-src'))
  check('F3 来源缺失时 chip 仍是可点按钮', Boolean(missingChip) && missingChip.tag === 'button' && typeof missingChip.props.onClick === 'function')
  eq('F3 来源缺失时标注 data-missing', missingChip && missingChip.props['data-missing'], 'true')
  if (missingChip) missingChip.props.onClick({ stopPropagation() {} })
  eq('F3 来源缺失时点击仍上报原 id', openedMissing[0], 'note:nt_gone')

  // --- 4. F1：无模型置灰 / 有模型恢复 ---------------------------------------
  const askBase = { pack: '【书房来源包】《诗经》', entry: NOTE_A1, kind: 'note', question: '', anchor: { x: 40, y: 120 }, onClose() {} }
  const askOffline = renderComp('ask-offline', smoke.AskCard, askBase, [[], '写点什么', false, '', '', '', 'offline'])
  const askChips = (askOffline.elements || []).filter((el) => String(el.props.className || '') === 'wr-ask-chip')
  const askSends = (askOffline.elements || []).filter((el) => String(el.props.className || '') === 'wr-ask-send')
  check('F1 无模型：四个胶囊都在', askChips.length === 4, askChips.length)
  check('F1 无模型：四个胶囊全部置灰', askChips.length === 4 && askChips.every((el) => el.props.disabled === true), JSON.stringify(askChips.map((el) => el.props.disabled)))
  check('F1 无模型：已写字时发送键仍置灰', askSends.length === 1 && askSends[0].props.disabled === true, JSON.stringify(askSends.map((el) => el.props.disabled)))
  has('F1 无模型：给出原因文案', askOffline.text, 'think.offline')
  check('F1 无模型：原因挂在 wr-ask-offline 上', (askOffline.elements || []).some((el) => String(el.props.className || '') === 'wr-ask-offline'))

  const askReady = renderComp('ask-ready', smoke.AskCard, askBase, [[], '写点什么', false, '', '', '', 'ready'])
  const readyChips = (askReady.elements || []).filter((el) => String(el.props.className || '') === 'wr-ask-chip')
  const readySends = (askReady.elements || []).filter((el) => String(el.props.className || '') === 'wr-ask-send')
  check('F1 有模型：胶囊恢复可点', readyChips.length === 4 && readyChips.every((el) => el.props.disabled === false), JSON.stringify(readyChips.map((el) => el.props.disabled)))
  check('F1 有模型：有输入时发送键可点', readySends.length === 1 && readySends[0].props.disabled === false, JSON.stringify(readySends.map((el) => el.props.disabled)))
  missing('F1 有模型：不再显示置灰原因', askReady.text, 'wr-ask-offline')
  const askBlank = renderComp('ask-blank', smoke.AskCard, askBase, [[], '', false, '', '', '', 'ready'])
  const blankSend = (askBlank.elements || []).filter((el) => String(el.props.className || '') === 'wr-ask-send')
  check('F1 有模型但空输入：发送键仍禁用', blankSend.length === 1 && blankSend[0].props.disabled === true)

  net.modelsAvailable = false
  const probeOffline = await smoke.forgetChatProbe()
  eq('F1 探测到无模型 → offline', probeOffline, 'offline')
  net.modelsAvailable = true
  const probeReady = await smoke.forgetChatProbe()
  eq('F1 探测到有模型 → ready', probeReady, 'ready')

  // --- 5. 空态与降级 --------------------------------------------------------
  const emptyCraft = smoke.EMPTY_CRAFT || { hasCraft: false, revision: 0, updatedAt: 0, counts: { responses: 0, materials: 0, topics: 0, works: 0 }, responses: [], materials: [], topics: [], works: [], bookIndex: [] }
  const emptyViews = [
    ['materials', ['mat.empty.title', 'mat.empty.next', 'mat.empty.action']],
    ['responses', ['thinkView.empty.title', 'thinkView.empty.next', 'thinkView.empty.action']],
    ['topics', ['topic.empty.title', 'topic.empty.next', 'topic.empty.action']],
    ['works', ['work.empty.title', 'work.empty.next', 'work.empty.action']],
    ['timeline', ['grow.empty.title', 'grow.empty.next']],
  ]
  for (const [view, needles] of emptyViews) {
    const draw = get(`empty-${view}`, { view, craft: emptyCraft })
    for (const needle of needles) has(`${view} 空态有「下一步」：${needle}`, draw.text, needle)
  }
  const craftFailed = get('craft-failed', { view: 'materials', craft: emptyCraft, craftState: 'failed', craftError: '网络开小差了' })
  has('craft 失败有失败提示', craftFailed.text, 'craft.failed')
  has('craft 失败有重试', craftFailed.text, 'craft.retry')
  has('craft 失败不拖垮 READ', craftFailed.text, 'nav.read')
  const setupDraw = get('setup', { state: Object.assign({}, statePayload, { configured: false }), data: null })
  has('未连接时进入设置引导', setupDraw.text, 'setup.title')

  // --- 6. 对话：流式、错误帧、来源包 ----------------------------------------
  const packText = smoke.buildSourcePack({ entry: NOTE_A1, kind: 'note', question: '这句话在说什么？' })
  has('来源包带书名', packText, '《诗经》')
  has('来源包带原文引用', packText, '> 关关雎鸠')

  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: '先看原文，' },
    { type: 'text', text: '再谈感受。' },
    { type: 'done' },
  ]
  const askLive = renderComp('ask-live', smoke.AskCard, askBase, [[], '这句话怎么理解', false, '', '', '', 'ready'])
  const liveSend = (askLive.elements || []).find((el) => String(el.props.className || '') === 'wr-ask-send')
  check('对话卡渲染出可点的发送键', Boolean(liveSend) && typeof liveSend.props.onClick === 'function')
  if (liveSend) {
    liveSend.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 200))
    const replayed = [[], '这句话怎么理解', false, '', '', '', 'ready']
    for (const entry of setterLog) {
      replayed[entry.at] = typeof entry.updater === 'function' ? entry.updater(replayed[entry.at]) : entry.updater
    }
    const messages = replayed[0]
    const answer = messages.filter((item) => item.role === 'assistant').map((item) => item.text).join('')
    has('对话流式文本落到消息里', answer, '先看原文')
    has('第二段流式文本也到了', answer, '再谈感受')
    has('open 帧把模型显示出来', replayed[4], 'fake-1')
  }

  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: '半截回答' },
    { type: 'error', error: '模型调用中断' },
    { type: 'done' },
  ]
  const askError = renderComp('ask-error', smoke.AskCard, askBase, [[], '再试一次', false, '', '', '', 'ready'])
  const errorSend = (askError.elements || []).find((el) => String(el.props.className || '') === 'wr-ask-send')
  if (errorSend) {
    errorSend.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 200))
    const replayed = [[], '再试一次', false, '', '', '', 'ready']
    for (const entry of setterLog) {
      replayed[entry.at] = typeof entry.updater === 'function' ? entry.updater(replayed[entry.at]) : entry.updater
    }
    has('错误帧有明确提示', replayed[3], '模型调用中断')
    has('错误帧不覆盖已写的半截回答', replayed[0].map((item) => item.text).join(''), '半截回答')
  }

  const picker = renderComp('material-picker', smoke.MaterialPicker, { entry: THOUGHT_A, kind: 'thought', context: [NOTE_A1, NOTE_A2], onClose() {} }, ['观点', '', false, ''])
  has('降级①：可选同章摘录', picker.text, 'mat.picker.title')
  has('降级①：可以跳过摘录', picker.text, 'mat.picker.skip')
  has('降级①：说明为什么要点一条摘录', picker.text, 'mat.picker.noteHint')
  has('降级①：列出同章划线原文', picker.text, '关关雎鸠')

  // --- 8. B1/B4：时间线的事件行要回到那本书，且按书筛只留这本书 -----------------
  const tlOpened = { books: [], sources: [] }
  const tlProps = Object.assign({}, craftProps, {
    onOpenBook(bookId, tab) {
      tlOpened.books.push([String(bookId), String(tab || '')])
    },
    onOpenSource(sourceId) {
      tlOpened.sources.push(String(sourceId))
    },
  })
  const tlItems = (draw) => (draw.elements || []).filter((el) => String(el.props.className || '').split(' ').includes('wr-tl-item'))
  const timeline = renderComp('timeline-events', smoke.GrowTimeline, tlProps, [])
  const tlRows = tlItems(timeline)
  check('B1 时间线事件行都是可点 button', tlRows.length >= 4 && tlRows.every((el) => el.tag === 'button'), tlRows.length)
  const workRow = tlRows.find((el) => el.props['data-kind'] === 'work')
  check('B1 时间线里有作品事件', Boolean(workRow))
  has('B1 事件行显示书名', timeline.text, String(BOOK_A.title).slice(0, 6))
  if (workRow) {
    workRow.props.onClick({ stopPropagation() {} })
    check('B1 点作品事件回到那本书', tlOpened.books.length === 1 && tlOpened.books[0][0] === BOOK_A.bookId, JSON.stringify(tlOpened.books))
  }
  const responseRow = tlRows.find((el) => el.props['data-kind'] === 'response')
  if (responseRow) {
    responseRow.props.onClick({ stopPropagation() {} })
    check('B1 点回应事件回到那条回应', tlOpened.sources[0] === `response:${responseA.id}`, JSON.stringify(tlOpened.sources))
  }
  const timelineA = renderComp('timeline-scoped-a', smoke.GrowTimeline, Object.assign({}, tlProps, { scopeBookId: BOOK_A.bookId }), [])
  const timelineB = renderComp('timeline-scoped-b', smoke.GrowTimeline, Object.assign({}, tlProps, { scopeBookId: BOOK_B.bookId }), [])
  has('B4 按 A 书筛时间线留下 A 的素材', timelineA.text, '先给画面，再给判断')
  missing('B4 按 A 书筛时间线不出现 B 的素材', timelineA.text, '第二本书的案例')
  has('B4 按 B 书筛时间线留下 B 的素材', timelineB.text, '第二本书的案例')
  missing('B4 按 B 书筛时间线不出现 A 的素材', timelineB.text, '先给画面，再给判断')
  check('B4 按书筛后事件行数变少', tlItems(timelineA).length < tlRows.length && tlItems(timelineA).length > 0, `${tlRows.length} → ${tlItems(timelineA).length}`)

  const crossCraft = Object.assign({}, craft, {
    topics: craft.topics.concat([
      {
        id: 't_cross',
        statement: '跨两本书的选题',
        materialIds: [materialA.id, materialB.id],
        bookIds: [BOOK_A.bookId, BOOK_B.bookId],
        gapNote: '',
        candidates: [],
        createdAt: craft.updatedAt,
        updatedAt: craft.updatedAt,
      },
    ]),
  })
  const crossTimeline = renderComp('timeline-cross', smoke.GrowTimeline, Object.assign({}, tlProps, { craft: crossCraft }), [])
  const crossRows = tlItems(crossTimeline)
  const crossRow = crossRows.find((el) => el.props['data-cross'] === 'true')
  check('B1 跨书事件降级为不可点', Boolean(crossRow) && crossRow.props.disabled === true)
  has('B1 跨书事件有明确标注', crossTimeline.text, 'grow.cross')
  check('B1 单书事件仍然可点', crossRows.some((el) => el.props['data-cross'] === 'false' && el.props.disabled !== true))

  // --- 9. B3/B5：原位改素材类型、选题书名回到那本书 -----------------------------
  const typeWrites = []
  const materialProps = Object.assign({}, craftProps, {
    scopeBookId: '',
    write(op, payload) {
      typeWrites.push([String(op), payload])
      return Promise.resolve({})
    },
  })
  const materialsBoard = renderComp('materials-type', smoke.MaterialBoard, materialProps, [''])
  const typeSwitch = (materialsBoard.elements || []).find((el) => String(el.props.className || '').split(' ').includes('wr-type-switch'))
  check('B3 素材行有改类型入口', Boolean(typeSwitch) && typeSwitch.tag === 'select' && typeof typeSwitch.props.onChange === 'function')
  if (typeSwitch) {
    typeSwitch.props.onChange({ target: { value: '案例' } })
    check('B3 改类型写回 material.update', typeWrites.length === 1 && typeWrites[0][0] === 'material.update', JSON.stringify(typeWrites.map((item) => item[0])))
    eq('B3 改类型带上的 id 是这条素材', typeWrites[0] && typeWrites[0][1].id, materialA.id)
    eq('B3 改类型带上新类型', typeWrites[0] && typeWrites[0][1].type, '案例')
    const options = (materialsBoard.elements || []).filter((el) => el.tag === 'option')
    check('B3 六类都能选', new Set(options.map((el) => el.props.value)).size === 6, options.length)
    typeSwitch.props.onChange({ target: { value: materialA.type } })
    check('B3 选回原类型不重复写', typeWrites.length === 1, typeWrites.length)
    // 刷新后仍在：把这份载荷真写进宿主，再用宿主回读的 craft 重新渲染。
    host.craftOp('material.update', { id: materialA.id, type: '案例' }, host.craftSummary().revision)
    const refreshed = host.craftView()
    const refreshedMaterial = refreshed.materials.find((item) => item.id === materialA.id)
    eq('B3 刷新后类型仍是新的', refreshedMaterial && refreshedMaterial.type, '案例')
    const refreshedBoard = renderComp(
      'materials-refreshed',
      smoke.MaterialBoard,
      Object.assign({}, craftProps, { craft: refreshed, scopeBookId: '' }),
      [''],
    )
    check(
      'B3 回灌后行内类型即时更新',
      (refreshedBoard.elements || []).some((el) => el.tag === 'select' && el.props.value === '案例'),
    )
  }

  const topicOpened = []
  const topicProps = Object.assign({}, craftProps, {
    scopeBookId: '',
    onOpenBook(bookId, tab) {
      topicOpened.push([String(bookId), String(tab || '')])
    },
  })
  const topicsBoard = renderComp('topics-link', smoke.TopicBoard, topicProps, ['', '', [], false, '', false])
  const topicBookButton = (topicsBoard.elements || []).find(
    (el) => el.tag === 'button' && String(el.props.className || '').split(' ').includes('wr-chip') && typeof el.props.onClick === 'function',
  )
  check('B5 选题上的书名是可点入口', Boolean(topicBookButton))
  if (topicBookButton) {
    topicBookButton.props.onClick({ stopPropagation() {} })
    check('B5 点选题书名回到那本书', topicOpened.length === 1 && [BOOK_A.bookId, BOOK_B.bookId].includes(topicOpened[0][0]), JSON.stringify(topicOpened))
  }

  // --- 10. B6：年度回顾四块 + 这一年的书 + 导出这一年 + 空态 ---------------------
  const annualDays = {}
  for (let at = 1; at <= 9; at += 1) annualDays[`2023-0${at}-0${at}`] = at * 60
  const annualData = {
    years: [{ year: 2023, total: 9 }],
    counts: { notes: 41, thoughts: 12, books: 2 },
    books: [
      { bookId: BOOK_A.bookId, title: BOOK_A.title, year: 2023 },
      { bookId: BOOK_B.bookId, title: BOOK_B.title, year: 2022 },
    ],
  }
  const annualOpened = []
  const annualProps = {
    data: annualData,
    craft,
    craftCounts: craft.counts,
    onGoShelf() {},
    onOpenBook(bookId) {
      annualOpened.push(String(bookId))
    },
  }
  net.calls.length = 0
  const annual = renderComp('annual-blocks', smoke.GrowAnnual, annualProps, [2023, annualDays, { totalReadTime: 3660 }, '', false, ''])
  for (const needle of ['grow.annual.total', 'grow.annual.days', 'grow.annual.notes', 'grow.annual.thoughts']) {
    has(`B6 年度四块：${needle}`, annual.text, needle)
  }
  has('B6 创作计数在年度里', annual.text, 'grow.annual.craft')
  has('B6 这一年读过的书', annual.text, 'grow.annual.books')
  has('B6 列出这一年的书', annual.text, BOOK_A.title)
  missing('B6 不把别的年份的书算进来', annual.text, BOOK_B.title)
  const annualBookChip = (annual.elements || []).find(
    (el) => el.tag === 'button' && String(el.props.className || '').split(' ').includes('wr-chip') && String(el.props.title || '') === BOOK_A.title,
  )
  check('B6 这一年的书是可点入口', Boolean(annualBookChip))
  if (annualBookChip) {
    annualBookChip.props.onClick({ stopPropagation() {} })
    eq('B6 点书回到那本书', annualOpened[0], BOOK_A.bookId)
  }
  const yearExport = (annual.elements || []).find(
    (el) => el.tag === 'button' && typeof el.props.onClick === 'function' && String(el.props.title || '').includes('grow.annual'),
  )
  check('B6 有「导出这一年」按钮', Boolean(yearExport) && yearExport.props.disabled !== true)
  if (yearExport) {
    yearExport.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 120))
    const exported = net.calls.find((item) => item.url.includes('/export') && !item.url.includes('/export/dir'))
    check('B6 导出这一年真的发请求', Boolean(exported), JSON.stringify(net.calls.map((item) => item.url)))
    if (exported) {
      const body = JSON.parse(exported.body || '{}')
      eq('B6 导出范围是这一年的书', JSON.stringify(body.selector && body.selector.bookIds), JSON.stringify([BOOK_A.bookId]))
      eq('B6 导出走保存文件', body.mode, 'file')
    }
  }
  const annualEmpty = renderComp('annual-empty', smoke.GrowAnnual, Object.assign({}, annualProps, { data: { years: [{ year: 2023, total: 0 }], counts: {}, books: [] } }), [2023, {}, null, '', false, ''])
  for (const needle of ['grow.annual.empty', 'grow.annual.emptyNext', 'grow.annual.emptyAction']) {
    has(`B6 空的一年有下一步：${needle}`, annualEmpty.text, needle)
  }

  // --- 11. B7：一条真实链路（书页 → 追问 → 注入回答 → 收为素材 → 选题 → 初稿 → 导出）---
  const chainBook = get('chain-book', { view: 'book', bookId: BOOK_A.bookId })
  const askButtons = (chainBook.elements || []).filter((el) => el.tag === 'button' && String(el.props.className || '').includes('wr-think-btn'))
  check('B7 书页能对一条摘录发起追问', askButtons.length > 0, askButtons.length)
  const answer = '秩序感先给画面，再给判断。'
  const chainAsk = renderComp('chain-ask', smoke.AskCard, Object.assign({}, askBase, { entry: NOTE_A1 }), [
    [{ role: 'assistant', text: answer }],
    '',
    false,
    '',
    'fake-1',
    '',
    'ready',
  ])
  has('B7 有回答时出现采纳出口', chainAsk.text, 'ask.adoptHint')
  const chainWrites = []
  smoke.craftBridge.write = (op, payload) => {
    chainWrites.push([String(op), payload])
    return Promise.resolve({})
  }
  const adopt = renderComp('chain-adopt', smoke.AskAdopt, { answer, entry: NOTE_A1, kind: 'note', model: 'fake-1' }, ['', 'material', '金句', false, ''])
  const adoptSave = (adopt.elements || []).find(
    (el) => el.tag === 'button' && String(el.props.className || '').split(' ').includes('wr-chip') && String(el.props.children || '') === 'ask.adoptSave',
  )
  check('B7 收为素材有保存按钮', Boolean(adoptSave))
  if (adoptSave) {
    adoptSave.props.onClick({ stopPropagation() {} })
    const materialCall = chainWrites.find((item) => item[0] === 'material.add')
    check('B7 收为素材写的是 material.add', Boolean(materialCall), JSON.stringify(chainWrites.map((item) => item[0])))
    if (materialCall) {
      const payload = materialCall[1]
      eq('B7 采纳带 bookId', payload.bookId, BOOK_A.bookId)
      eq('B7 采纳带来源', JSON.stringify(payload.sourceIds), JSON.stringify([`note:${NOTE_A1.id}`]))
      eq('B7 采纳声明 AI 参与', payload.containsAI, true)
      eq('B7 采纳带类型', payload.type, '金句')
      // 真写一次宿主：客户端给出的载荷必须被 index.js 接受，而不是只在 mock 里成立。
      const landed = host.craftOp('material.add', payload, host.craftSummary().revision).created.material
      eq('B7 宿主接受了这份载荷并归到这本书', landed.bookId, BOOK_A.bookId)
      const landedCraft = host.craftView()
      const afterWrite = renderComp('chain-materials', smoke.MaterialBoard, Object.assign({}, craftProps, { craft: landedCraft, scopeBookId: BOOK_A.bookId }), [''])
      has('B7 素材篮能看到刚收的素材', afterWrite.text, '秩序感先给画面')
      const landedChip = (afterWrite.elements || []).find((el) => String(el.props.className || '').split(' ').includes('wr-src'))
      check('B7 素材篮看得出出处', Boolean(landedChip) && String(landedChip.props.title || '').startsWith('note:'), landedChip && landedChip.props.title)
      const topic = host.craftOp('topic.add', { statement: '秩序感先给画面', materialIds: [landed.id], gapNote: '' }, host.craftSummary().revision).created.topic
      const work = host.craftOp('work.add', { title: '秩序感' }, host.craftSummary().revision).created.work
      host.craftOp('work.paragraph.add', { id: work.id, text: '第一段。', sourceIds: [`material:${landed.id}`] }, host.craftSummary().revision)
      host.craftOp('work.confirm', { id: work.id }, host.craftSummary().revision)
      const finalCraft = host.craftView()
      const finalWork = finalCraft.works.find((item) => item.id === work.id)
      const finalTopics = renderComp('chain-topics', smoke.TopicBoard, Object.assign({}, craftProps, { craft: finalCraft }), ['', '', [], false, '', false])
      has('B7 选题关联了这条素材', finalTopics.text, '秩序感先给画面')
      const sourceOpen = []
      const finalWorks = renderComp(
        'chain-works',
        smoke.WorkBoard,
        Object.assign({}, craftProps, {
          craft: finalCraft,
          onOpenSource(sourceId) {
            sourceOpen.push(String(sourceId))
          },
        }),
        [work.id, '', false, '', [], false, '', '', ''],
      )
      has('B7 初稿段落挂上了出处 chip', finalWorks.text, 'material:')
      const paragraphChip = (finalWorks.elements || []).find(
        (el) => el.tag === 'button' && String(el.props.className || '').split(' ').includes('wr-src'),
      )
      check('B7 段落 chip 是可点 button', Boolean(paragraphChip))
      if (paragraphChip) {
        paragraphChip.props.onClick({ stopPropagation() {} })
        eq('B7 点段落 chip 回到这条素材', sourceOpen[0], `material:${landed.id}`)
      }
      const document = host.exportCraftWork(finalWork.id, undefined).document
      const fm = document.markdown.split('---')[1] || ''
      has('B7 导出 front-matter 有 containsAI', fm, 'containsAI: true')
      const again = host.exportCraftWork(finalWork.id, undefined).document
      eq('B7 exportId 稳定', again.exportId, document.exportId)
      check('B7 选题确实只有这一条素材', (topic.materialIds || []).length === 1, JSON.stringify(topic.materialIds))
    }
  }

  // --- 11.5 F-23：段落行上的「AI 补写这一段」（生成 → 采纳 → 落盘 AI 段 → 导出）---
  const paraWork = host.craftView().works.find((item) => item.id === workA.id)
  const paraOwn = paraWork.paragraphs[0]
  const paraTitleOf = (bookId) => (String(bookId) === BOOK_A.bookId ? BOOK_A.title : '')
  const paraBase = {
    work: { id: workA.id, title: paraWork.title },
    paragraph: paraOwn,
    sourceIds: paraOwn.sourceIds,
    lookup,
    titleOf: paraTitleOf,
    onAdopt: () => Promise.resolve(),
  }
  const paraPack = smoke.buildParagraphPack({ sourceIds: paraOwn.sourceIds, lookup, titleOf: paraTitleOf })
  has('F-23 补写把段落自己的出处编成来源包', paraPack, '先给画面，再给判断')
  has('F-23 来源包带书名', paraPack, '《诗经》')

  const paraOffline = renderComp('para-ai-offline', smoke.ParagraphAI, paraBase, ['offline', false, '', '', '', false])
  const offlineTrigger = (paraOffline.elements || []).find((el) => String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
  check('F-23 无模型时补写入口置灰', Boolean(offlineTrigger) && offlineTrigger.props.disabled === true)
  has('F-23 置灰复用 think.offline 文案', paraOffline.text, 'think.offline')

  const paraNone = renderComp('para-ai-nosource', smoke.ParagraphAI, Object.assign({}, paraBase, { sourceIds: [] }), ['ready', false, '', '', '', false])
  const noneTrigger = (paraNone.elements || []).find((el) => String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
  check('F-23 段落没有出处时入口置灰', Boolean(noneTrigger) && noneTrigger.props.disabled === true)
  has('F-23 没有出处时说清原因', paraNone.text, 'work.aiNeedSource')

  net.modelsAvailable = true
  net.chatStatus = 200
  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: '秩序感先是从画面里' },
    { type: 'text', text: '长出来的。' },
    { type: 'done' },
  ]
  // ParagraphAI 的 useState 顺序：chat, open, stage, draft, error, busy
  const liveSeeds = ['ready', false, '', '', '', false]
  const revisionBefore = host.craftSummary().revision
  const paraLive = renderComp('para-ai-live', smoke.ParagraphAI, paraBase, liveSeeds.slice())
  const liveTrigger = (paraLive.elements || []).find((el) => el.tag === 'button' && String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
  check('F-23 有模型时补写入口可点', Boolean(liveTrigger) && liveTrigger.props.disabled !== true)
  if (liveTrigger) {
    liveTrigger.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const replayed = liveSeeds.slice()
    for (const entry of setterLog) replayed[entry.at] = typeof entry.updater === 'function' ? entry.updater(replayed[entry.at]) : entry.updater
    has('F-23 流式草稿落在段落行上', String(replayed[3]), '秩序感先是从画面里')
    has('F-23 第二段流式文本也到了', String(replayed[3]), '长出来的')
    eq('F-23 生成完是草稿态', replayed[2], 'done')
    eq('F-23 只生成不采纳时库里零变化', host.craftSummary().revision, revisionBefore)
    const chatCall = net.calls.filter((item) => item.url.endsWith('/chat')).pop()
    check('F-23 补写真的发了 /chat', Boolean(chatCall))
    if (chatCall) {
      const body = JSON.parse(chatCall.body || '{}')
      has('F-23 请求体里带出处而不是空问题', String(body.pack || ''), '先给画面，再给判断')
      eq('F-23 请求体里的问题是补写指令', String(body.question || ''), 'work.aiPrompt')
      eq('F-23 补写不带历史（一次一段，不预取）', JSON.stringify(body.history || []), '[]')
    }

    const adopted = []
    const paraDone = renderComp(
      'para-ai-done',
      smoke.ParagraphAI,
      Object.assign({}, paraBase, {
        onAdopt(text, originId, sourceIds) {
          adopted.push({ text, originId, sourceIds })
          return Promise.resolve()
        },
      }),
      ['ready', true, 'done', '秩序感先是从画面里长出来的。', '', false],
    )
    const keepBtn = (paraDone.elements || []).find((el) => el.tag === 'button' && String(el.props.children || '') === 'work.aiAdopt')
    check('F-23 草稿有「采纳」出口', Boolean(keepBtn))
    if (keepBtn) {
      keepBtn.props.onClick({ stopPropagation() {} })
      await new Promise((resolve) => setTimeout(resolve, 30))
      check('F-23 采纳把草稿交出去', adopted.length === 1, JSON.stringify(adopted))
      if (adopted.length === 1) {
        eq('F-23 采纳的正文就是草稿', adopted[0].text, '秩序感先是从画面里长出来的。')
        check('F-23 采纳带上那次生成的 id', String(adopted[0].originId || '').startsWith('think:'), adopted[0].originId)
        eq('F-23 采纳带段落自己的出处', JSON.stringify(adopted[0].sourceIds), JSON.stringify(paraOwn.sourceIds))
        // 真写一次宿主：客户端交出的三样东西必须被 index.js 接受并标成 AI 段。
        const before = host.craftView().works.find((item) => item.id === workA.id).paragraphs.length
        const written = host.craftOp(
          'work.paragraph.add',
          {
            id: workA.id,
            text: adopted[0].text,
            sourceIds: adopted[0].sourceIds,
            ai: true,
            aiOriginIds: [adopted[0].originId],
            index: 1,
          },
          host.craftSummary().revision,
        ).created.paragraph
        eq('F-23 落盘后这一段标为 AI', written.ai, true)
        eq('F-23 落盘后记住那次生成', JSON.stringify(written.aiOriginIds), JSON.stringify([adopted[0].originId]))
        const after = host.craftView().works.find((item) => item.id === workA.id)
        eq('F-23 落盘后段落数 +1', after.paragraphs.length, before + 1)
        eq('F-23 落盘后插在这一段之后', after.paragraphs.findIndex((item) => item.id === written.id), 1)
        const aiRow = renderComp(
          'para-ai-row',
          smoke.ParagraphRow,
          { paragraph: written, index: 1, work: { id: workA.id }, lookup, onSave: () => Promise.resolve(), onDelete() {}, onAdopt: () => Promise.resolve() },
          [false, '', false, ''],
        )
        has('F-23 AI 段在界面上有标记', aiRow.text, 'work.aiTag')
        const doc = host.exportCraftWork(workA.id, undefined).document
        const fm = doc.markdown.split('---')[1] || ''
        has('F-23 导出 front-matter 的 containsAI 为 true', fm, 'containsAI: true')
        has('F-23 导出正文里有这段 AI 文字', doc.markdown, '秩序感先是从画面里长出来的。')
      }
    }
  }

  // 一篇「一段 AI + 一段手写」的稿子：标记必须只落在 AI 段上。
  const mixedWork = write('work.add', { title: '混排稿' }).created.work
  write('work.paragraph.add', { id: mixedWork.id, text: '手写的一段：先把自己放进去。', sourceIds: [`material:${materialA.id}`] })
  write('work.paragraph.add', {
    id: mixedWork.id,
    text: '秩序感先给画面，再给判断。',
    sourceIds: [`material:${materialA.id}`],
    ai: true,
    aiOriginIds: ['think:mixed:1'],
  })
  const mixed = host.exportCraftWork(mixedWork.id, undefined).document
  const mixedBody = mixed.markdown.slice(mixed.markdown.indexOf('\n---\n') + 5)
  const mixedBlocks = mixedBody.split('\n\n')
  const handIndex = mixedBlocks.findIndex((block) => block.includes('先把自己放进去'))
  const aiIndex = mixedBlocks.findIndex((block) => block.includes('秩序感先给画面'))
  // 正文块与紧随其后的引用块是一段的两半。
  const handBlock = handIndex < 0 ? '' : mixedBlocks[handIndex + 1] || ''
  const aiBlock = aiIndex < 0 ? '' : mixedBlocks[aiIndex + 1] || ''
  check('F-23 导出：AI 段正文后带 > [!ai]', aiBlock.includes('> [!ai]'), aiBlock)
  check('F-23 导出：手写段不带 > [!ai]', handBlock !== '' && handBlock.indexOf('[!ai]') < 0, handBlock)
  check('F-23 导出：标记与来源同属一个 blockquote', aiBlock.includes('> [!ai]\n> 来源：'), aiBlock)
  has('F-23 导出：手写段仍保留来源行', handBlock, '> 来源：')
  eq('F-23 导出：全文只出现一次标记', (mixedBody.match(/\[!ai\]/g) || []).length, 1)
  eq('F-23 导出：aiParagraphCount 只数 AI 段', mixed.aiParagraphs, 1)
  eq('F-23 导出：containsAI 为 true', mixed.containsAI, true)
  const mixedAgain = host.exportCraftWork(mixedWork.id, undefined).document
  eq('F-23 导出：同一份内容两次导出 contentHash 相同', mixedAgain.contentHash, mixed.contentHash)
  eq('F-23 导出：同一份内容两次导出的正文相同', mixedAgain.markdown.split('\n---\n')[1], mixed.markdown.split('\n---\n')[1])

  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: '半截文字' },
    { type: 'error', error: '模型调用中断' },
    { type: 'done' },
  ]
  const failSeeds = ['ready', false, '', '', '', false]
  const paraFail = renderComp('para-ai-fail', smoke.ParagraphAI, paraBase, failSeeds.slice())
  const failTrigger = (paraFail.elements || []).find((el) => el.tag === 'button' && String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
  if (failTrigger) {
    failTrigger.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const replayed = failSeeds.slice()
    for (const entry of setterLog) replayed[entry.at] = typeof entry.updater === 'function' ? entry.updater(replayed[entry.at]) : entry.updater
    eq('F-23 失败后不留半截草稿', String(replayed[3]), '')
    has('F-23 失败有可见错误', String(replayed[4]), '模型调用中断')
    eq('F-23 失败后停在错误态而不是草稿态', replayed[2], 'error')
  }
  net.modelsAvailable = false

  // --- 11.6 F-29：来源包按类型标角色（金句不再冒充「我的想法」）-----------------
  // 四种来源各取一条真数据（素材现造一条 type=金句 的），把它们塞进同一个 pack，
  // 断言取的是 buildParagraphPack / buildSourcePack 的真实返回值。
  const quoteMaterial = host.craftOp('material.add', {
    type: '金句',
    text: '诗是生命的流露，不是文字的堆砌。',
    sourceIds: [`note:${NOTE_A1.id}`],
  }).created.material
  const packLookup = {
    note: lookup.note,
    thought: lookup.thought,
    response: lookup.response,
    material: new Map([[quoteMaterial.id, quoteMaterial]]),
  }
  const fourSourceIds = [
    `note:${NOTE_A1.id}`,
    `thought:${THOUGHT_A.id}`,
    `response:${responseA.id}`,
    `material:${quoteMaterial.id}`,
  ]
  const fourPack = smoke.buildParagraphPack({ sourceIds: fourSourceIds, lookup: packLookup, titleOf: () => BOOK_A.title })
  const roleLabels = ['note', 'thought', 'response', 'material'].map((kind) => smoke.packKindLabel(kind, '金句'))
  check('F-29 四种角色标签互不相同', new Set(roleLabels).size === 4, roleLabels.join(' | '))
  for (const label of roleLabels) has(`F-29 pack 里出现 ${label}`, fourPack, label)
  eq('F-29 书里的原文不代表我的想法', roleLabels[0] !== roleLabels[1], true)
  if (/think\.packKindMaterialOf\([^)]*mat\.type\.quote/.test(fourPack)) check('F-29 金句素材带了自己的六类类型', true)
  else check('F-29 金句素材带了自己的六类类型', false, fourPack.slice(0, 220))
  check('F-29 金句不落「我的想法」', !fourPack.includes('think.packMine'), fourPack.slice(0, 220))
  const quoteOnly = smoke.buildSourcePack({
    entry: { bookTitle: BOOK_A.title, text: quoteMaterial.text },
    kind: 'material',
    type: '金句',
  })
  has('F-29 单条金句 pack 用「我整理的素材」正文标签', quoteOnly, 'think.packFiled')
  check('F-29 单条金句 pack 不冒充「原文」', !quoteOnly.includes('think.packOriginal'), quoteOnly.slice(0, 220))
  check('F-29 单条金句 pack 不冒充「我的想法」', !quoteOnly.includes('think.packMine'), quoteOnly.slice(0, 220))
  // L1: compare the same kind reached through two different call sites (body vs
  // context entry), so a broken label actually shows up as a difference.
  const materialAsBody = smoke.buildSourcePack({
    entry: { bookTitle: BOOK_A.title, text: quoteMaterial.text },
    kind: 'material',
    type: '金句',
  })
  const materialAsContext = smoke.buildSourcePack({
    entry: NOTE_A1,
    kind: 'note',
    context: [{ text: quoteMaterial.text, kind: 'material', type: '金句' }],
  })
  const bodyLabel = (materialAsBody.split('\n').find((line) => line.startsWith('think.packKind')) || '').replace(
    /^think\.packKind/,
    '',
  )
  const contextRow = materialAsContext.split('\n').find((line) => line.startsWith('1. ')) || ''
  const contextLabel = contextRow.replace(/^1\. /, '').split('：')[0]
  check(
    'F-29 正文与上下文里的同类素材标签都取到了',
    bodyLabel !== '' && contextLabel !== '',
    `body=${bodyLabel} ctx=${contextLabel}`,
  )
  eq('F-29 同一类素材在正文与上下文落同一标签', bodyLabel, contextLabel)
  eq(
    'F-29 金句标签的稳定形态（正文与上下文共用同一形态）',
    bodyLabel,
    'think.packKindMaterialOf(think.packKindMaterial,mat.type.quote)',
  )
  const bogus = smoke.buildSourcePack({ entry: { bookTitle: BOOK_A.title, text: '伪类型素材' }, kind: 'material', type: '读书笔记' })
  has('F-29 未知素材类型仍标「我整理的素材」', bogus, 'think.packKindMaterial')
  check('F-29 未知素材类型不冒充「观点」', !bogus.includes('mat.type.idea'), bogus.split('\n').slice(0, 6).join(' / '))
  eq('F-29 判不出来的来源降级为「我整理的素材」', smoke.packKindLabel('mystery', ''), smoke.packKindLabel('material', ''))
  // L3: the ThinkingBar path must forward type, same as the paragraph path.
  const barDraw = renderComp(
    'think-bar-material',
    smoke.ThinkingBar,
    { entry: { bookTitle: BOOK_A.title, text: quoteMaterial.text }, kind: 'material', type: '金句', context: [] },
    [{ mode: '', question: '', anchor: { x: 40, y: 140 } }, false, '', [], '写点什么', false, '', '', '', 'ready'],
  )
  has('F-29 ThinkingBar 把 type 透传到 pack', barDraw.text, 'mat.type.quote')
  check(
    'F-29 ThinkingBar 链路不把金句标成「我的想法」',
    !barDraw.text.includes('think.packMine'),
    barDraw.text.slice(0, 200),
  )
  const barLabel = 'think.packKindMaterialOf(think.packKindMaterial,mat.type.quote)'
  eq(
    'F-29 ThinkingBar 把 type 透传给 AskCard（卡片头部同口径）',
    (barDraw.text.match(new RegExp(barLabel.replace(/[.()]/g, '\\$&'), 'g')) || []).length >= 1,
    true,
  )
  const barSend = (barDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-ask-send')
  check('F-29 ThinkingBar 的卡片能发出请求', Boolean(barSend), barDraw.text.slice(0, 160))
  if (barSend) {
    const beforeBar = net.calls.length
    barSend.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const barCall = net.calls.slice(beforeBar).find((call) => String(call.url).indexOf('/chat') >= 0 && String(call.url).indexOf('/chat/models') < 0)
    check(
      'F-29 ThinkingBar 把 type 透传给 buildSourcePack（发出的 pack 里带类型）',
      String(barCall && barCall.body).includes(barLabel),
      `pack 里没有类型标签：${String(barCall && barCall.body).slice(0, 220)}`,
    )
  }
  const longMaterial = smoke.buildSourcePack({
    entry: { bookTitle: BOOK_A.title, text: '露'.repeat(900) },
    kind: 'material',
    type: '金句',
  })
  const longBody = longMaterial.split('\n').find((line) => line.startsWith('露')) || ''
  check('F-29 素材正文仍被截到 600 字', longBody.length === 600 && longBody.endsWith('…'), `len=${longBody.length}`)
  const fourContext = smoke.buildSourcePack({
    entry: NOTE_A1,
    kind: 'note',
    context: [
      { text: '想法一', kind: 'thought' },
      { text: '回应一', kind: 'response' },
      { text: '素材一', kind: 'material', type: '金句' },
      { text: '第四条', kind: 'thought' },
    ],
  })
  check('F-29 其他来源仍只要 3 条', !fourContext.includes('4. ') && fourContext.includes('think.packContextMixed'))
  eq('F-29 THINK_LIMITS 仍是 600/3/200', JSON.stringify(smoke.THINK_LIMITS), JSON.stringify({ body: 600, context: 3, contextEach: 200 }))

  // --- 12. 防回潮 ------------------------------------------------------------
  const sources = ['client.js', 'index.js', 'locale/zh.json', 'locale/en.json'].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
  const banned = ['打卡', '排行榜', '徽章', '进度环', '连续天数']
  const hits = banned.filter((word) => sources.includes(word))
  check('防回潮：代码与文案里没有阅读挑战字样', hits.length === 0, hits.join(','))
  check('防回潮：包尾不再说「想法是我写的」', !sources.includes('想法是我写的'))
  has('防回潮：包尾改成了按角色说明归属', sources, '是我这一侧的记录，引用时请分清归属')

  // --- 汇总 ------------------------------------------------------------------
  const failed = results.filter((item) => !item.ok)
  console.log('[behave-1.2.1] pass=%d fail=%d', results.length - failed.length, failed.length)
  for (const item of failed) console.log('  ✗ %s %s', item.name, item.detail ? `— ${item.detail}` : '')
  if (failed.length === 0) console.log('[behave-1.2.1] ok：导航、按书过滤、出处回跳、置灰、流式对话、空态全部通过')
  if (!process.env.KEEP) {
    try {
      fs.rmSync(home, { recursive: true, force: true })
    } catch {}
  } else {
    console.log('[behave-1.2.1] 临时 DSH_HOME 保留在 %s', home)
  }
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('[behave-1.2.1] 崩溃：', error && error.stack ? error.stack : error)
  process.exit(1)
})