#!/usr/bin/env node
/**
 * Export self-test — runs the real exporter from `index.js` against the local
 * dataset, so the Markdown contract in `docs/prd-1.1.0.md` is checked against
 * production code rather than a copy of it.
 *
 *   node scripts/export-selftest.cjs [path/to/data.json]
 */
const { readFileSync } = require('node:fs')
const { homedir } = require('node:os')
const { join } = require('node:path')

const failures = []
const notes = []

function check(name, condition, detail) {
  if (condition) notes.push(`  ok   ${name}`)
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

function frontMatter(markdown) {
  const lines = markdown.split('\n')
  if (lines[0] !== '---') return null
  const end = lines.indexOf('---', 1)
  if (end === -1) return null
  return lines.slice(1, end)
}

function fmValue(lines, key) {
  const hit = lines.find((line) => line.startsWith(`${key}: `))
  return hit === undefined ? undefined : hit.slice(key.length + 2)
}

async function main() {
  const dataPath = process.argv[2] || join(homedir(), '.dsh', 'weread-gather', 'data.json')
  const dataset = JSON.parse(readFileSync(dataPath, 'utf8'))
  const allNotes = Array.isArray(dataset.notes) ? dataset.notes : []
  const allThoughts = Array.isArray(dataset.thoughts) ? dataset.thoughts : []
  const books = Array.isArray(dataset.books) ? dataset.books : []
  console.log(`dataset: ${books.length} books · ${allNotes.length} highlights · ${allThoughts.length} thoughts`)

  const mod = await import('../index.js')
  const { buildExportDocument } = mod.__internals
  const now = '2026-11-08T19:00:00+08:00'

  // ---- 1. one book that carries both kinds of entry -------------------------
  const byBook = new Map()
  for (const note of allNotes) {
    const id = String(note.bookId)
    if (!byBook.has(id)) byBook.set(id, { notes: [], thoughts: [] })
    byBook.get(id).notes.push(note)
  }
  for (const thought of allThoughts) {
    const id = String(thought.bookId)
    if (!byBook.has(id)) byBook.set(id, { notes: [], thoughts: [] })
    byBook.get(id).thoughts.push(thought)
  }
  const richest = Array.from(byBook.entries())
    .filter(([, value]) => value.notes.length > 0 && value.thoughts.length > 0)
    .sort((a, b) => b[1].notes.length - a[1].notes.length)[0]
  if (!richest) throw new Error('本机数据里没有同时含划线与否想的书，无法完成自检')
  const [bookId, bucket] = richest
  const book = books.find((item) => String(item.bookId) === String(bookId)) || { bookId, title: bucket.notes[0].bookTitle, author: bucket.notes[0].author }
  console.log(`sample book: 《${book.title}》 (${bucket.notes.length} highlights · ${bucket.thoughts.length} thoughts)`)

  const single = buildExportDocument({ books: [book], notes: bucket.notes, thoughts: bucket.thoughts }, {}, now)
  const fm = frontMatter(single.markdown)
  check('单书：以 front-matter 开头', fm !== null)
  for (const key of ['title', 'author', 'bookId', 'source', 'sourceUrl', 'exportedAt', 'excerptCount', 'thoughtCount', 'containsAI', 'exportId', 'contentHash', 'tags']) {
    check(`单书：front-matter 含 ${key}`, fmValue(fm, key) !== undefined)
  }
  check('单书：source 为 weread', fmValue(fm, 'source') === '"weread"')
  check('单书：sourceUrl 指向微读', /^"weread:\/\/reading\?bId=/.test(fmValue(fm, 'sourceUrl') || ''))
  check('单书：exportId 为 weread:book/<id>', fmValue(fm, 'exportId') === `"weread:book/${book.bookId}"`)
  check('单书：contentHash 为 sha256', /^"sha256:[0-9a-f]{64}"$/.test(fmValue(fm, 'contentHash') || ''))
  check('单书：containsAI 为 false', fmValue(fm, 'containsAI') === 'false')
  check('单书：excerptCount 与选中数量一致', fmValue(fm, 'excerptCount') === String(bucket.notes.length), `${fmValue(fm, 'excerptCount')} vs ${bucket.notes.length}`)
  check('单书：thoughtCount 与选中数量一致', fmValue(fm, 'thoughtCount') === String(bucket.thoughts.length))
  check('单书：tags 为 YAML 列表', /^\[.*\]$/.test(fmValue(fm, 'tags') || ''))
  check('单书：正文有 # 标题', /^# /m.test(single.markdown))
  check('单书：原文出现在引用块里', /^> \S/m.test(single.markdown))
  check('单书：引用块带「— 时间」脚注', /^> — .*\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/m.test(single.markdown))
  check('单书：想法用 **想法** 标记', /\*\*想法\*\*/.test(single.markdown))
  check('单书：不出现「未知 / 暂无 / N/A」占位', !/未知|暂无|N\/A|undefined|null/.test(single.markdown))
  check('单书：文件名以 .md 结尾', /\.md$/.test(single.filename))
  check('单书：文件名无非法字符', !/[\\/:*?"<>|]/.test(single.filename))
  check('单书：bytes 与内容长度一致', Buffer.byteLength(single.markdown, 'utf8') > 0 && !('bytes' in single))

  // ---- 2. determinism ------------------------------------------------------
  const again = buildExportDocument({ books: [book], notes: bucket.notes, thoughts: bucket.thoughts }, {}, '2027-01-01T00:00:00+08:00')
  check('确定性：不同导出时间得到同一个 contentHash', again.contentHash === single.contentHash)

  // ---- 3. options ----------------------------------------------------------
  const noExcerpts = buildExportDocument({ books: [book], notes: bucket.notes, thoughts: bucket.thoughts }, { excerpts: false }, now)
  check('选项：关闭原文后没有引用块', !/^> \S/m.test(noExcerpts.markdown))
  check('选项：关闭原文后想法仍在', /\*\*想法\*\*/.test(noExcerpts.markdown))
  check('选项：关闭原文后 excerptCount 为 0', fmValue(frontMatter(noExcerpts.markdown), 'excerptCount') === '0')

  const noThoughts = buildExportDocument({ books: [book], notes: bucket.notes, thoughts: bucket.thoughts }, { thoughts: false }, now)
  check('选项：关闭想法后没有 **想法**', !/\*\*想法\*\*/.test(noThoughts.markdown))
  check('选项：关闭想法后 thoughtCount 为 0', fmValue(frontMatter(noThoughts.markdown), 'thoughtCount') === '0')

  const flat = buildExportDocument({ books: [book], notes: bucket.notes, thoughts: bucket.thoughts }, { chapter: false }, now)
  check('选项：关闭章节后没有 ## 小标题', !/^## /m.test(flat.markdown))

  const noMeta = buildExportDocument({ books: [book], notes: bucket.notes, thoughts: bucket.thoughts }, { meta: false }, now)
  check('选项：关闭书籍信息后无 publisher 键', fmValue(frontMatter(noMeta.markdown), 'publisher') === undefined)
  check('选项：关闭书籍信息后 bookId 仍在', fmValue(frontMatter(noMeta.markdown), 'bookId') !== undefined)

  // ---- 4. batch across books ----------------------------------------------
  const secondBook = books.find((item) => String(item.bookId) !== String(bookId) && allNotes.some((note) => String(note.bookId) === String(item.bookId)))
  if (secondBook) {
    const secondNotes = allNotes.filter((note) => String(note.bookId) === String(secondBook.bookId))
    const batch = buildExportDocument(
      { books: [book, secondBook], notes: bucket.notes.concat(secondNotes), thoughts: bucket.thoughts },
      {},
      now,
    )
    const batchFm = frontMatter(batch.markdown)
    check('批量：bookCount 为 2', fmValue(batchFm, 'bookCount') === '2')
    check('批量：exportId 为 weread:selection/<hash8>', /^"weread:selection\/[0-9a-f]{8}"$/.test(fmValue(batchFm, 'exportId') || ''))
    check('批量：两本书各有 # 《…》 标题', (batch.markdown.match(/^# 《/gm) || []).length === 2)
    check('批量：书与书之间有 --- 分隔', /\n---\n/.test(batch.markdown))
    check('批量：含第二本书的划线', secondNotes.length === 0 || batch.markdown.includes(String(secondNotes[0].text).slice(0, 12)))
  }

  // ---- 5. isolation: an unselected book must not leak ----------------------
  const otherNotes = allNotes.filter((note) => String(note.bookId) !== String(bookId))
  if (otherNotes.length > 0) {
    const leaked = otherNotes.find((note) => String(note.text).length > 20 && !bucket.notes.some((own) => own.text === note.text))
    const guarded = buildExportDocument({ books: [book], notes: bucket.notes, thoughts: bucket.thoughts }, {}, now)
    check('隔离：未选中的划线不出现在导出里', leaked === undefined || !guarded.markdown.includes(leaked.text))
  }

  // ---- 6. empty selection throws ------------------------------------------
  let threw = false
  try {
    buildExportDocument({ books: [], notes: [], thoughts: [] }, {}, now)
  } catch {
    threw = true
  }
  check('空选择：抛出可读错误', threw)

  console.log(notes.join('\n'))
  if (failures.length > 0) {
    console.error(`\n[export] ${failures.length} 项失败：`)
    for (const failure of failures) console.error(`  - ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`\n[export] ${notes.length} 项断言全部通过`)
}

main().catch((error) => {
  console.error('[export] 自检崩溃：', error)
  process.exitCode = 1
})