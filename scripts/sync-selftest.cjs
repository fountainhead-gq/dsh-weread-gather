// Unit checks for the incremental sync planner (R-03). No network, no data file.
// Usage: node scripts/sync-selftest.cjs
const assert = require('node:assert/strict')
const path = require('node:path')

const results = []
function check(name, fn) {
  try {
    fn()
    results.push({ name, ok: true })
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

const notebook = (bookId, lastNoteTime, noteCount, reviewCount) => ({ bookId, title: `书${bookId}`, lastNoteTime, noteCount, reviewCount })

async function main() {
  const file = path.join(__dirname, '..', 'index.js')
  const { __internals } = await import(`file://${file.replace(/\\/g, '/')}`)
  const { planBookRefresh, mergeCarriedEntries } = __internals
  assert.equal(typeof planBookRefresh, 'function', '__internals 缺少 planBookRefresh')
  assert.equal(typeof mergeCarriedEntries, 'function', '__internals 缺少 mergeCarriedEntries')

  const books = [notebook('a', 1000, 5, 1), notebook('b', 900, 2, 0), notebook('c', 800, 0, 3)]
  const ledger = {
    a: { lastNoteTime: 1000, noteCount: 5, reviewCount: 1 },
    b: { lastNoteTime: 900, noteCount: 2, reviewCount: 0 },
    c: { lastNoteTime: 800, noteCount: 0, reviewCount: 3 },
  }

  check('首次同步（无记账）→ 全部刷新', () => {
    const plan = planBookRefresh({}, books, { full: false })
    assert.equal(plan.refresh.length, 3)
    assert.equal(plan.skipped.length, 0)
  })

  check('记账与清单一致 → 全部跳过', () => {
    const plan = planBookRefresh(ledger, books, { full: false })
    assert.equal(plan.refresh.length, 0)
    assert.equal(plan.skipped.length, 3)
  })

  check('lastNoteTime 变新 → 只刷新那一本', () => {
    const moved = [notebook('a', 1200, 5, 1), books[1], books[2]]
    const plan = planBookRefresh(ledger, moved, { full: false })
    assert.deepEqual(plan.refresh.map((n) => n.bookId), ['a'])
    assert.deepEqual(plan.skipped, ['b', 'c'])
  })

  check('noteCount 变化 → 刷新', () => {
    const grown = [books[0], notebook('b', 900, 7, 0), books[2]]
    const plan = planBookRefresh(ledger, grown, { full: false })
    assert.deepEqual(plan.refresh.map((n) => n.bookId), ['b'])
  })

  check('reviewCount 变化 → 刷新', () => {
    const grown = [books[0], books[1], notebook('c', 800, 0, 9)]
    const plan = planBookRefresh(ledger, grown, { full: false })
    assert.deepEqual(plan.refresh.map((n) => n.bookId), ['c'])
  })

  check('full:true → 忽略记账全部刷新', () => {
    const plan = planBookRefresh(ledger, books, { full: true })
    assert.equal(plan.refresh.length, 3)
    assert.equal(plan.skipped.length, 0)
  })

  check('旧条目搬运：未重拉且在架的书保留', () => {
    const previous = {
      notes: [
        { id: 'n1', bookId: 'a' },
        { id: 'n2', bookId: 'b' },
        { id: 'n3', bookId: 'gone' },
      ],
      thoughts: [
        { id: 't1', bookId: 'a' },
        { id: 't2', bookId: 'c' },
      ],
    }
    const carried = mergeCarriedEntries(previous, new Set(['a', 'b', 'c']), new Set(['a']))
    assert.deepEqual(carried.notes.map((n) => n.id), ['n2'])
    assert.deepEqual(carried.thoughts.map((n) => n.id), ['t2'])
  })

  check('旧条目搬运：已下架的书不保留', () => {
    const previous = { notes: [{ id: 'n1', bookId: 'gone' }], thoughts: [{ id: 't1', bookId: 'gone' }] }
    const carried = mergeCarriedEntries(previous, new Set(['a']), new Set())
    assert.equal(carried.notes.length, 0)
    assert.equal(carried.thoughts.length, 0)
  })

  check('旧条目搬运：无旧数据集时不炸', () => {
    const carried = mergeCarriedEntries(null, new Set(['a']), new Set())
    assert.deepEqual(carried, { notes: [], thoughts: [] })
  })

  check('旧条目搬运：计数器归零的书丢弃旧条目', () => {
    const previous = { notes: [{ id: 'n1', bookId: 'a' }], thoughts: [] }
    // 'a' 现在 0 条：调用方会把它放进 refresh 集合，从而不搬运
    const carried = mergeCarriedEntries(previous, new Set(['a']), new Set(['a']))
    assert.equal(carried.notes.length, 0)
  })

  const failed = results.filter((r) => !r.ok)
  for (const row of results) {
    console.log(`${row.ok ? 'ok  ' : 'FAIL'} ${row.name}${row.ok ? '' : ` — ${row.error}`}`)
  }
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})