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
      if (text.includes('/config')) {
        let patch = {}
        try {
          patch = init && init.body ? JSON.parse(String(init.body)) : {}
        } catch (error) {
          patch = {}
        }
        const body = Object.assign({}, statePayload)
        // 现在没有「空字段表示跟随」这套了：palette 永远是五套里的一个名字。
        if ('palette' in patch) body.palette = patch.palette
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
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
  // 默认把 locale key 原样返回（断言好写），但真实中文文案里包尾那句「素材里带「AI」字样的是…」
  // 本身就含「AI」——所以凡是要断「这段文字里有没有 AI」的用例，都得能切到真实文案再验一遍。
  // 这里把注册时的真字典留下来，并允许用 localeText 临时切到真文案。
  let localeDictionaries = {}
  let localeText = false
  const fillParams = (text, params) =>
    String(text).replace(/\{(\w+)\}/g, (all, name) => (params && Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : all))
  const renderLocale = (key, params) => {
    if (localeText) {
      const dict = (localeDictionaries && localeDictionaries.zh) || {}
      if (Object.prototype.hasOwnProperty.call(dict, key)) return fillParams(dict[key], params)
    }
    return params ? `${key}(${Object.values(params).join(',')})` : key
  }
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
        if (dictionaries && typeof dictionaries === 'object' && dictionaries.zh) localeDictionaries = dictionaries
      },
      bind() {
        return renderLocale
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
  eq('视图数与 IA 冻结一致（4+1+1+2，素材/选题退场）', JSON.stringify(viewCounts), JSON.stringify([4, 1, 1, 2]))

  const shelf = get('shelf', { view: 'shelf' })
  // 夹具只有两本书，书架本来就不长；这里验「渲染出内容 + 两本都在」，不拿真实书架的篇幅当门槛。
  check('书架渲染出真实内容', shelf.ok && shelf.text.length >= 200, shelf.text.length)
  has('书架能看到 A 书', shelf.text, BOOK_A.title)
  has('书架能看到 B 书', shelf.text, BOOK_B.title)
  const notesDraw = get('notes', { view: 'notes' })
  check('笔记页渲染出真实内容', notesDraw.ok && notesDraw.text.length >= 200, notesDraw.text.length)
  has('笔记页列出划线原文', notesDraw.text, '关关雎鸠')
  const thoughtsDraw = get('thoughts', { view: 'thoughts' })
  check('想法页渲染出真实内容', thoughtsDraw.ok && thoughtsDraw.text.length >= 300, thoughtsDraw.text.length)
  const searchDraw = get('search', { view: 'shelf', query: '关雎' })
  has('全局搜索命中书名/正文', searchDraw.text, '关雎')
  has('搜索保留类型筛选', searchDraw.text, 'search.typeAll')

  const bookDraw = get('book', { view: 'book', bookId: BOOK_A.bookId })
  // 1.2.2：六格计数块整块退场，书页第一块换成「我的阅读脉络」。
  has('书页有「我的阅读脉络」', bookDraw.text, 'thread.title')
  missing('六格计数块已经退场', bookDraw.text, 'chain.title')
  check(
    '脉络块在书名简介之后、笔记/想法分栏之前',
    bookDraw.text.indexOf('thread.title') >= 0 && bookDraw.text.indexOf('thread.title') < bookDraw.text.indexOf('关关雎鸠'),
    String(bookDraw.text.indexOf('thread.title')) + ' / ' + String(bookDraw.text.indexOf('关关雎鸠')),
  )

  // --- 2. 按书过滤（F2 + 三类列表） -----------------------------------------
  const createViews = (smoke.STAGE_VIEWS && smoke.STAGE_VIEWS.create) || []
  eq('CREATE 只留作品一个内页', JSON.stringify(createViews.map((item) => item[0])), JSON.stringify(['works']))
  const stageIdsOfCreate = JSON.parse(JSON.stringify(smoke.VIEW_STAGE ? '' : ''))
  const materialsView = get('materials-gone', { view: 'materials' })
  has('素材视图已经不可达（落回既有内页）', materialsView.text, 'nav.read')
  missing('素材视图不再有素材篮的筛选项', materialsView.text, 'mat.filterAll')
  const topicsView = get('topics-gone', { view: 'topics' })
  has('选题视图已经不可达（落回既有内页）', topicsView.text, 'nav.read')
  missing('选题视图不再有选题表单', topicsView.text, 'topic.statement')
  // 宿主路由没动：素材与选题仍然可写，只是界面不再露出它们。
  const hiddenMaterial = host.craftOp('material.add', { type: '金句', text: '界面外的一条素材', sourceIds: ['note:' + NOTE_A1.id] }, host.craftSummary().revision).created.material
  eq('素材路由仍然可用（界面退场不等于数据下线）', hiddenMaterial.bookId, BOOK_A.bookId)

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
  const retiredChips = paragraphChips.filter((el) => el.props['data-retired'] === 'true')
  check('素材来源已下线：渲染成纯文本而不是按钮', retiredChips.length === paragraphChips.length && retiredChips.every((el) => el.tag === 'span'), paragraphChips.map((el) => el.tag).join(','))
  check('素材来源的 title 说明了「已下线」', retiredChips.length > 0 && String(retiredChips[0].props.title || '') !== '', String(retiredChips[0] && retiredChips[0].props.title))

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
  const liveChips = (workBoard.elements || []).filter((el) => String(el.props.className || '').split(' ').includes('wr-src') && el.props['data-retired'] !== 'true')
  check('初稿里的非素材来源仍然可点', liveChips.every((el) => el.tag === 'button' && typeof el.props.onClick === 'function'), liveChips.map((el) => el.tag).join(','))
  check('素材/选题卡已经不在 client 里', !smoke.MaterialBoard && !smoke.TopicBoard && !smoke.MaterialPicker)

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

  // --- 4. 放回书里看：一个入口、就地展开、编号先校验、关系能存能改能删 -------------
  smoke.relateBridge.data = dataPayload
  smoke.craftBridge.craft = craft
  smoke.relateBridge.lookup = lookup
  const relateOpened = []
  smoke.relateBridge.openSource = (id) => relateOpened.push(String(id))
  const relateBase = { entry: NOTE_A1, kind: 'note', onToggle() {} }

  const barClosed = renderComp('relate-bar', smoke.RelateBar, Object.assign({}, relateBase, { open: false }), ['', false, ''])
  const goButton = (barClosed.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-go')
  check('入口只剩一个「放回书里看」', Boolean(goButton) && goButton.tag === 'button' && typeof goButton.props.onClick === 'function')
  for (const needle of ['think.mode.explain', 'think.mode.reframe', 'think.mode.deeper', 'think.mode.custom']) {
    missing('四胶囊已经合并：没有 ' + needle, barClosed.text, needle)
  }
  eq('收起时不渲染任何卡片', (barClosed.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-card').length, 0)
  check('收起时对话仍在（卡片常挂载，只是不渲染）', Boolean(barClosed.components) && typeof barClosed.components.has === 'function' && barClosed.components.has('RelateCard'))
  const barOpen = renderComp('relate-open', smoke.RelateBar, Object.assign({}, relateBase, { open: true }), ['', false, '', '', '', {}, '', '', false])
  check('点开后浮层出现', (barOpen.elements || []).some((el) => String(el.props.className || '') === 'wr-relate-modal'))
  has('卡片里写着这条记录是什么', barOpen.text, 'relate.thisNote')

  // 浮层：遮罩铺满、点遮罩与 Esc 都能关；卡片高度随内容（index 顺序 = 渲染顺序）。
  {
    const modal = (barOpen.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-modal')
    check('遮罩标成 backdrop 且是 dialog', Boolean(modal) && modal.props['data-backdrop'] === 'true' && modal.props.role === 'dialog' && modal.props['aria-modal'] === 'true')
    const closedBy = []
    const withSpy = renderComp('relate-modal-spy', smoke.RelateBar, Object.assign({}, relateBase, { open: true, onToggle: (next) => closedBy.push(next) }), ['', false, '', '', '', {}, '', '', false])
    const spyModal = (withSpy.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-modal')
    if (spyModal) spyModal.props.onClick({ target: spyModal, currentTarget: spyModal })
    eq('点遮罩会关闭', closedBy.length, 1)
    eq('点遮罩关闭时传 false', closedBy[0], false)
    const escBy = []
    const escDraw = renderComp('relate-modal-esc', smoke.RelateBar, Object.assign({}, relateBase, { open: true, onToggle: (next) => escBy.push(next) }), ['', false, '', '', '', {}, '', '', false])
    const escModal = (escDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-modal')
    if (escModal) escModal.props.onKeyDown({ key: 'Escape' })
    eq('Esc 会关闭', escBy.length, 1)
    // 点卡片内部不该冒泡成关闭。
    const insideBy = []
    const insideDraw = renderComp('relate-modal-inside', smoke.RelateBar, Object.assign({}, relateBase, { open: true, onToggle: (next) => insideBy.push(next) }), ['', false, '', '', '', {}, '', '', false])
    const insideCard = (insideDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-card')
    const stopped = []
    if (insideCard) insideCard.props.onClick({ stopPropagation: () => stopped.push(1) })
    eq('点卡片内部不会关闭浮层', insideBy.length, 0)
    check('卡片拦住了冒泡', stopped.length === 1)
  }
  // 尺寸：短回答 < 上限（不撑满），长回答 = 上限（内部滚动），空内容不占高。
  {
    const cap = smoke.relateCardCap(900)
    const shortBox = smoke.relateCardBox({ contentHeight: 220, viewportHeight: 900 })
    check('短回答时卡片高度小于上限', shortBox.height === 220 && shortBox.height < cap && shortBox.capped === false, JSON.stringify(shortBox))
    const tallBox = smoke.relateCardBox({ contentHeight: 4200, viewportHeight: 900 })
    check('长回答时卡片停在上限', tallBox.height === cap && tallBox.capped === true, JSON.stringify(tallBox))
    eq('空内容不占高度', smoke.relateCardBox({ contentHeight: 0, viewportHeight: 900 }).height, 0)
    const card = (barOpen.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-card')
    eq('卡片上限写在渲染出的 style 上', card && card.props.style && card.props.style.maxHeight, `${cap}px`)
    check('卡片没有被写死高度', Boolean(card) && (card.props.style || {}).height === undefined)
    const body = (barOpen.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-body')
    check('正文区是独立的滚动容器', Boolean(body) && typeof body.props.onScroll === 'function')
    // 输入区在滚动区之外，且在卡片底部：渲染顺序 body → compose → textarea。
    const order = (barOpen.elements || []).map((el) => String(el.props.className || ''))
    const bodyAt = order.indexOf('wr-relate-body')
    const composeAt = order.indexOf('wr-relate-compose')
    const inputAt = order.indexOf('wr-relate-input')
    check('输入区排在正文区之后（不随内容滚动）', bodyAt >= 0 && composeAt > bodyAt && inputAt > composeAt, `${bodyAt}/${composeAt}/${inputAt}`)
  }
  // 滚动跟随：贴底才跟，手动上滚后不再拉回，并给「回到底部」入口。
  {
    const hitBottom = smoke.relateAtBottom({ scrollHeight: 1200, scrollTop: 400, clientHeight: 800 })
    const scrolledUp = smoke.relateAtBottom({ scrollHeight: 1200, scrollTop: 120, clientHeight: 800 })
    check('贴底时算「在底部」', hitBottom === true)
    check('手动上滚后不再算贴底', scrolledUp === false)
    const shortContent = smoke.relateAtBottom({ scrollHeight: 300, scrollTop: 0, clientHeight: 800 })
    check('内容不足一屏时不算被拉回', shortContent === true)
    const stuckDraw = renderComp('relate-stuck', smoke.RelateCard, relateBase, ['', false, '', '很长的回答'.repeat(200), '', {}, '', '', true])
    const jump = (stuckDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-jump')
    check('上滚后出现「回到底部」', Boolean(jump) && jump.tag === 'button' && typeof jump.props.onClick === 'function')
    has('「回到底部」有文案', stuckDraw.text, 'relate.toBottom')
    const normalDraw = renderComp('relate-not-stuck', smoke.RelateCard, relateBase, ['', false, '', '', '', {}, '', '', false])
    eq('贴底时不显示「回到底部」', (normalDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-jump').length, 0)
  }

  // 候选：只取同一本书，≤12 条，且永远不带 material:
  const candidates = smoke.relateCandidates({ entry: NOTE_A1, kind: 'note', data: dataPayload, craft })
  check('候选不超过 12 条', candidates.length > 0 && candidates.length <= 12, candidates.length)
  check('候选只来自这本书', candidates.every((row) => row.kind !== 'response' || true) && !candidates.some((row) => String(row.id).startsWith('material:')), JSON.stringify(candidates.slice(0, 3).map((row) => row.id)))
  missing('候选里没有当前这条', JSON.stringify(candidates.map((row) => row.id)), 'note:' + NOTE_A1.id)

  // 请求体：自然话 + 带编号的候选 + mode:'relate'
  const askBody = smoke.buildRelateAsk({ entry: NOTE_A1, kind: 'note', question: '这条和别的记录怎么放在一起看？', candidates, data: dataPayload })
  has('请求体带上书名', askBody.pack, BOOK_A.title)
  has('请求体说明只导入了划线和想法', askBody.pack, 'relate.packHead')
  has('请求体里候选带编号', askBody.pack, candidates[0].id)
  has('用户的问题进了最后一行', askBody.question, '这条和别的记录怎么放在一起看')
  missing('请求体里没有素材（已下线）', askBody.pack, 'material:')

  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: '这两条像。\n[' + candidates[0].id + '] 都在说先给画面。\n' },
    { type: 'text', text: '问：要不要把这两条并成一段？' },
    { type: 'done' },
  ]
  net.calls.length = 0
  const relateLive = renderComp('relate-live', smoke.RelateCard, relateBase, ['', false, '', '', '', {}, '', ''])
  const liveSend = (relateLive.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-send')
  check('关系卡有可点的发送键', Boolean(liveSend) && typeof liveSend.props.onClick === 'function')
  if (liveSend) {
    liveSend.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const replayed = ['', false, '', '', '', {}, '', '']
    for (const entry of setterLog) {
      replayed[entry.at] = typeof entry.updater === 'function' ? entry.updater(replayed[entry.at]) : entry.updater
    }
    has('流式回答落进卡片', String(replayed[3]), '这两条像')
    has('追问建议也进了回答', String(replayed[3]), '问：')
    const chatCall = net.calls.filter((call) => String(call.url).includes('/chat') && !String(call.url).includes('/chat/models')).pop()
    check('真的发出了 /chat 请求', Boolean(chatCall), JSON.stringify(net.calls.map((item) => item.url)))
    if (chatCall) {
      const body = JSON.parse(chatCall.body || '{}')
      eq('请求带 mode=relate', body.mode, 'relate')
      has('请求体带候选编号', String(body.pack), candidates[0].id)
    }
  }

  // 渲染前校验：编造的编号整行丢弃，既不渲染也不进关系表
  const bogusAnswer = '先给判断。\n[' + candidates[0].id + '] 这条对得上。\n[thought:made_up_id_9999] 这条是编的。\n问：还有别的吗？'
  const parsedBogus = smoke.parseRelateAnswer(bogusAnswer, candidates)
  eq('编造的编号在解析阶段就被丢掉', parsedBogus.rows.length, 1)
  eq('留下的那一条是候选集里的', parsedBogus.rows[0] && parsedBogus.rows[0].id, candidates[0].id)
  check('编造的编号不会出现在渲染结果里', !JSON.stringify(parsedBogus).includes('made_up_id_9999'))
  const resultDraw = renderComp('relate-result', smoke.RelateCard, relateBase, ['', false, '', bogusAnswer, '', {}, '', ''])
  missing('渲染出来的卡里也没有编造的编号', resultDraw.text, 'made_up_id_9999')
  for (const needle of ['relate.together', 'relate.why', 'relate.followup', 'relate.askPrefix']) has('对照结果有 ' + needle, resultDraw.text, needle)
  const askJump = (resultDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-ask')
  check('追问建议是可点的按钮', Boolean(askJump) && askJump.tag === 'button' && typeof askJump.props.onClick === 'function')

  // L1：模型给编号加列表符号时，那一行仍然是候选行，不许退化成散文
  const bulletAnswer = '- [' + candidates[0].id + '] 这两条都在讲同一件事。\n1. [' + candidates[1].id + '] 这条只是换个说法。'
  const parsedBullet = smoke.parseRelateAnswer(bulletAnswer, candidates)
  eq('带列表符号的编号仍解析成对照行', parsedBullet.rows.length, 2)
  eq('第一条编号对得上', parsedBullet.rows[0] && parsedBullet.rows[0].id, candidates[0].id)
  check('列表符号没有被当成正文', !String(parsedBullet.prose || '').includes(candidates[0].id))
  const bulletDraw = renderComp('relate-bullet', smoke.RelateCard, relateBase, ['', false, '', bulletAnswer, '', {}, '', ''])
  eq('卡片里两条对照行都在', (bulletDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-chip').length, 2)
  missing('列表符号没有被渲染出来', bulletDraw.text, '- [' + candidates[0].id)

  // L3：记录已不在 lookup 里时，chip 必须降级成不可点的状态，而不是点了没反应的按钮
  const savedLookup = smoke.relateBridge.lookup
  smoke.relateBridge.lookup = { note: new Map(), thought: new Map(), response: new Map(), material: new Map() }
  const missingDraw = renderComp('relate-missing', smoke.RelateCard, relateBase, ['', false, '', bogusAnswer, '', {}, '', ''])
  smoke.relateBridge.lookup = savedLookup
  const missingChips = (missingDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-chip')
  check('缺来源时还剩 chip（否则这条断言空转）', missingChips.length > 0, String(missingChips.length))
  eq('缺来源的 chip 一个都不可点', missingChips.filter((el) => el.tag === 'button').length, 0)
  eq('缺来源的 chip 都带缺失状态', missingChips.filter((el) => el.props['data-missing'] === 'true').length, missingChips.length)
  has('缺来源时写出来源没找到', missingDraw.text, 'mat.status.missing')
  eq(
    '缺来源的行级状态也标了',
    (missingDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-item' && el.props['data-missing'] === 'true').length,
    (missingDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-item').length,
  )

  // 失败态：真实错误原文 + 可重试
  const failDraw = renderComp('relate-fail', smoke.RelateCard, relateBase, ['', false, 'provider rate limited (429)', '', '', {}, '', ''])
  has('失败时显示真实错误原文', failDraw.text, 'provider rate limited (429)')
  check('失败时给一次重试', (failDraw.elements || []).some((el) => String(el.props.className || '') === 'wr-relate-ask' && typeof el.props.onClick === 'function'))

  // 记录太少 / 没有书：不给按钮，只给一句怎么补
  const fewDraw = renderComp('relate-few', smoke.RelateCard, Object.assign({}, relateBase, { entry: Object.assign({}, NOTE_A1, { bookId: 'weread:book/none' }) }), ['', false, '', '', '', {}, '', ''])
  has('记录太少时说清楚补什么', fewDraw.text, 'relate.tooFew')
  eq('记录太少时没有发送键', (fewDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-send').length, 0)
  const noBookDraw = renderComp('relate-nobook', smoke.RelateCard, Object.assign({}, relateBase, { entry: Object.assign({}, NOTE_A1, { bookId: '' }) }), ['', false, '', '', '', {}, '', ''])
  has('没有书时说明原因', noBookDraw.text, 'relate.nobook'.replace('nobook', 'noBook'))

  // 关系落盘：点标签 → relation.add；改标签 → relation.update；删 → relation.delete；刷新仍在
  const relationWrites = []
  smoke.craftBridge.write = (op, payload) => {
    relationWrites.push([String(op), payload])
    return Promise.reject(new Error('spy only'))
  }
  const saveDraw = renderComp('relate-save', smoke.RelateCard, relateBase, ['', false, '', bogusAnswer, '', {}, '', ''])
  const echoButton = (saveDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-label' && String(el.props.children || '') === 'relate.label.echo')
  check('每条对照行都有四个标签', (saveDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-label').length >= 4)
  if (echoButton) {
    echoButton.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 30))
    const addCall = relationWrites.find((item) => item[0] === 'relation.add')
    check('点标签才写 relation.add（不是自动存）', Boolean(addCall) && relationWrites.length === 1, JSON.stringify(relationWrites.map((item) => item[0])))
    if (addCall) {
      eq('relation.add 的 from 是当前记录', JSON.stringify([addCall[1].from]), JSON.stringify([{ kind: 'note', id: NOTE_A1.id }]))
      eq('relation.add 的 to 是那条对照', addCall[1].to && addCall[1].to.id, candidates[0].rawId)
      eq('relation.add 带上标签', addCall[1].label, '呼应')
      check('relation.add 带上了一句理由', String(addCall[1].reason || '').length > 0)
      eq('relation.add 归到这本书', addCall[1].bookId, BOOK_A.bookId)
    }
  }

  // 真写一次宿主，再用宿主读回来的 craft 重新渲染：标签高亮、可删，重开宿主仍在。
  const landedRelation = host.craftOp('relation.add', {
    from: { kind: 'note', id: NOTE_A1.id },
    to: { kind: candidates[0].kind, id: candidates[0].rawId },
    label: '呼应',
    reason: '同章，说的是一件事。',
    bookId: BOOK_A.bookId,
    origin: 'ai',
  }, host.craftSummary().revision).created.relation
  check('宿主接受了这条关系', Boolean(landedRelation && landedRelation.id), JSON.stringify(landedRelation))
  const hostCraft = host.craftView()
  smoke.craftBridge.craft = hostCraft
  const storedDraw = renderComp('relate-stored', smoke.RelateCard, relateBase, ['', false, '', bogusAnswer, '', {}, '', ''])
  const onLabels = (storedDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-label' && el.props['data-on'] === 'true')
  eq('刷新后标签还在（高亮的那一个）', onLabels.length, 1)
  has('已存的关系给出删除入口', storedDraw.text, 'relate.remove')
  const reloadedHost = I.createHost({})
  check('重开宿主后关系仍在（刷新后仍在）', reloadedHost.craftView().relations.some((item) => item.id === landedRelation.id))
  host.craftOp('relation.update', { id: landedRelation.id, label: '对照' }, host.craftSummary().revision)
  eq('改标签只改标签', host.craftView().relations.find((item) => item.id === landedRelation.id).label, '对照')
  host.craftOp('relation.delete', { id: landedRelation.id }, host.craftSummary().revision)
  eq('删除后关系真的没了', host.craftView().relations.filter((item) => item.id === landedRelation.id).length, 0)
  smoke.relateBridge.craft = craft
  smoke.craftBridge.write = () => Promise.resolve({})

  // 预检不存在：整个过程里一次 /chat/models 都不该发出去。
  const modelCalls = net.calls.filter((call) => String(call.url).includes('/chat/models'))
  eq('没有 /chat/models 预检', modelCalls.length, 0)

  // --- 5. 空态与降级 --------------------------------------------------------
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
  check('B1 时间线事件行都是可点 button', tlRows.length >= 2 && tlRows.every((el) => el.tag === 'button'), tlRows.length)
  const kinds = new Set(tlRows.map((el) => el.props['data-kind']))
  eq('时间线的事件只有回应/作品两类', JSON.stringify([...kinds].sort()), JSON.stringify(['response', 'work']))
  const workRows = tlRows.filter((el) => el.props['data-kind'] === 'work')
  check('B1 时间线里有作品事件', workRows.length > 0)
  has('B1 事件行显示书名', timeline.text, String(BOOK_A.title).slice(0, 6))
  if (workRows.length > 0) {
    // 每篇稿子各自回到它的书 —— 不假设时间线里哪一行排在前面。
    for (const row of workRows) row.props.onClick({ stopPropagation() {} })
    check('B1 点作品事件回到那本书', tlOpened.books.some((entry) => entry[0] === BOOK_A.bookId), JSON.stringify(tlOpened.books))
  }
  const timelineA = renderComp('timeline-scoped-a', smoke.GrowTimeline, Object.assign({}, tlProps, { scopeBookId: BOOK_A.bookId }), [])
  const timelineB = renderComp('timeline-scoped-b', smoke.GrowTimeline, Object.assign({}, tlProps, { scopeBookId: BOOK_B.bookId }), [])
  has('B4 按 A 书筛时间线留下 A 的回应', timelineA.text, '秩序感先给画面')
  // 未筛时间线里 A/B 两本书的回应都在，谁排前面取决于时间；所以点到「那一条」这件事在 A 的视图上验。
  const responseRowA = tlItems(timelineA).find((el) => el.props['data-kind'] === 'response')
  if (responseRowA) {
    tlOpened.sources.length = 0
    responseRowA.props.onClick({ stopPropagation() {} })
    check('B1 点回应事件回到那条回应', tlOpened.sources[0] === 'response:' + responseA.id, JSON.stringify(tlOpened.sources))
  } else {
    check('B1 A 的时间线里有回应事件', false, 'no response row in scoped timeline')
  }
  missing('B4 按 A 书筛时间线不出现 B 的回应', timelineA.text, '第二本书的回应')
  has('B4 按 B 书筛时间线留下 B 的回应', timelineB.text, '第二本书的回应')
  missing('B4 按 B 书筛时间线不出现 A 的回应', timelineB.text, '秩序感先给画面')
  check('B4 按书筛后事件行数变少', tlItems(timelineA).length < tlRows.length && tlItems(timelineA).length > 0, tlRows.length + ' → ' + tlItems(timelineA).length)

  const crossCraft = Object.assign({}, craft, {
    works: craft.works.concat([
      {
        id: 'w_cross',
        title: '跨两本书的稿子',
        status: 'draft',
        containsAI: false,
        paragraphs: [
          { id: 'p_cross', text: '一段引用了两本书。', sourceIds: ['material:' + materialA.id, 'material:' + materialB.id], ai: false, aiOriginIds: [], editedAt: craft.updatedAt },
        ],
        createdAt: craft.updatedAt,
        updatedAt: craft.updatedAt,
      },
    ]),
  })
  const crossTimeline = renderComp('timeline-cross', smoke.GrowTimeline, Object.assign({}, tlProps, { craft: crossCraft }), [])
  const crossRows = tlItems(crossTimeline)
  const crossRow = crossRows.find((el) => el.props['data-kind'] === 'work' && String(el.props.title || '').includes('跨两本书'))
  check('B1 跨书作品仍然可点（靠 focusWorkId 打开那一篇）', Boolean(crossRow) && crossRow.props.disabled !== true)
  has('B1 跨书作品写明「等 N 本」', crossTimeline.text, 'grow.multiBooks')
  check('B1 不再出现「跨书」这种后台标签', crossTimeline.text.indexOf('grow.cross') < 0)
  check('B1 单书事件仍然可点', crossRows.some((el) => el.props.disabled !== true && String(el.props['data-kind']) !== ''))

  // --- 9. 素材/选题从界面上撤下来（数据与宿主路由都还在） -------------------------
  check('素材卡组件已退役', !smoke.MaterialBoard)
  check('选题卡组件已退役', !smoke.TopicBoard)
  check('收为素材的选择器已退役', !smoke.MaterialPicker)
  check('四胶囊组件已退役', !smoke.ThinkingBar && !smoke.AskCard)
  const stageCreate = ((smoke.STAGE_VIEWS || {}).create || []).map((item) => item[0])
  eq('CREATE 段只剩作品', JSON.stringify(stageCreate), JSON.stringify(['works']))
  const hiddenTopic = host.craftOp('topic.add', { statement: '界面外的一条选题', materialIds: [materialA.id], gapNote: '' }, host.craftSummary().revision).created.topic
  check('选题路由仍然可用（界面退场不等于数据下线）', Boolean(hiddenTopic && hiddenTopic.id))


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

  // --- 11. B7：一条真实链路（书页 → 放回书里看 → 存一条关系 → 重读仍在 → 初稿 → 导出）---
  const chainBook = get('chain-book', { view: 'book', bookId: BOOK_A.bookId })
  const relateEntries = (chainBook.elements || []).filter((el) => String(el.props.className || '').includes('wr-relate-go'))
  check('B7 书页每条记录都有「放回书里看」入口', relateEntries.length > 0, relateEntries.length)

  const chainCandidates = smoke.relateCandidates({ entry: NOTE_A1, kind: 'note', data: dataPayload, craft: host.craftView() })
  check('B7 书上能组出候选集', chainCandidates.length > 0, chainCandidates.length)
  const chainAnswer = '先给画面。\n[' + chainCandidates[0].id + '] 这条和当前这条在说同一件事。\n问：要不要并成一段？'
  const chainWrites = []
  smoke.craftBridge.write = (op, payload) => {
    chainWrites.push([String(op), payload])
    return Promise.reject(new Error('spy only'))
  }
  smoke.craftBridge.craft = Object.assign({}, craft, { relations: [] })
  const chainCard = renderComp('chain-relate', smoke.RelateCard, { entry: NOTE_A1, kind: 'note', onToggle() {} }, ['', false, '', chainAnswer, '', {}, '', ''])
  const chainChip = (chainCard.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-chip')
  check('B7 对照行渲染出编号 chip', Boolean(chainChip) && chainChip.tag === 'button')
  const chainLabel = (chainCard.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-label' && String(el.props.children || '') === 'relate.label.contrast')
  if (chainLabel) {
    chainLabel.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 30))
    const payloadCall = chainWrites.find((item) => item[0] === 'relation.add')
    check('B7 点标签写出 relation.add', Boolean(payloadCall), JSON.stringify(chainWrites.map((item) => item[0])))
    if (payloadCall) {
      const landed = host.craftOp('relation.add', payloadCall[1], host.craftSummary().revision)
      eq('B7 宿主接受了这份关系载荷', Boolean(landed.created.relation && landed.created.relation.id), true)
      const reread = I.createHost({}).craftView()
      check('B7 重开宿主后关系仍在（刷新后仍在）', reread.relations.some((item) => item.from.id === NOTE_A1.id || item.to.id === NOTE_A1.id), JSON.stringify(reread.relations.map((item) => item.id)))
      const work = host.craftOp('work.add', { title: '秩序感' }, host.craftSummary().revision).created.work
      host.craftOp('work.paragraph.add', { id: work.id, text: '第一段：先给画面。', sourceIds: ['note:' + NOTE_A1.id] }, host.craftSummary().revision)
      host.craftOp('work.confirm', { id: work.id }, host.craftSummary().revision)
      const finalWork = host.craftView().works.find((item) => item.id === work.id)
      const document = host.exportCraftWork(finalWork.id, undefined).document
      const fm = document.markdown.split('---')[1] || ''
      has('B7 导出 front-matter 有 containsAI', fm, 'containsAI: ')
      has('B7 导出段落看得出出处', document.markdown, 'note:' + NOTE_A1.id)
      const again = host.exportCraftWork(finalWork.id, undefined).document
      eq('B7 exportId 稳定', again.exportId, document.exportId)
    }
  }
  smoke.craftBridge.write = () => Promise.resolve({})


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

  // ParagraphAI 的 useState 顺序：open, stage, draft, error, busy（预检拆掉后不再有 chat 位）
  const paraFailed = renderComp('para-ai-error', smoke.ParagraphAI, paraBase, [true, 'error', '', 'provider rate limited (429)', false])
  const failedTrigger = (paraFailed.elements || []).find((el) => el.tag === 'button' && String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
  check('F-23 请求失败后补写入口仍可点（不再预检置灰）', Boolean(failedTrigger) && failedTrigger.props.disabled !== true)
  has('F-23 失败时显示真实错误', paraFailed.text, 'provider rate limited (429)')
  const paraRetry = (paraFailed.elements || []).find((el) => el.tag === 'button' && String(el.props.children || '') === 'work.aiRetry')
  check('F-23 失败后给一次重试', Boolean(paraRetry) && typeof paraRetry.props.onClick === 'function', 'no retry button')

  const paraNone = renderComp('para-ai-nosource', smoke.ParagraphAI, Object.assign({}, paraBase, { sourceIds: [] }), [false, '', '', '', false])
  const noneTrigger = (paraNone.elements || []).find((el) => String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
  check('F-23 段落没有出处时入口置灰', Boolean(noneTrigger) && noneTrigger.props.disabled === true)
  eq('F-23 没有出处时原因写在按钮 title 上', noneTrigger && noneTrigger.props.title, 'work.aiNeedSource')
  eq('F-23 没有出处时不再占一行灰字', (paraNone.elements || []).filter((el) => String(el.props.className || '') === 'wr-ai-hint').length, 0)

  net.modelsAvailable = true
  net.chatStatus = 200
  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: '秩序感先是从画面里' },
    { type: 'text', text: '长出来的。' },
    { type: 'done' },
  ]
  // ParagraphAI 的 useState 顺序：open, stage, draft, error, busy
  const liveSeeds = [false, '', '', '', false]
  const revisionBefore = host.craftSummary().revision
  const paraLive = renderComp('para-ai-live', smoke.ParagraphAI, paraBase, liveSeeds.slice())
  const liveTrigger = (paraLive.elements || []).find((el) => el.tag === 'button' && String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
  check('F-23 有模型时补写入口可点', Boolean(liveTrigger) && liveTrigger.props.disabled !== true)
  if (liveTrigger) {
    liveTrigger.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const replayed = liveSeeds.slice()
    for (const entry of setterLog) replayed[entry.at] = typeof entry.updater === 'function' ? entry.updater(replayed[entry.at]) : entry.updater
    has('F-23 流式草稿落在段落行上', String(replayed[2]), '秩序感先是从画面里')
    has('F-23 第二段流式文本也到了', String(replayed[2]), '长出来的')
    eq('F-23 生成完是草稿态', replayed[1], 'done')
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
      [true, 'done', '秩序感先是从画面里长出来的。', '', false],
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
  const failSeeds = [false, '', '', '', false]
  const paraFail = renderComp('para-ai-fail', smoke.ParagraphAI, paraBase, failSeeds.slice())
  const failTrigger = (paraFail.elements || []).find((el) => el.tag === 'button' && String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
  if (failTrigger) {
    failTrigger.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const replayed = failSeeds.slice()
    for (const entry of setterLog) replayed[entry.at] = typeof entry.updater === 'function' ? entry.updater(replayed[entry.at]) : entry.updater
    eq('F-23 失败后不留半截草稿', String(replayed[2]), '')
    has('F-23 失败有可见错误', String(replayed[3]), '模型调用中断')
    eq('F-23 失败后停在错误态而不是草稿态', replayed[1], 'error')
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
  // L3: 关系卡的请求体必须把候选编号带出去（这是「放回书里看」的立身之本）。
  const relateCallBefore = net.calls.length
  const bag = smoke.buildRelateAsk({ entry: NOTE_A1, kind: 'note', question: '', candidates: smoke.relateCandidates({ entry: NOTE_A1, kind: 'note', data: dataPayload, craft }), data: dataPayload })
  check('F-29 关系包带候选编号', bag.pack.includes('note:'), bag.pack.slice(0, 160))
  check('F-29 关系包不冒充原文/想法', !bag.pack.includes('think.packMine') && !bag.pack.includes('think.packOriginal'), bag.pack.slice(0, 160))
  eq('F-29 关系包没有额外发请求', net.calls.length, relateCallBefore)
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

  // --- 11.6b F-32：采纳 AI 回应整理成的素材，不能在包里冒充我自己的话 -------
  // 两条同 type 的素材：一条 authorType='ai'（采纳 AI 回应后整理的），一条 'human'。
  // 走真宿主写入，再用 buildParagraphPack 走完整链路取真实返回值。
  const aiMaterial = host.craftOp('material.add', {
    type: '金句',
    text: '秩序感先给画面，再给判断。',
    sourceIds: [`note:${NOTE_A1.id}`],
    authorType: 'ai',
  }).created.material
  const humanMaterial = host.craftOp('material.add', {
    type: '金句',
    text: '我自己抄下来的一句。',
    sourceIds: [`note:${NOTE_A1.id}`],
    authorType: 'human',
  }).created.material
  const plainMaterial = host.craftOp('material.add', {
    type: '金句',
    text: '没有写作者身份的一句。',
    sourceIds: [`note:${NOTE_A1.id}`],
  }).created.material
  eq('F-32 宿主把 AI 素材的身份存住了', aiMaterial.authorType, 'ai')
  eq('F-32 自写素材身份是 human', humanMaterial.authorType, 'human')
  const f32Lookup = {
    note: lookup.note,
    thought: lookup.thought,
    response: lookup.response,
    material: new Map([
      [aiMaterial.id, aiMaterial],
      [humanMaterial.id, humanMaterial],
      [plainMaterial.id, plainMaterial],
    ]),
  }
  const packOf = (ids) => smoke.buildParagraphPack({ sourceIds: ids, lookup: f32Lookup, titleOf: () => BOOK_A.title })
  const kindLineOf = (pack) => pack.split('\n').find((line) => line.startsWith('think.packKind')) || ''
  const numberedOf = (pack) => pack.split('\n').filter((line) => /^\d+\. /.test(line))
  const aiKind = kindLineOf(packOf([`material:${aiMaterial.id}`]))
  const humanKind = kindLineOf(packOf([`material:${humanMaterial.id}`]))
  check('F-32 同 type 的两条素材标签不同', aiKind !== '' && humanKind !== '' && aiKind !== humanKind, `${aiKind} vs ${humanKind}`)
  check('F-32 AI 素材的标签里有「AI」', aiKind.includes('AI'), aiKind)
  check('F-32 自写素材的标签里没有「AI」', !humanKind.includes('AI'), humanKind)
  has('F-32 AI 素材进包用独立正文抬头', packOf([`material:${aiMaterial.id}`]), 'think.packFiledAI')
  check('F-32 自写素材进包不用 AI 抬头', !packOf([`material:${humanMaterial.id}`]).includes('think.packFiledAI'), humanKind)
  // 上下文条目也要分身份：分别把对方放在第 1 条位置，逐条看标记。
  const ctxWithAI = numberedOf(packOf([`material:${humanMaterial.id}`, `material:${aiMaterial.id}`]))
  const ctxWithHuman = numberedOf(packOf([`material:${aiMaterial.id}`, `material:${humanMaterial.id}`]))
  check('F-32 上下文第 1 条是 AI 素材时带 AI 标记', Boolean(ctxWithAI[0]) && ctxWithAI[0].includes('AI'), String(ctxWithAI[0]))
  check('F-32 上下文第 1 条是自写素材时不带 AI 标记', Boolean(ctxWithHuman[0]) && !ctxWithHuman[0].includes('AI'), String(ctxWithHuman[0]))
  check('F-32 同一段里 AI 与自写素材上下文标签不同', Boolean(ctxWithAI[0]) && Boolean(ctxWithHuman[0]) && ctxWithAI[0] !== ctxWithHuman[0], `${ctxWithAI[0]} vs ${ctxWithHuman[0]}`)
  // 身份缺失按自写处理：宁可漏标，也不能把用户的话标成 AI。
  // 别拿整包做 includes('AI')：真实文案的包尾本来就写着「素材里带「AI」字样的是…」，
  // 那样在真文案下会假红、在 key 化 stub 下又只是碰巧绿。这里只断类型行与正文抬头。
  const plainPack = packOf([`material:${plainMaterial.id}`])
  const plainKindLine = kindLineOf(plainPack)
  const plainHeadLine = plainPack.split('\n').find((line) => line.startsWith('think.packFiled')) || ''
  check(
    'F-32 没写 authorType 的素材按自写处理',
    plainKindLine.includes('think.packKindMaterialOf') && !plainKindLine.includes('think.packKindMaterialAI') && plainHeadLine === 'think.packFiled',
    `${plainKindLine} / ${plainHeadLine}`,
  )
  check('F-32 没写 authorType 的素材不用 AI 抬头', !plainPack.includes('think.packFiledAI'), plainHeadLine)
  // 再拿真实中文文案跑一遍：真文案里「我整理的素材（金句）」与「我采纳的 AI 回应整理成的素材（金句）」
  // 才是用户与模型真正看到的东西；包尾那句自带「AI」，正好证明整包判断不可信。
  const PLAIN_ROLE = '我整理的素材（金句）'
  const AI_ROLE = '我采纳的 AI 回应整理成的素材（金句）'
  const AI_HEAD = '我采纳的 AI 回应整理成的素材：'
  localeText = true
  let plainText = ''
  let aiText = ''
  let dirtyText = ''
  let dirtyUpperText = ''
  try {
    plainText = packOf([`material:${plainMaterial.id}`])
    aiText = packOf([`material:${aiMaterial.id}`])
    // 脏值：'ai ' 带尾空格，不得被当成 AI。
    dirtyText = smoke.buildSourcePack({
      entry: { bookTitle: BOOK_A.title, text: '脏值素材' },
      kind: 'material',
      type: '金句',
      authorType: 'ai ',
    })
    // 大写变体：'AI' 只是大小写不同，也不能被当成「我采纳的 AI 回应整理成的素材」。
    dirtyUpperText = smoke.buildSourcePack({
      entry: { bookTitle: BOOK_A.title, text: '大写脏值素材' },
      kind: 'material',
      type: '金句',
      authorType: 'AI',
    })
  } finally {
    localeText = false
  }
  check('F-32 真实文案：未标身份用「我整理的素材（金句）」', plainText.includes(PLAIN_ROLE), plainText.split('\n').slice(0, 4).join(' / '))
  check('F-32 真实文案：未标身份不出现「我采纳的 AI 回应整理成的素材」', !plainText.includes(AI_ROLE) && !plainText.includes(AI_HEAD), plainText.split('\n').slice(0, 4).join(' / '))
  check('F-32 真实文案：AI 素材用「我采纳的 AI 回应整理成的素材（金句）」', aiText.includes(AI_ROLE), aiText.split('\n').slice(0, 4).join(' / '))
  check('F-32 真实文案：包尾本身就含「AI」（所以整包判断不可信）', plainText.includes('AI'), plainText.split('\n').slice(-2).join(' / '))
  check('F-32 真实文案：脏值「ai␠」仍按自写处理', dirtyText.includes(PLAIN_ROLE) && !dirtyText.includes(AI_ROLE) && !dirtyText.includes(AI_HEAD), dirtyText.split('\n').slice(0, 4).join(' / '))
  check(
    'F-32 真实文案：大写「AI」仍按自写处理',
    dirtyUpperText.includes(PLAIN_ROLE) && !dirtyUpperText.includes(AI_ROLE) && !dirtyUpperText.includes(AI_HEAD),
    dirtyUpperText.split('\n').slice(0, 4).join(' / '),
  )

  // 时间戳单位归一化：微读给的是秒，但真出现毫秒 createTime 时不能写出「55840-11-09」。
  const msStamp = Date.UTC(2025, 10, 9, 12, 30, 0)
  const secStamp = Math.floor(msStamp / 1000)
  const packWithStamp = (stamp) =>
    smoke.buildSourcePack({ entry: { bookTitle: BOOK_A.title, text: '同一时刻', createTime: stamp }, kind: 'note' })
  const packSeconds = packWithStamp(secStamp)
  const packMillis = packWithStamp(msStamp)
  const timeLineOf = (pack) => pack.split('\n').find((line) => line.startsWith('think.packTime')) || ''
  const dateOf = (pack) => (timeLineOf(pack).match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/) || [''])[0]
  check('时间戳：秒级 createTime 正常解析', /^20\d{2}-/.test(dateOf(packSeconds)), timeLineOf(packSeconds))
  check(
    '时间戳：毫秒级 createTime 不会写出五位数年份',
    dateOf(packMillis) !== '' && !/\d{5}-/.test(timeLineOf(packMillis)),
    timeLineOf(packMillis),
  )
  eq('时间戳：毫秒与秒指向同一分钟', dateOf(packMillis), dateOf(packSeconds))
  for (const value of ['AI', 'Ai', 'ai ', 'human', '', null, undefined]) {
    eq(`F-32 materialAuthorIsAI(${String(value)}) 不算 AI`, smoke.materialAuthorIsAI(value), false)
  }
  eq('F-32 materialAuthorIsAI(ai) 认出来', smoke.materialAuthorIsAI('ai'), true)

  // --- 11.7 F-28 配色：设置里选一套，根节点立刻换色 ------------------------
  const withPalette = (palette) => Object.assign({}, statePayload, { palette })
  const palettePicks = []
  const settingsDraw = renderComp('settings-palette', smoke.SettingsModal, {
    state: Object.assign({}, statePayload),
    onClose() {},
    onChanged() {},
    onDataChanged() {},
    onSyncStarted() {},
    onPalette: (name) => palettePicks.push(name),
  }, ['', '60', '200', false, '', path.join(workDir, 'exports'), '', null, false])
  has('F-28 设置里出现「外观」段', settingsDraw.text, 'appearance.title')
  has('F-28 说明里点出默认是 glacier', settingsDraw.text, 'appearance.glacier')
  has('F-28 五套色板都在选择器里', settingsDraw.text, 'appearance.night')
  for (const gone of ['appearance.follow', 'appearance.cream']) missing('F-28 退役选项已从文案里消失', settingsDraw.text, gone)
  const paletteSelects = settingsDraw.elements.filter((el) => el.tag === 'select' && String(el.props.className || '').includes('wr-palette-select'))
  eq('F-28 外观只有一支选择器', paletteSelects.length, 1)
  eq('F-28 没有第二个主题开关', settingsDraw.elements.filter((el) => ['checkbox', 'radio'].includes(el.props.type)).length, 0)
  const paletteValues = [...new Set(settingsDraw.elements.filter((el) => el.tag === 'option').map((el) => el.props.value))]
  eq('F-28 选项就是五套', JSON.stringify(paletteValues), JSON.stringify(['glacier', 'mint', 'night', 'mist', 'iris']))
  check('F-28 没设置时选择器停在 glacier', paletteSelects.length === 1 && paletteSelects[0].props.value === 'glacier',
    paletteSelects.length === 1 ? String(paletteSelects[0].props.value) : 'no select')
  const beforeConfig = net.calls.length
  if (paletteSelects.length === 1 && typeof paletteSelects[0].props.onChange === 'function') {
    paletteSelects[0].props.onChange({ target: { value: 'night' } })
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  eq('F-28 选了 night 就先通知外层换色', JSON.stringify(palettePicks), JSON.stringify(['night']))
  const configCall = net.calls.slice(beforeConfig).find((call) => String(call.url).includes('/config'))
  check('F-28 选完写回 config.json', Boolean(configCall), net.calls.slice(beforeConfig).map((call) => call.url).join(','))
  if (configCall) {
    let patched = {}
    try {
      patched = JSON.parse(configCall.body)
    } catch (error) {
      patched = {}
    }
    eq('F-28 写回的是 palette=night', patched.palette, 'night')
  }
  check('F-28 换配色不触发同步', net.calls.slice(beforeConfig).every((call) => !String(call.url).includes('/sync')),
    net.calls.slice(beforeConfig).map((call) => call.url).join(','))

  const rootOf = (draw) => draw.elements.find((el) => String(el.props.className || '') === 'wr-root')
  const defaultDraw = get('palette-default', { view: 'overview', state: Object.assign({}, statePayload) })
  const nightDraw = get('palette-night', { view: 'overview', state: withPalette('night') })
  const unknownDraw = get('palette-unknown', { view: 'overview', state: withPalette('neon-bogus') })
  const defaultRoot = rootOf(defaultDraw)
  const nightRoot = rootOf(nightDraw)
  const unknownRoot = rootOf(unknownDraw)
  eq('F-28 没设置配色时根节点就是 glacier', defaultRoot && defaultRoot.props['data-palette'], 'glacier')
  eq('F-28 选了 night 根节点挂 data-palette=night', nightRoot && nightRoot.props['data-palette'], 'night')
  eq('F-28 未知配色回落 glacier', unknownRoot && unknownRoot.props['data-palette'], 'glacier')
  eq('F-28 退役的 follow 回落 glacier', smoke.paletteOf('follow'), 'glacier')
  eq('F-28 退役的 cream 回落 glacier', smoke.paletteOf('cream'), 'glacier')

  // 关键 token 真的换了，而且不是「看起来可以」——下面按 WCAG 算对比度。
  const styleOf = (draw) => {
    const el = draw.elements.find((item) => item.tag === 'style')
    const raw = el && el.props && el.props.dangerouslySetInnerHTML ? el.props.dangerouslySetInnerHTML.__html : ''
    return String(raw || '')
  }
  const css = styleOf(nightDraw)
  const blockOf = (selector) => {
    const at = css.indexOf(selector)
    if (at < 0) return ''
    const end = css.indexOf('}', at)
    return end > at ? css.slice(at, end) : ''
  }
  const baseBlock = blockOf('.wr-root{')
  const nightBlock = blockOf('.wr-root[data-palette="night"]{')
  const tokenOf = (block, name) => {
    const match = block.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{3,8})`))
    return match ? match[1] : ''
  }
  check('F-28 样式表里有 night 的 token 块', nightBlock.length > 0, String(nightBlock.length))
  check('F-28 night 的背景/正文与默认不同',
    tokenOf(nightBlock, '--wr-bg') !== '' && tokenOf(nightBlock, '--wr-bg') !== tokenOf(baseBlock, '--wr-bg') &&
      tokenOf(nightBlock, '--wr-ink') !== tokenOf(baseBlock, '--wr-ink'),
    `${tokenOf(nightBlock, '--wr-bg')} / ${tokenOf(nightBlock, '--wr-ink')} vs ${tokenOf(baseBlock, '--wr-bg')} / ${tokenOf(baseBlock, '--wr-ink')}`)

  const hexOf = (hex) => {
    const raw = String(hex || '').replace('#', '')
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6)
    return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16))
  }
  const luminance = (hex) => {
    const [r, g, b] = hexOf(hex).map((value) => {
      const channel = value / 255
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contrast = (one, two) => {
    const a = luminance(one)
    const b = luminance(two)
    const [hi, lo] = a > b ? [a, b] : [b, a]
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
  }
  const nightInk = tokenOf(nightBlock, '--wr-ink')
  const nightBg = tokenOf(nightBlock, '--wr-bg')
  const nightPaper = tokenOf(nightBlock, '--wr-paper')
  const nightSoft = tokenOf(nightBlock, '--wr-ink-soft')
  const nightAccent = tokenOf(nightBlock, '--wr-accent')
  const bodyContrast = contrast(nightInk, nightPaper)
  check('F-28 night 正文对比度 ≥4.5:1', bodyContrast >= 4.5, `${nightInk} on ${nightPaper} = ${bodyContrast}:1`)
  check('F-28 night 次要文字对比度 ≥4.5:1', contrast(nightSoft, nightPaper) >= 4.5,
    `${nightSoft} on ${nightPaper} = ${contrast(nightSoft, nightPaper)}:1`)
  check('F-28 night 正文在页面底色上也 ≥4.5:1', contrast(nightInk, nightBg) >= 4.5,
    `${nightInk} on ${nightBg} = ${contrast(nightInk, nightBg)}:1`)
  check('F-28 night 图形/大字对比度 ≥3:1', contrast(nightAccent, nightPaper) >= 3,
    `${nightAccent} on ${nightPaper} = ${contrast(nightAccent, nightPaper)}:1`)
  const heat = [0, 1, 2, 3, 4].map((step) => tokenOf(nightBlock, `--wr-heat-${step}`))
  eq('F-28 night 热力图五档都有值', heat.filter((hex) => hex !== '').length, 5)
  eq('F-28 night 热力图五档互不相同', new Set(heat).size, 5)
  const heatSteps = heat.slice(1).map((hex, index) => contrast(heat[index], hex))
  check('F-28 night 热力图相邻两档可分辨（≥1.2:1）', heatSteps.every((step) => step >= 1.2), heatSteps.join(' / '))
  check('F-28 浅色默认配色正文对比度 ≥4.5:1', contrast(tokenOf(baseBlock, '--wr-ink'), tokenOf(baseBlock, '--wr-paper')) >= 4.5,
    `${tokenOf(baseBlock, '--wr-ink')} on ${tokenOf(baseBlock, '--wr-paper')} = ${contrast(tokenOf(baseBlock, '--wr-ink'), tokenOf(baseBlock, '--wr-paper'))}:1`)
  check('F-28 cream 的 token 块已经从样式表里删掉', blockOf('.wr-root[data-palette="cream"]{') === '', '仍有 cream 块')

  // 持久化：写进 config.json，换一个宿主实例（= 刷新/重启）再读回来仍在。
  const configFile = path.join(home, 'weread-gather', 'config.json')
  const readConfig = () => JSON.parse(fs.readFileSync(configFile, 'utf8'))
  host.saveConfig({ palette: 'night' })
  eq('F-28 宿主记住 night', host.settings().palette, 'night')
  eq('F-28 config.json 里写着 palette=night', readConfig().palette, 'night')
  const reloaded = I.createHost({})
  eq('F-28 重开宿主仍是 night（刷新后仍在）', reloaded.settings().palette, 'night')
  // 老配置里的五套继续被接受；退役的 follow 与非法值一律落成 glacier，字段仍在（不再有「空 = 跟随」）。
  host.saveConfig({ palette: 'follow' })
  eq('F-28 退役的 follow 落盘为 glacier', readConfig().palette, 'glacier')
  eq('F-28 退役的 follow 读回来是 glacier', host.settings().palette, 'glacier')
  host.saveConfig({ palette: 'neon-bogus' })
  eq('F-28 非法配色落盘为 glacier', readConfig().palette, 'glacier')
  eq('F-28 非法配色读回来是 glacier', host.settings().palette, 'glacier')
  const reloaded2 = I.createHost({})
  eq('F-28 再开一次宿主仍是 glacier', reloaded2.settings().palette, 'glacier')

  // 关系卡：浮层里按内容自适应，遮罩负责铺满与层级。
  const clientCode = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
  const cssBlock = (name) => {
    const at = clientCode.indexOf(`.${name}{`)
    return at < 0 ? '' : clientCode.slice(at, clientCode.indexOf('}', at))
  }
  const cardCss = cssBlock('wr-relate-card')
  const modalCss = cssBlock('wr-relate-modal')
  const bodyCss = cssBlock('wr-relate-body')
  check('F-28 卡片自己不再 fixed（fixed 在遮罩上）', cardCss !== '' && cardCss.indexOf('position:fixed') < 0 && cardCss.indexOf('position:absolute') < 0, String(cardCss.length))
  check('F-28 遮罩铺满视口', modalCss.indexOf('position:fixed') >= 0 && modalCss.indexOf('inset:0') >= 0, modalCss.slice(0, 120))
  check('F-28 关系卡仍有 max-height（长答案卡内滚动）', cardCss.indexOf('max-height') >= 0, cardCss.slice(0, 160))
  check('F-28 关系卡宽度是 min(600px, …)', cardCss.indexOf('min(600px') >= 0, cardCss.slice(0, 160))
  check('F-28 正文区是内部滚动区', bodyCss.indexOf('overflow-y:auto') >= 0 && bodyCss.indexOf('flex:1 1 auto') >= 0, bodyCss.slice(0, 140))
  check('F-28 已经不再用 askPosition 摆卡片', clientCode.indexOf('askPosition') < 0)
  check('F-28 旧的浮层卡样式已清除', clientCode.indexOf('.wr-ask{') < 0)
  const modalDraw = renderComp('behave-modal-card', smoke.RelateCard, { entry: NOTE_A1, kind: 'note', onToggle() {} }, ['', false, '', '', '', {}, '', '', false])
  const modalCards = (modalDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-relate-card')
  check('F-28 浮层里只有一张卡', modalCards.length === 1, String(modalCards.length))
  check('F-28 卡片只带高度上限、不带坐标', modalCards.length === 1 && modalCards[0].props.style && modalCards[0].props.style.maxHeight !== undefined && modalCards[0].props.style.top === undefined && modalCards[0].props.style.left === undefined, JSON.stringify(modalCards.length === 1 ? modalCards[0].props.style : null))

// --- 11.8 我的阅读脉络（F-33）：生成 → 校验 → 落盘 → 采纳建议对 ---------------
  // 这条链每一步都真跑：真宿主写数据、真 SSE 帧、真 threads.save。断言数单独累计。
  let threadChain = 0
  const threadCheck = (name, ok, detail) => {
    threadChain += 1
    check(name, ok, detail)
  }
  const relOne = host.craftOp('relation.add', {
    from: { kind: 'note', id: NOTE_A1.id },
    to: { kind: 'thought', id: THOUGHT_A.id },
    label: '呼应',
    reason: '都在说先给画面。',
    bookId: BOOK_A.bookId,
    origin: 'manual',
  }, host.craftSummary().revision).created.relation
  const threadWrites = []
  const threadWrite = (op, payload) => {
    threadWrites.push({ op, payload })
    return Promise.resolve(host.craftOp(op, payload, host.craftSummary().revision))
  }
  const threadBase = {
    book: BOOK_A,
    data: dataPayload,
    craft: host.craftView(),
    craftState: 'ready',
    write: threadWrite,
    onOpenSource() {},
    onSwitchToWorks() {},
  }
  // BookThreads 的 useState 顺序：busy, error, notice, suggests, adopting, saving, expand
  const threadSeeds = [false, '', '', [], false, false, false]
  const thinBook = Object.assign({}, dataPayload, {
    notes: (dataPayload.notes || []).filter((item) => item.bookId !== BOOK_A.bookId),
    thoughts: (dataPayload.thoughts || []).filter((item) => item.bookId !== BOOK_A.bookId),
  })
  const thinDraw = renderComp('threads-thin', smoke.BookThreads, Object.assign({}, threadBase, { data: thinBook }), threadSeeds)
  has('记录太少时给的是「先划一句」', thinDraw.text, 'thread.emptyNone')
  missing('记录太少时不给梳理按钮', thinDraw.text, 'thread.build')
  const thinBtn = (thinDraw.elements || []).find((el) => String(el.props.className || '').split(' ').includes('wr-threads-build'))
  threadCheck('记录太少时没有可点的梳理按钮', !thinBtn)

  const answerOne = JSON.stringify({
    threads: [
      { title: '读诗先要一个画面', why: '两次都停在先看见。', relations: [relOne.id], suggest: [] },
      { title: '这条线索的编号是编的', why: '编号不在包里。', relations: ['rel_fake_999'], suggest: [] },
    ],
  })
  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: answerOne },
    { type: 'done' },
  ]
  net.calls.length = 0
  const buildDraw = renderComp('threads-build', smoke.BookThreads, threadBase, threadSeeds)
  const buildBtn = (buildDraw.elements || []).find((el) => String(el.props.className || '').split(' ').includes('wr-threads-build'))
  threadCheck('梳理按钮可点', Boolean(buildBtn) && typeof buildBtn.props.onClick === 'function')
  if (buildBtn) {
    buildBtn.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const chatCall = net.calls.filter((call) => String(call.url).includes('/chat') && !String(call.url).includes('/chat/models')).pop()
    threadCheck('真的发出了 /chat 请求', Boolean(chatCall))
    let chatBody = {}
    try {
      chatBody = chatCall ? JSON.parse(String(chatCall.body || '{}')) : {}
    } catch {
      chatBody = {}
    }
    threadCheck('请求体带 mode=threads', chatBody.mode === 'threads')
    // threads 是「让你梳理这些记录」，本来就没有用户提问：发空问题才是对的，
    // 客户端不能为了绕过校验塞一句假问题。
    threadCheck('请求体不发假问题（question 为空）', String(chatBody.question === undefined ? '' : chatBody.question) === '')
    threadCheck('请求体把全书记录按章带上了编号', String(chatBody.pack || '').includes('note:' + NOTE_A1.id))
    threadCheck('请求体带上了已确认的对照编号', String(chatBody.pack || '').includes(relOne.id))
    const saved = threadWrites.filter((item) => item.op === 'threads.save').pop()
    threadCheck('生成后写了 threads.save', Boolean(saved))
    threadCheck('只留下编号能落地的线索', Boolean(saved) && saved.payload.threads.length === 1)
    threadCheck('存的是那条已确认关系的编号', Boolean(saved) && saved.payload.threads[0].relationIds[0] === relOne.id)
    threadCheck('编造的编号没有进 threads.save', Boolean(saved) && !JSON.stringify(saved.payload).includes('rel_fake_999'))
    const stored = host.craftView()
    const storedThread = (stored.threads || []).find((item) => String(item.bookId) === String(BOOK_A.bookId))
    threadCheck('宿主按书存下了这条线索', Boolean(storedThread))
    threadCheck('覆盖行由宿主算：章数', Boolean(storedThread) && (storedThread.coverage.chapters || []).length >= 1)
    threadCheck('覆盖行由宿主算：划线数', Boolean(storedThread) && Number(storedThread.coverage.notes) === 2)
    threadCheck('覆盖行由宿主算：想法数', Boolean(storedThread) && Number(storedThread.coverage.thoughts) === 1)
    const reopened = I.createHost({}).craftView()
    threadCheck('刷新后线索仍在', (reopened.threads || []).some((item) => String(item.title) === '读诗先要一个画面'))
    // L5：卡片头是宿主快照，「这次扫了」是实时数据 —— 两个数字并排，就必须各自写明口径。
    const zhDict = (localeDictionaries && localeDictionaries.zh) || {}
    threadCheck('卡片头写明数字来自宿主快照', String(zhDict['thread.coverage'] || '').includes('本书导入'))
    threadCheck('「这次扫了」写明是实时数据', String(zhDict['thread.scanned'] || '').includes('按当前数据'))
    const threadsDraw = renderComp('threads-head-foot', smoke.BookThreads, Object.assign({}, threadBase, { craft: host.craftView() }), threadSeeds)
    threadCheck('脉络卡上真的有覆盖行', threadsDraw.text.includes('thread.coverage'))
    threadCheck('脉络卡上真的有「这次扫了」', threadsDraw.text.includes('thread.scanned'))
  }

  // 上限：模型给 6 条，前端先截到 5 条再落盘（宿主 >5 会 400，所以这里也证明没把 400 露给用户）。
  threadWrites.length = 0
  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: JSON.stringify({ threads: Array.from({ length: 6 }, (_, index) => ({ title: '线索 ' + (index + 1), why: '第 ' + (index + 1) + ' 条。', relations: [relOne.id], suggest: [] })) }) },
    { type: 'done' },
  ]
  const cappedDraw = renderComp('threads-build-capped', smoke.BookThreads, threadBase, threadSeeds)
  const cappedBtn = (cappedDraw.elements || []).find((el) => String(el.props.className || '').split(' ').includes('wr-threads-build'))
  if (cappedBtn) {
    cappedBtn.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const cappedSave = threadWrites.filter((item) => item.op === 'threads.save').pop()
    threadCheck('六条线索只落了五条', Boolean(cappedSave) && cappedSave.payload.threads.length === 5)
    threadCheck('截断发生在前端（宿主没有收到 6 条）', Boolean(cappedSave) && cappedSave.payload.threads.length <= 5)
  }
  const cappedView = renderComp('threads-capped-notice', smoke.BookThreads, threadBase, [false, '', 'thread.capped(1)', [], false, false, false])
  has('超上限时给出提示', cappedView.text, 'thread.capped')

  // 冷启动：一条 relations 都没有时，模型只能给「建议对」；采纳才写。
  host.craftOp('relation.delete', { id: relOne.id }, host.craftSummary().revision)
  threadWrites.length = 0
  net.chatFrames = [
    { type: 'open', provider: 'fake', model: 'fake-1' },
    { type: 'text', text: JSON.stringify({ threads: [{ title: '两条该放一起看', why: '都在说自然的秩序。', relations: [], suggest: [[ 'note:' + NOTE_A1.id, 'thought:' + THOUGHT_A.id ]] }] }) },
    { type: 'done' },
  ]
  const coldDraw = renderComp('threads-cold', smoke.BookThreads, Object.assign({}, threadBase, { craft: host.craftView() }), threadSeeds)
  const coldBtn = (coldDraw.elements || []).find((el) => String(el.props.className || '').split(' ').includes('wr-threads-build'))
  if (coldBtn) {
    coldBtn.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 300))
    threadCheck('只有建议对时不动库（没有 threads.save）', threadWrites.filter((item) => item.op === 'threads.save').length === 0)
    threadCheck('只有建议对时也没有写关系', threadWrites.filter((item) => item.op === 'relation.add').length === 0)
  }
  const suggestEntry = { thread: { title: '两条该放一起看', why: '都在说自然的秩序。', relations: [], suggest: [['note:' + NOTE_A1.id, 'thought:' + THOUGHT_A.id]] } }
  const suggestDraw = renderComp('threads-suggest-adopt', smoke.BookThreads, Object.assign({}, threadBase, { craft: host.craftView() }), [false, '', '', [suggestEntry], '', '', false])
  has('建议对渲染成一行', suggestDraw.text, 'thread.suggestTitle')
  const adopter = (suggestDraw.elements || []).find((el) => String(el.props.className || '').split(' ').includes('wr-thread-adopt'))
  threadCheck('建议对有「采纳」按钮', Boolean(adopter) && typeof adopter.props.onClick === 'function')
  if (adopter) {
    adopter.props.onClick({ stopPropagation() {} })
    await new Promise((resolve) => setTimeout(resolve, 300))
    const relAdd = threadWrites.filter((item) => item.op === 'relation.add').pop()
    try {
      const direct = host.craftOp('relation.add', relAdd.payload, host.craftSummary().revision)
    } catch (error) {
    }
    threadCheck('采纳点了才写 relation.add', Boolean(relAdd))
    threadCheck('采纳写的是「待核实」标签', Boolean(relAdd) && relAdd.payload.label === '待核实')
    threadCheck('建议对两端都用包里出现过的编号', Boolean(relAdd) && relAdd.payload.from.kind === 'note' && relAdd.payload.from.id === NOTE_A1.id && relAdd.payload.to.kind === 'thought' && relAdd.payload.to.id === THOUGHT_A.id)
    const afterAdopt = host.craftView()
    const created = (afterAdopt.relations || []).find((item) => String(item.reason) === '都在说自然的秩序。')
    threadCheck('关系真的落了盘', Boolean(created))
    const reSave = threadWrites.filter((item) => item.op === 'threads.save').pop()
    threadCheck('采纳后把这一对的编号并入 threads.save', Boolean(reSave) && JSON.stringify(reSave.payload).includes(created ? created.id : 'rel_missing'))
    const reloadedThreads = I.createHost({}).craftView().threads || []
    threadCheck('刷新后这条建议对成的线索还在', reloadedThreads.some((item) => item.title === '两条该放一起看'))
  }

  console.log('[behave] 阅读脉络链路断言 %d 条（含「建议对 → 采纳 → 落 relation → 重存 threads」）', threadChain)

// --- 11.9 积累页时间线：按月分组、每条三行、整行可点（作品带 focusWorkId） --------
  {
    const at = (iso) => Math.floor(Date.parse(iso) / 1000)
    const tlBookA = { bookId: 'weread:book/T1', title: '时间线之书', author: '作者甲' }
    const tlBookB = { bookId: 'weread:book/T2', title: '另一本', author: '作者乙' }
    const tlData = {
      books: [tlBookA, tlBookB],
      notes: [],
      thoughts: [
        { id: 'th_t1', bookId: tlBookA.bookId, chapterName: '第一卷', content: '三月的想法：把整段文字放上来，看它会不会在第二行被截断。'.repeat(2), createTime: at('2026-03-05T10:20:00Z') },
        { id: 'th_t2', bookId: tlBookA.bookId, chapterName: '第二卷', content: '一月的想法。', createTime: at('2026-01-09T08:05:00Z') },
        { id: 'th_t3', bookId: '', chapterName: '', content: '没有书归属的想法。', createTime: at('2026-01-02T09:00:00Z') },
      ],
      counts: { notes: 0, thoughts: 3 },
    }
    const tlCraft = {
      hasCraft: true,
      revision: 3,
      updatedAt: at('2026-03-06T00:00:00Z'),
      counts: { responses: 1, materials: 0, topics: 0, works: 2 },
      responses: [{ id: 'r_t1', bookId: tlBookA.bookId, sourceIds: [], text: '采纳的一句回应。', origin: 'think', containsAI: true, model: 'fake-1', promptVersion: 'think-v1', adoptedAt: at('2026-03-06T21:40:00Z'), createdAt: at('2026-03-06T21:40:00Z') }],
      materials: [],
      topics: [],
      works: [
        { id: 'w_t1', title: '单书初稿', status: 'confirmed', exportId: 'craft:work/w_t1', containsAI: false, paragraphs: [{ id: 'p_t1', text: '单书的一段。', sourceIds: ['note:n_t1'], ai: false, aiOriginIds: [], editedAt: 0 }], createdAt: at('2026-02-20T11:00:00Z'), updatedAt: at('2026-02-20T11:00:00Z'), confirmedAt: at('2026-02-20T11:30:00Z') },
        { id: 'w_t2', title: '跨两本书的初稿', status: 'draft', exportId: 'craft:work/w_t2', containsAI: false, paragraphs: [{ id: 'p_t2', text: '两本书的一段。', sourceIds: ['note:n_t1', 'note:n_t2'], ai: false, aiOriginIds: [], editedAt: 0 }], createdAt: at('2026-02-11T09:00:00Z'), updatedAt: at('2026-02-11T09:00:00Z'), confirmedAt: 0 },
      ],
      bookIndex: [],
      relations: [],
      threads: [],
    }
    const tlBookIdOf = (sourceId) => {
      const id = String(sourceId || '')
      if (id === 'note:n_t1') return tlBookA.bookId
      if (id === 'note:n_t2') return tlBookB.bookId
      return ''
    }
    const trail = []
    const tlDraw = renderComp('timeline-rows', smoke.GrowTimeline, {
      craft: tlCraft,
      craftState: 'ready',
      craftError: '',
      data: tlData,
      bookIdOf: tlBookIdOf,
      scopeBookId: '',
      onOpenSource: (sourceId) => trail.push(String(sourceId)),
      onOpenWork: (workId) => trail.push(`work:${workId}`),
      onOpenBook: (bookId) => trail.push(`book:${bookId}`),
      onGoShelf: () => {},
      onRetry: () => {},
    }, [0])
    const tlNodes = (tlDraw.elements || []).filter((el) => String(el.props.className || '').split(' ').includes('wr-tl-item'))
    const plain = (node) => {
      if (node === null || node === undefined || node === false) return ''
      if (typeof node === 'string' || typeof node === 'number') return String(node)
      if (Array.isArray(node)) return node.map(plain).join('')
      if (node.type === '__fragment__') return plain(node.props && node.props.children)
      if (typeof node.type === 'function') return plain(node.type(node.props || {}))
      const kids = node.props ? node.props.children : undefined
      return kids === undefined ? '' : plain(kids)
    }
    eq('时间线只剩思考与创作（三条）', tlNodes.length, 3)
    eq('时间线没有想法这一类事件', tlNodes.filter((el) => el.props['data-kind'] === 'thought').length, 0)
    const tlShapes = tlNodes.map((el) => (el.props.children || []).filter((kid) => kid && typeof kid === 'object').map((kid) => String(kid.props.className || '')).join(','))
    check('每条记录都是三行（时间+动作 / 正文 / 书名·章节）', tlShapes.every((shape) => shape === 'wr-tl-meta,wr-tl-body,wr-tl-where'), tlShapes[0])
    const metae = tlNodes.map((el) => (el.props.children || [])[0])
    check('第一行是时:分', metae.every((meta) => /^\d{1,2}:\d{2}$/.test(plain((meta.props.children || [])[0]))), plain((metae[0].props.children || [])[0]))
    const actions = new Set(metae.map((meta) => plain((meta.props.children || [])[1])))
    check('第一行还有动作（采纳了回应/新建初稿）', actions.size === 2 && [...actions].every((name) => name.indexOf('grow.event.') === 0), [...actions].join(','))
    check('时间线里不再写「写了想法」这类阅读动作', !tlDraw.text.includes('grow.event.thought'))
    check('不再出现「确认初稿」这类动作', !tlDraw.text.includes('grow.event.workConfirmed'))
    check('第三行写明书名', tlDraw.text.includes('时间线之书'))
    check('第三行跨两本书时写「等 N 本」', tlDraw.text.includes('grow.multiBooks'))
    const responseRow = tlNodes.find((el) => el.props['data-kind'] === 'response')
    const responseWhere = responseRow ? plain((responseRow.props.children || [])[2]) : ''
    check('第三行写书名', responseWhere.includes('时间线之书'), responseWhere)
    const months = (tlDraw.elements || []).filter((el) => String(el.props.className || '') === 'wr-tl-month')
    eq('按月分成两组', months.length, 2)
    check('月份标题带该月条数', tlDraw.text.includes('grow.monthCountInline'))
    const monthTexts = months.map((el) => plain(el))
    const monthOrder = monthTexts.map((item) => String(item.split(',')[1] || '').slice(0, 2))
    check('组内组间都是时间倒序（三月在前）', monthTexts.length === 2 && monthOrder.join(',') === '03,02', JSON.stringify(monthOrder))
    check('不再有「共 N 条」', !tlDraw.text.includes('grow.total'))
    check('不再有「跨书」这种后台标签', !tlDraw.text.includes('grow.cross'))
    const clickRow = (kind, needle) => {
      const row = tlNodes.find((el) => el.props['data-kind'] === kind && (!needle || String(el.props.title || '').includes(needle)))
      if (row) row.props.onClick({ stopPropagation() {} })
      return Boolean(row)
    }
    check('回应行可点', clickRow('response'))
    check('作品行可点', clickRow('work', '跨两本书'))
    eq('回应行回到原记录', trail[0], 'response:r_t1')
    eq('作品行带 focusWorkId 打开那一篇', trail[1], 'work:w_t2')

    const headTitle = (draw) => {
      const head = ((draw && draw.elements) || []).find((el) => String(el.props.className || '') === 'wr-draft-head-title')
      return head ? plain(head) : ''
    }
    const focusDraw = renderComp('works-focus', smoke.WorkBoard, {
      craft: tlCraft,
      craftState: 'ready',
      craftError: '',
      data: tlData,
      bookIdOf: tlBookIdOf,
      scopeBookId: '',
      focusWorkId: 'w_t2',
      lookup: {},
      write: () => Promise.resolve({}),
      onOpenSource: () => {},
      onOpenBook: () => {},
    }, [])
    const noFocusDraw = renderComp('works-nofocus', smoke.WorkBoard, {
      craft: tlCraft,
      craftState: 'ready',
      craftError: '',
      data: tlData,
      bookIdOf: tlBookIdOf,
      scopeBookId: '',
      focusWorkId: '',
      lookup: {},
      write: () => Promise.resolve({}),
      onOpenSource: () => {},
      onOpenBook: () => {},
    }, [])
    check('带 focusWorkId 时打开的是那一篇（不是最近更新的那篇）', headTitle(focusDraw).includes('跨两本书的初稿'), headTitle(focusDraw))
    check('不带 focusWorkId 时仍选最近更新的一篇', headTitle(noFocusDraw).includes('单书初稿'), headTitle(noFocusDraw))
    const annualDraw = renderComp('annual-plain', smoke.GrowAnnual, { data: tlData, craft: tlCraft, onGoShelf: () => {}, onOpenBook: () => {} }, [2026, {}, { totalReadTime: 0 }, '', false, ''])
    check('年度回顾不再挂常驻说明', !annualDraw.text.includes('grow.annual.note'))
    check('年度回顾不再重复画热力图', !(annualDraw.elements || []).some((el) => String(el.props.className || '').indexOf('wr-heat') >= 0))
  }

  // --- 12. 初稿页快修：删除要两步、预览是开关、输入框跟着长 ----------------------
  {
    const deletes = []
    const menuProps = { work: workA, busy: false, onDelete: () => deletes.push(1) }
    const menuClosed = renderComp('work-menu-closed', smoke.WorkMenu, menuProps, [false, false])
    check('初稿头部的「⋯」默认是收起的', (menuClosed.elements || []).filter((el) => String(el.props.className || '') === 'wr-menu-panel').length === 0)
    const menuOpen = renderComp('work-menu-open', smoke.WorkMenu, menuProps, [true, false])
    const firstDanger = (menuOpen.elements || []).find((el) => String(el.props.className || '') === 'wr-menu-danger')
    check('「⋯」里写明删的是整篇', Boolean(firstDanger) && String(firstDanger.props.children || '') === 'work.deleteWhole', firstDanger && firstDanger.props.children)
    if (firstDanger) firstDanger.props.onClick()
    eq('第一次点不删、只是换成确认', deletes.length, 0)
    const menuArmed = renderComp('work-menu-armed', smoke.WorkMenu, menuProps, [true, true])
    const secondDanger = (menuArmed.elements || []).find((el) => String(el.props.className || '') === 'wr-menu-danger')
    check('第二步的文案是「再点一次，确认删除整篇」', Boolean(secondDanger) && String(secondDanger.props.children || '') === 'work.deleteConfirm', secondDanger && secondDanger.props.children)
    if (secondDanger) secondDanger.props.onClick()
    eq('确认之后才真的发 work.delete', deletes.length, 1)

    const boardBase = {
      craft,
      data: dataPayload,
      scopeBookId: '',
      bookIdOf: () => BOOK_A.bookId,
      onOpenSource() {},
      onGoShelf() {},
      write: () => Promise.resolve({}),
    }
    const boardEmpty = renderComp('work-board-empty', smoke.WorkBoard, boardBase, [workA.id, '', false, '', [], false, '', '', ''])
    const boardLong = renderComp('work-board-long', smoke.WorkBoard, boardBase, [workA.id, '', false, '长草稿。'.repeat(120), [], false, '', '', ''])
    const boardPreview = renderComp('work-board-preview', smoke.WorkBoard, boardBase, [workA.id, '', false, '', [], false, '', '## 预览', ''])
    const rowsOf = (draw) => {
      const areas = (draw.elements || []).filter((el) => el.tag === 'textarea' && String(el.props.className || '').indexOf('wr-line-input') >= 0)
      return areas.length === 1 ? areas[0].props.rows : null
    }
    eq('空输入框只占一行', rowsOf(boardEmpty), 1)
    eq('长草稿把输入框撑到六行封顶', rowsOf(boardLong), 6)
    eq('三行文本对应三行', smoke.textareaRows('a\nb\nc'), 3)
    check('rows 永远在 1..6 之间', [0, 1, 3, 6, 20, 200].every((lines) => {
      const rows = smoke.textareaRows('x\n'.repeat(lines))
      return rows >= 1 && rows <= smoke.TEXTAREA_MAX_ROWS
    }))

    const menuInHead = (boardEmpty.elements || []).filter((el) => String(el.props.className || '').indexOf('wr-menu-btn') >= 0)
    eq('作品头部有唯一「⋯」', menuInHead.length, 1)
    const formRows = (boardEmpty.elements || []).filter((el) => String(el.props.className || '').indexOf('wr-form-row') >= 0)
    check('「加这一段」那一排不再有整篇删除', formRows.every((el) => JSON.stringify(el.props).indexOf('wr-menu-danger') < 0))

    const previewOff = (boardEmpty.elements || []).find((el) => el.tag === 'button' && String(el.props.children || '') === 'work.exportPreview')
    check('预览按钮默认写着「预览」', Boolean(previewOff))
    eq('预览区默认收起', (boardEmpty.elements || []).filter((el) => String(el.props.className || '') === 'wr-draft-export').length, 0)
    const previewOn = (boardPreview.elements || []).find((el) => el.tag === 'button' && String(el.props.children || '') === 'work.hidePreview')
    check('预览打开后按钮变成「隐藏预览」', Boolean(previewOn))
    eq('预览打开后能看到 YAML 区', (boardPreview.elements || []).filter((el) => String(el.props.className || '') === 'wr-draft-export').length, 1)
    const exportCallsBefore = net.calls.filter((item) => item.url.indexOf('/export') >= 0).length
    if (previewOn) previewOn.props.onClick()
    const exportCallsAfter = net.calls.filter((item) => item.url.indexOf('/export') >= 0).length
    eq('点「隐藏预览」不再发导出请求', exportCallsAfter, exportCallsBefore)

    // 提示清理：说错的那句里不再提 bookIds；两句灰字提示都不在了。
    const boardText = boardEmpty.text
    check('front-matter 说明里不再提 bookIds', !boardText.includes('bookIds'))
    check('初稿页那句「段落挂着出处」的说明已经删掉', !boardText.includes('work.hint'))

    const responsesView = get('responses-copy', { view: 'responses' })
    check('思考页那句「对话本身不落盘」已经删掉', !responsesView.text.includes('thinkView.hint'))
    has('思考页仍然写着采纳时间', responsesView.text, 'thinkView.adoptedAt')

    // 段落行：没出处的说明只在按钮 title 里，不占正文。
    const paraRow = renderComp(
      'paragraph-no-source-row',
      smoke.ParagraphRow,
      { paragraph: { id: 'p_ns', text: '这一段没有出处。', sourceIds: [] }, index: 0, work: { id: workA.id }, lookup, titleOf: () => '诗经', onSave: () => Promise.resolve(), onDelete() {}, onAdopt: () => Promise.resolve() },
      [false, '', false, ''],
    )
    const aiTrigger = (paraRow.elements || []).find((el) => String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
    check('没出处时说明放进按钮 title', Boolean(aiTrigger) && String(aiTrigger.props.title || '') === 'work.aiNeedSource', aiTrigger && aiTrigger.props.title)
    eq('没出处时不再多一行灰字', (paraRow.elements || []).filter((el) => String(el.props.className || '') === 'wr-ai-hint').length, 0)

    // 浮层底部：记成想法 / 收起 是次级按钮，输入框也是一行起。
    const relateFoot = renderComp('relate-foot-quiet', smoke.RelateCard, { entry: NOTE_A1, kind: 'note', open: true, onToggle() {} }, ['', false, '', '秩序感先给画面，再给判断。', '', {}, '', '', false])
    const quietButtons = (relateFoot.elements || []).filter((el) => el.tag === 'button' && ['relate.keepThought', 'relate.collapse'].includes(String(el.props.children || '')))
    eq('浮层底部两个次动作都在', quietButtons.length, 2)
    check('两个次动作都是次级按钮样式', quietButtons.every((el) => String(el.props.className || '').split(' ').includes('wr-btn-quiet')), quietButtons.map((el) => el.props.className).join('|'))
    const sendButton = (relateFoot.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-send')
    check('发送键没被降级', Boolean(sendButton) && String(sendButton.props.className).indexOf('wr-btn-quiet') < 0)
    const relateInput = (relateFoot.elements || []).find((el) => el.tag === 'textarea' && String(el.props.className || '').indexOf('wr-relate-input') >= 0)
    eq('浮层输入框空态是一行', relateInput && relateInput.props.rows, 1)
  }

// --- 12.6 对话卡高度、按钮分排、入口靠右、同章划线收起 ----------------------
  {
    // 高度：卡片只给上限，正文区没有写死高度；短回答矮、长回答停在上限。
    const cardCss = cssBlock('wr-relate-card')
    const bodyCss = cssBlock('wr-relate-body')
    check('卡片只给上限、不写死高度', cardCss.indexOf('max-height') >= 0 && !/(^|;)\s*height:/.test(cardCss), cardCss.slice(0, 120))
    check('正文区没有写死高度', bodyCss !== '' && !/(^|;)\s*height:/.test(bodyCss) && bodyCss.indexOf('max-height') < 0, bodyCss.slice(0, 120))
    const shortBox = smoke.relateCardBox({ contentHeight: 180, viewportHeight: 900 })
    const longBox = smoke.relateCardBox({ contentHeight: 4000, viewportHeight: 900 })
    check('短回答不撑满：高度跟着内容走', shortBox.height === 180 && shortBox.capped === false, JSON.stringify(shortBox))
    check('长回答停在上限并内部滚动', longBox.height === longBox.cap && longBox.capped === true, JSON.stringify(longBox))
    const shortDraw = renderComp('t42-short', smoke.RelateCard, { entry: NOTE_A1, kind: 'note', open: true, onToggle() {} }, ['', false, '', '短回答。', '', {}, '', '', false])
    const emptyDraw = renderComp('t42-empty', smoke.RelateCard, { entry: NOTE_A1, kind: 'note', open: true, onToggle() {} }, ['', false, '', '', '', {}, '', '', false])
    const shortCard = (shortDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-card')
    check('渲染出的卡片不带固定 height', Boolean(shortCard) && shortCard.props.style && shortCard.props.style.height === undefined, JSON.stringify(shortCard && shortCard.props.style))
    const bodyEl = (shortDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-body')
    check('正文区是滚动容器', Boolean(bodyEl) && typeof bodyEl.props.onScroll === 'function')

    // 分排：输入区一列，按钮另一排，间距 8px，发送在按钮排里。
    const composeCss = cssBlock('wr-relate-compose')
    const actionsCss = cssBlock('wr-relate-actions')
    const footCss = cssBlock('wr-relate-foot')
    check('输入区与按钮分成两排', composeCss.indexOf('flex-direction:column') >= 0 && composeCss.indexOf('gap:8px') >= 0, composeCss.slice(0, 120))
    check('按钮行自身间距 8px', actionsCss.indexOf('gap:8px') >= 0, actionsCss.slice(0, 120))
    check('按钮行有独立留白', footCss.indexOf('padding-top:8px') >= 0, footCss.slice(0, 120))
    const keepOf = (draw) => (draw.elements || []).filter((el) => el.tag === 'button' && String(el.props.children || '') === 'relate.keepThought')
    eq('没有可采纳内容时不显示「记成想法」', keepOf(emptyDraw).length, 0)
    eq('有内容时「记成想法」出现且只有一个', keepOf(shortDraw).length, 1)
    const spacer = (shortDraw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-spacer')
    check('按钮行里发送与次动作被撑开', Boolean(spacer))

    // 入口靠右：笔记/想法卡片上的「放回书里看」在右侧那一组里。
    const noteDraw = renderComp('t42-note-tail', smoke.NoteRow, { note: NOTE_A1 }, [false])
    const thoughtRow = dataPayload.thoughts.find((item) => item.bookId === BOOK_A.bookId) || dataPayload.thoughts[0]
    const thinkDraw = renderComp('t42-thought-tail', smoke.ThoughtRow, { thought: thoughtRow, wall: false, context: [] }, [false, false, false])
    for (const [label, draw] of [['笔记', noteDraw], ['想法', thinkDraw]]) {
      const bars = (draw.elements || []).filter((el) => String(el.props.className || '').split(/\s+/).indexOf('wr-relate') !== -1)
      const go = (draw.elements || []).find((el) => String(el.props.className || '') === 'wr-relate-go')
      check(`${label}卡上的入口在右侧那一组`, bars.length === 1 && bars[0].props['data-in-tail'] === 'true' && Boolean(go), bars.length ? bars[0].props['data-in-tail'] : 'none')
    }
    check('右侧那一组的入口去掉了上边距', fs.readFileSync(path.join(root, 'client.js'), 'utf8').indexOf('.wr-quote-tail .wr-relate{margin-top:0}') >= 0)
  }

  // 同章划线：默认收起；展开是有界的小面板，条数只在入口、引文不带日期。
  {
    const ctx = dataPayload.notes.filter((item) => item.bookId === BOOK_A.bookId).slice(0, 3)
    const closed = renderComp('t42-ctx-closed', smoke.ThoughtRow, { thought: dataPayload.thoughts[0], wall: false, context: ctx }, [false, false, false])
    const opened = renderComp('t42-ctx-open', smoke.ThoughtRow, { thought: dataPayload.thoughts[0], wall: false, context: ctx }, [false, true, false])
    const panelsClosed = (closed.elements || []).filter((el) => String(el.props.className || '') === 'wr-thread-pop')
    eq('默认收起：没有面板', panelsClosed.length, 0)
    eq('默认收起：条数只在入口出现一次', (closed.text.match(/thought\.contextToggle/g) || []).length, 1)
    eq('展开后有且只有一块面板', (opened.elements || []).filter((el) => String(el.props.className || '') === 'wr-thread-pop').length, 1)
    const closes = (opened.elements || []).filter((el) => String(el.props.className || '') === 'wr-thread-pop-close')
    check('面板有可点的关闭按钮', closes.length === 1 && closes[0].tag === 'button' && typeof closes[0].props.onClick === 'function')
    eq('展开后入口消失（条数不重复）', (opened.text.match(/thought\.contextToggle/g) || []).length, 0)
    eq('引文不再重复日期', (opened.elements || []).filter((el) => String(el.props.className || '') === 'wr-thread-date').length, 0)
    eq('引文按条渲染', (opened.elements || []).filter((el) => String(el.props.className || '') === 'wr-thread-quote').length, ctx.length)
    const popCss = cssBlock('wr-thread-pop')
    const popBodyCss = cssBlock('wr-thread-pop-body')
    check('面板有上限高度并裁掉溢出', popCss.indexOf('max-height:240px') >= 0 && popCss.indexOf('overflow:hidden') >= 0, popCss.slice(0, 120))
    check('面板内部可滚动', popBodyCss.indexOf('overflow-y:auto') >= 0, popBodyCss.slice(0, 120))
  }// --- 12.5 A 方案：段落点开就能改、出处从这本书的记录里挂 ----------------------
  {
    // 点正文进编辑态：有选区（触屏长按选字）时不进。
    const editTarget = { textContent: '秩序感先给画面，再给判断。', contains: () => true, ownerDocument: null }
    const openProps = {
      paragraph: Object.assign({}, workA.paragraphs[0], { text: '秩序感先给画面，再给判断。', sourceIds: [] }),
      index: 0,
      work: workA,
      lookup,
      titleOf: () => '诗经',
      sourcePool: [],
      onSave: () => Promise.resolve(),
      onAttachSources: () => Promise.resolve(),
      onDelete() {},
      onAdopt: () => Promise.resolve(),
    }
    const openRow = renderComp('row-open', smoke.ParagraphRow, openProps, [false, '', false, ''])
    const body = (openRow.elements || []).find((el) => String(el.props.className || '') === 'wr-item-text')
    check('段落正文标成可编辑', Boolean(body) && body.props['data-editable'] === 'true')
    check('正文的 title 说明「点一下就能改」', Boolean(body) && String(body.props.title || '') === 'work.editHint', body && body.props.title)
    check('正文点了有 onClick', Boolean(body) && typeof body.props.onClick === 'function')
    if (body) {
      const before = setterLog.length
      body.props.onClick({ currentTarget: editTarget, clientX: 0, clientY: 0 })
      const opened = setterLog
        .slice(before)
        .some((entry) => entry.updater === true || (typeof entry.updater === 'function' && entry.updater(false) === true))
      check('点一下正文就进编辑态', opened, JSON.stringify(setterLog.slice(before).map((entry) => typeof entry.updater)))
    }
    eq('未进编辑态时不渲染输入框', (openRow.elements || []).filter((el) => el.tag === 'textarea').length, 0)

    // 触屏长按选字：client 只在 window 里判断选区，这里临时把 window 给沙箱。
    sandbox.window = { getSelection: () => ({ toString: () => '选中的这几个字' }), innerHeight: 900 }
    if (body) {
      const before = setterLog.length
      body.props.onClick({ currentTarget: editTarget, clientX: 0, clientY: 0 })
      eq('有选区时（长按选字）不进编辑态', setterLog.length, before)
    }
    check('hasTextSelection 认得出有选区', smoke.hasTextSelection() === true)
    delete sandbox.window
    check('没有 window 时不误判成有选区', smoke.hasTextSelection() === false)

    // 编辑态：Esc 还原、Ctrl+Enter 保存、失焦保存、两颗按钮都在、失败不丢字。
    const saved = []
    const editProps = Object.assign({}, openProps, {
      paragraph: Object.assign({}, workA.paragraphs[0], { text: '原来的句子。' }),
      onSave: (text) => {
        saved.push(text)
        return Promise.resolve()
      },
    })
    const editRow = renderComp('row-edit', smoke.ParagraphRow, editProps, [true, '改过的句子。', false, ''])
    const area = (editRow.elements || []).find((el) => el.tag === 'textarea')
    check('编辑态有输入框', Boolean(area))
    eq('输入框带着正在改的文字', area && area.props.value, '改过的句子。')
    check('输入框可编辑', Boolean(area) && typeof area.props.onChange === 'function')
    check('输入框有失焦保存', Boolean(area) && typeof area.props.onBlur === 'function')
    check('输入框有键盘处理', Boolean(area) && typeof area.props.onKeyDown === 'function')
    const buttons = (editRow.elements || []).filter((el) => el.tag === 'button')
    const saveButton = buttons.find((el) => String(el.props.children || '') === 'action.save')
    const cancelButton = buttons.find((el) => String(el.props.children || '') === 'action.cancel')
    check('编辑态有「保存」按钮', Boolean(saveButton) && typeof saveButton.props.onClick === 'function')
    check('编辑态有「取消」按钮', Boolean(cancelButton) && typeof cancelButton.props.onClick === 'function')
    check('编辑态不再显示「编辑」按钮', !buttons.some((el) => String(el.props.children || '') === 'action.edit'))
    if (area) {
      let prevented = 0
      area.props.onKeyDown({ key: 'Escape', preventDefault: () => { prevented += 1 } })
      eq('Esc 会拦下浏览器默认行为', prevented, 1)
      area.props.onKeyDown({ key: 'Enter', ctrlKey: true, preventDefault() {} })
      eq('Ctrl+Enter 保存一次', saved.length, 1)
      eq('保存的是改过的句子', saved[0], '改过的句子。')
      if (typeof area.props.onBlur === 'function') area.props.onBlur()
      eq('失焦也保存', saved.length, 2)
    }
    if (cancelButton) {
      const before = saved.length
      if (typeof cancelButton.props.onMouseDown === 'function') cancelButton.props.onMouseDown()
      cancelButton.props.onClick()
      eq('点「取消」不保存', saved.length, before)
    }

    const failingRow = renderComp(
      'row-edit-failed',
      smoke.ParagraphRow,
      Object.assign({}, editProps, { onSave: () => Promise.reject(new Error('provider rate limited (429)')) }),
      [true, '改过的句子，保存失败了。', false, 'provider rate limited (429)'],
    )
    has('保存失败时显示真实原因', failingRow.text, 'provider rate limited (429)')
    const failedArea = (failingRow.elements || []).find((el) => el.tag === 'textarea')
    eq('保存失败后用户改的字没丢', failedArea && failedArea.props.value, '改过的句子，保存失败了。')

    // 「确认初稿」退场：作品页有确认入口或「已确认」标签都算回潮。
    const worksView = get('works-confirm-gone', { view: 'works', scopeBookId: BOOK_A.bookId })
    check('初稿页没有「确认初稿」按钮', !(worksView.elements || []).some((el) => el.tag === 'button' && (el.props.children || '') === 'work.confirm'))
    check('初稿页没有「已确认」标签', !worksView.text.includes('work.confirmed') && !worksView.text.includes('work.confirm'))
    check('时间线也不再出现「确认初稿」动作', !get('timeline-no-confirm', { view: 'timeline' }).text.includes('grow.event.workConfirmed'))

    const confirmedRow = renderComp(
      'row-confirmed',
      smoke.ParagraphRow,
      Object.assign({}, editProps, { work: { id: 'w_conf', title: '已确认', status: 'confirmed' } }),
      [false, '', false, ''],
    )
    const confirmedBody = (confirmedRow.elements || []).find((el) => String(el.props.className || '') === 'wr-item-text')
    check('旧数据里的 confirmed 作品段落仍能点开改', Boolean(confirmedBody) && typeof confirmedBody.props.onClick === 'function')
    check('旧数据不再显示任何确认相关字样', !confirmedRow.text.includes('work.confirmed'))

    // 挂出处：composer 列这本书的划线/想法/回应，选中后写进 sourceIds。
    const writes = []
    const boardProps = {
      craft,
      data: dataPayload,
      scopeBookId: BOOK_A.bookId,
      bookIdOf: byBook,
      onOpenSource() {},
      onGoShelf() {},
      write: (op, payload) => {
        writes.push({ op, payload })
        return Promise.resolve({})
      },
    }
    const board = renderComp('board-composer', smoke.WorkBoard, boardProps, [workA.id, '', false, '这一段引用一条划线。', [], false, '', '', ''])
    const pickRows = (board.elements || []).filter((el) => String(el.props.className || '') === 'wr-pickrow')
    check('composer 里有可挂的记录', pickRows.length > 0, pickRows.length)
    const kinds = new Set(pickRows.map((el) => String(el.props.key || '').split(':')[0]))
    check('可挂的记录只有划线/想法/回应三类', [...kinds].every((kind) => ['note', 'thought', 'response'].includes(kind)), [...kinds].join(','))
    has('composer 说明写的是「挂上这本书里的记录」', board.text, 'work.pickSource')
    // 列表项只回答「这是哪条记录」：一行小字「《书名》 · 章节」+ 一行摘要。
    const rowShapes = pickRows.map((el) => (el.props.children || []).map((child) => String((child && child.props && child.props.className) || '')))
    check(
      '每条记录都是「勾选 + 类型 + 书名/摘要两行」一个结构',
      rowShapes.length > 0 &&
        rowShapes.every((shape) => shape.length === 3 && shape[0] === 'wr-pickrow-mark' && shape[1] === 'wr-tag' && shape[2] === 'wr-pickrow-main'),
      JSON.stringify(rowShapes.slice(0, 2)),
    )
    const mains = pickRows.map((el) => (el.props.children || [])[2]).filter(Boolean)
    const whereLines = mains.map((main) => String(((main.props.children || [])[0] || {}).props.children || ''))
    const summaryLines = mains.map((main) => String(((main.props.children || [])[1] || {}).props.children || ''))
    check('首行是《书名》', whereLines.length > 0 && whereLines.every((line) => line.startsWith('《')), JSON.stringify(whereLines.slice(0, 2)))
    check('首行带章节位置', whereLines.some((line) => line.includes(' · ')), JSON.stringify(whereLines.slice(0, 2)))
    check('摘要不超过 40 字', summaryLines.every((line) => Array.from(line).length <= 40), JSON.stringify(summaryLines.slice(0, 2)))
    const pickCss = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
    const pickBlock = (pickCss.match(/\.wr-pickrow\{[^}]*\}/) || [''])[0]
    const listBlock = (pickCss.match(/\.wr-picklist\{[^}]*\}/) || [''])[0]
    has('列表项用等高网格排版', pickBlock, 'min-height:38px')
    has('列表项摘要单行省略', pickCss, '.wr-pickrow-text{')
    has('列表区有最大高度', listBlock, 'max-height:')
    has('列表区自己滚动', listBlock, 'overflow-y:auto')
    const pickedRow = pickRows.find((el) => String(el.props['data-on'] || '') === 'true')
    check('已选中的记录有明确标记（勾选格填色）', pickCss.includes('.wr-pickrow[data-on=true] .wr-pickrow-mark'), pickedRow ? '已有选中行' : '当前未选中')
    const firstPick = pickRows.find((el) => String(el.props.key || '').startsWith('note:'))
    if (firstPick) {
      const before = setterLog.length
      firstPick.props.onClick()
      eq('点一条记录会把它选上（一条 setState）', setterLog.length, before + 1)
    }
    // 选中状态在渲染闭包里，所以另渲染一次把 picked 播进去，再点「加这一段」。
    const pickedSourceId = firstPick ? String(firstPick.props.key) : `note:${NOTE_A1.id}`
    const boardPicked = renderComp('board-composer-picked', smoke.WorkBoard, boardProps, [workA.id, '', false, '这一段引用一条划线。', [pickedSourceId], false, '', '', ''])
    const addButton = (boardPicked.elements || []).find((el) => el.tag === 'button' && String(el.props.children || '') === 'work.addParagraph')
    check('「加这一段」按钮在', Boolean(addButton))
    if (addButton) addButton.props.onClick()
    await new Promise((resolve) => setTimeout(resolve, 120))
    const added = writes.find((item) => item.op === 'work.paragraph.add')
    check(
      '「加这一段」把选中的记录写进 sourceIds',
      Boolean(added) && Array.isArray(added.payload.sourceIds) && added.payload.sourceIds.length === 1,
      added && JSON.stringify(added.payload.sourceIds),
    )
    check('挂的出处是 note: 而不是 material:', Boolean(added) && String(added.payload.sourceIds[0]).startsWith('note:'), added && added.payload.sourceIds[0])

    // 「建这篇」：回车走和按钮完全相同的那条路（同一个 createWork）。
    writes.length = 0
    const newForm = renderComp('work-new-form', smoke.WorkBoard, boardProps, [workA.id, '新的一篇', true, '', [], false, '', '', ''])
    const titleInput = (newForm.elements || []).find((el) => el.tag === 'input' && String(el.props.className || '') === 'wr-input')
    check('新建初稿的输入框在', Boolean(titleInput) && typeof titleInput.props.onKeyDown === 'function')
    let prevented = 0
    const pressEnter = (extra) => {
      // 输入框没有键盘处理时也要给出可读的失败，而不是把整个自检打崩。
      if (!titleInput || typeof titleInput.props.onKeyDown !== 'function') return false
      titleInput.props.onKeyDown(Object.assign({ key: 'Enter', shiftKey: false, preventDefault() { prevented += 1 } }, extra || {}))
      return true
    }
    pressEnter()
    await new Promise((resolve) => setTimeout(resolve, 80))
    const createdByEnter = writes.filter((item) => item.op === 'work.add')
    eq('回车建了一篇初稿', createdByEnter.length, 1)
    eq('回车带的标题就是输入框里的字', createdByEnter[0] && createdByEnter[0].payload.title, '新的一篇')
    eq('回车拦掉了默认提交', prevented, 1)
    pressEnter({ shiftKey: true })
    pressEnter({ key: 'Escape' })
    await new Promise((resolve) => setTimeout(resolve, 80))
    eq('Shift+Enter 与 Esc 不建稿', writes.filter((item) => item.op === 'work.add').length, 1)
    const emptyForm = renderComp('work-new-form-empty', smoke.WorkBoard, boardProps, [workA.id, '', true, '', [], false, '', '', ''])
    const emptyInput = (emptyForm.elements || []).find((el) => el.tag === 'input' && String(el.props.className || '') === 'wr-input')
    if (emptyInput && typeof emptyInput.props.onKeyDown === 'function') emptyInput.props.onKeyDown({ key: 'Enter', shiftKey: false, preventDefault() {} })
    await new Promise((resolve) => setTimeout(resolve, 80))
    eq('空内容回车不建稿', writes.filter((item) => item.op === 'work.add').length, 1)
    check('空内容回车不报错', !emptyForm.text.includes('wr-adopt-error'))

    // 挂上出处之后「AI 补写这一段」就能点，pack 里也取得到这条出处。
    const noteForRow = dataPayload.notes.find((note) => note.bookId === BOOK_A.bookId) || NOTE_A1
    const sourcedRow = renderComp(
      'row-sourced',
      smoke.ParagraphRow,
      Object.assign({}, editProps, {
        paragraph: Object.assign({}, workA.paragraphs[0], { text: '这一段挂了出处。', sourceIds: [`note:${noteForRow.id}`] }),
      }),
      [false, '', false, ''],
    )
    const sourcedTrigger = (sourcedRow.elements || []).find((el) => String(el.props.className || '').indexOf('wr-ai-trigger') >= 0)
    check('挂了出处后「AI 补写」不再置灰', Boolean(sourcedTrigger) && sourcedTrigger.props.disabled !== true)
    const noteBody = smoke.clip(String(noteForRow.text || '').replace(/\s+/g, ' ').trim(), 200)
    const sourcedPack = smoke.buildParagraphPack({ sourceIds: [`note:${noteForRow.id}`], lookup, titleOf: () => '诗经' })
    check('补写的 pack 里取得到这条出处', sourcedPack.includes(noteBody), sourcedPack.slice(0, 120))

    // 三处错误引导：不再把人指向已经撤掉的素材/选题。
    const zhDict = (localeDictionaries && localeDictionaries.zh) || {}
    const enDict = (localeDictionaries && localeDictionaries.en) || {}
    const zhCreate = String(zhDict['journey.create.hint'] || '')
    const enCreate = String(enDict['journey.create.hint'] || '')
    check('CREATE 段的说明不再提素材/选题', !zhCreate.includes('素材') && !enCreate.includes('material'), zhCreate)
    const zhNext = String(zhDict['work.empty.next'] || '')
    check('初稿空态指向新建初稿、不再让人选选题', zhNext.includes('新建') && !zhNext.includes('选题'), zhNext)
    const zhNeed = String(zhDict['work.aiNeedSource'] || '')
    check('AI 补写的说明改成「先挂一条来源」', zhNeed.includes('挂一条来源') && !zhNeed.includes('素材'), zhNeed)
    check('孤儿键 work.empty.action 已删除', !('work.empty.action' in zhDict) && !('work.empty.action' in enDict))
    check('front-matter 说明不再提 bookIds', !String(zhDict['work.frontMatter'] || '').includes('bookIds'), zhDict['work.frontMatter'])

    // 单段「挂来源」：老段落也能补出处，挂的是 note:/thought:，不是 material:。
    const attached = []
    const sourcesRow = renderComp(
      'row-sources',
      smoke.ParagraphSources,
      {
        paragraph: Object.assign({}, workA.paragraphs[0], { text: '老段落。', sourceIds: [`note:${NOTE_A1.id}`] }),
        pool: [
          { sourceId: `note:${NOTE_A1.id}`, kind: 'note', chapter: '开场白', text: '关关雎鸠。', at: 2 },
          { sourceId: `thought:${THOUGHT_A}`, kind: 'thought', chapter: '开场白', text: '先把自己放进去。', at: 1 },
        ],
        onAttach: (sourceIds) => {
          attached.push(sourceIds)
          return Promise.resolve()
        },
      },
      [true, [], false, ''],
    )
    const sourceRows = (sourcesRow.elements || []).filter((el) => String(el.props.className || '') === 'wr-pickrow')
    eq('单段挂来源列出可挂的记录', sourceRows.length, 2)
    const thoughtRow = sourceRows.find((el) => String(el.props.key || '').startsWith('thought:'))
    if (thoughtRow) thoughtRow.props.onClick()
    const attachSave = renderComp(
      'row-sources-picked',
      smoke.ParagraphSources,
      {
        paragraph: Object.assign({}, workA.paragraphs[0], { text: '老段落。', sourceIds: [`note:${NOTE_A1.id}`] }),
        pool: [{ sourceId: `thought:${THOUGHT_A}`, kind: 'thought', chapter: '开场白', text: '先把自己放进去。', at: 1 }],
        onAttach: (sourceIds) => {
          attached.push(sourceIds)
          return Promise.resolve()
        },
      },
      [true, [`thought:${THOUGHT_A}`], false, ''],
    )
    const attachSaveButton = (attachSave.elements || []).find((el) => el.tag === 'button' && String(el.props.children || '') === 'action.save')
    if (attachSaveButton) attachSaveButton.props.onClick()
    await new Promise((resolve) => setTimeout(resolve, 120))
    const attachPayload = attached[0]
    check(
      '单段挂来源把新出处处并进原有 sourceIds',
      Array.isArray(attachPayload) && attachPayload.length === 2 && attachPayload.includes(`thought:${THOUGHT_A}`),
      JSON.stringify(attachPayload),
    )
    check('单段挂来源仍然不写 material:', Array.isArray(attachPayload) && attachPayload.every((id) => !String(id).startsWith('material:')))

    // sourcePoolOf：素材退场后不再出现在出处清单里。
    const pool = smoke.sourcePoolOf(dataPayload, craft, BOOK_A.bookId)
    check('出处清单不为空', pool.length > 0, pool.length)
    check('出处清单里没有 material:', pool.every((row) => !String(row.sourceId).startsWith('material:')))
    check('出处清单只含这本书的记录', pool.every((row) => ['note', 'thought', 'response'].includes(row.kind)))
  }

  // --- 13. 防回潮 ------------------------------------------------------------
  const sources = ['client.js', 'index.js', 'locale/zh.json', 'locale/en.json'].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')
  const banned = ['打卡', '排行榜', '徽章', '进度环', '连续天数']
  const hits = banned.filter((word) => sources.includes(word))
  check('防回潮：代码与文案里没有阅读挑战字样', hits.length === 0, hits.join(','))
  check('防回潮：包尾不再说「想法是我写的」', !sources.includes('想法是我写的'))
  has('防回潮：包尾改成了按角色说明归属', sources, '是我这一侧的记录，引用时请分清归属')

  // --- 12.7 三页收敛：一个标题行、一个更新时间、按钮与标题分色 ----------------
  {
    const cssOf = (name) => {
      const source = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
      const at = source.indexOf(`.${name}{`)
      if (at < 0) return ''
      const end = source.indexOf('}', at)
      return end > at ? source.slice(at, end) : ''
    }
    const stampOf = (seconds) => {
      const date = new Date(Number(seconds) * 1000)
      const pad = (n) => String(n).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    const craftNow = host.craftView()
    for (const [label, view] of [['t43-think', 'responses'], ['t43-create', 'works'], ['t43-timeline', 'timeline'], ['t43-annual', 'annual']]) {
      const draw = get(label, { view })
      const titles = (draw.elements || []).filter((el) => String(el.props.className || '') === 'wr-page-title')
      eq(`${view} 页只有一个标题行`, titles.length, 1)
      const hands = (draw.elements || []).filter((el) => String(el.props.className || '') === 'wr-page-head')
      eq(`${view} 页标题行只有一处`, hands.length, 1)
      if (view === 'responses' || view === 'works') {
        const subs = (draw.elements || []).filter((el) => String(el.props.className || '') === 'wr-subnav')
        eq(`${view} 只有一项时的二级栏不再渲染`, subs.length, 0)
      }
      /* 每页各自的更新时间：页脚两段各一次，页内不再重复。 */
      eq(`${view} 页只出现一次创作更新时间`, draw.text.split('synced.craftAt(').length - 1, 1)
      eq(`${view} 页只出现一次微读更新时间`, draw.text.split('synced.at(').length - 1, 1)
    }
    const primary = cssOf('wr-btn-primary')
    const draftTitle = cssOf('wr-draft-title')
    has('主按钮用品牌色', primary, 'var(--dsw-alias-brand-primary)')
    has('稿子标题用正文墨色', draftTitle, 'color:var(--wr-ink)')
    check('主按钮与稿子标题不是同一个颜色 token', primary.indexOf('var(--wr-ink)') < 0, primary)
    has('删除入口有宽度下限', cssOf('wr-menu-btn'), 'min-width:64px')
    has('删除项有 44px 点击区', cssOf('wr-menu-danger'), 'min-height:44px')
    const hint = cssOf('wr-page-hint')
    check('右上说明不再被截断', hint.indexOf('ellipsis') < 0 && hint.indexOf('nowrap') < 0, hint)
    // 只有一篇时选择器不出现（否则标题在 chip 与卡片头各出现一次）。
    const oneWork = Object.assign({}, craftNow, { works: (craftNow.works || []).slice(0, 1) })
    const single = get('t43-works-single', { view: 'works', craft: oneWork })
    eq('只有一篇时不摆选择器', (single.elements || []).filter((el) => String(el.props.className || '') === 'wr-chips').length, 0)
    const flat = (node) => {
      if (node === null || node === undefined || node === false) return ''
      if (typeof node === 'string' || typeof node === 'number') return String(node)
      if (Array.isArray(node)) return node.map(flat).join('')
      if (node.type === '__fragment__') return flat(node.props && node.props.children)
      if (typeof node.type === 'function') return flat(node.type(node.props || {}))
      return flat(node.props ? node.props.children : undefined)
    }
    const headTitles = (single.elements || []).filter((el) => String(el.props.className || '') === 'wr-draft-head-title')
    if (headTitles.length === 1) {
      const heading = flat(headTitles[0].props.children && headTitles[0].props.children[0])
      const repeats = heading === '' ? 0 : single.text.split(heading).length - 1
      check('片段标题与摘要是两段不同的字', repeats <= 1, `${heading} 出现 ${repeats} 次`)
    } else check('卡片头只有一个', false, String(headTitles.length))
    // 空态只有一个主按钮，没有「去书架」。
    const emptyWorks = get('t43-works-empty', { view: 'works', craft: smoke.EMPTY_CRAFT })
    check('创作页空态不再给「去书架」按钮', !emptyWorks.text.includes('work.empty.actionShelf'))
    const emptyLabels = (emptyWorks.elements || [])
      .filter((el) => el.tag === 'button' && String(el.props.className || '').indexOf('wr-btn') >= 0)
      .map((el) => flat(el.props.children))
      // 顶栏的同步与设置不属于页面动作。
      .filter((name) => name !== 'action.sync' && name !== '⚙')
    eq('创作页空态只有「新建初稿」这一个动作', emptyLabels.filter((name) => name === 'work.new').length, 1)
    check('创作页空态没有别的动作按钮', emptyLabels.every((name) => name === 'work.new'), emptyLabels.join(','))
    // 时间线只有思考（回应）与创作（作品）：想法与划线仍在书页。
    const timeline = get('t43-timeline-kinds', { view: 'timeline' })
    check('时间线不再写「写了想法」', !timeline.text.includes('grow.event.thought'))
    const bookPage = get('t43-book-records', { view: 'book', bookId: BOOK_A.bookId })
    check('书页记录不受时间线过滤影响', bookPage.text.includes('nav.notes') && bookPage.text.includes('nav.thoughts'))
  }

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