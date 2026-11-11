// 1.2.1 放行门槛 · 宿主级端到端自检
//
// 目的：在没有浏览器、没有真实微信读书 key、没有真实模型的环境里，把
// 「书页 → 摘录 → 对话 → 回应 → 素材 → 选题 → 初稿 → 导出 → 刷新 → 备份/清空」
// 这条链路在真实 index.js 上真跑一遍，并检查认证闸门、跨书隔离、降级路径。
//
// 用法（仓库根目录一条命令）：
//   node scripts/e2e-1.2.1.cjs
//
// 安全：只用 mkdtemp 出来的临时 DSH_HOME，不读写 ~/.dsh/weread-gather；
// 结束后删除临时目录（KEEP=1 可保留以便排查）。

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const { pathToFileURL } = require('node:url')

const root = path.join(__dirname, '..')
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-e2e121-'))
const dir = path.join(home, 'weread-gather')
fs.mkdirSync(dir, { recursive: true })

const BOOK_A = { bookId: '3300043210', title: '诗经', author: '佚名', category: '文学', noteCount: 1, reviewCount: 1, readUpdateTime: 1762000000 }
const BOOK_B = { bookId: '900001', title: '另一本书', author: '某作者', category: '社会', noteCount: 1, reviewCount: 1, readUpdateTime: 1762000001 }
const NOTE_A = { id: 'nt_a1', bookId: BOOK_A.bookId, bookTitle: BOOK_A.title, author: BOOK_A.author, chapterTitle: '周南·关雎', text: '关关雎鸠，在河之洲。窈窕淑女，君子好逑。', createTime: 1762000100, star: 1 }
const NOTE_B = { id: 'nt_b1', bookId: BOOK_B.bookId, bookTitle: BOOK_B.title, author: BOOK_B.author, chapterTitle: '第一章', text: '这一段只属于第二本书。', createTime: 1762000101, star: 0 }
const THOUGHT_A = { id: 'th_a1', bookId: BOOK_A.bookId, bookTitle: BOOK_A.title, author: BOOK_A.author, chapterName: '周南·关雎', content: '读起来像在讲一种自然的秩序。', createTime: 1762000200, star: -1 }
const THOUGHT_B = { id: 'th_b1', bookId: BOOK_B.bookId, bookTitle: BOOK_B.title, author: BOOK_B.author, chapterName: '第一章', content: '第二本书的想法。', createTime: 1762000201, star: -1 }

const dataset = {
  updatedAt: 1762000300,
  shelfTotal: 2,
  books: [BOOK_A, BOOK_B],
  notes: [NOTE_A, NOTE_B],
  thoughts: [THOUGHT_A, THOUGHT_B],
  archives: [],
  dashboard: { totalBooks: 2, totalNotes: 2, totalThoughts: 2, readDays: 1 },
  warnings: [],
}
const SECRET = 'wrk-verify-secret-1234'
fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify(dataset, null, 2), 'utf8')
fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ apiKey: SECRET }, null, 2), 'utf8')
const dataBefore = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'data.json'))).digest('hex')

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

// --- 假宿主服务 --------------------------------------------------------------
// connection.requestRejection 由请求头决定，这样同一台服务器能演三种来访者：
// 没有票据（401）、来源不可信（403）、正常浏览器（放行）。
function connectionFor(mode) {
  return {
    requestRejection({ headers }) {
      const ticket = String((headers && headers['x-wr-test']) || '')
      if (ticket === 'unauth') return 401
      if (ticket === 'untrusted') return 403
      return undefined
    },
    mode,
  }
}
const llmState = { mode: 'ok', calls: [] }
const llm = {
  async listProviders() {
    if (llmState.mode === 'none') return []
    return [{ id: 'fake', name: 'Fake 出品' }]
  },
  async listModels() {
    return [{ id: 'fake-1', name: 'Fake One' }]
  },
  stream(args) {
    llmState.calls.push(args)
    if (llmState.mode === 'rate') throw new Error('429 Too Many Requests')
    async function* frames() {
      yield { type: 'text-delta', text: '先看原文，' }
      await new Promise((resolve) => setTimeout(resolve, 20))
      yield { type: 'text-delta', text: '再谈自己的感受。' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
    return frames()
  },
}

async function main() {
  process.env.DSH_HOME = home
  const mod = await import(pathToFileURL(path.join(root, 'index.js')).href)
  const I = mod.__internals
  const ROUTE_PREFIX = mod.ROUTE_PREFIX
  check('index.js 导出 ROUTE_PREFIX', typeof ROUTE_PREFIX === 'string' && ROUTE_PREFIX.length > 0, ROUTE_PREFIX)

  const host = I.createHost({})
  const ctx = {
    get(name) {
      if (name === 'connection') return connectionFor('browser')
      if (name === 'llm') return llm
      return null
    },
  }
  const ctxBroken = {
    get(name) {
      // 宿主的 connection 服务缺失：一切都必须挡在门外。
      if (name === 'llm') return llm
      return null
    },
  }
  const routes = I.makeRoutes(host, ctx)
  const routesBroken = I.makeRoutes(host, ctxBroken)
  const handler = routes[0].handler
  const handlerBroken = routesBroken[0].handler

  // 一台服务器，两个入口：默认走正常 ctx，带 x-wr-ctx: none 的走缺服务版本。
  const server = http.createServer((req, res) => {
    const which = String(req.headers['x-wr-ctx'] || '')
    const target = which === 'none' ? handlerBroken : handler
    if (!String(req.url || '').startsWith(ROUTE_PREFIX)) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'not found' }))
      return
    }
    target(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  process.on('exit', () => {
    try {
      server.close()
    } catch {}
  })

  function call(method, route, { body, headers, onStart } = {}) {
    return new Promise((resolve, reject) => {
      const text = body === undefined ? '' : JSON.stringify(body)
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          method,
          path: `${ROUTE_PREFIX}${route}`,
          headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
        },
        (res) => {
          let chunks = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            chunks += chunk
            if (typeof onStart === 'function') onStart({ req, res, chunks })
          })
          res.on('end', () => {
            let json = null
            try {
              json = JSON.parse(chunks)
            } catch {}
            resolve({ status: res.statusCode, headers: res.headers, text: chunks, json })
          })
        },
      )
      req.on('error', (error) => {
        if (error && error.code === 'ECONNRESET') resolve({ status: 0, headers: {}, text: '', json: null })
        else reject(error)
      })
      if (text !== '') req.write(text)
      req.end()
    })
  }

  const post = (route, body, extra) => call('POST', route, Object.assign({ body }, extra || {}))
  const get = (route, extra) => call('GET', route, extra || {})

  function frames(text) {
    return String(text)
      .split('\n\n')
      .map((part) => part.trim())
      .filter((part) => part.startsWith('data: '))
      .map((part) => {
        try {
          return JSON.parse(part.slice(6))
        } catch {
          return null
        }
      })
      .filter(Boolean)
  }

  // --- 1. 认证闸门 -----------------------------------------------------------
  const guarded = [
    ['GET', '/state'],
    ['GET', '/data'],
    ['GET', '/craft'],
    ['POST', '/craft'],
    ['POST', '/craft/export'],
    ['POST', '/reset/data'],
    ['POST', '/chat'],
    ['GET', '/backup'],
    ['POST', '/restore'],
  ]
  for (const [method, route] of guarded) {
    const res = await call(method, route, { headers: { 'x-wr-test': 'unauth' }, body: method === 'POST' ? {} : undefined })
    check(`未认证 ${method} ${route} → 401`, res.status === 401, res.status)
    has(`未认证 ${method} ${route} 文案`, res.json && res.json.error, '未通过 DSH 认证')
  }
  const untrusted = await get('/state', { headers: { 'x-wr-test': 'untrusted' } })
  check('来源不可信 → 403', untrusted.status === 403, untrusted.status)
  has('来源不可信文案', untrusted.json && untrusted.json.error, '请求来源不被信任')
  const noService = await get('/state', { headers: { 'x-wr-ctx': 'none' } })
  check('缺少 connection 服务 → 401', noService.status === 401, noService.status)
  const outside = await new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port, path: '/dsh-weread/other' }, (res) => {
      res.resume()
      resolve(res.statusCode)
    })
  })
  eq('前缀之外的路由不归书房管 → 404', outside, 404)

  // --- 2. 冷启动：有数据但还没有 craft.json ---------------------------------
  const state0 = await get('/state')
  check('/state 200', state0.status === 200, state0.status)
  check('/state configured', state0.json && state0.json.configured === true, state0.json && state0.json.configured)
  check('/state 不含明文 apiKey', !JSON.stringify(state0.json || {}).includes(SECRET), 'raw key leaked')
  const craft0 = await get('/craft')
  check('冷启动 hasCraft=false', craft0.json && craft0.json.hasCraft === false, craft0.json && craft0.json.hasCraft)
  eq('冷启动 revision=0', craft0.json && craft0.json.revision, 0)
  eq('冷启动 schemaVersion 等于宿主常量', craft0.json && craft0.json.schemaVersion, I.CRAFT_SCHEMA_VERSION)
  check('冷启动有 craft 版本常量', typeof I.CRAFT_SCHEMA_VERSION === 'number' && I.CRAFT_SCHEMA_VERSION >= 2, I.CRAFT_SCHEMA_VERSION)
  check('冷启动素材/选题/作品都为空', craft0.json && [craft0.json.materials, craft0.json.topics, craft0.json.works].every((list) => Array.isArray(list) && list.length === 0))
  check('冷启动关系/线索都为空', craft0.json && [craft0.json.relations, craft0.json.threads].every((list) => Array.isArray(list) && list.length === 0), craft0.json && JSON.stringify({ relations: craft0.json.relations, threads: craft0.json.threads }))
  const data0 = await get('/data')
  check('/data 有数据', data0.json && data0.json.hasData === true)
  eq('/data 书目数', data0.json && data0.json.books && data0.json.books.length, 2)
  eq('/data 摘录数', data0.json && data0.json.notes && data0.json.notes.length, 2)

  // --- 3. 对话（模型可用） ---------------------------------------------------
  const models = await get('/chat/models')
  check('/chat/models available', models.json && models.json.available === true, JSON.stringify(models.json && models.json.providers))
  eq('/chat/models 当前模型', models.json && models.json.current && models.json.current.model, 'fake-1')
  llmState.mode = 'ok'
  const chat = await post('/chat', { pack: '【书房来源包】《诗经》 关关雎鸠', question: '这句话在说什么？' })
  eq('/chat 200', chat.status, 200)
  has('SSE content-type', chat.headers['content-type'], 'text/event-stream')
  const chatFrames = frames(chat.text)
  const open = chatFrames.find((item) => item.type === 'open')
  check('/chat 首帧 open 带 provider/model', open && open.provider === 'fake' && open.model === 'fake-1', JSON.stringify(open))
  const said = chatFrames.filter((item) => item.type === 'text').map((item) => item.text).join('')
  has('/chat 文本流式返回', said, '先看原文')
  has('/chat 第二帧也到了', said, '再谈自己的感受')
  check('/chat 最后一帧 done', chatFrames[chatFrames.length - 1] && chatFrames[chatFrames.length - 1].type === 'done', JSON.stringify(chatFrames[chatFrames.length - 1]))
  const seen = llmState.calls[llmState.calls.length - 1]
  check('/chat 只发一条 user 消息', seen && seen.messages && seen.messages.length === 1)
  has('/chat 提示词折进来源包', seen && seen.messages[0].content[0].text, '【书房来源包】')
  has('/chat 提示词折进问题', seen && seen.messages[0].content[0].text, '这句话在说什么？')
  has('/chat 系统提示来自宿主', seen && seen.system, '书房')
  eq('/chat maxTokens=1200', seen && seen.maxTokens, 1200)

  // --- 4. 429：明确报错、不写坏数据 -----------------------------------------
  const revisionBeforeRate = (await get('/craft')).json.revision
  llmState.mode = 'rate'
  const rate = await post('/chat', { pack: 'pack', question: '再来一次' })
  const rateFrames = frames(rate.text)
  const rateError = rateFrames.find((item) => item.type === 'error')
  check('429 有 error 帧', Boolean(rateError), JSON.stringify(rateFrames))
  has('429 文案带状态码', rateError && rateError.error, '429')
  check('429 后仍以 done 收尾', rateFrames[rateFrames.length - 1] && rateFrames[rateFrames.length - 1].type === 'done')
  eq('429 不改动 craft 版本', (await get('/craft')).json.revision, revisionBeforeRate)
  llmState.mode = 'ok'

  // --- 5. 取消：客户端断开后服务端仍然健康 -----------------------------------
  await new Promise((resolve) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: 'POST', path: `${ROUTE_PREFIX}/chat`, headers: { 'content-type': 'application/json' } },
      (res) => {
        let seenFirst = false
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          if (!seenFirst) {
            seenFirst = true
            req.destroy()
            setTimeout(resolve, 120)
          }
        })
      },
    )
    req.on('error', () => {})
    req.write(JSON.stringify({ pack: 'pack', question: '半路取消' }))
    req.end()
  })
  const afterAbort = await get('/state')
  eq('取消后服务端仍可响应', afterAbort.status, 200)
  eq('取消不改动 craft 版本', (await get('/craft')).json.revision, revisionBeforeRate)

  // --- 6. A 书：摘录 → 回应 → 素材 → 选题 → 初稿 → 确认（revision 递增） -----
  let revision = 0
  const responseA = await post('/craft', { op: 'response.add', payload: { text: '这句话好在不解释，先给你看画面。', sourceIds: [`note:${NOTE_A.id}`] }, revision })
  eq('response.add 200', responseA.status, 200)
  eq('response.add revision 1', responseA.json && responseA.json.revision, 1)
  const responseAId = responseA.json && responseA.json.created && responseA.json.created.response && responseA.json.created.response.id
  check('response.add 生成 r_ 前缀 id', typeof responseAId === 'string' && responseAId.startsWith('r_'), responseAId)
  revision = responseA.json.revision

  const materialA = await post('/craft', {
    op: 'material.add',
    payload: { type: '观点', text: '秩序感是先给画面再给判断。', sourceIds: [`note:${NOTE_A.id}`, `response:${responseAId}`] },
    revision,
  })
  eq('material.add 200', materialA.status, 200)
  eq('material.add revision 2', materialA.json && materialA.json.revision, 2)
  const materialAItem = materialA.json && materialA.json.created && materialA.json.created.material
  const materialAId = materialAItem && materialAItem.id
  check('素材带 bookId', materialAItem && materialAItem.bookId === BOOK_A.bookId, materialAItem && materialAItem.bookId)
  eq('素材来源链完整', JSON.stringify(materialAItem && materialAItem.sourceIds), JSON.stringify([`note:${NOTE_A.id}`, `response:${responseAId}`]))
  eq('素材校验状态 ok', materialAItem && materialAItem.verification && materialAItem.verification.status, 'ok')
  check('素材快照可见', materialAItem && materialAItem.verification && String(materialAItem.verification.snapshot || '').length > 0)
  revision = materialA.json.revision

  const topicA = await post('/craft', { op: 'topic.add', payload: { statement: '《关雎》里的秩序感', materialIds: [materialAId], gapNote: '还缺一个反例。' }, revision })
  eq('topic.add 200', topicA.status, 200)
  const topicAItem = topicA.json && topicA.json.created && topicA.json.created.topic
  eq('选题从素材推出书', JSON.stringify(topicAItem && topicAItem.bookIds), JSON.stringify([BOOK_A.bookId]))
  revision = topicA.json.revision

  const workA = await post('/craft', { op: 'work.add', payload: { title: '关雎里的秩序感' }, revision })
  eq('work.add 200', workA.status, 200)
  const workAItem = workA.json && workA.json.created && workA.json.created.work
  const workAId = workAItem && workAItem.id
  check('初稿 exportId 形态', workAItem && /^craft:work\/w_/.test(String(workAItem.exportId)), workAItem && workAItem.exportId)
  eq('初稿初始 status', workAItem && workAItem.status, 'draft')
  revision = workA.json.revision

  const paraA = await post('/craft', {
    op: 'work.paragraph.add',
    payload: { id: workAId, text: '先是鸟鸣，再是人的心思。', sourceIds: [`material:${materialAId}`], ai: true, aiOriginIds: [responseAId] },
    revision,
  })
  eq('work.paragraph.add 200', paraA.status, 200)
  const paraAItem = paraA.json && paraA.json.created && paraA.json.created.paragraph
  const paraAId = paraAItem && paraAItem.id
  eq('段落来源指向素材', JSON.stringify(paraAItem && paraAItem.sourceIds), JSON.stringify([`material:${materialAId}`]))
  revision = paraA.json.revision

  const editA = await post('/craft', { op: 'work.paragraph.update', payload: { id: workAId, paragraphId: paraAId, text: '先是鸟鸣，再是人的心思（手改）。' }, revision })
  eq('手改段落 200', editA.status, 200)
  const editedPara = editA.json && editA.json.craft && editA.json.craft.works[0] && editA.json.craft.works[0].paragraphs[0]
  has('手改后的正文', editedPara && editedPara.text, '（手改）')
  eq('手改不清来源链', JSON.stringify(editedPara && editedPara.sourceIds), JSON.stringify([`material:${materialAId}`]))
  eq('手改仍保留 AI 标记', editedPara && editedPara.ai, true)
  check('手改写入 editedAt', editedPara && Number(editedPara.editedAt) > 0, editedPara && editedPara.editedAt)
  revision = editA.json.revision

  const confirmA = await post('/craft', { op: 'work.confirm', payload: { id: workAId }, revision })
  eq('work.confirm 200', confirmA.status, 200)
  const confirmed = confirmA.json && confirmA.json.craft && confirmA.json.craft.works[0]
  eq('确认后 status=confirmed', confirmed && confirmed.status, 'confirmed')
  revision = confirmA.json.revision

  // --- 7. 拒绝路径：孤儿、跨书、空稿、旧版本、未知操作 -----------------------
  const noSource = await post('/craft', { op: 'material.add', payload: { type: '金句', text: '没有来源的素材' }, revision })
  eq('无来源素材 → 400', noSource.status, 400)
  has('无来源素材文案', noSource.json && noSource.json.error, '至少要有一个来源')
  const orphan = await post('/craft', { op: 'material.add', payload: { type: '金句', text: '孤儿来源', sourceIds: ['note:not-exist'] }, revision })
  eq('孤儿来源 → 400', orphan.status, 400)
  has('孤儿来源文案', orphan.json && orphan.json.error, '已经找不到了')
  const cross = await post('/craft', { op: 'material.add', payload: { type: '金句', text: '跨书声明', sourceIds: [`note:${NOTE_A.id}`], bookId: BOOK_B.bookId }, revision })
  eq('声明书与来源不一致 → 400', cross.status, 400)
  has('跨书文案', cross.json && cross.json.error, '不属于同一本书')
  const badTopic = await post('/craft', { op: 'topic.add', payload: { statement: '', materialIds: [materialAId] }, revision })
  eq('空选题 → 400', badTopic.status, 400)
  const emptyWork = await post('/craft', { op: 'work.add', payload: { title: '空稿' }, revision })
  const emptyWorkId = emptyWork.json && emptyWork.json.created && emptyWork.json.created.work && emptyWork.json.created.work.id
  const confirmEmpty = await post('/craft', { op: 'work.confirm', payload: { id: emptyWorkId }, revision: emptyWork.json.revision })
  eq('空稿不能确认 → 400', confirmEmpty.status, 400)
  revision = emptyWork.json.revision
  const stale = await post('/craft', { op: 'response.add', payload: { text: '旧窗口写回', sourceIds: [`note:${NOTE_A.id}`] }, revision: revision - 1 })
  eq('旧 revision → 409', stale.status, 409)
  eq('409 带回最新版本', stale.json && stale.json.revision, revision)
  const unknownOp = await post('/craft', { op: 'craft.magic', payload: {}, revision })
  eq('未知 op → 400', unknownOp.status, 400)

  // --- 8. 导出：来源可读、containsAI 真实、exportId/contentHash 稳定 ----------
  const preview1 = await post('/craft/export', { kind: 'work', id: workAId, mode: 'preview' })
  eq('导出预览 200', preview1.status, 200)
  const doc1 = preview1.json && preview1.json.document
  check('导出带 front-matter', doc1 && String(doc1.markdown).startsWith('---'))
  has('front-matter 有 workId 字段', doc1 && doc1.markdown, 'workId:')
  has('front-matter 的 workId 是本作品', doc1 && doc1.markdown, workAId)
  has('front-matter 有 exportId 字段', doc1 && doc1.markdown, 'exportId:')
  has('front-matter 的 exportId 稳定形态', doc1 && doc1.markdown, `craft:work/${workAId}`)
  has('front-matter containsAI 与段落一致', doc1 && doc1.markdown, 'containsAI: true')
  has('front-matter 书名取自来源书', doc1 && doc1.markdown, BOOK_A.title)
  has('导出正文标出处', doc1 && doc1.markdown, `> 来源：[material:${materialAId}]`)
  has('导出出处带书名', doc1 && doc1.markdown, `《${BOOK_A.title}》`)
  has('导出文件名按作品名', doc1 && doc1.filename, '关雎里的秩序感 - 初稿.md')
  const preview2 = await post('/craft/export', { kind: 'work', id: workAId, mode: 'preview' })
  eq('两次导出 exportId 相同', preview2.json.document.exportId, doc1.exportId)
  eq('两次导出 contentHash 相同', preview2.json.document.contentHash, doc1.contentHash)
  const file1 = await post('/craft/export', { kind: 'work', id: workAId, mode: 'file' })
  check('导出落盘 200', file1.status === 200 && file1.json && file1.json.saved === true, file1.status)
  const file1Path = file1.json && file1.json.path
  check('落盘文件存在', Boolean(file1Path) && fs.existsSync(file1Path), file1Path)
  const file2 = await post('/craft/export', { kind: 'work', id: workAId, mode: 'file' })
  eq('二次导出覆盖同一文件', file2.json && file2.json.path, file1Path)
  check('没有产生 -2 副本', !fs.existsSync(String(file1Path).replace(/\.md$/, '-2.md')))
  const badKind = await post('/craft/export', { kind: 'book', id: workAId })
  eq('只支持导出初稿 → 400', badKind.status, 400)

  // --- 9. 刷新：新 host 读同一份磁盘 = 刷新后仍在 ----------------------------
  const host2 = I.createHost({})
  const afterReload = host2.craftView()
  check('刷新后作品仍在', afterReload.works.some((item) => item.id === workAId), JSON.stringify(afterReload.works.map((item) => item.id)))
  eq('刷新后素材仍在', afterReload.materials.length, 1)
  eq('刷新后 revision 不回退', afterReload.revision, revision)
  const dataAfter = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, 'data.json'))).digest('hex')
  eq('原始四件套未被写入', dataAfter, dataBefore)
  const craftRaw = JSON.parse(fs.readFileSync(path.join(dir, 'craft.json'), 'utf8'))
  // 数据形状随 schema 演进：只钉「必需键都在」，多出来的键不算失败。
  const requiredCraftKeys = ['schemaVersion', 'updatedAt', 'revision', 'responses', 'materials', 'topics', 'works', 'relations', 'threads']
  const missingCraftKeys = requiredCraftKeys.filter((key) => !Object.prototype.hasOwnProperty.call(craftRaw, key))
  check('craft.json 含全部必需键（允许多余键）', missingCraftKeys.length === 0, `missing=${missingCraftKeys.join(',') || 'none'}`)
  eq('craft.json 版本与宿主常量一致', craftRaw.schemaVersion, I.CRAFT_SCHEMA_VERSION)
  const indexA = afterReload.bookIndex.find((item) => item.bookId === BOOK_A.bookId)
  eq('书页链路计数（回应）', indexA && indexA.counts.responses, 1)
  eq('书页链路计数（素材）', indexA && indexA.counts.materials, 1)
  eq('书页链路计数（选题）', indexA && indexA.counts.topics, 1)
  eq('书页链路计数（作品）', indexA && indexA.counts.works, 1)
  eq('书页缓存标记', indexA && indexA.cached, true)

  // --- 10. B 书：同样的动作只落在 B 书的链路里 -------------------------------
  revision = afterReload.revision
  const responseB = await post('/craft', { op: 'response.add', payload: { text: '第二本书的回应。', sourceIds: [`note:${NOTE_B.id}`] }, revision })
  const responseBId = responseB.json.created.response.id
  revision = responseB.json.revision
  const materialB = await post('/craft', { op: 'material.add', payload: { type: '案例', text: '第二本书的案例。', sourceIds: [`note:${NOTE_B.id}`, `response:${responseBId}`] }, revision })
  const materialBId = materialB.json.created.material.id
  eq('B 素材归属 B 书', materialB.json.created.material.bookId, BOOK_B.bookId)
  revision = materialB.json.revision
  const topicB = await post('/craft', { op: 'topic.add', payload: { statement: '第二本书的选题', materialIds: [materialBId] }, revision })
  eq('B 选题归属 B 书', JSON.stringify(topicB.json.created.topic.bookIds), JSON.stringify([BOOK_B.bookId]))
  revision = topicB.json.revision
  const workB = await post('/craft', { op: 'work.add', payload: { title: '第二本书的初稿' }, revision })
  const workBId = workB.json.created.work.id
  revision = workB.json.revision
  const paraB = await post('/craft', { op: 'work.paragraph.add', payload: { id: workBId, text: '手写一段，没有 AI 参与。', sourceIds: [`material:${materialBId}`] }, revision })
  eq('B 段落不带 AI 标记', paraB.json.created.paragraph.ai, false)
  revision = paraB.json.revision

  const view = (await get('/craft')).json
  const materialAView = view.materials.find((item) => item.id === materialAId)
  const materialBView = view.materials.find((item) => item.id === materialBId)
  eq('A 素材来源只有 A 书摘录', JSON.stringify(materialAView.sourceIds), JSON.stringify([`note:${NOTE_A.id}`, `response:${responseAId}`]))
  eq('B 素材来源只有 B 书摘录', JSON.stringify(materialBView.sourceIds), JSON.stringify([`note:${NOTE_B.id}`, `response:${responseBId}`]))
  check('两本书的素材互不出现在对方的 bookIndex 计数之外', view.bookIndex.every((entry) => entry.bookId === BOOK_A.bookId || entry.bookId === BOOK_B.bookId), JSON.stringify(view.bookIndex.map((item) => item.bookId)))
  const indexB = view.bookIndex.find((item) => item.bookId === BOOK_B.bookId)
  eq('B 书作品计数', indexB && indexB.counts.works, 1)
  const exportA = await post('/craft/export', { kind: 'work', id: workAId, mode: 'preview' })
  const exportB = await post('/craft/export', { kind: 'work', id: workBId, mode: 'preview' })
  eq('A 稿只声明 A 书', JSON.stringify(exportA.json.document.bookIds), JSON.stringify([BOOK_A.bookId]))
  eq('B 稿只声明 B 书', JSON.stringify(exportB.json.document.bookIds), JSON.stringify([BOOK_B.bookId]))
  check('A 稿里没有 B 书正文', !String(exportA.json.document.markdown).includes('第二本书'))
  has('B 稿 containsAI 与事实一致（手写=false）', exportB.json.document.markdown, 'containsAI: false')
  check('B 稿里没有 A 书原文', !String(exportB.json.document.markdown).includes('关雎'))

  // --- 11. 降级：没有模型服务时聊天明确报错，craft 仍可用 --------------------
  const noLlmRoutes = I.makeRoutes(host, { get: (name) => (name === 'connection' ? connectionFor('browser') : null) })
  const noLlmServer = http.createServer((req, res) => noLlmRoutes[0].handler(req, res))
  await new Promise((resolve) => noLlmServer.listen(0, '127.0.0.1', resolve))
  const noLlmPort = noLlmServer.address().port
  const callNoLlm = (route, body) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: noLlmPort, method: body ? 'POST' : 'GET', path: `${ROUTE_PREFIX}${route}`, headers: { 'content-type': 'application/json' } },
        (res) => {
          let text = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => (text += chunk))
          res.on('end', () => {
            let json = null
            try {
              json = JSON.parse(text)
            } catch {}
            resolve({ status: res.statusCode, json, text })
          })
        },
      )
      req.on('error', reject)
      if (body) req.write(JSON.stringify(body))
      req.end()
    })
  const noModels = await callNoLlm('/chat/models')
  eq('无模型服务时 /chat/models available=false', noModels.json && noModels.json.available, false)
  const noLlmChat = await callNoLlm('/chat', { pack: 'p', question: '在吗' })
  eq('无模型服务时 /chat 400', noLlmChat.status, 400)
  has('无模型服务时说明原因', noLlmChat.json && noLlmChat.json.error, '没有可用的模型服务')
  const noLlmCraft = await callNoLlm('/craft', { op: 'response.add', payload: { text: '没有模型也能手写回应。', sourceIds: [`note:${NOTE_A.id}`] }, revision })
  eq('无模型时手写回应仍成功', noLlmCraft.status, 200)
  revision = noLlmCraft.json.revision
  await new Promise((resolve) => noLlmServer.close(resolve))

  // --- 12. 旧版导出（READ）与选择器边界 -------------------------------------
  const exportEmpty = await post('/export', { selector: {}, options: {}, mode: 'preview' })
  eq('空选择 → 400', exportEmpty.status, 400)
  const exportUnknown = await post('/export', { selector: { bookIds: ['nope'] }, options: {}, mode: 'preview' })
  eq('未知书 → 400', exportUnknown.status, 400)
  const exportMulti = await post('/export', { selector: { bookIds: [BOOK_A.bookId, BOOK_B.bookId] }, options: {}, mode: 'preview' })
  eq('多书导出 200', exportMulti.status, 200)
  has('多书导出文件名', exportMulti.json.filename, '数字书房 · 摘录 4 条.md')
  has('多书导出含 A 书', exportMulti.json.markdown, BOOK_A.title)
  has('多书导出含 B 书', exportMulti.json.markdown, BOOK_B.title)
  const exportOne = await post('/export', { selector: { bookIds: [BOOK_A.bookId] }, options: {}, mode: 'preview' })
  eq('单书导出文件名', exportOne.json.filename, '诗经 - 佚名.md')
  has('单书导出 containsAI 与事实一致', exportOne.json.markdown, 'containsAI: false')

  // --- 13. 备份 / 恢复 / 旧备份包 / 清空 -------------------------------------
  const backupRes = await get('/backup')
  const bundle = backupRes.json && backupRes.json.bundle
  check('备份 200', backupRes.status === 200)
  check('备份声明 apiKey 已剔除', bundle && bundle.apiKeyOmitted === true)
  check('备份文件含 craft.json', bundle && bundle.files && Object.prototype.hasOwnProperty.call(bundle.files, 'craft.json'))
  check('备份文案不含明文 key', !JSON.stringify(bundle || {}).includes(SECRET))
  const legacy = {
    format: bundle.format,
    formatVersion: bundle.formatVersion,
    schemaVersion: bundle.schemaVersion,
    exportedAt: bundle.exportedAt,
    files: { 'data.json': bundle.files['data.json'] },
  }
  const restoredLegacy = await post('/restore', { bundle: legacy })
  eq('旧备份包（无 craft）导入 200', restoredLegacy.status, 200)
  check('旧备份包不覆盖现有 craft', restoredLegacy.json && restoredLegacy.json.craftKept === true, JSON.stringify(restoredLegacy.json && restoredLegacy.json.craftKept))
  eq('旧备份包导入后素材还在', (await get('/craft')).json.materials.length, 2)
  const restored = await post('/restore', { bundle })
  eq('完整备份恢复 200', restored.status, 200)
  check('完整备份恢复列出 craft.json', restored.json && Array.isArray(restored.json.restored) && restored.json.restored.includes('craft.json'), JSON.stringify(restored.json && restored.json.restored))

  const noConfirm = await post('/reset/data', {})
  eq('清空缺 confirm → 400', noConfirm.status, 400)
  has('清空缺确认文案', noConfirm.json && noConfirm.json.error, '二次确认')
  const cleared = await post('/reset/data', { confirm: true })
  eq('清空 200', cleared.status, 200)
  check('清空删掉 craft.json', !fs.existsSync(path.join(dir, 'craft.json')))
  const clearBackupDir = fs.existsSync(path.join(dir, 'backups'))
  check('清空前自动备份', clearBackupDir && fs.readdirSync(path.join(dir, 'backups')).length > 0)
  const clearedCraft = (await get('/craft')).json
  eq('清空后 craft 归零', clearedCraft.revision, 0)
  eq('清空后作品为空', clearedCraft.works.length, 0)
  eq('清空后 hasCraft=false', clearedCraft.hasCraft, false)
  eq('清空后 data 也没了', (await get('/data')).json.hasData, false)

  // --- 汇总 ------------------------------------------------------------------
  const failed = results.filter((item) => !item.ok)
  console.log('[e2e-1.2.1] pass=%d fail=%d', results.length - failed.length, failed.length)
  for (const item of failed) console.log('  ✗ %s %s', item.name, item.detail ? `— ${item.detail}` : '')
  if (failed.length === 0) console.log('[e2e-1.2.1] ok：宿主链路、认证、隔离、备份/清空全部通过')
  if (!process.env.KEEP) {
    try {
      fs.rmSync(home, { recursive: true, force: true })
    } catch {}
  } else {
    console.log('[e2e-1.2.1] 临时 DSH_HOME 保留在 %s', home)
  }
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('[e2e-1.2.1] 崩溃：', error && error.stack ? error.stack : error)
  process.exit(1)
})