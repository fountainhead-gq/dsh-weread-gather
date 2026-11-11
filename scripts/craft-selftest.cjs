#!/usr/bin/env node
/**
 * Craft self-test — 在临时 DSH_HOME 里真跑 `index.js` 的 craft 数据层，检查
 * 1.2.1 的 CREATE 契约（docs/prd-1.2.1.md §5 / design-1.2.1-ia.md §6）：
 * 资产可回溯、素材必有来源、初稿→素材→摘录三级反查、containsAI 与 AI 段一致、
 * 备份包含 craft.json、清空前自动备份。
 *
 * 全程不碰用户的 ~/.dsh：`dshHome()` 在调用时读 `DSH_HOME`，这里指向 mkdtemp 目录。
 *
 *   node scripts/craft-selftest.cjs
 */
const { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const failures = []
const notes = []

function check(name, condition, detail) {
  if (condition) notes.push(`  ok   ${name}`)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function throws(fn) {
  try {
    fn()
    return null
  } catch (error) {
    return error
  }
}

function frontMatter(markdown) {
  const lines = String(markdown).split('\n')
  if (lines[0] !== '---') return null
  const end = lines.indexOf('---', 1)
  if (end === -1) return null
  return lines.slice(1, end)
}

function fmValue(lines, key) {
  const hit = (lines || []).find((line) => line.startsWith(`${key}: `))
  return hit === undefined ? undefined : hit.slice(key.length + 2)
}

/** Quoted YAML scalars (`status: "confirmed"`) compare by their bare value. */
function fmText(lines, key) {
  const value = fmValue(lines, key)
  return value === undefined ? undefined : String(value).replace(/^"(.*)"$/, '$1')
}

const BOOK_ID = '812345'
const NOTE_ID = 'note-a1'
const THOUGHT_ID = 'th-1'

function fixture(overrides = {}) {
  return {
    schemaVersion: 1,
    updatedAt: 1762300000,
    books: [
      {
        bookId: BOOK_ID,
        title: '顾随诗词讲记',
        author: '顾随',
        cover: '',
        category: '文学',
        noteCount: 1,
        reviewCount: 1,
        chapters: [],
      },
    ],
    categories: [{ name: '文学', count: 1 }],
    archives: [],
    notes: [
      {
        id: NOTE_ID,
        bookId: BOOK_ID,
        bookTitle: '顾随诗词讲记',
        author: '顾随',
        chapterUid: 1,
        chapterTitle: '开场白',
        text: '诗是生命的流露，不是文字的堆砌。',
        createTime: 1762200000,
        range: '0-18',
        colorStyle: 1,
        kind: 'note',
      },
    ],
    thoughts: [
      {
        id: THOUGHT_ID,
        bookId: BOOK_ID,
        bookTitle: '顾随诗词讲记',
        author: '顾随',
        chapterName: '开场白',
        content: '读诗要先把自己放进去。',
        createTime: 1762200100,
        star: 0,
        isFinish: 1,
        kind: 'thought',
      },
    ],
    dashboard: {},
    warnings: [],
    ...overrides,
  }
}

async function main() {
  const home = mkdtempSync(join(tmpdir(), 'craft-selftest-'))
  process.env.DSH_HOME = home
  const dir = join(home, 'weread-gather')
  mkdirSync(dir, { recursive: true })

  const mod = await import('../index.js')
  const {
    createHost,
    makeRoutes,
    CRAFT_MATERIAL_TYPES,
    CRAFT_SCHEMA_VERSION,
    CRAFT_RELATION_LABELS,
    CRAFT_THREAD_LIMIT,
    migrateCraft,
    parseSourceId,
    craftBags,
    resolveCraftSourceWith,
    RELATE_SYSTEM,
    THREADS_SYSTEM,
  } = mod.__internals

  // ---- 1. no craft.json yet: first paint must not be blocked ---------------
  const empty = createHost({})
  const emptyView = empty.craftView()
  check('空目录：craft.json 缺失时按空文档返回', emptyView.ok === true && emptyView.responses.length === 0 && emptyView.materials.length === 0 && emptyView.topics.length === 0 && emptyView.works.length === 0)
  check('空目录：hasCraft 为 false', emptyView.hasCraft === false)
  check('空目录：revision 从 0 开始', emptyView.revision === 0)
  check('空目录：schemaVersion 为 2', emptyView.schemaVersion === CRAFT_SCHEMA_VERSION && CRAFT_SCHEMA_VERSION === 2)
  check('空目录：relations/threads 是空数组', Array.isArray(emptyView.relations) && emptyView.relations.length === 0 && Array.isArray(emptyView.threads) && emptyView.threads.length === 0)
  check('空目录：关系标签白名单为四项', CRAFT_RELATION_LABELS.join('/') === '呼应/对照/个人回应/待核实' && CRAFT_THREAD_LIMIT === 5)
  check('空目录：bookIndex 为空', emptyView.bookIndex.length === 0)
  check('空目录：六类素材类型齐备', CRAFT_MATERIAL_TYPES.length === 6 && CRAFT_MATERIAL_TYPES.join('/') === '金句/观点/案例/论据/问题/灵感')
  check('空目录：破损 craft.json 也能迁移成空文档', migrateCraft({ materials: 'nope' }).materials.length === 0 && migrateCraft(null).revision === 0)
  check(
    '解析：source id 必须是 kind:id',
    parseSourceId('note:note-a1').kind === 'note' &&
      parseSourceId('material:m_1').kind === 'material' &&
      parseSourceId('thought:th-1').kind === 'thought' &&
      parseSourceId('response:r_1').kind === 'response' &&
      parseSourceId('m_1') === null &&
      parseSourceId('book:812345') === null &&
      parseSourceId('note:') === null,
  )

  // ---- 1b. a schemaVersion 1 file: read as-is, gain the two new arrays ------
  const legacyHome = mkdtempSync(join(tmpdir(), 'craft-legacy-'))
  const legacyDir = join(legacyHome, 'weread-gather')
  mkdirSync(legacyDir, { recursive: true })
  const legacyDoc = {
    schemaVersion: 1,
    updatedAt: 1762300000,
    revision: 7,
    responses: [
      {
        id: 'r_legacy',
        bookId: BOOK_ID,
        bookTitle: '顾随诗词讲记',
        author: '顾随',
        sourceIds: [`note:${NOTE_ID}`],
        text: '旧版留下的回应',
        origin: 'think',
        containsAI: false,
        model: 'old-model',
        promptVersion: '',
        adoptedAt: 1762300000,
        createdAt: 1762300000,
      },
    ],
    materials: [
      {
        id: 'm_legacy',
        type: '观点',
        bookId: BOOK_ID,
        sourceIds: [`note:${NOTE_ID}`],
        text: '旧版留下的素材',
        authorType: 'human',
        origin: 'craft',
        containsAI: false,
        verification: { status: 'ok', checkedAt: 0, hash: '', snapshot: '' },
        createdAt: 1762300000,
        updatedAt: 1762300000,
      },
    ],
    topics: [
      { id: 't_legacy', statement: '旧版留下的选题', materialIds: ['m_legacy'], bookIds: [BOOK_ID], gapNote: '', candidates: [], createdAt: 1762300000, updatedAt: 1762300000 },
    ],
    works: [
      {
        id: 'w_legacy',
        title: '旧版留下的初稿',
        status: 'draft',
        exportId: 'craft:work/w_legacy',
        containsAI: false,
        paragraphs: [{ id: 'p_legacy', text: '旧段落', sourceIds: ['material:m_legacy'], ai: false, aiOriginIds: [], editedAt: 0 }],
        createdAt: 1762300000,
        updatedAt: 1762300000,
        confirmedAt: 0,
      },
    ],
  }
  writeFileSync(join(legacyDir, 'data.json'), JSON.stringify(fixture()))
  writeFileSync(join(legacyDir, 'craft.json'), JSON.stringify(legacyDoc, null, 2))
  process.env.DSH_HOME = legacyHome
  const legacyHost = createHost({})
  const legacyView = legacyHost.craftView()
  check('迁移：老文件读成版本 2 且 revision 不变', legacyView.schemaVersion === 2 && legacyView.revision === 7)
  check(
    '迁移：补出空 relations/threads',
    Array.isArray(legacyView.relations) && legacyView.relations.length === 0 && Array.isArray(legacyView.threads) && legacyView.threads.length === 0,
  )
  check(
    '迁移：四条旧数据一条不少',
    legacyView.responses.length === 1 &&
      legacyView.materials.length === 1 &&
      legacyView.topics.length === 1 &&
      legacyView.works.length === 1 &&
      legacyView.works[0].paragraphs.length === 1 &&
      legacyView.responses[0].model === 'old-model',
  )
  check('迁移：只读时不改写磁盘上的老文件', JSON.parse(readFileSync(join(legacyDir, 'craft.json'), 'utf8')).schemaVersion === 1)
  const legacyWrite = legacyHost.craftOp('relation.add', {
    bookId: BOOK_ID,
    from: `note:${NOTE_ID}`,
    to: 'material:m_legacy',
    label: '呼应',
    reason: '旧素材与这句话是一回事',
    origin: 'manual',
  })
  const legacyDisk = JSON.parse(readFileSync(join(legacyDir, 'craft.json'), 'utf8'))
  check(
    '迁移：回写后版本写成 2 且旧字段全在',
    legacyDisk.schemaVersion === 2 &&
      legacyDisk.responses.length === 1 &&
      legacyDisk.materials.length === 1 &&
      legacyDisk.topics.length === 1 &&
      legacyDisk.works.length === 1 &&
      legacyWrite.revision === 8,
  )
  check('迁移：回写后新关系也落了盘', legacyDisk.relations.length === 1 && legacyDisk.relations[0].to.kind === 'material')
  process.env.DSH_HOME = home

  // ---- 2. real reading data, then write the craft chain --------------------
  writeFileSync(join(dir, 'data.json'), JSON.stringify(fixture()))
  const host = createHost({})
  check('装载：/data 仍来自 data.json', host.dataset.books.length === 1 && host.dataset.notes.length === 1)

  const added = host.craftOp('response.add', {
    bookId: BOOK_ID,
    sourceIds: [`note:${NOTE_ID}`],
    text: '诗不是文字，是生命。',
    origin: 'think',
    containsAI: true,
    model: 'test-model',
    adoptedAt: 1762300100,
  })
  const response = added.created.response
  check('回应：id 以 r_ 开头', /^r_/.test(response.id))
  check('回应：带 note 来源', response.sourceIds.length === 1 && response.sourceIds[0] === `note:${NOTE_ID}`)
  check('回应：快照了书名与作者', response.bookTitle === '顾随诗词讲记' && response.author === '顾随')
  check('回应：revision 递增到 1', added.revision === 1)

  const materialAdded = host.craftOp('material.add', {
    type: '观点',
    bookId: BOOK_ID,
    sourceIds: [`note:${NOTE_ID}`, `response:${response.id}`],
    text: '诗是生命的流露。',
    authorType: 'human',
    origin: 'think',
    containsAI: true,
  })
  const material = materialAdded.created.material
  check('素材：id 以 m_ 开头', /^m_/.test(material.id))
  check('素材：至少一个来源', material.sourceIds.length >= 1)
  check('素材：来源含摘录与回应', material.sourceIds.includes(`note:${NOTE_ID}`) && material.sourceIds.includes(`response:${response.id}`))
  check('素材：带 bookId', material.bookId === BOOK_ID)
  check('素材：核验快照落盘', material.verification.status === 'ok' && /^sha256:[0-9a-f]{64}$/.test(material.verification.hash) && material.verification.snapshot.length > 0 && material.verification.snapshot.length <= 200)
  check('素材：containsAI 由来源推导', material.containsAI === true)

  const badType = throws(() => host.craftOp('material.add', { type: '八卦', sourceIds: [`note:${NOTE_ID}`], text: 'x' }))
  check('素材：非法类型被拒', badType !== null)
  const noSource = throws(() => host.craftOp('material.add', { type: '观点', sourceIds: [], text: 'x' }))
  check('素材：缺 sourceIds 被拒', noSource !== null)
  const orphan = throws(() => host.craftOp('material.add', { type: '观点', sourceIds: ['note:已经没了'], text: 'x' }))
  check('素材：来源解析不到（孤立资产）被拒', orphan !== null)
  const mismatch = throws(() => host.craftOp('material.add', { type: '观点', bookId: '999999', sourceIds: [`note:${NOTE_ID}`], text: 'x' }))
  check('素材：声明的书与来源不一致被拒', mismatch !== null)

  const topicAdded = host.craftOp('topic.add', { statement: '为什么说诗是生命的流露？', materialIds: [material.id], gapNote: '缺一个反例' })
  const topic = topicAdded.created.topic
  check('选题：id 以 t_ 开头', /^t_/.test(topic.id))
  check('选题：bookIds 由素材反推', topic.bookIds.length === 1 && topic.bookIds[0] === BOOK_ID)
  const emptyTopic = throws(() => host.craftOp('topic.add', { statement: '空选题', materialIds: [] }))
  check('选题：不引用素材被拒', emptyTopic !== null)

  const workAdded = host.craftOp('work.add', { title: '从诗到生活' })
  const work = workAdded.created.work
  check('初稿：id 以 w_ 开头', /^w_/.test(work.id))
  check('初稿：默认 draft', work.status === 'draft' && work.confirmedAt === 0)
  check('初稿：exportId 为 craft:work/<id>', work.exportId === `craft:work/${work.id}`)
  check('初稿：自身不存 bookIds', !('bookIds' in work))

  const paragraph = host.craftOp('work.paragraph.add', {
    id: work.id,
    text: '诗不是文字的堆砌，而是生命在语言里留下的一次呼吸。',
    sourceIds: [`material:${material.id}`, `thought:${THOUGHT_ID}`],
  }).created.paragraph
  check('段落：id 以 p_ 开头', /^p_/.test(paragraph.id))
  check('段落：来源带类型前缀', paragraph.sourceIds.every((id) => /^(note|thought|response|material):/.test(id)))

  const aiParagraph = host.craftOp('work.paragraph.add', {
    id: work.id,
    text: '所以读诗不是解释，是把自己放进去。',
    sourceIds: [`material:${material.id}`],
    ai: true,
    aiOriginIds: [`response:${response.id}`],
  }).created.paragraph
  check('段落：AI 候选标 ai:true', aiParagraph.ai === true && aiParagraph.aiOriginIds.includes(`response:${response.id}`))

  const badParagraphSource = throws(() =>
    host.craftOp('work.paragraph.add', { id: work.id, text: 'x', sourceIds: ['material:m_已经没了'] }),
  )
  check('段落：来源不存在被拒（防孤立引用）', badParagraphSource !== null)

  const confirmed = host.craftOp('work.confirm', { id: work.id }).created.work
  check('确认：status 变 confirmed 并有 confirmedAt', confirmed.status === 'confirmed' && confirmed.confirmedAt > 0)
  check('确认：still 不存 bookIds', !('bookIds' in confirmed))

  const bare = host.craftOp('work.add', { title: '空稿' }).created.work
  const confirmEmpty = throws(() => host.craftOp('work.confirm', { id: bare.id }))
  check('确认：没有段落的初稿不能确认', confirmEmpty !== null)

  const conflict = throws(() => host.craftOp('response.add', { text: '旧窗口的写入', sourceIds: [`note:${NOTE_ID}`] }, 0))
  check('并发：revision 不匹配返回 409 conflict', conflict !== null && conflict.statusCode === 409 && conflict.code === 'conflict')
  const unknown = throws(() => host.craftOp('craft.nuke', {}))
  check('白名单：未知操作被拒', unknown !== null && /未知操作/.test(unknown.message))

  // ---- 3. every asset traces back to a book --------------------------------
  const view = host.craftView()
  check('可回溯：回应 100% 带 bookId', view.responses.every((item) => typeof item.bookId === 'string' && item.bookId !== ''))
  check('可回溯：素材 100% 带 bookId', view.materials.every((item) => typeof item.bookId === 'string' && item.bookId !== ''))
  check('可回溯：素材 100% 带 sourceIds', view.materials.every((item) => Array.isArray(item.sourceIds) && item.sourceIds.length >= 1))
  check('可回溯：选题 100% 有 bookIds', view.topics.every((item) => Array.isArray(item.bookIds) && item.bookIds.length >= 1))
  check('可回溯：没有孤儿素材（来源都能解析）', view.materials.every((item) => item.sourceIds.every((id) => parseSourceId(id) !== null)))
  check('书索引：把资产按书聚合', view.bookIndex.length === 1 && view.bookIndex[0].bookId === BOOK_ID && view.bookIndex[0].counts.materials === 1 && view.bookIndex[0].counts.works === 1 && view.bookIndex[0].counts.topics === 1)
  check('书索引：书还在同步窗口里', view.bookIndex[0].cached === true)

  // ---- 4. 三级反查 + containsAI -------------------------------------------
  const exported = host.exportCraftWork(work.id)
  const markdown = exported.document.markdown
  const fm = frontMatter(markdown)
  check('导出：以 front-matter 开头', fm !== null)
  for (const key of ['title', 'kind', 'workId', 'exportId', 'status', 'bookIds', 'containsAI', 'contentHash', 'exportedAt']) {
    check(`导出：front-matter 含 ${key}`, fmValue(fm, key) !== undefined)
  }
  check('导出：workId 指回初稿', fmValue(fm, 'workId') === `"${work.id}"`)
  check('导出：exportId 与初稿一致', fmValue(fm, 'exportId') === `"${work.exportId}"`)
  check('导出：bookIds 由段落推导', (fmValue(fm, 'bookIds') || '').includes(BOOK_ID))
  check('导出：containsAI 与 AI 段一致', fmValue(fm, 'containsAI') === 'true')
  check('导出：正文保留 [m_…] 引用', markdown.includes(`[material:${material.id}]`) || markdown.includes(`[${material.id}]`))
  check('导出：段尾有来源清单', markdown.includes('> 来源：') && markdown.includes('《顾随诗词讲记》'))
  // 三级反查：初稿段落 → material: → note: → 那句原文
  const bags = craftBags(host.dataset, host.craft)
  const viaMaterial = resolveCraftSourceWith(bags, `material:${material.id}`)
  const viaNote = resolveCraftSourceWith(bags, material.sourceIds.find((id) => id.startsWith('note:')))
  check('三级反查：初稿→素材→摘录', viaMaterial !== null && viaNote !== null && viaNote.text === '诗是生命的流露，不是文字的堆砌。')
  check('三级反查：素材落回同一本书', viaMaterial !== null && viaMaterial.bookId === BOOK_ID && viaMaterial.bookTitle === '顾随诗词讲记')
  check('导出：文件名以 .md 结尾', /\.md$/.test(exported.document.filename))
  check('导出：文件名无非法字符', !/[\\/:*?"<>|]/.test(exported.document.filename))
  check('导出：bytes 与内容一致', exported.document.bytes === Buffer.byteLength(markdown, 'utf8'))

  const written = host.exportCraftWork(work.id, 'file')
  check('导出到文件：落盘成功', written.saved === true && existsSync(written.path))
  const again = host.exportCraftWork(work.id, 'file')
  check('导出到文件：同 exportId 幂等（不生成 -2）', again.path === written.path)
  check('导出到文件：内容含 contentHash', readFileSync(written.path, 'utf8').includes('contentHash:'))
  check('导出态：空初稿抛可读错误', throws(() => host.exportCraftWork(bare.id)) !== null)

  // 手改不丢来源与 AI 标记
  const edited = host.craftOp('work.paragraph.update', { id: work.id, paragraphId: aiParagraph.id, text: '所以读诗不是解释，是把自己放进去，再带出来。' })
  const editedParagraph = edited.created.paragraph
  check('手改：来源保留', editedParagraph.sourceIds.length === aiParagraph.sourceIds.length)
  check('手改：AI 标记保留', editedParagraph.ai === true && editedParagraph.aiOriginIds.length === aiParagraph.aiOriginIds.length)
  check('手改：写入 editedAt', editedParagraph.editedAt > 0)

  // ---- 5. 来源变了 / 来源没了：只提示，不删素材 ---------------------------
  writeFileSync(
    join(dir, 'data.json'),
    JSON.stringify(
      fixture({
        notes: [
          {
            ...fixture().notes[0],
            text: '诗是生命的流露，不是文字的堆砌。（再版改成了这句）',
          },
        ],
      }),
    ),
  )
  const rehost = createHost({})
  const changed = rehost.craftView().materials.find((item) => item.id === material.id)
  check('来源已变：重新载入后标记 changed', changed !== undefined && changed.verification.status === 'changed')
  check('来源已变：素材没有被删掉', rehost.craftView().materials.length === 1)
  writeFileSync(join(dir, 'data.json'), JSON.stringify(fixture({ notes: [] })))
  const goneHost = createHost({})
  const gone = goneHost.craftView().materials.find((item) => item.id === material.id)
  check('来源缺失：标记 missing 且素材仍在', gone !== undefined && gone.verification.status === 'missing')
  writeFileSync(join(dir, 'data.json'), JSON.stringify(fixture()))

  // ---- 6. 书掉出同步窗口：靠快照兜底 --------------------------------------
  const offShelf = createHost({})
  writeFileSync(join(dir, 'data.json'), JSON.stringify(fixture({ books: [] })))
  const shelfless = createHost({})
  const shelflessBook = shelfless.craftView().bookIndex[0]
  check('书掉窗口：仍按快照显示书名', shelflessBook !== undefined && shelflessBook.bookTitle === '顾随诗词讲记')
  check('书掉窗口：cached 标 false', shelflessBook !== undefined && shelflessBook.cached === false)
  writeFileSync(join(dir, 'data.json'), JSON.stringify(fixture()))
  check('恢复：书架回去后 cached 恢复 true', offShelf.craftView().bookIndex[0].cached === true)

  // ---- 6b. 关系（relations）与脉络（threads） ------------------------------
  const related = host.craftOp('relation.add', {
    bookId: BOOK_ID,
    from: `note:${NOTE_ID}`,
    to: `thought:${THOUGHT_ID}`,
    label: '呼应',
    reason: '摘录在说诗，想法也在说诗',
    origin: 'manual',
  })
  const relation = related.created.relation
  check('关系：id 以 rel_ 开头', /^rel_/.test(relation.id))
  check(
    '关系：两端都解析成了 {kind,id}',
    relation.from.kind === 'note' && relation.from.id === NOTE_ID && relation.to.kind === 'thought' && relation.to.id === THOUGHT_ID,
  )
  check('关系：带 bookId 与白名单标签', relation.bookId === BOOK_ID && relation.label === '呼应')
  check('关系：真的落盘了（重载后还在）', createHost({}).craftView().relations.length === 1)

  const deadEnd = host.craftOp('relation.add', {
    bookId: BOOK_ID,
    from: `note:${NOTE_ID}`,
    to: 'note:does-not-exist',
    label: '对照',
    reason: '对面已经没了',
  })
  check('关系：一端解析不出 → 丢弃并回报 dropped', deadEnd.dropped === 1 && deadEnd.created.relation === undefined)
  check(
    '关系：丢弃的关系不进内存也不进文件',
    host.craftView().relations.length === 1 && JSON.parse(readFileSync(join(dir, 'craft.json'), 'utf8')).relations.length === 1,
  )
  check('关系：整单被丢弃时 revision 不动', deadEnd.revision === host.craftView().revision)

  const badLabel = throws(() => host.craftOp('relation.add', { bookId: BOOK_ID, from: `note:${NOTE_ID}`, to: `thought:${THOUGHT_ID}`, label: '像极了' }))
  check('关系：白名单外的标签 400', badLabel !== null && /关系标签/.test(badLabel.message))
  const crossBook = host.craftOp('relation.add', { bookId: '999999', from: `note:${NOTE_ID}`, to: `thought:${THOUGHT_ID}`, label: '对照', reason: '跨书声明' })
  check('关系：两端不在声明的书里 → 丢弃', crossBook.dropped === 1 && host.craftView().relations.length === 1)
  const badField = throws(() => host.craftOp('relation.update', { id: relation.id, from: `note:${NOTE_ID}`, label: '对照' }))
  check('关系：relation.update 改别的字段 400（不静默忽略）', badField !== null && /只能改 label 与 reason/.test(badField.message))
  const relabeled = host.craftOp('relation.update', { id: relation.id, label: '对照', reason: '换个说法' }).created.relation
  check('关系：relation.update 改得动 label 与 reason', relabeled.label === '对照' && relabeled.reason === '换个说法' && relabeled.from.id === NOTE_ID)

  const threadsFirst = host.craftOp('threads.save', {
    bookId: BOOK_ID,
    threads: [
      { title: '诗与生命的说法', why: '摘录和想法在同一个意思上撞了两次', relationIds: [relation.id, 'rel_不存在'] },
      { title: '另一个念头', why: '只是顺手记的' },
    ],
  }).created.threads
  check('脉络：id 以 thr_ 开头且两条都存下', threadsFirst.length === 2 && threadsFirst.every((item) => /^thr_/.test(item.id)))
  check(
    '脉络：coverage 由宿主按 data.json 算',
    threadsFirst[0].coverage.notes === 1 &&
      threadsFirst[0].coverage.thoughts === 1 &&
      threadsFirst[0].coverage.chapters.includes('开场白') &&
      threadsFirst[0].coverage.hasFullText === false,
  )
  check('脉络：引用了别处的关系被筛掉', threadsFirst[0].relationIds.length === 1 && threadsFirst[0].relationIds[0] === relation.id)
  check('脉络：整份替换第一次之后状态正确', host.craftView().threads.length === 2)

  const deadEdges = host.craftOp('threads.save', { bookId: BOOK_ID, threads: [{ title: '带死关系', why: 'x', relationIds: ['rel_不存在', 'rel_也不存在'] }] })
  check('脉络：无效 relationIds 被丢弃并计数', deadEdges.droppedRelations === 2 && deadEdges.created.threads[0].relationIds.length === 0)

  const replacedThreads = host.craftOp('threads.save', { bookId: BOOK_ID, threads: [{ title: '只剩这一条', why: '整份替换' }] }).created.threads
  const afterReplace = host.craftView().threads
  check('脉络：第二次保存整份替换、旧的不残留', afterReplace.length === 1 && afterReplace[0].title === '只剩这一条' && replacedThreads.length === 1)
  const tooMany = throws(() =>
    host.craftOp('threads.save', { bookId: BOOK_ID, threads: [1, 2, 3, 4, 5, 6].map((n) => ({ title: `线索${n}`, why: 'x' })) }),
  )
  check(`脉络：超过 ${CRAFT_THREAD_LIMIT} 条 400`, tooMany !== null && new RegExp(`最多 ${CRAFT_THREAD_LIMIT} 条`).test(tooMany.message))
  check('脉络：被拒后文件里的脉络没变', host.craftView().threads.length === 1 && JSON.parse(readFileSync(join(dir, 'craft.json'), 'utf8')).threads.length === 1)

  const liar = host.craftOp('threads.save', {
    bookId: BOOK_ID,
    threads: [{ title: '前端乱报覆盖度', why: 'x', coverage: { chapters: ['假的章节'], notes: 99, thoughts: 99, hasFullText: true } }],
  }).created.threads[0]
  check(
    '脉络：不采信前端传来的 coverage',
    liar.coverage.notes === 1 && liar.coverage.thoughts === 1 && !liar.coverage.chapters.includes('假的章节') && liar.coverage.hasFullText === false,
  )

  host.craftOp('threads.save', { bookId: '999999', threads: [{ title: '别的书', why: 'x' }] })
  check('脉络：按书隔离，另一本书的脉络不影响这本', host.craftView().threads.filter((item) => item.bookId === BOOK_ID).length === 1)

  const threaded = host.craftOp('threads.save', { bookId: BOOK_ID, threads: [{ title: '还挂着一条关系', why: 'x', relationIds: [relation.id] }] }).created.threads[0]
  check('脉络：关系能挂到线索上', threaded.relationIds.length === 1 && threaded.relationIds[0] === relation.id)
  host.craftOp('relation.delete', { id: relation.id })
  const afterRelationDelete = host.craftView()
  check(
    '关系：删除后线索不再指向它',
    afterRelationDelete.relations.length === 0 &&
      afterRelationDelete.threads.find((item) => item.id === threaded.id).relationIds.length === 0,
  )
  check('关系：删不存在的 id 400', throws(() => host.craftOp('relation.delete', { id: 'rel_nope' })) !== null)

  // ---- 7. 备份五件套 + 旧包兼容 + 清空 --------------------------------
  const bundle = host.pluginBackup()
  check('备份：files 含 craft.json', Object.prototype.hasOwnProperty.call(bundle.files, 'craft.json'))
  check('备份：craft.json 带素材与初稿', bundle.files['craft.json'].materials.length === 1 && bundle.files['craft.json'].works.length === 2)
  check('备份：仍是四件套阅读文件 + craft', Object.keys(bundle.files).length === 6 && ['data.json', 'meta.json', 'heat.json', 'sync-state.json', 'config.json'].every((name) => name in bundle.files))
  check('备份：不含 apiKey', bundle.apiKeyOmitted === true && bundle.files['config.json'].apiKey === undefined)
  check(
    '备份：relations/threads 也进包（不丢新字段）',
    Array.isArray(bundle.files['craft.json'].relations) &&
      bundle.files['craft.json'].relations.length === host.craftView().relations.length &&
      bundle.files['craft.json'].threads.length === host.craftView().threads.length &&
      bundle.files['craft.json'].threads.length >= 1,
  )

  const restored = host.restoreBackup(bundle)
  check('恢复：五件套逐件写回', restored.restored.includes('data.json') && restored.restored.includes('craft.json'))
  check('恢复：craftKept 为 false（包里有 craft）', restored.craftKept === false)
  check('恢复：素材仍在', host.craftView().materials.length === 1)

  const legacy = { ...bundle, files: { ...bundle.files } }
  delete legacy.files['craft.json']
  const legacyRestored = host.restoreBackup(legacy)
  check('旧包：没有 craft.json 也不报错', legacyRestored.restored.includes('data.json'))
  check('旧包：本地素材保留不丢', legacyRestored.craftKept === true && host.craftView().materials.length === 1)

  const noConfirm = throws(() => host.clearData({}))
  check('清空：缺 confirm 被拒', noConfirm !== null && noConfirm.statusCode === 400)
  const cleared = host.clearData({ confirm: true })
  check('清空：连带清 craft.json', cleared.cleared.includes('craft.json'))
  check('清空：阅读四件套也清', cleared.cleared.includes('data.json'))
  check('清空：craft.json 文件确实没了', !existsSync(join(dir, 'craft.json')))
  check('清空：清前自动备份落盘', existsSync(cleared.backup.file) && readFileSync(cleared.backup.file, 'utf8').includes('craft.json'))
  check('清空：备份里有清空前的素材', JSON.parse(readFileSync(cleared.backup.file, 'utf8')).files['craft.json'].materials.length === 1)
  check('清空：内存回到空 craft', host.craftView().materials.length === 0 && host.craftView().revision === 0)
  check('清空：relations/threads 也一并归零', host.craftView().relations.length === 0 && host.craftView().threads.length === 0)
  check('清空：/data 回到首屏空态', host.dataset === null && host.counts().books === 0)
  check('清空：备份目录留在 backups/ 下', existsSync(cleared.backup.dir) && readdirSync(join(dir, 'backups')).length >= 1)

  // ---- 8. 路由面：挂在 ROUTE_PREFIX，先过认证，错误码可区分 -----------------
  const table = makeRoutes(host, {
    get(name) {
      if (name !== 'connection') return null
      return { requestRejection: ({ headers }) => (headers && headers.cookie === 'ok' ? undefined : 401) }
    },
  })
  const route = table.find((item) => item.kind === 'prefix')
  check('路由：注册为 prefix 且挂在 /dsh-weread/api', route !== undefined && route.path === '/dsh-weread/api')
  check('路由：handler 是可调用函数', route !== undefined && typeof route.handler === 'function')

  const callRoute = (target, path, options = {}) =>
    new Promise((resolve) => {
      const listeners = {}
      const req = {
        method: options.method || 'GET',
        url: `http://127.0.0.1${target.path}${path}`,
        headers: options.authorized === false ? {} : { cookie: 'ok' },
        on(event, fn) {
          listeners[event] = (listeners[event] || []).concat(fn)
          return req
        },
        off() {
          return req
        },
        destroy() {},
      }
      let statusCode = 0
      let payload = ''
      let headers = {}
      const res = {
        writableEnded: false,
        writeHead(code, nextHeaders) {
          statusCode = code
          headers = nextHeaders || {}
          return res
        },
        write(chunk) {
          payload += String(chunk)
          return true
        },
        end(chunk) {
          if (chunk) payload += String(chunk)
          res.writableEnded = true
          let json = null
          try {
            json = JSON.parse(payload)
          } catch {
            json = null
          }
          resolve({ statusCode, json, text: payload, headers })
        },
      }
      target.handler(req, res)
      if (options.body !== undefined) {
        process.nextTick(() => {
          const chunk = Buffer.from(JSON.stringify(options.body))
          for (const fn of listeners.data || []) fn(chunk)
          for (const fn of listeners.end || []) fn()
        })
      }
    })
  const call = (path, options = {}) => callRoute(route, path, options)

  const denied = await call('/craft', { authorized: false })
  check('路由：未认证返 401', denied.statusCode === 401 && denied.json.ok === false)
  const read = await call('/craft')
  check('路由：GET /craft 返快照', read.statusCode === 200 && read.json.ok === true && read.json.revision === 0 && Array.isArray(read.json.materials))
  const failedRead = await call('/craft', { method: 'GET', authorized: true, body: { op: 'x' } })
  check('路由：GET /craft 不受请求体影响', failedRead.statusCode === 200)
  const wrote = await call('/craft', { method: 'POST', body: { op: 'work.add', payload: { title: '重建的初稿' } } })
  check('路由：POST /craft 写入成功', wrote.statusCode === 200 && wrote.json.ok === true && wrote.json.revision === 1 && wrote.json.created.work.title === '重建的初稿')
  const stale = await call('/craft', { method: 'POST', body: { op: 'work.add', payload: { title: '旧窗口' }, revision: 0 } })
  check('路由：revision 不匹配返 409 并带最新快照', stale.statusCode === 409 && stale.json.ok === false && stale.json.code === 'conflict' && stale.json.revision === 1)
  const bad = await call('/craft', { method: 'POST', body: { op: 'craft.nuke', payload: {} } })
  check('路由：未知 op 返 400', bad.statusCode === 400 && bad.json.ok === false && /未知操作/.test(bad.json.error))
  const droppedRoute = await call('/craft', {
    method: 'POST',
    body: { op: 'relation.add', payload: { bookId: BOOK_ID, from: `note:${NOTE_ID}`, to: `thought:${THOUGHT_ID}`, label: '呼应' } },
  })
  check(
    '路由：relation.add 丢弃关系时仍是 200 并带 dropped',
    droppedRoute.statusCode === 200 && droppedRoute.json.ok === true && droppedRoute.json.dropped === 1 && droppedRoute.json.revision === 1,
  )
  const threadsRoute = await call('/craft', {
    method: 'POST',
    body: { op: 'threads.save', payload: { bookId: BOOK_ID, threads: [{ title: '路由上的脉络', why: 'x' }] } },
  })
  check(
    '路由：threads.save 走同一个白名单与快照回传',
    threadsRoute.statusCode === 200 && threadsRoute.json.created.threads.length === 1 && threadsRoute.json.craft.threads.length === 1,
  )
  const badKind = await call('/craft/export', { method: 'POST', body: { kind: 'year', id: 'x' } })
  check('路由：非 work 导出返 400', badKind.statusCode === 400 && /只支持导出初稿/.test(badKind.json.error))
  const badWork = await call('/craft/export', { method: 'POST', body: { kind: 'work', id: 'w_不存在' } })
  check('路由：找不到初稿返 400', badWork.statusCode === 400 && badWork.json.ok === false)
  const noConfirmRoute = await call('/reset/data', { method: 'POST', body: {} })
  check('路由：清空缺 confirm 返 400', noConfirmRoute.statusCode === 400 && /二次确认/.test(noConfirmRoute.json.error))
  const missing = await call('/nope')
  check('路由：未知接口返 404', missing.statusCode === 404)

  // ---- 9. /chat 底座仍在：SSE 逐帧返回，prompt 仍由 buildChatPrompt 组装 ----------
  const seen = {}
  const chatCtx = ({
    get(name) {
      if (name === 'connection') return { requestRejection: ({ headers }) => (headers && headers.cookie === 'ok' ? undefined : 401) }
      if (name !== 'llm') return null
      return {
        async listProviders() {
          return [{ id: 'fake', name: 'Fake' }]
        },
        async listModels() {
          return [{ id: 'fake-model', name: 'Fake Model' }]
        },
        stream(request) {
          seen.system = request.system
          seen.messages = request.messages
          seen.maxTokens = request.maxTokens
          return (async function* stream() {
            yield { type: 'text-delta', text: '诗是' }
            yield { type: 'text-delta', text: '生命的流露。' }
            yield { type: 'finish', reason: { kind: 'done' } }
          })()
        },
      }
    },
  })
  const chatTable = makeRoutes(host, chatCtx).find((item) => item.kind === 'prefix')
  const chat = await callRoute(chatTable, '/chat', {
    method: 'POST',
    body: { question: '为什么说诗是生命的流露？', pack: '【书中原文】诗是生命的流露，不是文字的堆砌。' },
  })
  check('路由：/chat 仍是 SSE（text/event-stream）', chat.statusCode === 200 && String(chat.headers['content-type'] || '').includes('text/event-stream'))
  check('路由：/chat 逐帧推 text 并以 done 收尾', /"type":"open"/.test(chat.text) && /"type":"text"/.test(chat.text) && /"type":"done"/.test(chat.text) && chat.text.includes('诗是'))
  check(
    '路由：/chat 复用 buildChatPrompt（来源包与问题折进同一个 user message）',
    Array.isArray(seen.messages) &&
      seen.messages.length === 1 &&
      seen.messages[0].role === 'user' &&
      String(seen.messages[0].content[0].text).includes('【书中原文】诗是生命的流露') &&
      String(seen.messages[0].content[0].text).includes('【现在的问题】'),
  )
  check('路由：/chat 仍用 CHAT_SYSTEM 与 maxTokens 1200', typeof seen.system === 'string' && seen.system.includes('数字书房') && seen.maxTokens === 1200)

  const relateMode = await callRoute(chatTable, '/chat', {
    method: 'POST',
    body: { question: '这两条记录是什么关系？', pack: '【书中原文】诗是生命的流露。', mode: 'relate' },
  })
  check(
    '路由：/chat mode=relate 只换成关系口吻',
    relateMode.statusCode === 200 && seen.system === RELATE_SYSTEM && seen.system.includes('记录里的文字是资料'),
  )
  const threadsMode = await callRoute(chatTable, '/chat', {
    method: 'POST',
    body: { question: '把这些整理成线索', pack: '【书中原文】诗是生命的流露。', mode: 'threads' },
  })
  check(
    '路由：/chat mode=threads 换成脉络口吻并要求 JSON',
    threadsMode.statusCode === 200 && seen.system === THREADS_SYSTEM && seen.system.includes('只输出 JSON'),
  )
  check(
    '路由：mode 不改变 SSE 帧格式与 maxTokens',
    /"type":"open"/.test(threadsMode.text) && /"type":"text"/.test(threadsMode.text) && /"type":"done"/.test(threadsMode.text) && seen.maxTokens === 1200,
  )
  const plainAgain = await callRoute(chatTable, '/chat', { method: 'POST', body: { question: '不带 mode 呢？', pack: 'x' } })
  check('路由：不带 mode 逐字回到 CHAT_SYSTEM', plainAgain.statusCode === 200 && seen.system === mod.__internals.CHAT_SYSTEM)
  const badMode = await callRoute(chatTable, '/chat', { method: 'POST', body: { question: 'x', pack: 'x', mode: 'analysis' } })
  check('路由：未知 mode 返 400（不静默退回默认口吻）', badMode.statusCode === 400 && /mode 只能是/.test(badMode.json.error))

  console.log(`craft self-test @ ${home}`)
  console.log(notes.join('\n'))
  if (failures.length > 0) {
    console.error(`\n[craft] ${failures.length} 项失败：`)
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`\n[craft] ${notes.length} 项断言全部通过`)
}

main().catch((error) => {
  console.error('[craft] 自检崩溃：', error)
  process.exitCode = 1
})