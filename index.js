/**
 * 书房 / WeRead Gather — Host half.
 *
 * Owns everything that cannot run in the browser: the WeRead agent gateway
 * calls (the API key must never reach the page), the durable dataset under
 * `$DSH_HOME/weread-gather`, and the JSON routes the Client half reads.
 *
 * Routes are mounted on the shared `webServer` service exactly like the
 * shipped task-board plugin does: the page is served with `<base href="./">`,
 * so the Client half calls document-relative paths and this half registers the
 * root-absolute prefix.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Root-absolute route prefix; the Client drops the leading slash. */
export const ROUTE_PREFIX = '/dsh-weread/api'

const GATEWAY = 'https://i.weread.qq.com/api/agent/gateway'
const SKILL_VERSION = '1.0.5'
const SCHEMA_VERSION = 1
/** Hard ceilings so one sync can never walk a huge shelf forever. */
const MAX_NOTEBOOK_PAGES = 30
const MAX_SHELF_BOOKS = 400
const DEFAULT_MAX_BOOKS = 60
const DEFAULT_NOTES_PER_BOOK = 200
const THOUGHT_PAGE_SIZE = 50
const THOUGHT_MAX_PAGES = 6
/** `/book/info` is one request per book: cap each sync and cache every hit. */
const DEFAULT_META_LIMIT = 400
const META_CONCURRENCY = 6
/** A book whose lookup failed is retried after this many seconds. */
const META_RETRY_AFTER = 60 * 60 * 24 * 7
/** Bumped when the cached `/book/info` shape changes, so old entries refresh. */
const META_VERSION = 2

/**
 * Reading heatmap. `/readdata/detail?mode=monthly&baseTime=<month>` answers the
 * daily seconds of that month in `readTimes`, so one year costs twelve calls
 * and is cached forever once the year is over.
 */
const HEAT_TTL = 30 * 60
const HEAT_CONCURRENCY = 4
const HEAT_CACHE_VERSION = 2

/**
 * Incremental sync. `sync-state.json` remembers, per book, what the notebook
 * list looked like the last time its highlights were fetched. A book is only
 * re-read when one of those numbers moved, so a second sync in a row costs a
 * shelf call plus one notebook page instead of ~130 requests.
 */
const SYNC_STATE_VERSION = 1
/** Reading totals (annually / overall) change slowly: reuse them for a while. */
const DASHBOARD_TTL = 6 * 60 * 60

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }

/**
 * The shelf shows at most ten buckets. WeRead's own taxonomy is far too fine
 * (76 leaf categories, 19 top-level ones) to work as a filter row, so every
 * book is folded into one of these shelves by the prefix of its category
 * ("文学-文学鉴赏" → 文学). The leaf value stays on `book.category` for the
 * detail page and for search; only the filter row uses the bucket.
 */
const CATEGORY_GROUPS = [
  { name: '文学', prefixes: ['文学', '精品小说'] },
  { name: '艺术', prefixes: ['艺术'] },
  { name: '历史', prefixes: ['历史', '人物传记'] },
  { name: '社科', prefixes: ['社会文化', '政治军事', '法律', '社会科学'] },
  { name: '哲学宗教', prefixes: ['哲学宗教'] },
  { name: '成长心理', prefixes: ['个人成长', '心理'] },
  { name: '经管理财', prefixes: ['经济理财'] },
  { name: '科技', prefixes: ['科学技术', '计算机', '医学健康'] },
  { name: '生活', prefixes: ['生活百科', '教育学习', '童书', '有声书'] },
]
const FALLBACK_GROUP = '其他'

/** "文学-文学鉴赏" → "文学"; "" → "". */
function categoryPrefix(category) {
  const text = String(category || '').trim()
  if (text === '') return ''
  const dash = text.indexOf('-')
  return dash > 0 ? text.slice(0, dash) : text
}

function groupOf(category) {
  const prefix = categoryPrefix(category)
  for (const group of CATEGORY_GROUPS) {
    if (group.prefixes.includes(prefix)) return group.name
  }
  return FALLBACK_GROUP
}

/** Stamp `group` on every book and rebuild the ≤10 bucket list. */
function decorateDataset(input) {
  if (!input || typeof input !== 'object') return input
  const books = Array.isArray(input.books) ? input.books : []
  const counts = new Map()
  for (const book of books) {
    if (!book || typeof book !== 'object') continue
    const group = groupOf(book.category)
    book.group = group
    counts.set(group, (counts.get(group) || 0) + 1)
  }
  input.categories = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  return input
}

/** Resolve the DSH home directory (env override, then the platform home). */
function dshHome(env = process.env) {
  const raw = typeof env.DSH_HOME === 'string' ? env.DSH_HOME.trim() : ''
  if (raw !== '') return raw
  return join(homedir(), '.dsh')
}

function readJsonFile(path, fallback) {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonFile(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(value), 'utf8')
  renameSync(tmp, path)
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** One gateway call: business parameters are flattened beside `api_name`. */
async function gateway(apiKey, apiName, params = {}, signal) {
  const body = { api_name: apiName, ...params, skill_version: SKILL_VERSION }
  const response = await fetch(GATEWAY, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`微读网关返回了非 JSON 内容（HTTP ${response.status}）`)
  }
  if (!isObject(payload)) throw new Error('微读网关返回了意外的内容')
  if (payload.upgrade_info && typeof payload.upgrade_info === 'object') {
    const message = payload.upgrade_info.message || '微信读书要求升级接口版本'
    throw new Error(`微信读书技能需要升级：${message}`)
  }
  const errcode = Number(payload.errcode ?? 0)
  if (errcode !== 0) {
    const errmsg = payload.errmsg || payload.errmsg_msg || `接口错误 ${errcode}`
    if (errcode === -2012 || errcode === 401 || /apikey|api key|鉴权|授权/i.test(String(errmsg))) {
      throw new Error(`API Key 无效或已过期：${errmsg}`)
    }
    throw new Error(`${apiName} 调用失败：${errmsg}`)
  }
  return payload
}

/** Bounded concurrency map. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = new Array(Math.max(1, Math.min(limit, items.length))).fill(0).map(async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      try {
        results[index] = await worker(items[index], index)
      } catch (error) {
        results[index] = { error: String(error && error.message ? error.message : error) }
      }
    }
  })
  await Promise.all(runners)
  return results
}

function trimReadData(raw = {}) {
  const list = Array.isArray(raw.readLongest) ? raw.readLongest : []
  const preferCategory = Array.isArray(raw.preferCategory) ? raw.preferCategory : []
  const preferAuthor = Array.isArray(raw.preferAuthor) ? raw.preferAuthor : []
  return {
    baseTime: raw.baseTime || 0,
    totalReadTime: Number(raw.totalReadTime) || 0,
    readDays: Number(raw.readDays) || 0,
    dayAverageReadTime: Number(raw.dayAverageReadTime) || 0,
    compare: typeof raw.compare === 'number' ? raw.compare : undefined,
    readTimes: isObject(raw.readTimes) ? raw.readTimes : {},
    dailyReadTimes: isObject(raw.dailyReadTimes) ? raw.dailyReadTimes : undefined,
    readLongest: list.slice(0, 10).map((item) => ({
      title: (item.book && item.book.title) || (item.albumInfo && item.albumInfo.name) || '未命名',
      author: (item.book && item.book.author) || (item.albumInfo && item.albumInfo.authorName) || '',
      cover: (item.book && item.book.cover) || (item.albumInfo && item.albumInfo.cover) || '',
      bookId: (item.book && item.book.bookId) || '',
      readTime: Number(item.readTime) || 0,
      tags: Array.isArray(item.tags) ? item.tags : [],
    })),
    readStat: Array.isArray(raw.readStat)
      ? raw.readStat.map((item) => ({ stat: item.stat, counts: item.counts }))
      : [],
    preferCategory: preferCategory.slice(0, 8).map((item) => ({
      title: item.categoryTitle || item.parentCategoryTitle || '其他',
      parent: item.parentCategoryTitle || '',
      val: Number(item.val) || 0,
      readingTime: Number(item.readingTime) || 0,
      readingCount: Number(item.readingCount) || 0,
    })),
    preferTime: Array.isArray(raw.preferTime) ? raw.preferTime.map((v) => Number(v) || 0) : [],
    preferTimeWord: raw.preferTimeWord || '',
    preferCategoryWord: raw.preferCategoryWord || '',
    preferAuthor: preferAuthor.slice(0, 8).map((item) => ({
      name: item.name || '',
      count: Number(item.count) || 0,
      readTime: item.readTime || '',
    })),
    rank: raw.rank && raw.rank.text ? raw.rank.text : '',
    readRate: typeof raw.readRate === 'number' ? raw.readRate : undefined,
    wrReadTime: Number(raw.wrReadTime) || 0,
    wrListenTime: Number(raw.wrListenTime) || 0,
  }
}

function normalizeNotebookBook(entry) {
  const info = isObject(entry.book) ? entry.book : {}
  const bookId = String(entry.bookId || info.bookId || '')
  if (bookId === '') return null
  return {
    bookId,
    title: info.title || '未命名',
    author: info.author || '',
    cover: info.cover || info.coverUrl || '',
    category: info.category || '',
    noteCount: Number(entry.noteCount) || 0,
    reviewCount: Number(entry.reviewCount) || 0,
    bookmarkCount: Number(entry.bookmarkCount) || 0,
    readingProgress: Number(entry.readingProgress) || 0,
    markedStatus: Number(entry.markedStatus) || 0,
    lastNoteTime: Number(entry.sort) || 0,
  }
}

function normalizeBookmark(item, chapters) {
  const chapterUid = item.chapterUid
  return {
    id: String(item.bookmarkId || `${item.bookId}-${item.range || ''}-${item.createTime || ''}`),
    bookId: String(item.bookId || ''),
    chapterUid: chapterUid || 0,
    chapterTitle: chapters.get(String(chapterUid)) || '',
    text: String(item.markText || '').trim(),
    createTime: Number(item.createTime) || 0,
    range: item.range || '',
    colorStyle: Number(item.colorStyle) || 0,
    kind: 'note',
  }
}

function normalizeThought(item, bookId) {
  const review = isObject(item.review) ? item.review : isObject(item) ? item : {}
  const content = String(review.content || '').trim()
  if (content === '') return null
  const id = String(review.reviewId || `${bookId}-${review.createTime || ''}-${content.slice(0, 12)}`)
  return {
    id,
    bookId: String(bookId),
    chapterName: review.chapterName || '',
    content,
    createTime: Number(review.createTime || review.createTimeMs / 1000) || 0,
    star: typeof review.star === 'number' ? review.star : -1,
    isFinish: review.isFinish === 1 || review.isFinish === true,
    kind: 'thought',
  }
}

/** Owns the on-disk dataset plus the in-memory sync job. */
// ---------------------------------------------------- Markdown export & backup

const BACKUP_FORMAT = 'dsh-weread-gather-backup'
const BACKUP_VERSION = 1
/** One export is a user-facing file; past a few thousand entries it is a mistake. */
const EXPORT_ENTRY_LIMIT = 5000

/** Version reported by `/state` and recorded in every backup bundle. */
function pluginVersion() {
  try {
    const parsed = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

/** `YYYY-MM-DD HH:mm` in the host's local time; `''` when the stamp is unusable. */
function formatStamp(seconds) {
  const stamp = Number(seconds)
  if (!Number.isFinite(stamp) || stamp <= 0) return ''
  const date = new Date(stamp * 1000)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function formatDay(seconds) {
  const full = formatStamp(seconds)
  return full === '' ? '' : full.slice(0, 10)
}

function formatNowIso() {
  const date = new Date()
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}${sign}${pad2(Math.floor(Math.abs(offset) / 60))}:${pad2(Math.abs(offset) % 60)}`
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** Double-quoted YAML scalar; JSON escaping is valid YAML. */
function yamlText(value) {
  const text = value === null || value === undefined ? '' : String(value).trim()
  return text === '' ? '""' : JSON.stringify(text)
}

function yamlList(values) {
  const list = values.map((value) => String(value || '').trim()).filter((value) => value !== '')
  return list.length === 0 ? '[]' : `[${list.map((value) => JSON.stringify(value)).join(', ')}]`
}

/** One file-name-safe segment; falls back rather than producing an empty name. */
function safeSegment(text, fallback) {
  const cleaned = String(text || '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const cut = cleaned.length > 80 ? cleaned.slice(0, 80).trim() : cleaned
  return cut === '' ? fallback : cut
}

const EXPORT_OPTION_KEYS = ['excerpts', 'thoughts', 'meta', 'chapter', 'star', 'sourceUrl']

function exportOptions(input) {
  const source = isObject(input) ? input : {}
  const options = {}
  for (const key of EXPORT_OPTION_KEYS) options[key] = typeof source[key] === 'boolean' ? source[key] : true
  return options
}

/** The two entry kinds disagree on the chapter field name; never guess beyond that. */
function chapterOf(entry) {
  return String(entry.chapterTitle || entry.chapterName || '').trim()
}

/** Entries of one book, grouped by chapter, both kinds interleaved by time. */
function chapterGroups(notes, thoughts, options) {
  const buckets = new Map()
  const push = (chapter, type, entry) => {
    if (!buckets.has(chapter)) buckets.set(chapter, [])
    buckets.get(chapter).push({ type, entry, at: Number(entry.createTime) || 0 })
  }
  if (options.excerpts) for (const note of notes) push(chapterOf(note), 'note', note)
  if (options.thoughts) for (const thought of thoughts) push(chapterOf(thought), 'thought', thought)
  return Array.from(buckets.entries())
    .map(([chapter, items]) => ({ chapter, items: items.sort((a, b) => a.at - b.at) }))
    .sort((a, b) => (a.items[0]?.at || 0) - (b.items[0]?.at || 0) || a.chapter.localeCompare(b.chapter, 'zh'))
}

/** A highlight is always a block quote; the trailing line names place and time. */
function renderNote(note, chapter, options, showChapter) {
  const body = String(note.text || '').trim()
  if (body === '') return ''
  const quoted = body
    .split(/\r?\n/)
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n')
  const tail = []
  if (showChapter && options.chapter && chapter !== '') tail.push(chapter)
  const stamp = formatStamp(note.createTime)
  if (stamp !== '') tail.push(stamp)
  return tail.length === 0 ? quoted : `${quoted}\n> — ${tail.join(' · ')}`
}

/** A thought is plain prose so it can never be mistaken for the book's own words. */
function renderThought(thought, options) {
  const body = String(thought.content || '').trim()
  if (body === '') return ''
  const mark = []
  const star = Number(thought.star)
  if (options.star && Number.isFinite(star) && star > 0) mark.push(`★${star}`)
  const stamp = formatStamp(thought.createTime)
  if (stamp !== '') mark.push(stamp)
  const head = mark.length === 0 ? '**想法**' : `**想法**（${mark.join(' · ')}）`
  return `${head}\n\n${body}`
}

function renderBook(book, notes, thoughts, options, level, wrapTitle) {
  const title = String(book.title || '').trim()
  const heading = title === '' ? '' : wrapTitle ? `《${title}》` : title
  const lines = [`${'#'.repeat(level)} ${heading}`.trimEnd()]
  const author = String(book.author || '').trim()
  // Italic, not a quote: a block quote means "the book's own words" everywhere else.
  if (author !== '') lines.push('', `*${author}*`)
  for (const group of chapterGroups(notes, thoughts, options)) {
    const headingEmitted = options.chapter && group.chapter !== ''
    const blocks = []
    for (const item of group.items) {
      const rendered =
        item.type === 'note'
          ? renderNote(item.entry, group.chapter, options, !headingEmitted)
          : renderThought(item.entry, options)
      if (rendered !== '') blocks.push(rendered)
    }
    if (blocks.length === 0) continue
    lines.push('')
    if (headingEmitted) lines.push(`## ${group.chapter}`, '')
    lines.push(blocks.join('\n\n'))
  }
  return lines.join('\n')
}

function frontMatterLines(fields) {
  return ['---', ...fields.map(([key, value]) => `${key}: ${value}`), '---']
}

function bookFrontMatter(book, stats, options, nowIso) {
  const fields = []
  const push = (key, value) => fields.push([key, yamlText(value)])
  /** Counts and flags stay real numbers/booleans so other tools can read them. */
  const pushRaw = (key, value) => fields.push([key, String(value)])
  push('title', book.title)
  push('author', book.author)
  push('bookId', book.bookId)
  push('source', 'weread')
  if (options.sourceUrl) {
    push('sourceUrl', String(book.bookId || '') === '' ? '' : `weread://reading?bId=${book.bookId}`)
  }
  if (options.meta) {
    push('category', book.category)
    push('group', book.group)
    push('publisher', book.publisher)
    push('publishYear', book.publishYear)
    push('rating', book.rating)
    push('ratingCount', book.ratingCount)
    push('readingProgress', book.readingProgress)
    push(
      'isFinished',
      book.finishReading === undefined || book.finishReading === null
        ? ''
        : String(Number(book.finishReading) === 1 || book.finishReading === true),
    )
    push('lastReadTime', formatDay(book.readUpdateTime))
    push('lastNoteTime', formatDay(book.lastNoteTime))
  }
  push('exportedAt', nowIso)
  pushRaw('excerptCount', stats.excerpts)
  pushRaw('thoughtCount', stats.thoughts)
  pushRaw('containsAI', false)
  push('exportId', stats.exportId)
  push('contentHash', stats.contentHash)
  fields.push(['tags', yamlList(['微信读书', book.group || ''])])
  return fields
}

function hashOf(fields, body) {
  const stable = fields
    .filter(([key]) => key !== 'exportedAt' && key !== 'contentHash')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
  return `sha256:${sha256Hex(`${stable}\n\n${body}`)}`
}

function exportFileName(books, total) {
  if (books.length === 1) {
    const book = books[0]
    const title = safeSegment(book.title, `书 ${book.bookId || ''}`.trim())
    const author = safeSegment(book.author, '')
    return author === '' ? `${title}.md` : `${title} - ${author}.md`
  }
  return `数字书房 · 摘录 ${total} 条.md`
}

/**
 * The one exporter. `picked` is `{ books, notes, thoughts }` already narrowed to
 * the selection, so an unselected book can never leak into the file.
 */
function buildExportDocument(picked, optionsInput, nowIso) {
  const options = exportOptions(optionsInput)
  const books = Array.isArray(picked.books) ? picked.books : []
  if (books.length === 0) throw new Error('没有选中任何书籍')

  const notesByBook = new Map()
  for (const note of picked.notes || []) {
    const key = String(note.bookId || '')
    if (!notesByBook.has(key)) notesByBook.set(key, [])
    notesByBook.get(key).push(note)
  }
  const thoughtsByBook = new Map()
  for (const thought of picked.thoughts || []) {
    const key = String(thought.bookId || '')
    if (!thoughtsByBook.has(key)) thoughtsByBook.set(key, [])
    thoughtsByBook.get(key).push(thought)
  }

  const single = books.length === 1
  const chunks = []
  let excerpts = 0
  let thoughts = 0
  for (const book of books) {
    const key = String(book.bookId || '')
    const bookNotes = notesByBook.get(key) || []
    const bookThoughts = thoughtsByBook.get(key) || []
    if (options.excerpts) excerpts += bookNotes.length
    if (options.thoughts) thoughts += bookThoughts.length
    chunks.push(renderBook(book, bookNotes, bookThoughts, options, single ? 1 : 1, !single))
  }
  const body = chunks.filter((chunk) => chunk.trim() !== '').join('\n\n---\n\n')
  if (body.trim() === '') throw new Error('选中的内容里没有可导出的划线或想法')

  if (single) {
    const book = books[0]
    const stats = { excerpts, thoughts, exportId: `weread:book/${book.bookId}`, contentHash: '' }
    const fields = bookFrontMatter(book, stats, options, nowIso)
    stats.contentHash = hashOf(fields, body)
    const finalFields = bookFrontMatter(book, stats, options, nowIso)
    return {
      markdown: `${frontMatterLines(finalFields).join('\n')}\n\n${body}\n`,
      filename: exportFileName(books, excerpts + thoughts),
      exportId: stats.exportId,
      contentHash: stats.contentHash,
      excerpts,
      thoughts,
      books: 1,
    }
  }

  const stats = { exportId: 'weread:selection/pending', contentHash: '' }
  const fields = [
    ['title', yamlText('数字书房 · 摘录导出')],
    ['source', yamlText('weread')],
    ['bookCount', String(books.length)],
    ['excerptCount', String(excerpts)],
    ['thoughtCount', String(thoughts)],
    ['exportedAt', yamlText(nowIso)],
    ['containsAI', 'false'],
    ['exportId', yamlText(stats.exportId)],
    ['contentHash', yamlText(stats.contentHash)],
    ['tags', yamlList(['微信读书', '摘录'])],
  ]
  const hash = hashOf(fields, body)
  stats.contentHash = hash
  stats.exportId = `weread:selection/${hash.replace('sha256:', '').slice(0, 8)}`
  const finalFields = fields.map(([key, value]) => {
    if (key === 'exportId') return [key, yamlText(stats.exportId)]
    if (key === 'contentHash') return [key, yamlText(stats.contentHash)]
    return [key, value]
  })
  return {
    markdown: `${frontMatterLines(finalFields).join('\n')}\n\n${body}\n`,
    filename: exportFileName(books, excerpts + thoughts),
    exportId: stats.exportId,
    contentHash: stats.contentHash,
    excerpts,
    thoughts,
    books: books.length,
  }
}

// --------------------------------------------------------------- sync planning

const notebookSorted = (a, b) => Number(b.lastNoteTime || 0) - Number(a.lastNoteTime || 0)

/**
 * Decide which notebooks need their highlights re-read.
 *
 * A book is re-read when we have never recorded it, when its newest note moved,
 * or when either note counter changed. Everything else is skipped and its old
 * entries are carried over from `data.json` instead of being downloaded again.
 */
function planBookRefresh(previous, notebooks, options = {}) {
  const full = options.full === true
  const known = isObject(previous) ? previous : {}
  const refresh = []
  const skipped = []
  for (const notebook of notebooks) {
    if (!notebook || !notebook.bookId) continue
    const before = isObject(known[notebook.bookId]) ? known[notebook.bookId] : null
    const changed =
      full ||
      before === null ||
      Number(notebook.lastNoteTime || 0) > Number(before.lastNoteTime || 0) ||
      Number(notebook.noteCount || 0) !== Number(before.noteCount || 0) ||
      Number(notebook.reviewCount || 0) !== Number(before.reviewCount || 0)
    if (changed) refresh.push(notebook)
    else skipped.push(notebook.bookId)
  }
  return { refresh, skipped, full }
}

/** Carry over the entries of books we are not re-reading this round. */
function mergeCarriedEntries(previous, keepBookIds, refreshBookIds) {
  const keep = keepBookIds instanceof Set ? keepBookIds : new Set(keepBookIds || [])
  const refresh = refreshBookIds instanceof Set ? refreshBookIds : new Set(refreshBookIds || [])
  const notes = []
  const thoughts = []
  if (!isObject(previous)) return { notes, thoughts }
  for (const note of Array.isArray(previous.notes) ? previous.notes : []) {
    if (keep.has(note.bookId) && !refresh.has(note.bookId)) notes.push(note)
  }
  for (const thought of Array.isArray(previous.thoughts) ? previous.thoughts : []) {
    if (keep.has(thought.bookId) && !refresh.has(thought.bookId)) thoughts.push(thought)
  }
  return { notes, thoughts }
}

function createHost(options) {
  const dir = join(dshHome(), 'weread-gather')
  const configPath = join(dir, 'config.json')
  const dataPath = join(dir, 'data.json')
  const metaPath = join(dir, 'meta.json')
  const heatPath = join(dir, 'heat.json')
  const syncStatePath = join(dir, 'sync-state.json')

  let config = readJsonFile(configPath, {})
  if (!isObject(config)) config = {}
  let dataset = readJsonFile(dataPath, null)
  if (!isObject(dataset)) dataset = null
  // Grouping is derived, not stored: an older dataset gets buckets on load
  // without a re-sync.
  else decorateDataset(dataset)
  /** bookId -> { v, category, intro, publisher, publishYear, rating, ratingCount, at, failed } */
  let meta = readJsonFile(metaPath, {})
  if (!isObject(meta)) meta = {}
  /** "2026" -> { at, days: { "2026-01-02": seconds } } */
  let heatCache = readJsonFile(heatPath, {})
  if (!isObject(heatCache)) heatCache = {}
  /** Sync bookkeeping: what the notebook list looked like when we last read it. */
  let syncState = readJsonFile(syncStatePath, null)
  if (!isObject(syncState) || Number(syncState.version) !== SYNC_STATE_VERSION) {
    syncState = { version: SYNC_STATE_VERSION, lastSyncAt: 0, lastFullAt: 0, dashboardAt: {}, books: {} }
  }
  if (!isObject(syncState.books)) syncState.books = {}
  if (!isObject(syncState.dashboardAt)) syncState.dashboardAt = {}

  let job = null

  const envKey = typeof process.env.WEREAD_API_KEY === 'string' ? process.env.WEREAD_API_KEY.trim() : ''
  const settings = () => {
    const stored = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
    return {
      apiKey: stored || envKey,
      fromEnv: stored === '' && envKey !== '',
      maxBooks: clampInt(config.maxBooks, DEFAULT_MAX_BOOKS, 5, 300),
      notesPerBook: clampInt(config.notesPerBook, DEFAULT_NOTES_PER_BOOK, 20, 2000),
      metaLimit: clampInt(config.metaLimit, DEFAULT_META_LIMIT, 0, 2000),
      autoSync: config.autoSync === true,
    }
  }

  function clampInt(value, fallback, min, max) {
    const number = Number(value)
    if (!Number.isFinite(number)) return fallback
    return Math.min(max, Math.max(min, Math.round(number)))
  }

  function maskKey(key) {
    if (!key) return ''
    if (key.length <= 8) return '****'
    return `${key.slice(0, 4)}…${key.slice(-4)}`
  }

  function saveConfig(patch) {
    config = { ...config, ...patch }
    writeJsonFile(configPath, config)
  }

  function saveDataset(next) {
    dataset = next
    writeJsonFile(dataPath, next)
  }

  function saveMeta() {
    try {
      writeJsonFile(metaPath, meta)
    } catch {
      // The metadata cache is an optimisation: a failed write only costs requests.
    }
  }

  function saveHeat() {
    try {
      writeJsonFile(heatPath, heatCache)
    } catch {
      // Same trade-off as meta.json: the cache only saves gateway calls.
    }
  }

  function saveSyncState() {
    try {
      writeJsonFile(syncStatePath, syncState)
    } catch {
      // Losing the ledger only costs a slower sync next time; never fail a sync.
    }
  }

  // ------------------------------------------------------------------ exports

  const defaultExportDir = join(dir, 'exports')

  function exportDirPath() {
    const custom = typeof config.exportDir === 'string' ? config.exportDir.trim() : ''
    return custom === '' ? defaultExportDir : custom
  }

  function exportDirectory() {
    const target = exportDirPath()
    return { dir: target, exists: existsSync(target) }
  }

  /** Point exports elsewhere, and prove the folder is writable before saving it. */
  function setExportDir(value) {
    const text = String(value ?? '').trim()
    if (text === '') {
      saveConfig({ exportDir: '' })
      return exportDirectory()
    }
    mkdirSync(text, { recursive: true })
    const probe = join(text, `.weread-gather-${Date.now()}.tmp`)
    try {
      writeFileSync(probe, 'ok', 'utf8')
    } finally {
      try {
        unlinkSync(probe)
      } catch {
        // A leftover probe file is harmless; the write above already proved access.
      }
    }
    saveConfig({ exportDir: text })
    return exportDirectory()
  }

  /** Selection -> exactly the books and entries an export is allowed to see. */
  function selectEntries(selector = {}) {
    const current = dataset
    if (current === null) throw new Error('还没有同步数据')
    const books = Array.isArray(current.books) ? current.books : []
    const allNotes = Array.isArray(current.notes) ? current.notes : []
    const allThoughts = Array.isArray(current.thoughts) ? current.thoughts : []

    const bookIds = Array.isArray(selector.bookIds) ? selector.bookIds.map(String).filter((id) => id !== '') : []
    const noteIds = Array.isArray(selector.noteIds) ? selector.noteIds.map(String) : []
    const thoughtIds = Array.isArray(selector.thoughtIds) ? selector.thoughtIds.map(String) : []
    const bookScope = new Set(bookIds)
    // An empty selector must never mean "everything": a mis-wired button would then
    // dump the whole library into one file.
    if (bookScope.size === 0 && noteIds.length === 0 && thoughtIds.length === 0) {
      throw new Error('没有选择任何内容，先勾选要导出的书或条目')
    }

    const pick = (list, ids) => {
      if (ids.length > 0) {
        const wanted = new Set(ids)
        return list.filter((entry) => wanted.has(String(entry.id)))
      }
      if (bookScope.size > 0) return list.filter((entry) => bookScope.has(String(entry.bookId)))
      return list
    }
    const notes = pick(allNotes, noteIds)
    const thoughts = pick(allThoughts, thoughtIds)

    const ids = new Set(bookScope)
    for (const entry of notes) ids.add(String(entry.bookId))
    for (const entry of thoughts) ids.add(String(entry.bookId))

    const picked = books.filter((book) => ids.has(String(book.bookId)))
    const known = new Set(picked.map((book) => String(book.bookId)))
    // A book can leave the shelf while its highlights stay behind: keep the export
    // usable with only the fields the entry itself carries, and invent nothing.
    for (const id of ids) {
      if (known.has(id)) continue
      const sample =
        notes.find((entry) => String(entry.bookId) === id) || thoughts.find((entry) => String(entry.bookId) === id)
      if (sample) picked.push({ bookId: id, title: sample.bookTitle || '', author: sample.author || '' })
    }
    return { books: picked, notes, thoughts }
  }

  function runExport(selector, options, mode) {
    const picked = selectEntries(isObject(selector) ? selector : {})
    if (picked.notes.length + picked.thoughts.length > EXPORT_ENTRY_LIMIT) {
      throw new Error(`一次最多导出 ${EXPORT_ENTRY_LIMIT} 条，请先缩小范围`)
    }
    const document = buildExportDocument(picked, options, formatNowIso())
    const base = { ...document, bytes: Buffer.byteLength(document.markdown, 'utf8'), saved: false, dir: exportDirPath() }
    if (mode !== 'file') return base

    const target = exportDirPath()
    mkdirSync(target, { recursive: true })
    const stem = document.filename.replace(/\.md$/i, '')
    let path = join(target, `${stem}.md`)
    for (let index = 2; existsSync(path); index += 1) {
      if (index > 999) throw new Error('导出目录里同名文件太多，请换一个目录')
      path = join(target, `${stem}-${index}.md`)
    }
    writeFileSync(path, document.markdown, 'utf8')
    return { ...base, saved: true, path }
  }

  // ------------------------------------------------------------------- backup

  function pluginBackup() {
    const safeConfig = { ...config }
    delete safeConfig.apiKey
    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      pluginVersion: pluginVersion(),
      exportedAt: formatNowIso(),
      apiKeyOmitted: true,
      counts: counts(),
      files: {
        'config.json': safeConfig,
        'data.json': dataset,
        'meta.json': meta,
        'heat.json': heatCache,
        'sync-state.json': syncState,
      },
    }
  }

  /** Restoring never touches the live key: a backup must not be able to erase it. */
  function restoreBackup(input) {
    const bundle = isObject(input) ? input : {}
    if (bundle.format !== BACKUP_FORMAT) throw new Error('不是数字书房导出的备份包')
    const files = isObject(bundle.files) ? bundle.files : {}
    const incoming = files['data.json']
    if (!isObject(incoming) || !Array.isArray(incoming.books)) throw new Error('备份包里缺少合法的 data.json')

    const stamp = new Date()
    const folder = join(
      dir,
      'backups',
      `${stamp.getFullYear()}${pad2(stamp.getMonth() + 1)}${pad2(stamp.getDate())}-${pad2(stamp.getHours())}${pad2(stamp.getMinutes())}${pad2(stamp.getSeconds())}`,
    )
    mkdirSync(folder, { recursive: true })
    const keptFiles = []
    for (const [name, path] of [
      ['config.json', configPath],
      ['data.json', dataPath],
      ['meta.json', metaPath],
      ['heat.json', heatPath],
    ]) {
      if (existsSync(path)) {
        copyFileSync(path, join(folder, name))
        keptFiles.push(name)
      }
    }

    const restored = []
    dataset = decorateDataset({ ...incoming })
    writeJsonFile(dataPath, dataset)
    restored.push('data.json')

    if (isObject(files['config.json'])) {
      const next = { ...files['config.json'] }
      delete next.apiKey
      if (typeof config.apiKey === 'string' && config.apiKey !== '') next.apiKey = config.apiKey
      config = next
      writeJsonFile(configPath, config)
      restored.push('config.json')
    }
    if (isObject(files['meta.json'])) {
      meta = files['meta.json']
      writeJsonFile(metaPath, meta)
      restored.push('meta.json')
    }
    if (isObject(files['heat.json'])) {
      heatCache = files['heat.json']
      saveHeat()
      restored.push('heat.json')
    }
    // Optional: older bundles (1.0.0 / 1.1.0) have no ledger. Keep ours instead of
    // resetting it, otherwise the next sync would silently become a full one.
    if (isObject(files['sync-state.json'])) {
      const incomingState = files['sync-state.json']
      if (Number(incomingState.version) === SYNC_STATE_VERSION && isObject(incomingState.books)) {
        syncState = incomingState
        if (!isObject(syncState.dashboardAt)) syncState.dashboardAt = {}
        saveSyncState()
        restored.push('sync-state.json')
      }
    }
    return { restored, keptBackup: folder, keptFiles, counts: counts() }
  }

  /** Years that carry reading time, newest first: `[{ year, total }]`. */
  function readingYears() {
    const dashboard = dataset && isObject(dataset.dashboard) ? dataset.dashboard : {}
    const overall = isObject(dashboard.overall) ? dashboard.overall : {}
    const readTimes = isObject(overall.readTimes) ? overall.readTimes : {}
    const totals = new Map()
    for (const [key, value] of Object.entries(readTimes)) {
      const stamp = Number(key)
      if (!Number.isFinite(stamp) || stamp <= 0) continue
      const year = new Date(stamp * 1000).getFullYear()
      if (year < 2000 || year > 2100) continue
      totals.set(year, (totals.get(year) || 0) + (Number(value) || 0))
    }
    return Array.from(totals.entries())
      .filter(([, total]) => total > 0)
      .map(([year, total]) => ({ year, total }))
      .sort((a, b) => b.year - a.year)
  }

  /**
   * One calendar year of reading data: daily seconds for the heatmap plus the
   * `/readdata/detail?mode=annually` payload that feeds every figure on the
   * overview page (totals, readStat, categories, longest reads, authors).
   * A finished year is cached permanently; the live year is refreshed every
   * HEAT_TTL.
   */
  async function loadHeat(year) {
    const today = new Date()
    const target = clampInt(year, today.getFullYear(), 2000, 2100)
    const cached = heatCache[String(target)]
    const immutable = target < today.getFullYear()
    const fresh =
      isObject(cached) &&
      isObject(cached.days) &&
      isObject(cached.annual) &&
      Number(cached.v) === HEAT_CACHE_VERSION &&
      (immutable || nowSeconds() - (Number(cached.at) || 0) < HEAT_TTL)
    if (fresh) return { year: target, days: cached.days, annual: cached.annual, cached: true }

    const current = settings()
    if (current.apiKey === '') throw new Error('还没有配置微信读书 API Key')
    const months = []
    for (let month = 0; month < 12; month += 1) {
      months.push(Math.floor(new Date(target, month, 1, 0, 0, 0).getTime() / 1000))
    }
    const days = {}
    let annual = null
    const results = await mapLimit(months.concat([null]), HEAT_CONCURRENCY, async (baseTime) => {
      if (baseTime === null) {
        const payload = await gateway(
          current.apiKey,
          '/readdata/detail',
          { mode: 'annually', baseTime: Math.floor(new Date(target, 0, 1, 0, 0, 0).getTime() / 1000) },
          AbortSignal.timeout(90_000),
        )
        annual = trimReadData(payload)
        return null
      }
      const payload = await gateway(current.apiKey, '/readdata/detail', { mode: 'monthly', baseTime }, AbortSignal.timeout(90_000))
      const readTimes = isObject(payload.readTimes) ? payload.readTimes : {}
      for (const [key, value] of Object.entries(readTimes)) {
        const seconds = Number(value) || 0
        const stamp = Number(key)
        if (seconds <= 0 || !Number.isFinite(stamp)) continue
        days[key] = (days[key] || 0) + seconds
      }
      return null
    })
    const failure = results.find((item) => item && item.error)
    if (annual === null && Object.keys(days).length === 0) {
      throw new Error(String(failure && failure.error ? failure.error : '读取年度数据失败'))
    }
    if (annual !== null) {
      heatCache[String(target)] = { v: HEAT_CACHE_VERSION, at: nowSeconds(), days, annual }
      saveHeat()
    }
    return { year: target, days, annual, cached: false }
  }

  /** True when this book still needs a `/book/info` lookup. */
  function needsMeta(bookId) {
    const hit = meta[bookId]
    if (!isObject(hit)) return true
    if ((Number(hit.v) || 0) !== META_VERSION) return true
    if (hit.failed === true) return nowSeconds() - (Number(hit.at) || 0) > META_RETRY_AFTER
    return false
  }

  /** Copy cached metadata onto a shelf book, keeping any value already known. */
  function applyMeta(book) {
    const hit = meta[book.bookId]
    if (!isObject(hit) || hit.failed === true) return book
    if (!book.category && hit.category) book.category = hit.category
    if (!book.intro && hit.intro) book.intro = hit.intro
    if (!book.publisher && hit.publisher) book.publisher = hit.publisher
    book.rating = Number(book.rating) || Number(hit.rating) || 0
    book.ratingCount = Number(book.ratingCount) || Number(hit.ratingCount) || 0
    if (!book.publishYear && hit.publishYear) book.publishYear = String(hit.publishYear)
    return book
  }

  function counts() {
    if (!dataset) return { books: 0, notes: 0, thoughts: 0, booksWithNotes: 0 }
    const notes = Array.isArray(dataset.notes) ? dataset.notes.length : 0
    const thoughts = Array.isArray(dataset.thoughts) ? dataset.thoughts.length : 0
    const books = Array.isArray(dataset.books) ? dataset.books.length : 0
    return {
      books,
      notes,
      thoughts,
      booksWithNotes: Array.isArray(dataset.books) ? dataset.books.filter((b) => (b.noteCount || 0) + (b.reviewCount || 0) > 0).length : 0,
    }
  }

  function status() {
    const current = settings()
    return {
      ok: true,
      version: pluginVersion(),
      configured: current.apiKey !== '',
      fromEnv: current.fromEnv,
      maskedKey: maskKey(current.apiKey),
      hasData: dataset !== null,
      updatedAt: dataset ? dataset.updatedAt || 0 : 0,
      counts: counts(),
      maxBooks: current.maxBooks,
      notesPerBook: current.notesPerBook,
      metaLimit: current.metaLimit,
      dir,
      exportDir: exportDirPath(),
      sync: job === null ? { running: false } : { ...job, apiKey: undefined },
    }
  }

  async function sync(options = {}) {
    const current = settings()
    if (current.apiKey === '') {
      const error = new Error('尚未配置微信读书 API Key')
      error.statusCode = 400
      throw error
    }
    if (job && job.running) return status()

    const maxBooks = clampInt(options.maxBooks, current.maxBooks, 5, 300)
    const signal = AbortSignal.timeout(600_000)
    job = {
      running: true,
      phase: 'shelf',
      label: '同步书架',
      done: 0,
      total: 0,
      message: '',
      error: '',
      startedAt: nowSeconds(),
      finishedAt: 0,
    }
    const warnings = []
    // Incremental bookkeeping. `full` (or having no ledger at all) falls back to
    // the 1.1.0 behaviour of reading everything.
    const full = options.full === true
    const previousState = syncState
    const previousDataset = dataset
    const lastSyncAt = Number(previousState.lastSyncAt) || 0
    const effectiveFull = full || lastSyncAt === 0 || !isObject(previousDataset)

    try {
      // 1. Shelf ------------------------------------------------------------
      const shelf = await gateway(current.apiKey, '/shelf/sync', {}, signal)
      const shelfBooks = Array.isArray(shelf.books) ? shelf.books.slice(0, MAX_SHELF_BOOKS) : []
      const albums = Array.isArray(shelf.albums) ? shelf.albums : []
      const archive = Array.isArray(shelf.archive) ? shelf.archive : []

      const books = new Map()
      for (const raw of shelfBooks) {
        const bookId = String(raw.bookId || '')
        if (bookId === '') continue
        books.set(bookId, {
          bookId,
          title: raw.title || '未命名',
          author: raw.author || '',
          cover: raw.cover || '',
          category: raw.category || '',
          readUpdateTime: Number(raw.readUpdateTime) || 0,
          finishReading: Number(raw.finishReading) || 0,
          isTop: Number(raw.isTop) || 0,
          secret: Number(raw.secret) || 0,
          updateTime: Number(raw.updateTime) || 0,
          kind: 'book',
          noteCount: 0,
          reviewCount: 0,
          bookmarkCount: 0,
          readingProgress: 0,
          lastNoteTime: 0,
        })
      }

      for (const raw of albums) {
        const info = isObject(raw.albumInfo) ? raw.albumInfo : {}
        const extra = isObject(raw.albumInfoExtra) ? raw.albumInfoExtra : {}
        const albumId = String(info.albumId || '')
        if (albumId === '') continue
        books.set(`album:${albumId}`, {
          bookId: `album:${albumId}`,
          title: info.name || '未命名专辑',
          author: info.authorName || '',
          cover: info.cover || '',
          category: '有声书',
          readUpdateTime: Number(extra.lectureReadUpdateTime) || Number(info.updateTime) || 0,
          finishReading: Number(info.finish) || 0,
          isTop: Number(extra.isTop) || 0,
          secret: Number(extra.secret) || 0,
          updateTime: Number(info.updateTime) || 0,
          kind: 'album',
          trackCount: Number(info.trackCount) || 0,
          intro: info.intro || '',
          noteCount: 0,
          reviewCount: 0,
          bookmarkCount: 0,
          readingProgress: 0,
          lastNoteTime: 0,
        })
      }

      // 2. Notebook overview -------------------------------------------------
      job.phase = 'notebooks'
      job.label = '同步笔记本清单'
      job.message = ''
      const notebooks = []
      let lastSort = 0
      for (let page = 0; page < MAX_NOTEBOOK_PAGES; page += 1) {
        const payload = await gateway(current.apiKey, '/user/notebooks', lastSort ? { count: 100, lastSort } : { count: 100 }, signal)
        const pageBooks = Array.isArray(payload.books) ? payload.books : []
        for (const entry of pageBooks) {
          const normalized = normalizeNotebookBook(entry)
          if (normalized !== null) notebooks.push(normalized)
        }
        const hasMore = Number(payload.hasMore) === 1 || payload.hasMore === true
        const last = pageBooks[pageBooks.length - 1]
        const nextSort = last && Number(last.sort) ? Number(last.sort) : 0
        if (!hasMore || nextSort === 0 || nextSort === lastSort) break
        lastSort = nextSort
        job.message = `已读取 ${notebooks.length} 本有笔记的书`
        // Paging must not stop early: this list is also where books that the
        // capped shelf slice dropped come from, so a partial list would shrink
        // the catalogue. It is only ~5 cheap requests anyway.
      }

      for (const notebook of notebooks) {
        const existing = books.get(notebook.bookId)
        if (existing) {
          existing.noteCount = notebook.noteCount
          existing.reviewCount = notebook.reviewCount
          existing.bookmarkCount = notebook.bookmarkCount
          existing.readingProgress = notebook.readingProgress
          existing.lastNoteTime = notebook.lastNoteTime
          if (!existing.category && notebook.category) existing.category = notebook.category
          if (!existing.cover && notebook.cover) existing.cover = notebook.cover
          if (!existing.author && notebook.author) existing.author = notebook.author
        } else {
          books.set(notebook.bookId, { ...notebook, kind: 'book', readUpdateTime: notebook.lastNoteTime, finishReading: notebook.markedStatus === 1 ? 1 : 0, isTop: 0, secret: 0, updateTime: 0 })
        }
      }

      // 3. Reading dashboard -------------------------------------------------
      job.phase = 'dashboard'
      job.label = '同步阅读统计'
      const dashboard = {}
      const previousDashboard = previousDataset && isObject(previousDataset.dashboard) ? previousDataset.dashboard : {}
      const now = nowSeconds()
      for (const mode of ['weekly', 'monthly', 'annually', 'overall']) {
        const cached = previousDashboard[mode]
        const cachedAt = Number(previousState.dashboardAt[mode]) || 0
        const reusable = !effectiveFull && isObject(cached) && now - cachedAt < DASHBOARD_TTL
        if (reusable) {
          dashboard[mode] = cached
          continue
        }
        try {
          dashboard[mode] = trimReadData(await gateway(current.apiKey, '/readdata/detail', { mode }, signal))
          syncState.dashboardAt[mode] = now
        } catch (error) {
          if (isObject(cached)) dashboard[mode] = cached
          warnings.push(`阅读统计(${mode}): ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // 3b. Book metadata (category / intro / rating / word count) ----------
      // `/shelf/sync` leaves `category` empty for most titles, so the shelf
      // would otherwise collapse into a single "未分类" bucket. `/book/info`
      // answers one book at a time; every answer is cached in meta.json and a
      // failed lookup is only retried after a week.
      job.phase = 'meta'
      job.label = '补全书籍信息'
      job.message = ''
      job.done = 0
      job.total = 0
      const metaLimit = clampInt(options.metaLimit, current.metaLimit, 0, 2000)
      for (const book of books.values()) applyMeta(book)
      const pendingMeta =
        metaLimit <= 0
          ? []
          : Array.from(books.values())
              .filter((book) => book.kind === 'book' && needsMeta(book.bookId))
              .slice(0, metaLimit)
      job.total = pendingMeta.length
      if (pendingMeta.length > 0) job.message = `待补全 ${pendingMeta.length} 本`
      await mapLimit(pendingMeta, META_CONCURRENCY, async (book) => {
        try {
          const info = await gateway(current.apiKey, '/book/info', { bookId: book.bookId }, signal)
          const publishTime = String(info.publishTime || '')
          meta[book.bookId] = {
            v: META_VERSION,
            category: String(info.category || '').trim(),
            intro: String(info.intro || '').trim(),
            publisher: String(info.publisher || '').trim(),
            publishYear: (/^(\d{4})/.exec(publishTime) || [])[1] || '',
            rating: Number(info.newRating) || 0,
            ratingCount: Number(info.newRatingCount) || 0,
            at: nowSeconds(),
          }
        } catch {
          meta[book.bookId] = { v: META_VERSION, failed: true, at: nowSeconds() }
        }
        job.done += 1
        if (job.done % 25 === 0) job.message = `已补全 ${job.done}/${pendingMeta.length} 本`
        return null
      })
      if (pendingMeta.length > 0) saveMeta()
      for (const book of books.values()) applyMeta(book)

      // 4. Per-book highlights and thoughts ---------------------------------
      job.phase = 'notes'
      job.label = '同步笔记与想法'
      const withNotes = notebooks.filter((n) => n.noteCount + n.reviewCount > 0).sort(notebookSorted)
      const plan = planBookRefresh(previousState.books, withNotes, { full: effectiveFull })
      const candidates = plan.refresh.slice(0, maxBooks)
      // Books beyond the per-sync cap keep their old entries; they are simply not
      // part of the refresh set.
      const refreshIds = new Set(candidates.map((n) => n.bookId))
      const keepIds = new Set(books.keys())
      // A book whose counters dropped to zero has lost its entries: dropping the
      // old rows is the only way the next view matches WeRead.
      const emptiedIds = new Set(notebooks.filter((n) => n.noteCount + n.reviewCount === 0).map((n) => n.bookId))
      const carried = mergeCarriedEntries(previousDataset, keepIds, new Set([...refreshIds, ...emptiedIds]))
      job.total = candidates.length
      job.done = 0
      job.updated = candidates.length
      job.skipped = withNotes.length - candidates.length
      if (job.skipped > 0) job.message = `更新 ${candidates.length} 本 · 跳过 ${job.skipped} 本`

      const notes = carried.notes
      const thoughts = carried.thoughts
      // Pre-fill the ledger for every notebook so the next sync can tell
      // "unchanged" from "never looked at". `read` remembers that a book's
      // highlights were actually downloaded once: books the per-sync cap has
      // never reached keep `read:false`, which is what the pending count shows
      // (1.1.0 only ever had highlights for the newest N books anyway).
      for (const notebook of withNotes) {
        const previousRow = isObject(syncState.books[notebook.bookId]) ? syncState.books[notebook.bookId] : null
        syncState.books[notebook.bookId] = {
          lastNoteTime: Number(notebook.lastNoteTime) || 0,
          noteCount: Number(notebook.noteCount) || 0,
          reviewCount: Number(notebook.reviewCount) || 0,
          syncedAt: nowSeconds(),
          read: previousRow !== null && (previousRow.read === true || previousRow.done === true),
        }
      }
      const results = await mapLimit(candidates, 4, async (notebook) => {
        const collectedNotes = []
        const collectedThoughts = []
        try {
          const bookmarkPayload = await gateway(current.apiKey, '/book/bookmarklist', { bookId: notebook.bookId }, signal)
          const chapters = new Map()
          if (Array.isArray(bookmarkPayload.chapters)) {
            for (const chapter of bookmarkPayload.chapters) {
              if (chapter && chapter.chapterUid !== undefined) chapters.set(String(chapter.chapterUid), chapter.title || '')
            }
          }
          const updated = Array.isArray(bookmarkPayload.updated) ? bookmarkPayload.updated : []
          for (const item of updated.slice(0, current.notesPerBook)) {
            const note = normalizeBookmark(item, chapters)
            if (note.text !== '') collectedNotes.push(note)
          }
        } catch (error) {
          throw new Error(`划线(${notebook.title}): ${error instanceof Error ? error.message : String(error)}`)
        }
        try {
          let synckey = 0
          for (let page = 0; page < THOUGHT_MAX_PAGES; page += 1) {
            const payload = await gateway(current.apiKey, '/review/list/mine', { bookid: notebook.bookId, count: THOUGHT_PAGE_SIZE, ...(synckey ? { synckey } : {}) }, signal)
            const reviews = Array.isArray(payload.reviews) ? payload.reviews : []
            for (const item of reviews) {
              const thought = normalizeThought(item, notebook.bookId)
              if (thought !== null) collectedThoughts.push(thought)
            }
            const hasMore = Number(payload.hasMore) === 1 || payload.hasMore === true
            const nextKey = Number(payload.synckey) || 0
            if (!hasMore || nextKey === 0 || nextKey === synckey) break
            synckey = nextKey
          }
        } catch (error) {
          throw new Error(`想法(${notebook.title}): ${error instanceof Error ? error.message : String(error)}`)
        }
        return { notes: collectedNotes, thoughts: collectedThoughts }
      })

      results.forEach((result, index) => {
        const notebook = candidates[index]
        if (result && result.error) {
          warnings.push(result.error)
          // Drop the ledger row so the next sync retries this book instead of
          // remembering a half-finished state.
          delete syncState.books[notebook.bookId]
          return
        }
        if (!result) return
        for (const note of result.notes) notes.push({ ...note, bookTitle: notebook.title, author: notebook.author, cover: notebook.cover })
        for (const thought of result.thoughts) thoughts.push({ ...thought, bookTitle: notebook.title, author: notebook.author, cover: notebook.cover })
        const entry = syncState.books[notebook.bookId]
        if (isObject(entry)) entry.read = true
        job.done += 1
      })

      // 5. Persist -----------------------------------------------------------
      job.phase = 'save'
      job.label = '写入本地书房'
      const bookList = Array.from(books.values())
      const next = decorateDataset({
        version: SCHEMA_VERSION,
        updatedAt: nowSeconds(),
        books: bookList.sort((a, b) => (b.readUpdateTime || b.lastNoteTime) - (a.readUpdateTime || a.lastNoteTime)),
        categories: [],
        archives: archive
          .map((item) => ({ name: item.name || '未命名书单', bookIds: Array.isArray(item.bookIds) ? item.bookIds.map(String) : [] }))
          .filter((item) => item.bookIds.length > 0),
        shelfTotal: shelfBooks.length + albums.length + (isObject(shelf.mp) && Object.keys(shelf.mp).length > 0 ? 1 : 0),
        notes: notes.sort((a, b) => b.createTime - a.createTime),
        thoughts: thoughts.sort((a, b) => b.createTime - a.createTime),
        dashboard,
        warnings: warnings.slice(0, 20),
      })
      saveDataset(next)

      // 6. Ledger -----------------------------------------------------------
      // Forget books that left the shelf so the file cannot grow forever.
      for (const bookId of Object.keys(syncState.books)) {
        if (!keepIds.has(bookId)) delete syncState.books[bookId]
      }
      const pendingBooks = withNotes.filter((n) => {
        const row = syncState.books[n.bookId]
        return isObject(row) && row.read !== true
      }).length
      if (pendingBooks > 0) job.pending = pendingBooks
      syncState.version = SYNC_STATE_VERSION
      syncState.lastSyncAt = nowSeconds()
      if (effectiveFull) syncState.lastFullAt = syncState.lastSyncAt
      saveSyncState()

      job.running = false
      job.phase = 'done'
      job.label = '同步完成'
      job.message = `更新 ${job.updated || 0} 本 · 跳过 ${job.skipped || 0} 本 · 笔记 ${next.notes.length} 条 · 想法 ${next.thoughts.length} 条`
      job.finishedAt = nowSeconds()
      return status()
    } catch (error) {
      job = {
        running: false,
        phase: 'error',
        label: '同步失败',
        done: 0,
        total: 0,
        message: '',
        error: error instanceof Error ? error.message : String(error),
        startedAt: job ? job.startedAt : nowSeconds(),
        finishedAt: nowSeconds(),
      }
      return status()
    }
  }

  return {
    dir,
    settings,
    saveConfig,
    status,
    sync,
    loadHeat,
    readingYears,
    runExport,
    exportDirectory,
    setExportDir,
    pluginBackup,
    restoreBackup,
    get dataset() {
      return dataset
    },
    counts,
    maskKey,
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      // A restore bundle carries data.json (a few MB), hence the generous cap.
      if (size > 32_000_000) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (text === '') return resolve({})
      try {
        const parsed = JSON.parse(text)
        resolve(isObject(parsed) ? parsed : {})
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, statusCode, payload) {
  if (res.writableEnded) return
  res.writeHead(statusCode, JSON_HEADERS)
  res.end(JSON.stringify(payload))
}

function fail(res, statusCode, message) {
  sendJson(res, statusCode, { ok: false, error: message })
}

/** The one route table; each entry is (relative path, method, handler). */
function makeRoutes(host) {
  async function handle(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    if (!url.pathname.startsWith(ROUTE_PREFIX)) return false
    const route = url.pathname.slice(ROUTE_PREFIX.length) || '/'
    const method = (req.method || 'GET').toUpperCase()

    try {
      if (route === '/state' && method === 'GET') {
        sendJson(res, 200, host.status())
        return true
      }

      if (route === '/data' && method === 'GET') {
        const dataset = host.dataset
        if (dataset === null) {
          sendJson(res, 200, { ok: true, hasData: false, updatedAt: 0, books: [], categories: [], archives: [], notes: [], thoughts: [], dashboard: {}, years: [], warnings: [], counts: { books: 0, notes: 0, thoughts: 0, booksWithNotes: 0 } })
          return true
        }
        sendJson(res, 200, {
          ok: true,
          hasData: true,
          updatedAt: dataset.updatedAt || 0,
          books: dataset.books || [],
          categories: dataset.categories || [],
          archives: dataset.archives || [],
          shelfTotal: dataset.shelfTotal || 0,
          notes: dataset.notes || [],
          thoughts: dataset.thoughts || [],
          dashboard: dataset.dashboard || {},
          years: host.readingYears(),
          warnings: dataset.warnings || [],
          counts: host.counts(),
        })
        return true
      }

      if (route === '/heat' && method === 'GET') {
        const requested = url.searchParams.get('year')
        const year = Number.isFinite(Number(requested ?? '')) && String(requested).trim() !== '' ? Number(requested) : new Date().getFullYear()
        const payload = await host.loadHeat(year)
        sendJson(res, 200, { ok: true, year: payload.year, days: payload.days, annual: payload.annual || null, cached: payload.cached })
        return true
      }

      if (route === '/export' && method === 'POST') {
        const body = await readBody(req)
        const mode = body.mode === 'preview' ? 'preview' : 'file'
        try {
          sendJson(res, 200, { ok: true, ...host.runExport(body.selector, body.options, mode) })
        } catch (error) {
          // Bad selectors and over-limit batches are caller mistakes, not server faults.
          fail(res, 400, error instanceof Error ? error.message : String(error))
        }
        return true
      }

      if (route === '/export/dir' && method === 'GET') {
        sendJson(res, 200, { ok: true, ...host.exportDirectory() })
        return true
      }

      if (route === '/export/dir' && method === 'POST') {
        const body = await readBody(req)
        sendJson(res, 200, { ok: true, ...host.setExportDir(body.dir) })
        return true
      }

      if (route === '/backup' && method === 'GET') {
        sendJson(res, 200, { ok: true, bundle: host.pluginBackup() })
        return true
      }

      if (route === '/restore' && method === 'POST') {
        const body = await readBody(req)
        sendJson(res, 200, { ok: true, ...host.restoreBackup(body.bundle) })
        return true
      }

      if (route === '/sync' && method === 'POST') {
        const body = await readBody(req)
        const before = host.status()
        if (before.sync && before.sync.running) {
          sendJson(res, 202, before)
          return true
        }
        void host.sync(body)
        sendJson(res, 202, host.status())
        return true
      }

      if (route === '/sync' && method === 'GET') {
        sendJson(res, 200, host.status())
        return true
      }

      if (route === '/config' && method === 'POST') {
        const body = await readBody(req)
        const patch = {}
        if (typeof body.apiKey === 'string') {
          const key = body.apiKey.trim()
          if (key !== '' && !/^wrk-/.test(key)) return fail(res, 400, 'API Key 格式应为 wrk-开头的字符串'), true
          patch.apiKey = key
        }
        if (body.maxBooks !== undefined) patch.maxBooks = body.maxBooks
        if (body.notesPerBook !== undefined) patch.notesPerBook = body.notesPerBook
        host.saveConfig(patch)
        host.settings()
        sendJson(res, 200, host.status())
        return true
      }

      if (route === '/reset' && method === 'POST') {
        host.saveConfig({ apiKey: '' })
        sendJson(res, 200, host.status())
        return true
      }

      fail(res, 404, `未知接口 ${method} ${route}`)
      return true
    } catch (error) {
      fail(res, 500, error instanceof Error ? error.message : String(error))
      return true
    }
  }

  return [{ kind: 'prefix', path: ROUTE_PREFIX, handler: (req, res) => { void handle(req, res).then((handled) => { if (!handled) fail(res, 404, 'not found') }) } }]
}

export const inject = ['webServer']

/**
 * Pure helpers exposed for `scripts/export-selftest.cjs`. Nothing here touches
 * the filesystem or the gateway, so importing the module stays side-effect free.
 */
export const __internals = {
  buildExportDocument,
  exportOptions,
  chapterGroups,
  formatStamp,
  safeSegment,
  planBookRefresh,
  mergeCarriedEntries,
}

export function apply(ctx) {
  const host = createHost({})
  try {
    mkdirSync(host.dir, { recursive: true })
  } catch {
    // A read-only home only breaks persistence, not the route surface.
  }
  // Routes must be released when this fiber disposes, otherwise a reload of
  // the package collides with its own leftovers ("duplicate prefix route").
  ctx.effect(() => {
    const disposers = []
    for (const route of makeRoutes(host)) {
      try {
        disposers.push(ctx.webServer.register(route))
      } catch (error) {
        console.warn('[weread-gather] route not mounted', route.path, error instanceof Error ? error.message : error)
      }
    }
    return () => {
      for (const dispose of disposers.splice(0)) {
        try {
          dispose()
        } catch {
          // The route owner is already gone.
        }
      }
    }
  }, 'weread-gather: routes')
}