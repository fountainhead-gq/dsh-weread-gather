/**
 * 书房 / WeRead Study — Client half.
 *
 * Renders the sidebar entry and the center-column page. All WeRead traffic,
 * the API key and the dataset live in the Host half; this file only talks to
 * its own JSON routes over document-relative paths.
 */
window.__ModuleLoader__.load({
  id: 'dsh-weread-gather',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    /** Locale namespace owned by this plugin. */
    const NS = 'weread-gather'
    /** Document-relative base: the page is served with `<base href="./">`. */
    const API = 'dsh-weread/api'
    /** Sidebar entry id; also the key of the center-column panel. */
    const PANEL_ID = 'weread'
    /** A finished sync message clears itself after this long (ms). */
    const AUTO_HIDE_MS = 8000

    // ------------------------------------------------------------------ copy
    const zh = {
      'entry.label': '数字书房',
      'page.title': '数字书房',
      'page.subtitle': '私人阅读档案',
      'nav.overview': '总览',
      'nav.shelf': '书架',
      'nav.notes': '笔记',
      'nav.thoughts': '想法',
      'action.sync': '同步微读',
      'action.syncing': '同步中',
      'action.settings': '设置',
      'action.search': '搜索',
      'action.searchGlobal': '搜索书架、笔记、想法…',
      'action.save': '保存',
      'action.cancel': '取消',
      'action.dismiss': '关闭提示',
      'action.clearKey': '清除 Key',
      'action.back': '返回',
      'action.retry': '重试',
      'action.loadMore': '加载更多',
      'action.copy': '复制',
      'action.copied': '已复制',
      'action.openBook': '点击查看这本书',
      'pager.prev': '上一页',
      'pager.next': '下一页',
      'pager.page': '第 {page} / {total} 页',
      'action.refresh': '刷新',
      'state.loading': '正在打开数字书房…',
      'state.loadFailed': '数字书房数据加载失败',
      'state.notConfigured': '还没有连接微信读书',
      'setup.title': '连接你的微信读书',
      'setup.desc': '数字书房通过微信读书 Agent 网关读取你的书架、笔记与阅读统计。填写一次 API Key，之后可以随时自行同步。',
      'setup.keyLabel': 'API Key',
      'setup.keyPlaceholder': 'wrk-…',
      'setup.hint': 'Key 只保存在本机 DSH 数据目录，不会出现在页面里。',
      'setup.onEnv': '当前使用环境变量 WEREAD_API_KEY。',
      'setup.save': '连接并同步',
      'setup.saving': '正在连接…',
      'setup.badKey': 'Key 看起来不对，应以 wrk- 开头。',
      'setup.savedOnly': '已连接',
      'synced.at': '更新于 {time}',
      'synced.never': '尚未同步',
      'synced.counts': '{books} 本 · {notes} 条划线 · {thoughts} 条想法',
      'sync.running': '{label} {done}/{total}',
      'sync.done': '同步完成：{message}',
      'sync.failed': '同步失败：{error}',
      'dash.period.weekly': '本周',
      'dash.period.monthly': '本月',
      'dash.period.annually': '今年',
      'dash.period.overall': '累计',
      'dash.time': '阅读时长',
      'dash.days': '阅读天数',
      'dash.avg': '自然日均',
      'dash.hour': '阅读时段',
      'dash.hourHint': '从 6 点开始，按小时统计阅读时长',
      'dash.heat': '阅读热力图',
      'dash.heatHint': '那一年的每日阅读时长',
      'dash.heat.active': '活跃 {days} 天',
      'dash.heat.streak': '最长连续 {days} 天',
      'dash.heat.total': '全年 {time}',
      'dash.heat.best': '最投入的一天 {date} · {time}',
      'dash.heat.loading': '正在读取 {year} 年数据…',
      'dash.heat.empty': '这一年还没有阅读记录',
      'dash.heat.year': '年份',
      'dash.yearTitle': '{year} 年度',
      'dash.yearDelta': '较上年',
      'dash.yearEmpty': '{year} 年还没有阅读记录，换一个年份看看',
      'dash.month': '月度分布',
      'dash.hourAll': '累计，不随年份变化',
      'dash.notesCount': '笔记',
      'dash.thoughtsCount': '想法',
      'dash.category': '偏好分类',
      'dash.top': '读得最多',
      'dash.author': '偏好作者',
      'dash.rank': '好友排行',
      'dash.readRate': '文字 / 听书',
      'dash.text': '文字阅读',
      'dash.audio': '有声听书',
      'dash.heat.none': '无阅读',
      'dash.heat.future': '还没到',
      'dash.less': '少',
      'dash.more': '多',
      'dash.empty': '还没有阅读统计，先同步一次。',
      'dash.stat.读过': '读过',
      'dash.stat.读完': '读完',
      'dash.stat.阅读': '阅读',
      'dash.stat.笔记': '笔记',
      'shelf.all': '全部',
      'shelf.search': '搜索书名、作者、分类…',
      'shelf.sort.recent': '最近阅读',
      'shelf.sort.title': '书名',
      'shelf.sort.notes': '笔记最多',
      'shelf.finished': '已读完',
      'shelf.reading': '在读',
      'shelf.private': '私密',
      'shelf.empty': '没有匹配的书籍',
      'shelf.year': '年份',
      'shelf.yearAll': '全部年份',
      'shelf.yearNone': '无日期',
      'shelf.yearHint': '按最后阅读年份筛选，可直接在搜索框输入年份',
      'shelf.count': '共 {count} 本',
      'book.back': '返回书架',
      'book.notes': '划线 {count}',
      'book.thoughts': '想法 {count}',
      'book.progress': '阅读进度',
      'book.rating': '评分',
      'book.year': '出版于',
      'book.album': '有声书',
      'book.empty': '这本书还没有同步到笔记',
      'book.searchNotes': '在这本书里搜索…',
      'note.title': '笔记流',
      'note.search': '搜索划线原文、书名、章节…',
      'thought.title': '想法墙',
      'thought.search': '搜索想法内容、书名…',
      'thought.expand': '展开全文（还有 {count} 字）',
      'thought.collapse': '收起',
      'thought.contextToggle': '同章划线 {count}',
      'thought.contextTitle': '同章的划线（供参考）',
      'view.list': '列表',
      'view.wall': '墙',
      'filter.allBooks': '全部书籍',
      'filter.book': '按书籍筛选',
      'empty.notes': '还没有划线笔记',
      'empty.thoughts': '还没有想法',
      'empty.notesHint': '在微信读书里划过线的书，同步后就会出现在这里。',
      'empty.thoughtsHint': '读时写下的想法与点评，同步后会汇成这一面墙。',
      'search.empty': '没有找到“{query}”',
      'search.books': '书籍',
      'search.notes': '划线',
      'search.thoughts': '想法',
      'search.more': '还有 {count} 条结果，继续输入可缩小范围',
      'settings.title': '数字书房设置',
      'settings.key': 'API Key',
      'settings.keyMasked': '当前 Key：{key}',
      'settings.keyNone': '当前未配置 Key',
      'settings.maxBooks': '同步书籍上限',
      'settings.maxBooksHint': '每次只抓取笔记最多的这些书，数值越大越慢。',
      'settings.notesPerBook': '每本书划线上限',
      'settings.saved': '已保存',
      'settings.dir': '数据目录：{dir}',
      'settings.resync': '重新同步',
      'export.title': '导出为 Markdown',
      'export.summary': '{entries} 条内容 · {books} 本书',
      'export.select': '选择这条',
      'export.selected': '已选 {count} 条',
      'export.selectPage': '全选本页',
      'export.exportSelected': '导出所选',
      'export.exportAll': '导出全部',
      'export.clear': '清空',
      'export.none': '还没有选择内容，点卡片左上角的小圆圈即可勾选。',
      'export.options': '包含内容',
      'export.opt.excerpts': '原文划线',
      'export.opt.thoughts': '我的想法',
      'export.opt.meta': '书籍信息',
      'export.opt.chapter': '章节标题',
      'export.opt.star': '星级',
      'export.opt.sourceUrl': '微读链接',
      'export.previewLabel': '预览',
      'export.previewHint': '前 {lines} 行，共 {total} 行 · {bytes}',
      'export.copyAll': '复制全文',
      'export.download': '下载 .md',
      'export.save': '保存到导出目录',
      'export.saving': '正在保存…',
      'export.saved': '已保存：{files}',
      'export.failed': '导出失败：{error}',
      'export.close': '关闭',
      'export.book': '导出这本书',
      'export.emptySelection': '没有可导出的内容',
      'settings.dataTitle': '数据与导出',
      'settings.exportDir': 'Markdown 导出目录',
      'settings.exportDirHint': '默认保存到这里；也可以只改这一次的目标目录。',
      'settings.dirSave': '保存目录',
      'settings.dirSaved': '已更新导出目录',
      'settings.backup': '下载备份',
      'settings.backupHint': '包含书架、划线、想法、统计缓存与本机设置，不含 API Key。',
      'settings.fullSync': '强制全量重建',
      'settings.fullSyncHint': '平时只同步有变化的书；重建会重新拉取全部笔记与想法，比较慢。',
      'settings.fullSyncStarted': '已开始全量重建，完成后会刷新数据',
      'settings.restore': '导入备份',
      'settings.restorePick': '选择备份文件',
      'settings.restoreConfirm': '将用备份覆盖本机数据，会先把当前数据另存一份。确定恢复吗？',
      'settings.restoreYes': '确定恢复',
      'settings.restored': '已恢复 {files} 个文件',
      'settings.version': '版本 {version}',
      'search.typeAll': '全部',
      'search.typeBooks': '书籍',
      'count.notes': '{count} 条',
      'error.prefix': '出错了：',
    }
    const en = {
      'entry.label': 'Digital Study',
      'page.title': 'Digital Study',
      'page.subtitle': 'A private reading archive',
      'nav.overview': 'Overview',
      'nav.shelf': 'Shelf',
      'nav.notes': 'Notes',
      'nav.thoughts': 'Thoughts',
      'action.sync': 'Sync WeRead',
      'action.syncing': 'Syncing',
      'action.settings': 'Settings',
      'action.search': 'Search',
      'action.searchGlobal': 'Search shelf, notes, thoughts…',
      'action.save': 'Save',
      'action.cancel': 'Cancel',
      'action.dismiss': 'Dismiss the message',
      'action.clearKey': 'Clear key',
      'action.back': 'Back',
      'action.retry': 'Retry',
      'action.loadMore': 'Load more',
      'action.copy': 'Copy',
      'action.copied': 'Copied',
      'action.openBook': 'Open this book',
      'pager.prev': 'Prev',
      'pager.next': 'Next',
      'pager.page': 'Page {page} of {total}',
      'action.refresh': 'Refresh',
      'state.loading': 'Opening your study…',
      'state.loadFailed': 'Could not load the study data',
      'state.notConfigured': 'WeRead is not connected yet',
      'setup.title': 'Connect your WeRead account',
      'setup.desc': 'The study reads your shelf, highlights and reading stats through the WeRead agent gateway. Add an API key once; sync whenever you like.',
      'setup.keyLabel': 'API Key',
      'setup.keyPlaceholder': 'wrk-…',
      'setup.hint': 'The key stays in this machine’s DSH data directory and never reaches the page.',
      'setup.onEnv': 'Using the WEREAD_API_KEY environment variable.',
      'setup.save': 'Connect and sync',
      'setup.saving': 'Connecting…',
      'setup.badKey': 'That does not look like a key; it should start with wrk-.',
      'setup.savedOnly': 'Connected',
      'synced.at': 'Updated {time}',
      'synced.never': 'Never synced',
      'synced.counts': '{books} books · {notes} highlights · {thoughts} thoughts',
      'sync.running': '{label} {done}/{total}',
      'sync.done': 'Sync finished: {message}',
      'sync.failed': 'Sync failed: {error}',
      'dash.period.weekly': 'This week',
      'dash.period.monthly': 'This month',
      'dash.period.annually': 'This year',
      'dash.period.overall': 'All time',
      'dash.time': 'Reading time',
      'dash.days': 'Days read',
      'dash.avg': 'Daily average',
      'dash.hour': 'Time of day',
      'dash.hourHint': 'From 6am, reading time per hour',
      'dash.heat': 'Reading heatmap',
      'dash.heatHint': 'Daily reading time; darker means more',
      'dash.heat.active': '{days} active days',
      'dash.heat.streak': 'Longest streak {days} days',
      'dash.heat.total': '{time} this year',
      'dash.heat.best': 'Best day {date} · {time}',
      'dash.heat.loading': 'Loading {year}…',
      'dash.heat.empty': 'No reading in this year',
      'dash.heat.year': 'Year',
      'dash.yearTitle': '{year} in reading',
      'dash.yearDelta': 'vs last year',
      'dash.yearEmpty': 'No reading recorded in {year}; try another year',
      'dash.month': 'Monthly distribution',
      'dash.hourAll': 'All-time, not year-scoped',
      'dash.notesCount': 'Notes',
      'dash.thoughtsCount': 'Thoughts',
      'dash.category': 'Favourite categories',
      'dash.top': 'Most read',
      'dash.author': 'Favourite authors',
      'dash.rank': 'Friends ranking',
      'dash.readRate': 'Text / audio',
      'dash.text': 'E-books read',
      'dash.audio': 'Audiobooks heard',
      'dash.heat.none': 'No reading',
      'dash.heat.future': 'Not yet',
      'dash.less': 'Less',
      'dash.more': 'More',
      'dash.empty': 'No reading stats yet — sync once.',
      'dash.stat.读过': 'Read',
      'dash.stat.读完': 'Finished',
      'dash.stat.阅读': 'Reading',
      'dash.stat.笔记': 'Notes',
      'shelf.all': 'All',
      'shelf.search': 'Search title, author, category…',
      'shelf.sort.recent': 'Recently read',
      'shelf.sort.title': 'Title',
      'shelf.sort.notes': 'Most notes',
      'shelf.finished': 'Finished',
      'shelf.reading': 'Reading',
      'shelf.private': 'Private',
      'shelf.empty': 'No matching books',
      'shelf.year': 'Year',
      'shelf.yearAll': 'All years',
      'shelf.yearNone': 'No date',
      'shelf.yearHint': 'Filter by last-read year, or type a year in the search box',
      'shelf.count': '{count} books',
      'book.back': 'Back to shelf',
      'book.notes': 'Highlights {count}',
      'book.thoughts': 'Thoughts {count}',
      'book.progress': 'Progress',
      'book.rating': 'Rating',
      'book.year': 'Published',
      'book.album': 'Audiobook',
      'book.empty': 'No notes synced for this book yet',
      'book.searchNotes': 'Search in this book…',
      'note.title': 'Highlights',
      'note.search': 'Search highlight text, book, chapter…',
      'thought.title': 'Thoughts',
      'thought.search': 'Search thoughts and books…',
      'thought.expand': 'Show all ({count} more characters)',
      'thought.collapse': 'Collapse',
      'thought.contextToggle': '{count} highlight(s) in the same chapter',
      'thought.contextTitle': 'Highlights in the same chapter (for context)',
      'view.list': 'List',
      'view.wall': 'Wall',
      'filter.allBooks': 'All books',
      'filter.book': 'Filter by book',
      'empty.notes': 'No highlights yet',
      'empty.thoughts': 'No thoughts yet',
      'empty.notesHint': 'Books you highlighted in WeRead show up here after a sync.',
      'empty.thoughtsHint': 'Thoughts written while reading gather on this wall.',
      'search.empty': 'Nothing found for “{query}”',
      'search.books': 'Books',
      'search.notes': 'Highlights',
      'search.thoughts': 'Thoughts',
      'search.more': '{count} more results — keep typing to narrow down',
      'settings.title': 'Study settings',
      'settings.key': 'API Key',
      'settings.keyMasked': 'Current key: {key}',
      'settings.keyNone': 'No key configured',
      'settings.maxBooks': 'Books per sync',
      'settings.maxBooksHint': 'Only the books with the most notes are fetched; higher is slower.',
      'settings.notesPerBook': 'Highlights per book',
      'settings.saved': 'Saved',
      'settings.dir': 'Data directory: {dir}',
      'settings.resync': 'Sync again',
      'export.title': 'Export as Markdown',
      'export.summary': '{entries} entries · {books} books',
      'export.select': 'Select this',
      'export.selected': '{count} selected',
      'export.selectPage': 'Select page',
      'export.exportSelected': 'Export selected',
      'export.exportAll': 'Export all',
      'export.clear': 'Clear',
      'export.none': 'Nothing selected yet — click the circle at the top-left of a card.',
      'export.options': 'Include',
      'export.opt.excerpts': 'Highlights',
      'export.opt.thoughts': 'My thoughts',
      'export.opt.meta': 'Book details',
      'export.opt.chapter': 'Chapter headings',
      'export.opt.star': 'Star rating',
      'export.opt.sourceUrl': 'WeRead link',
      'export.previewLabel': 'Preview',
      'export.previewHint': 'First {lines} of {total} lines · {bytes}',
      'export.copyAll': 'Copy all',
      'export.download': 'Download .md',
      'export.save': 'Save to folder',
      'export.saving': 'Saving…',
      'export.saved': 'Saved: {files}',
      'export.failed': 'Export failed: {error}',
      'export.close': 'Close',
      'export.book': 'Export this book',
      'export.emptySelection': 'Nothing to export',
      'settings.dataTitle': 'Data & export',
      'settings.exportDir': 'Markdown export folder',
      'settings.exportDirHint': 'Markdown goes here by default; you can change it for one export.',
      'settings.dirSave': 'Save folder',
      'settings.dirSaved': 'Export folder updated',
      'settings.backup': 'Download backup',
      'settings.backupHint': 'Shelf, highlights, thoughts, statistics cache and local settings — API key excluded.',
      'settings.fullSync': 'Full rebuild',
      'settings.fullSyncHint': 'Normal syncs only read books that changed; a rebuild re-reads every highlight and is slower.',
      'settings.fullSyncStarted': 'Full rebuild started — data refreshes when it finishes',
      'settings.restore': 'Import backup',
      'settings.restorePick': 'Choose a backup file',
      'settings.restoreConfirm': 'This overwrites local data (the current copy is saved first). Restore now?',
      'settings.restoreYes': 'Restore',
      'settings.restored': 'Restored {files} files',
      'settings.version': 'Version {version}',
      'search.typeAll': 'All',
      'search.typeBooks': 'Books',
      'count.notes': '{count}',
      'error.prefix': 'Something went wrong: ',
    }

    /** Translate through the runtime dictionary; falls back to the key. */
    let translate = null
    function t(key, params) {
      const text = translate === null ? undefined : translate(key, params)
      if (typeof text === 'string') return text
      return (zh[key] !== undefined ? zh[key] : key).replace(/\{(\w+)\}/g, (match, name) => (params && params[name] !== undefined ? String(params[name]) : match))
    }

    // ------------------------------------------------------------------- api
    async function request(path, init) {
      const response = await fetch(`${API}${path}`, { headers: { accept: 'application/json' }, ...init })
      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
      if (!response.ok) {
        const message = payload && payload.error ? payload.error : `HTTP ${response.status}`
        throw new Error(message)
      }
      if (payload === null) throw new Error('后台返回了无法识别的内容')
      return payload
    }
    const apiState = () => request('/state')
    const apiData = () => request('/data')
    const apiHeat = (year) => request(`/heat?year=${encodeURIComponent(String(year))}`)
    const apiSync = (options) => request('/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(options && options.full === true ? { full: true } : {}) })
    const apiConfig = (patch) => request('/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) })
    const apiReset = () => request('/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    const jsonPost = (path, body) => request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body === undefined ? {} : body) })
    /** mode 'preview' returns the markdown only; 'file' also writes it into the export folder. */
    const apiExport = (selector, options, mode) => jsonPost('/export', { selector, options, mode })
    const apiExportDir = () => request('/export/dir')
    const apiSetExportDir = (dir) => jsonPost('/export/dir', { dir })
    const apiBackup = () => request('/backup')
    const apiRestore = (bundle) => jsonPost('/restore', { bundle })

    // --------------------------------------------------------------- helpers
    function pad(value) {
      return value < 10 ? `0${value}` : String(value)
    }
    function fmtDate(seconds) {
      if (!seconds) return ''
      const date = new Date(seconds * 1000)
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
    function fmtDuration(seconds) {
      const total = Math.max(0, Math.round(Number(seconds) || 0))
      if (total < 60) return `${total}秒`
      const minutes = Math.round(total / 60)
      if (minutes < 60) return `${minutes}分`
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return rest === 0 ? `${hours}小时` : `${hours}小时${rest}分`
    }
    function fmtCount(value) {
      return new Intl.NumberFormat().format(Number(value) || 0)
    }
    function fmtDateTime(seconds) {
      if (!seconds) return ''
      const date = new Date(seconds * 1000)
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    function contains(haystack, needle) {
      return haystack !== undefined && haystack !== null && String(haystack).toLowerCase().includes(needle)
    }
    /** Hard cut for option labels: a long book title must not widen the popup. */
    function clip(text, max) {
      const value = text === undefined || text === null ? '' : String(text)
      if (value.length <= max) return value
      return `${value.slice(0, Math.max(1, max - 1))}…`
    }

    // ----------------------------------------------------------------- styles
    const CSS = `
.wr-root{--wr-paper:#F6F8F7;--wr-paper-soft:#FFFFFF;--wr-wash:#F0F4F1;--wr-ink:#263C34;--wr-ink-soft:#6B7F74;--wr-ink-mute:#93A49B;--wr-sage:#A6CCB5;--wr-moss:#4F9274;--wr-clay:#A57F5B;--wr-progress:#73AD8A;--wr-track:#F0F4F1;--wr-line:#E7EEEA;--wr-line-2:#DCE6E0;--wr-card-line:#EDF1EE;--wr-divider:#EEF3F0;--wr-surface:#FBFCFB;--wr-heat-0:#F3F4F2;--wr-heat-1:#D5E9DD;--wr-heat-2:#A9D3BA;--wr-heat-3:#74B28E;--wr-heat-4:#438765;--dsw-alias-bg-base:var(--wr-paper);--dsw-alias-bg-layer-1:var(--wr-paper-soft);--dsw-alias-bg-layer-2:var(--wr-wash);--dsw-alias-label-primary:var(--wr-ink);--dsw-alias-label-secondary:var(--wr-ink-soft);--dsw-alias-border-l1:var(--wr-line);--dsw-alias-border-l2:var(--wr-line-2);--dsw-alias-brand-primary:var(--wr-moss);--dsw-alias-state-success-primary:#4F7A5B;--dsw-alias-state-warn-primary:#B98A57;--dsw-alias-state-error-primary:#A8574C;display:flex;flex-direction:column;height:100%;min-height:0;width:100%;box-sizing:border-box;background:radial-gradient(900px 420px at 50% -18%,#FFFFFF 0%,transparent 70%),var(--wr-paper);color:var(--wr-ink);font-family:inherit}
.wr-root[data-view=shelf]{--wr-paper:#EDF2EE;--wr-paper-soft:#FFFFFF}
.wr-root[data-view=notes],.wr-root[data-view=thoughts]{--wr-paper:#F8FAF8;--wr-paper-soft:#FFFFFF}
.wr-head{flex:none;display:flex;align-items:center;gap:16px;padding:14px 26px;border-bottom:1px solid var(--dsw-alias-border-l1);background:rgba(255,255,255,.86);backdrop-filter:blur(10px);flex-wrap:wrap}
.wr-brand{display:flex;flex-direction:column;gap:1px;min-width:0}
.wr-brand-title{font-size:15.5px;font-weight:700;letter-spacing:.07em;color:var(--wr-ink)}
.wr-brand-sub{font-size:11px;color:var(--wr-ink-mute);letter-spacing:.05em}
.wr-tabs{display:flex;gap:2px;padding:4px;border-radius:999px;background:var(--wr-wash);border:1px solid transparent}
.wr-tab{appearance:none;border:0;background:transparent;color:var(--wr-ink-soft);font:inherit;font-size:12.5px;padding:6px 15px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background .16s ease,color .16s ease}
.wr-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.wr-tab[data-active=true]{color:var(--wr-ink);background:var(--wr-paper-soft);font-weight:600;box-shadow:0 1px 2px rgba(38,60,52,.08)}
.wr-head-right{margin-left:auto;display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.wr-search{position:relative;display:flex;align-items:center}
.wr-search input{box-sizing:border-box;height:32px;width:232px;max-width:44vw;border-radius:999px;border:1px solid var(--wr-line-2);background:var(--wr-paper-soft);color:var(--wr-ink);font:inherit;font-size:12.5px;padding:0 28px 0 13px;outline:none;transition:border-color .16s ease,box-shadow .16s ease}
.wr-search input:focus{border-color:var(--wr-moss);box-shadow:0 0 0 3px rgba(79,146,116,.14)}
.wr-search input::placeholder{color:var(--dsw-alias-label-secondary)}
.wr-search-clear{position:absolute;right:4px;width:20px;height:20px;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center}
.wr-search-clear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wr-btn{appearance:none;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 14px;border-radius:999px;border:1px solid var(--wr-line-2);background:var(--wr-paper-soft);color:var(--wr-ink);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .16s ease,border-color .16s ease,transform .16s ease}
.wr-btn:hover{background:var(--wr-wash);border-color:var(--wr-sage)}
.wr-btn:disabled{opacity:.55;cursor:default}
.wr-btn-primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}
.wr-btn-primary:hover{background:var(--dsw-alias-brand-primary);filter:brightness(1.06)}
.wr-btn-ghost{border-color:var(--wr-line);background:var(--wr-paper-soft)}
.wr-btn-ghost:hover{background:var(--wr-wash);border-color:var(--wr-sage)}
.wr-body{flex:1;min-height:0;overflow:auto;padding:26px 30px 64px;scrollbar-width:thin;scrollbar-color:#CFD8C6 transparent}
.wr-body-inner{max-width:1240px;margin:0 auto}
.wr-card{background:var(--wr-paper-soft);border:1px solid var(--wr-card-line);border-radius:16px;padding:20px 22px}
.wr-section{margin-top:22px}
.wr-section:first-child{margin-top:0}
.wr-section-title{display:flex;align-items:baseline;gap:8px;margin:0 0 12px;font-size:13.5px;font-weight:700;letter-spacing:.03em}
.wr-section-hint{font-size:11.5px;font-weight:400;color:var(--dsw-alias-label-secondary)}
.wr-muted{color:var(--dsw-alias-label-secondary);font-size:12px}
.wr-empty{padding:36px 10px;text-align:center;color:var(--dsw-alias-label-secondary);font-size:13px}
.wr-empty strong{display:block;color:var(--dsw-alias-label-primary);font-size:14px;margin-bottom:6px}
.wr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.wr-stat{background:var(--wr-paper-soft);border:1px solid var(--wr-card-line);border-radius:16px;padding:16px 18px}
.wr-stat-label{font-size:11.5px;color:var(--dsw-alias-label-secondary);letter-spacing:.04em}
.wr-stat-value{font-size:22px;font-weight:700;margin-top:6px;font-variant-numeric:tabular-nums;line-height:1.15}
.wr-stat-hint{font-size:11.5px;color:var(--dsw-alias-label-secondary);margin-top:6px;display:flex;gap:10px;flex-wrap:wrap}
.wr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px;margin-top:14px}
.wr-kpi{background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-radius:14px;padding:12px 14px;min-width:0}
.wr-kpi-value{font-size:19px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wr-kpi-label{font-size:11px;color:var(--dsw-alias-label-secondary);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wr-kpi-hint{font-size:10px;color:var(--dsw-alias-label-secondary);opacity:.75;margin-top:2px}
.wr-chip-stat{font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 9px;white-space:nowrap}
.wr-chips{display:flex;gap:6px;flex-wrap:wrap}
.wr-chip{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:4px 11px;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;transition:all .12s}
.wr-chip:hover{color:var(--wr-ink);border-color:var(--wr-sage)}
.wr-chip[data-active=true]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:#fff;font-weight:600}
.wr-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.wr-toolbar-fill{flex:1;min-width:0}
.wr-input{box-sizing:border-box;height:32px;border-radius:10px;border:1px solid var(--wr-line-2);background:var(--wr-paper-soft);color:var(--wr-ink);font:inherit;font-size:12.5px;padding:0 11px;outline:none;transition:border-color .16s ease,box-shadow .16s ease}
.wr-input:focus{border-color:var(--wr-moss);box-shadow:0 0 0 3px rgba(79,146,116,.14)}
.wr-select{box-sizing:border-box;height:32px;border-radius:10px;border:1px solid var(--wr-line-2);background:var(--wr-paper-soft);color:var(--wr-ink);font:inherit;font-size:12.5px;padding:0 9px;outline:none;max-width:220px;cursor:pointer}
.wr-grid{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:12px}
@media (max-width:1240px){.wr-grid{grid-template-columns:repeat(8,minmax(0,1fr))}}
@media (max-width:920px){.wr-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media (max-width:640px){.wr-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.wr-book{appearance:none;border:0;background:transparent;padding:0;margin:0;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px;font:inherit;color:inherit;content-visibility:auto;contain-intrinsic-size:0 220px}
.wr-book-cover-wrap{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(38,60,52,.08);transition:transform .2s ease,box-shadow .2s ease}
.wr-book:hover .wr-book-cover-wrap{transform:translateY(-3px);box-shadow:0 6px 14px rgba(38,60,52,.12)}
.wr-cover{aspect-ratio:3/4;width:100%;background:var(--dsw-alias-bg-layer-2);display:block;overflow:hidden;position:relative}
.wr-cover img{width:100%;height:100%;object-fit:cover;display:block}
.wr-cover-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:rgba(255,255,255,.94);background:linear-gradient(150deg,#A8B9A3,#5F7562)}
.wr-cover-badges{position:absolute;left:4px;top:4px;display:flex;gap:3px;flex-wrap:wrap;max-width:calc(100% - 8px)}
.wr-badge{font-size:9px;line-height:1.5;padding:0 5px;border-radius:999px;background:rgba(38,60,52,.62);color:#FCFAF4;backdrop-filter:blur(3px)}
.wr-badge[data-tone=brand]{background:rgba(111,138,116,.92)}
.wr-book-title{font-size:11px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wr-book-author{font-size:10px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wr-book-meta{display:flex;gap:4px;font-size:9.5px;color:var(--dsw-alias-label-secondary);align-items:center;flex-wrap:wrap}
.wr-progress{height:3px;border-radius:2px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.wr-progress span{display:block;height:100%;background:var(--dsw-alias-brand-primary);border-radius:2px}
.wr-hour{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:3px;align-items:end;height:120px}
.wr-hour-col{display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%}
.wr-hour-bar{width:100%;border-radius:4px 4px 0 0;background:var(--wr-sage);min-height:2px}
.wr-hour-bar[data-future=true]{background:var(--wr-track)}
.wr-hour-col:hover .wr-hour-bar,.wr-hour-bar[data-active=true]{background:var(--wr-moss)}
.wr-hour-bar[data-future=true],.wr-hour-col:hover .wr-hour-bar[data-future=true]{background:var(--wr-track)}
.wr-hour-label[data-active=true]{color:var(--wr-ink);font-weight:600}
.wr-hour-label{font-size:9px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.wr-months{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px;align-items:end;height:132px}
.wr-months .wr-hour-label{font-size:10px}
.wr-heat-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.wr-yearbar{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px;background:var(--dsw-alias-bg-layer-1)}
.wr-yearbar button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1;padding:4px 7px;border-radius:999px;cursor:pointer}
.wr-yearbar button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wr-yearbar button:disabled{opacity:.35;cursor:default}
.wr-yearbar strong{font-size:12.5px;font-variant-numeric:tabular-nums;padding:0 4px;min-width:42px;text-align:center}
.wr-heat-wrap{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px}
.wr-heat-days{display:grid;grid-template-rows:repeat(7,12px);gap:3px;flex:none;font-size:9.5px;color:var(--dsw-alias-label-secondary);align-items:center}
.wr-heat-months{display:grid;grid-auto-flow:column;grid-auto-columns:12px;gap:3px;font-size:9.5px;color:var(--dsw-alias-label-secondary);overflow:hidden;margin:0 0 4px 0}
.wr-heat-months span{white-space:nowrap;overflow:visible}
.wr-heat{display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,12px);gap:3px;flex:none}
.wr-heat-cell{width:12px;height:12px;border-radius:2.5px;background:var(--wr-heat-0);transition:transform .12s ease}
.wr-heat-cell[data-on=true]:hover{transform:scale(1.3)}
.wr-heat-cell[data-future=true]{background:transparent}
.wr-heat-foot{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}
.wr-heat-foot-stats{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
.wr-banner-close{border:none;background:transparent;color:inherit;font-size:14px;line-height:1;cursor:pointer;padding:2px 4px;border-radius:6px;opacity:.55;flex:none;margin-left:auto}
.wr-banner-close:hover{opacity:1;background:var(--wr-wash)}
.wr-banner-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wr-heat-legend{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.wr-bars{display:flex;flex-direction:column;gap:8px}
.wr-bar-row{display:grid;grid-template-columns:104px 1fr 54px;gap:10px;align-items:center;font-size:12px}
.wr-bar-track{height:6px;border-radius:999px;background:var(--wr-track);overflow:hidden}
.wr-bar-fill{height:100%;border-radius:999px;background:var(--wr-progress)}
.wr-bar-value{text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;font-size:11.5px}
.wr-list{display:flex;flex-direction:column;gap:2px}
.wr-row{display:flex;align-items:center;gap:10px;padding:8px 8px;border-radius:8px;text-align:left;border:0;background:transparent;font:inherit;color:inherit;width:100%;cursor:default}
.wr-row[data-clickable=true]{cursor:pointer}
.wr-row[data-clickable=true]:hover{background:var(--dsw-alias-bg-layer-2)}
.wr-row-rank{width:18px;text-align:right;font-size:11.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;flex:none}
.wr-row-cover{width:28px;height:38px;flex:none;border-radius:4px;overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.wr-row-main{min-width:0;flex:1}
.wr-row-title{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wr-row-sub{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.wr-row-tail{font-size:11.5px;color:var(--dsw-alias-label-secondary);flex:none;font-variant-numeric:tabular-nums}
.wr-ring{position:relative;display:grid;place-items:center;flex:none}
.wr-ring svg{position:absolute;inset:0}
.wr-ring-label{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1.2}
.wr-ring-label strong{font-size:16px;font-variant-numeric:tabular-nums}
.wr-ring-label span{font-size:10.5px;color:var(--dsw-alias-label-secondary)}
.wr-cols{column-count:2;column-gap:14px}
@media (min-width:900px){.wr-cols{column-count:3}}
@media (min-width:1300px){.wr-cols{column-count:4}}
.wr-quote{break-inside:avoid;margin:0 0 14px;background:var(--wr-paper-soft);border:1px solid var(--wr-card-line);border-radius:14px;padding:14px 16px;position:relative}
.wr-quote:before{content:'“';position:absolute;left:9px;top:3px;font-size:26px;color:#C3D2BC;font-family:Georgia,serif;line-height:1}
.wr-quote-text{font-size:12.8px;line-height:1.62;white-space:pre-wrap;word-break:break-word;padding-left:12px;margin:0}
.wr-quote-foot{display:flex;align-items:center;gap:6px;margin-top:9px;padding-left:12px;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0}
.wr-quote-book{font-weight:600;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
.wr-quote-tail{margin-left:auto;flex:none;display:flex;gap:6px;align-items:center}
.wr-thought{break-inside:avoid;margin:0 0 14px;background:var(--wr-paper-soft);border:1px solid var(--wr-card-line);border-left:2px solid color-mix(in srgb, var(--wr-sage) 70%, transparent);border-radius:14px;padding:15px 17px}
.wr-cols .wr-thought{margin-bottom:20px;background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-left:2px solid color-mix(in srgb, var(--wr-sage) 70%, transparent);box-shadow:0 1px 2px rgba(38,60,52,.05)}
.wr-cols .wr-thought[data-clickable=true]:hover{background:var(--wr-paper-soft);border-color:var(--wr-sage);box-shadow:0 4px 12px rgba(38,60,52,.09)}
.wr-cols .wr-thought[data-picked=true]{border-color:var(--dsw-alias-brand-primary)}
.wr-thought .wr-quote-text{font-size:13.5px;line-height:1.75;text-wrap:pretty}
.wr-thought .wr-quote-foot{flex-wrap:wrap;gap:4px 8px;margin-top:12px;padding-top:9px;border-top:1px solid var(--wr-divider)}
.wr-thought .wr-quote-book{white-space:normal;overflow:visible;max-width:none;text-overflow:clip}
.wr-clamp{display:-webkit-box;-webkit-line-clamp:9;-webkit-box-orient:vertical;overflow:hidden}
.wr-more{appearance:none;border:0;background:transparent;color:var(--wr-moss);font:inherit;font-size:11.5px;line-height:1.5;padding:6px 0 0;cursor:pointer;text-align:left}
.wr-more:hover{text-decoration:underline}
.wr-thread-toggle{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:1.5;padding:8px 0 0;cursor:pointer}
.wr-thread-toggle:hover{color:var(--wr-ink)}
.wr-thread{margin-top:10px;padding:10px 12px;border-radius:10px;background:var(--wr-surface);border:1px solid var(--wr-divider)}
.wr-thread-title{font-size:11px;color:var(--wr-ink-mute);letter-spacing:.03em;margin-bottom:4px}
.wr-thread-item{font-size:12.5px;line-height:1.7;padding:6px 0;border-top:1px dashed var(--wr-divider)}
.wr-thread-item:first-of-type{border-top:0;padding-top:0}
.wr-thread-date{display:block;font-size:10.5px;color:var(--wr-ink-mute);margin-top:2px}
.wr-quote[data-clickable=true],.wr-thought[data-clickable=true]{cursor:pointer;transition:border-color .12s ease}
.wr-quote[data-clickable=true]:hover,.wr-thought[data-clickable=true]:hover{border-color:var(--dsw-alias-border-l2)}
.wr-copy{appearance:none;border:1px solid var(--wr-line);background:var(--wr-paper);color:var(--wr-ink-soft);font:inherit;font-size:10.5px;line-height:1;padding:4px 9px;border-radius:999px;cursor:pointer;flex:none;opacity:0;transition:opacity .14s ease,color .14s ease,border-color .14s ease}
.wr-quote:hover .wr-copy,.wr-thought:hover .wr-copy,.wr-copy:focus,.wr-copy[data-done=true]{opacity:1}
@media (hover:none){.wr-copy{opacity:1}}
.wr-copy:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.wr-copy[data-done=true]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.wr-pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:16px;font-size:12px;flex-wrap:wrap}
.wr-pick{position:absolute;right:8px;top:8px;width:16px;height:16px;border-radius:50%;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:transparent;font-size:10px;line-height:1;display:grid;place-items:center;cursor:pointer;padding:0;opacity:0;transition:opacity .12s ease;z-index:1}
.wr-quote:hover .wr-pick,.wr-thought:hover .wr-pick,.wr-pick[data-on=true]{opacity:1}
.wr-pick[data-on=true]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.wr-quote[data-picked=true],.wr-thought[data-picked=true]{border-color:var(--dsw-alias-brand-primary)}
.wr-mark{background:var(--wr-heat-1);color:var(--wr-ink);border-radius:3px;padding:0 2px}
.wr-export{width:min(760px,94vw);max-height:88vh;display:flex;flex-direction:column}
.wr-export-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.wr-export-opts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:10px 0}
.wr-export-body{flex:1 1 auto;min-height:120px;max-height:46vh;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1)}
.wr-export-label{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:6px}
.wr-export-preview{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.wr-stars{color:var(--wr-clay);font-size:10.5px;letter-spacing:1px}
.wr-detail-head{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
.wr-detail-cover{width:120px;flex:none;border-radius:12px;overflow:hidden;box-shadow:0 10px 24px -12px rgba(38,60,52,.55)}
.wr-detail-main{flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px}
.wr-detail-title{font-size:18px;font-weight:700;line-height:1.35;margin:0}
.wr-detail-author{font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.wr-modal-mask{position:fixed;inset:0;z-index:1200;background:rgba(45,60,48,.34);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px}
.wr-modal{width:min(480px,100%);max-height:80vh;overflow:auto;background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-radius:18px;box-shadow:0 30px 70px -30px rgba(45,60,48,.6);padding:22px}
.wr-modal h3{margin:0 0 4px;font-size:15px}
.wr-field{display:flex;flex-direction:column;gap:6px;margin-top:14px}
.wr-field label{font-size:11.5px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.wr-modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
.wr-setup{max-width:560px;margin:8vh auto 0;display:flex;flex-direction:column;gap:14px}
.wr-setup h2{margin:0;font-size:20px}
.wr-setup p{margin:0;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary)}
.wr-banner{display:flex;align-items:center;gap:10px;border-radius:10px;padding:9px 12px;font-size:12px;margin-bottom:14px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary)}
.wr-banner[data-tone=error]{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}
.wr-banner[data-tone=run]{color:var(--dsw-alias-label-primary)}
.wr-spinner{width:11px;height:11px;border-radius:50%;border:2px solid var(--dsw-alias-brand-primary);border-top-color:transparent;animation:wrspin .8s linear infinite;flex:none;display:inline-block}
@keyframes wrspin{to{transform:rotate(360deg)}}
.wr-flex{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.wr-split{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.wr-kv{display:flex;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.wr-notice{font-size:11.5px;color:var(--wr-ink-mute);margin:8px 0 0}
.wr-root ::selection{background:rgba(168,185,163,.45);color:var(--wr-ink)}
.wr-root :focus-visible{outline:2px solid rgba(111,138,116,.45);outline-offset:2px}
.wr-body::-webkit-scrollbar{width:10px;height:10px}
.wr-body::-webkit-scrollbar-thumb{background:#CFD8C6;border-radius:999px;border:2px solid transparent;background-clip:content-box}
.wr-body::-webkit-scrollbar-track{background:transparent}
.wr-heat-legend i{width:11px;height:11px;border-radius:3px;display:inline-block}
.wr-setup{background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-radius:18px;padding:26px 28px;box-shadow:0 1px 2px rgba(38,60,52,.04)}
`

    // ------------------------------------------------------------ components
    function Cover(props) {
      const book = props.book || {}
      const [failed, setFailed] = useState(false)
      useEffect(() => {
        setFailed(false)
      }, [book.cover])
      return h(
        'div',
        { className: 'wr-cover' },
        book.cover && !failed
          ? h('img', { src: book.cover, alt: book.title || '', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer', onError: () => setFailed(true) })
          : h('div', { className: 'wr-cover-fallback' }, String(book.title || '书').slice(0, 1)),
      )
    }

    function BookCard(props) {
      const book = props.book
      const noteTotal = (book.noteCount || 0) + (book.reviewCount || 0)
      return h(
        'button',
        { className: 'wr-book', type: 'button', onClick: () => props.onOpen(book), title: `${book.title || ''}${book.author ? ` · ${book.author}` : ''}` },
        h(
          'div',
          { className: 'wr-book-cover-wrap' },
          h(Cover, { book }),
          h(
            'div',
            { className: 'wr-cover-badges' },
            book.kind === 'album' ? h('span', { className: 'wr-badge', 'data-tone': 'brand' }, t('book.album')) : null,
            book.finishReading === 1 ? h('span', { className: 'wr-badge' }, t('shelf.finished')) : null,
            book.secret === 1 ? h('span', { className: 'wr-badge' }, t('shelf.private')) : null,
          ),
        ),
        h('div', { className: 'wr-book-title' }, book.title || '未命名'),
        h('div', { className: 'wr-book-author' }, book.author || '—'),
        h(
          'div',
          { className: 'wr-book-meta' },
          h('span', null, t('count.notes', { count: fmtCount(noteTotal) })),
          book.readingProgress > 0 ? h('span', null, `${Math.round(book.readingProgress)}%`) : null,
        ),
        book.readingProgress > 0
          ? h('div', { className: 'wr-progress' }, h('span', { style: { width: `${Math.max(2, Math.min(100, book.readingProgress))}%` } }))
          : null,
      )
    }

    function StatCard(props) {
      return h(
        'div',
        { className: 'wr-stat' },
        h('div', { className: 'wr-stat-label' }, props.label),
        h('div', { className: 'wr-stat-value' }, props.value),
        h(
          'div',
          { className: 'wr-stat-hint' },
          (props.hints || []).map((hint, index) => h('span', { key: index }, hint)),
        ),
      )
    }

    /** 双段环形表盘：outer 环走品牌色，剩余部分用底色，中心显示百分比。 */
    function Ring(props) {
      const value = Math.max(0, Math.min(100, Number(props.value) || 0))
      const size = Number(props.size) || 96
      const thickness = Number(props.thickness) || 9
      const radius = (size - thickness) / 2
      const circumference = 2 * Math.PI * radius
      const filled = (value / 100) * circumference
      return h(
        'div',
        { className: 'wr-ring', style: { width: `${size}px`, height: `${size}px` } },
        h(
          'svg',
          { width: size, height: size, viewBox: `0 0 ${size} ${size}`, role: 'img', 'aria-label': props.label || '' },
          h('circle', { cx: size / 2, cy: size / 2, r: radius, fill: 'none', stroke: 'var(--dsw-alias-bg-layer-2)', strokeWidth: thickness }),
          h('circle', {
            cx: size / 2,
            cy: size / 2,
            r: radius,
            fill: 'none',
            stroke: 'var(--dsw-alias-brand-primary)',
            strokeWidth: thickness,
            strokeLinecap: 'round',
            strokeDasharray: `${filled} ${Math.max(0, circumference - filled)}`,
            transform: `rotate(-90 ${size / 2} ${size / 2})`,
          }),
        ),
        h('div', { className: 'wr-ring-label' }, h('strong', null, `${Math.round(value)}%`), props.caption ? h('span', null, props.caption) : null),
      )
    }

    function HourChart(props) {
      const values = Array.isArray(props.values) ? props.values : []
      if (values.length === 0) return h('div', { className: 'wr-muted' }, props.emptyText || '—')
      const max = Math.max.apply(null, values.concat([1]))
      const cells = []
      for (let index = 0; index < 24; index += 1) {
        const hour = (6 + index) % 24
        const value = values[index] || 0
        const height = max <= 0 ? 0 : Math.max(value > 0 ? 6 : 0, Math.round((value / max) * 100))
        cells.push(
          h(
            'div',
            { className: 'wr-hour-col', key: index, title: `${pad(hour)}:00 · ${fmtDuration(value)}` },
            h('div', { className: 'wr-hour-bar', style: { height: `${height}%` } }),
            index % 3 === 0 ? h('div', { className: 'wr-hour-label' }, pad(hour)) : h('div', { className: 'wr-hour-label' }, ' '),
          ),
        )
      }
      return h('div', { className: 'wr-hour' }, cells)
    }

    /** Year heatmap: weekday rows × week columns for one calendar year. */
    function Heatmap(props) {
      const year = Number(props.year) || new Date().getFullYear()
      const raw = props.days || {}
      const byDate = useMemo(() => {
        const map = new Map()
        for (const [key, value] of Object.entries(raw)) {
          const seconds = Number(value) || 0
          if (seconds <= 0) continue
          let iso = null
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            iso = key
          } else {
            const stamp = Number(key)
            if (!Number.isFinite(stamp) || stamp <= 0) continue
            const date = new Date(stamp * 1000)
            iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
          }
          map.set(iso, (map.get(iso) || 0) + seconds)
        }
        return map
      }, [raw])

      const model = useMemo(() => {
        const first = new Date(year, 0, 1)
        const last = new Date(year, 11, 31)
        const start = new Date(first)
        start.setDate(start.getDate() - ((first.getDay() + 6) % 7))
        const columns = []
        const cursor = new Date(start)
        const values = []
        let total = 0
        let active = 0
        let best = 0
        let bestDate = ''
        while (cursor <= last) {
          const inYear = cursor.getFullYear() === year
          const iso = inYear ? `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}` : null
          const value = iso === null ? 0 : byDate.get(iso) || 0
          const row = (cursor.getDay() + 6) % 7
          if (row === 0) columns.push([])
          columns[columns.length - 1][row] = { iso, value }
          if (value > 0) {
            values.push(value)
            total += value
            active += 1
            if (value > best) {
              best = value
              bestDate = iso
            }
          }
          cursor.setDate(cursor.getDate() + 1)
        }
        let streak = 0
        let run = 0
        const walk = new Date(first)
        while (walk <= last) {
          const iso = `${walk.getFullYear()}-${pad(walk.getMonth() + 1)}-${pad(walk.getDate())}`
          if ((byDate.get(iso) || 0) > 0) {
            run += 1
            streak = Math.max(streak, run)
          } else {
            run = 0
          }
          walk.setDate(walk.getDate() + 1)
        }
        values.sort((a, b) => a - b)
        const quantile = (ratio) =>
          values.length === 0 ? 0 : values[Math.min(values.length - 1, Math.max(0, Math.floor(values.length * ratio)))]
        return { columns, total, active, streak, best, bestDate, thresholds: [quantile(0.25), quantile(0.5), quantile(0.8)] }
      }, [byDate, year])

      const monthFormat = useMemo(() => {
        try {
          return new Intl.DateTimeFormat(undefined, { month: 'short' })
        } catch {
          return null
        }
      }, [])
      const weekdayFormat = useMemo(() => {
        try {
          return new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
        } catch {
          return null
        }
      }, [])
      const monthLabel = (index) => (monthFormat === null ? String(index + 1) : monthFormat.format(new Date(2020, index, 1)))
      const weekdayLabel = (row) => (weekdayFormat === null ? '' : weekdayFormat.format(new Date(2020, 0, 6 + row)))

      const monthOf = (column) => {
        for (const cell of column) {
          if (cell && cell.iso) return Number(cell.iso.slice(5, 7))
        }
        return 0
      }
      // Monthly ticks would crowd the ~53 columns, so only quarter starts get a
      // label — enough to orient without turning the axis into a wall of text.
      const labelledMonths = [1, 4, 7, 10]
      const ticks = model.columns.map((column, index) => {
        const month = monthOf(column)
        if (month === 0 || !labelledMonths.includes(month)) return ''
        for (let back = index - 1; back >= 0; back -= 1) {
          const previous = monthOf(model.columns[back])
          if (previous > 0) return previous === month ? '' : monthLabel(month - 1)
        }
        return monthLabel(month - 1)
      })

      // Four discrete steps above "no reading": a fixed palette keeps the bands
      // distinguishable, where mixing percentages blurred them into the page.
      const level = (value) => {
        if (value <= 0) return 'var(--wr-heat-0)'
        const low = model.thresholds[0]
        const mid = model.thresholds[1]
        const high = model.thresholds[2]
        if (value <= low) return 'var(--wr-heat-1)'
        if (value <= mid) return 'var(--wr-heat-2)'
        if (value <= high) return 'var(--wr-heat-3)'
        return 'var(--wr-heat-4)'
      }
      const now = new Date()
      const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

      const cells = []
      model.columns.forEach((column, columnIndex) => {
        for (let row = 0; row < 7; row += 1) {
          const cell = column[row]
          if (!cell || cell.iso === null) {
            cells.push(h('div', { key: `e-${columnIndex}-${row}`, className: 'wr-heat-cell', style: { background: 'transparent' } }))
            continue
          }
          // Days after today are left blank: an outline still reads as a row of
          // dots, and "not yet" needs no decoration at all.
          const future = cell.iso > todayIso
          cells.push(
            h('div', {
              key: cell.iso,
              className: 'wr-heat-cell',
              'data-on': cell.value > 0 ? 'true' : 'false',
              'data-future': future ? 'true' : 'false',
              title: future
                ? null
                : `${cell.iso} · ${cell.value > 0 ? fmtDuration(cell.value) : t('dash.heat.none')}`,
              style: { background: future ? 'transparent' : level(cell.value) },
            }),
          )
        }
      })

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-heat-wrap' },
          h('div', { className: 'wr-heat-days' }, [0, 1, 2, 3, 4, 5, 6].map((row) => h('span', { key: row }, row % 2 === 0 ? weekdayLabel(row) : ''))),
          h(
            'div',
            { style: { minWidth: 0 } },
            h('div', { className: 'wr-heat-months' }, ticks.map((label, index) => h('span', { key: index }, label))),
            h(
              'div',
              {
                className: 'wr-heat',
                title: model.bestDate === '' ? null : t('dash.heat.best', { date: model.bestDate, time: fmtDuration(model.best) }),
              },
              cells,
            ),
          ),
        ),
        // The numbers live under the grid and stay to one line: above it they
        // pushed the calendar away from the card title.
        h(
          'div',
          { className: 'wr-heat-foot' },
          h(
            'div',
            { className: 'wr-heat-legend' },
            h('span', null, t('dash.heat.none')),
            h('span', { className: 'wr-heat-cell' }),
            h('span', { style: { marginLeft: '6px' } }, t('dash.less')),
            ['var(--wr-heat-1)', 'var(--wr-heat-2)', 'var(--wr-heat-3)', 'var(--wr-heat-4)'].map((color, index) =>
              h('span', { key: index, className: 'wr-heat-cell', style: { background: color } })),
            h('span', null, t('dash.more')),
          ),
          h(
            'div',
            { className: 'wr-heat-foot-stats' },
            `${t('dash.heat.active', { days: model.active })} · ${t('dash.heat.total', { time: fmtDuration(model.total) })}`,
          ),
        ),
      )
    }

    function BarList(props) {
      const items = props.items || []
      if (items.length === 0) return h('div', { className: 'wr-muted' }, '—')
      const max = Math.max.apply(null, items.map((item) => item.value).concat([1]))
      return h(
        'div',
        { className: 'wr-bars' },
        items.map((item, index) =>
          h(
            'div',
            { className: 'wr-bar-row', key: `${item.label}-${index}` },
            h('div', { className: 'wr-row-sub', style: { color: 'var(--dsw-alias-label-primary)', fontSize: '12px' }, title: item.label }, item.label),
            h('div', { className: 'wr-bar-track' }, h('div', { className: 'wr-bar-fill', style: { width: `${Math.max(2, (item.value / max) * 100)}%` } })),
            h('div', { className: 'wr-bar-value' }, item.text),
          ),
        ),
      )
    }

    function PeriodCard(props) {
      const period = props.period || {}
      const total = Number(period.totalReadTime) || 0
      return h(
        'div',
        { className: 'wr-stat' },
        h('div', { className: 'wr-stat-label' }, props.label),
        h('div', { className: 'wr-stat-value' }, total > 0 ? fmtDuration(total) : '—'),
        h(
          'div',
          { className: 'wr-stat-hint' },
          h('span', null, `${t('dash.days')} ${Number(period.readDays) || 0}`),
          h('span', null, `${t('dash.avg')} ${period.dayAverageReadTime ? fmtDuration(period.dayAverageReadTime) : '—'}`),
          typeof period.compare === 'number' ? h('span', null, `${period.compare > 0 ? '+' : ''}${Math.round(period.compare * 100)}%`) : null,
        ),
      )
    }

/** Twelve monthly bars for the selected year. */
    function MonthChart(props) {
      const values = Array.isArray(props.values) ? props.values : []
      const activeIndex = Number.isInteger(props.activeIndex) ? props.activeIndex : -1
      const year = Number(props.year) || new Date().getFullYear()
      const now = new Date()
      // Months that have not happened yet are drawn in the track colour instead
      // of vanishing, so a partial year reads as "not yet" rather than "no data".
      const futureFrom = year === now.getFullYear() ? now.getMonth() + 1 : year > now.getFullYear() ? 0 : 13
      const max = Math.max.apply(null, values.concat([1]))
      const cells = []
      for (let index = 0; index < 12; index += 1) {
        const value = values[index] || 0
        const future = index >= futureFrom
        const height = max <= 0 || future ? 0 : Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100))
        cells.push(
          h(
            'div',
            { className: 'wr-hour-col', key: index, title: future ? `${index + 1} · ${t('dash.heat.future')}` : `${index + 1} · ${fmtDuration(value)}` },
            h('div', { className: 'wr-hour-bar', 'data-active': index === activeIndex ? 'true' : 'false', 'data-future': future ? 'true' : 'false', style: { height: future ? '6%' : `${height}%` } }),
            h('div', { className: 'wr-hour-label', 'data-active': index === activeIndex ? 'true' : 'false' }, String(index + 1)),
          ),
        )
      }
      return h('div', { className: 'wr-months' }, cells)
    }

    function Overview(props) {
      const data = props.data || {}
      const dashboard = data.dashboard || {}
      const overall = dashboard.overall || {}
      const currentYear = new Date().getFullYear()

      // One year drives the whole page: the year cursor is the single control.
      const years = useMemo(() => {
        const list = Array.isArray(data.years)
          ? data.years.map((item) => Number(item.year)).filter((item) => Number.isFinite(item) && item > 2000)
          : []
        if (list.length === 0) return [currentYear, currentYear - 1]
        if (!list.includes(currentYear)) list.push(currentYear)
        return Array.from(new Set(list)).sort((a, b) => b - a)
      }, [data.years, currentYear])
      const yearTotals = useMemo(() => {
        const map = new Map()
        for (const item of Array.isArray(data.years) ? data.years : []) map.set(Number(item.year), Number(item.total) || 0)
        return map
      }, [data.years])

      const [year, setYear] = useState(0)
      const [days, setDays] = useState(null)
      const [annual, setAnnual] = useState(null)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')

      useEffect(() => {
        if (year === 0) setYear(years[0])
      }, [year, years])

      useEffect(() => {
        if (!year) return undefined
        let cancelled = false
        setLoading(true)
        setError('')
        apiHeat(year)
          .then((payload) => {
            if (cancelled) return
            setDays((payload && payload.days) || {})
            setAnnual((payload && payload.annual) || null)
          })
          .catch((issue) => {
            if (cancelled) return
            setDays({})
            setAnnual(null)
            setError(String(issue.message || issue))
          })
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
        return () => {
          cancelled = true
        }
      }, [year])

      const activeYear = year || currentYear
      const isCurrent = activeYear === currentYear
      const stats = annual || (isCurrent ? dashboard.annually || {} : {})
      const yearIndex = years.indexOf(activeYear)

      const monthly = useMemo(() => {
        const list = new Array(12).fill(0)
        const readTimes = stats && typeof stats.readTimes === 'object' && stats.readTimes !== null ? stats.readTimes : {}
        for (const [key, value] of Object.entries(readTimes)) {
          const stamp = Number(key)
          const seconds = Number(value) || 0
          if (!Number.isFinite(stamp) || seconds <= 0) continue
          const month = new Date(stamp * 1000).getMonth()
          if (month < 0 || month > 11) continue
          list[month] += seconds
        }
        return list
      }, [stats])

      const delta = useMemo(() => {
        if (typeof stats.compare === 'number') return stats.compare
        const total = Number(stats.totalReadTime) || 0
        const previous = yearTotals.get(activeYear - 1) || 0
        if (previous <= 0 || total <= 0) return null
        return ((total - previous) / previous) * 100
      }, [stats, yearTotals, activeYear])

      const yearCounts = useMemo(() => {
        const count = (list) =>
          Array.isArray(list)
            ? list.filter((item) => {
                const stamp = Number(item.createTime) || 0
                return stamp > 0 && new Date(stamp * 1000).getFullYear() === activeYear
              }).length
            : 0
        return { notes: count(data.notes), thoughts: count(data.thoughts) }
      }, [data.notes, data.thoughts, activeYear])

      const statChips = (Array.isArray(stats.readStat) ? stats.readStat : []).slice(0, 6)
      const categories = (Array.isArray(stats.preferCategory) ? stats.preferCategory : []).map((item) => ({
        label: item.parent && item.title !== item.parent ? `${item.parent} · ${item.title}` : item.title,
        value: Number(item.readingTime) || Number(item.val) || 0,
        text: item.readingCount ? `${item.readingCount} 本` : fmtDuration(item.readingTime),
      }))
      const top = (Array.isArray(stats.readLongest) ? stats.readLongest : []).slice(0, 8)
      const authors = (Array.isArray(stats.preferAuthor) ? stats.preferAuthor : []).slice(0, 6)
      const listenTotal = (Number(stats.wrReadTime) || 0) + (Number(stats.wrListenTime) || 0)
      const readRate =
        typeof stats.readRate === 'number'
          ? stats.readRate
          : listenTotal > 0
            ? (Number(stats.wrReadTime) / listenTotal) * 100
            : null

      const kpi = (label, value, hint) =>
        h(
          'div',
          { className: 'wr-kpi', key: label },
          h('div', { className: 'wr-kpi-value' }, value),
          h('div', { className: 'wr-kpi-label' }, label),
          hint ? h('div', { className: 'wr-kpi-hint' }, hint) : null,
        )

      const yearCard = h(
        'div',
        { className: 'wr-card wr-section', style: { marginTop: '0' } },
        h(
          'div',
          { className: 'wr-heat-top' },
          h('h3', { className: 'wr-section-title', style: { margin: 0 } }, t('dash.yearTitle', { year: activeYear })),
          h('div', { style: { flex: 1 } }),
          h(
            'div',
            { className: 'wr-yearbar', role: 'group', 'aria-label': t('dash.heat.year') },
            h('button', { type: 'button', 'aria-label': t('dash.heat.year'), disabled: yearIndex >= years.length - 1, onClick: () => setYear(years[Math.min(years.length - 1, yearIndex + 1)]) }, '‹'),
            h('strong', null, String(activeYear)),
            h('button', { type: 'button', 'aria-label': t('dash.heat.year'), disabled: yearIndex <= 0, onClick: () => setYear(years[Math.max(0, yearIndex - 1)]) }, '›'),
          ),
        ),
        h(
          'div',
          { className: 'wr-kpis' },
          kpi(t('dash.time'), fmtDuration(stats.totalReadTime)),
          kpi(t('dash.days'), `${Number(stats.readDays) || 0}`),
          kpi(t('dash.avg'), fmtDuration(stats.dayAverageReadTime)),
          kpi(
            t('dash.yearDelta'),
            delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
            String(activeYear - 1),
          ),
          kpi(t('dash.notesCount'), `${yearCounts.notes}`),
          kpi(t('dash.thoughtsCount'), `${yearCounts.thoughts}`),
        ),
        statChips.length > 0
          ? h(
              'div',
              { className: 'wr-flex', style: { marginTop: '12px' } },
              statChips.map((item, index) => {
                const key = `dash.stat.${item.stat}`
                const label = t(key)
                return h('span', { key: index, className: 'wr-chip-stat' }, `${label === key ? item.stat : label} ${item.counts || ''}`)
              }),
              stats.preferTimeWord ? h('span', { className: 'wr-muted' }, stats.preferTimeWord) : null,
              stats.rank ? h('span', { className: 'wr-muted' }, stats.rank) : null,
            )
          : null,
      )

      const heatCard = h(
        'div',
        { className: 'wr-card wr-section' },
        h(
          'div',
          { className: 'wr-heat-top' },
          h('h3', { className: 'wr-section-title', style: { margin: 0 } }, t('dash.heat'), h('span', { className: 'wr-section-hint' }, t('dash.heatHint'))),
        ),
        error !== ''
          ? h('div', { className: 'wr-muted' }, error)
          : loading
            ? h('div', { className: 'wr-muted' }, t('dash.heat.loading', { year: activeYear }))
            : days !== null && Object.keys(days).length === 0
              ? h('div', { className: 'wr-muted' }, t('dash.heat.empty'))
              : h(Heatmap, { year: activeYear, days: days || {} }),
      )

      return h(
        'div',
        null,
        yearCard,
        heatCard,
        Number(stats.totalReadTime) > 0
          ? null
          : h('div', { className: 'wr-banner', style: { marginTop: '14px' } }, t('dash.yearEmpty', { year: activeYear })),
        h(
          'div',
          { className: 'wr-split wr-section' },
          h('div', { className: 'wr-card' }, h('h3', { className: 'wr-section-title' }, t('dash.month')), h(MonthChart, { values: monthly, year, activeIndex: isCurrent ? new Date().getMonth() : -1 })),
          h('div', { className: 'wr-card' }, h('h3', { className: 'wr-section-title' }, t('dash.category')), h(BarList, { items: categories })),
        ),
        h(
          'div',
          { className: 'wr-split wr-section' },
          h(
            'div',
            { className: 'wr-card' },
            h('h3', { className: 'wr-section-title' }, t('dash.top')),
            top.length === 0
              ? h('div', { className: 'wr-muted' }, '—')
              : h(
                  'div',
                  { className: 'wr-list' },
                  top.map((item, index) =>
                    h(
                      'div',
                      { className: 'wr-row', key: `${item.title}-${index}` },
                      h('div', { className: 'wr-row-rank' }, String(index + 1)),
                      h('div', { className: 'wr-row-cover' }, h(Cover, { book: item })),
                      h('div', { className: 'wr-row-main' }, h('div', { className: 'wr-row-title' }, item.title), h('div', { className: 'wr-row-sub' }, item.author || '')),
                      h('div', { className: 'wr-row-tail' }, fmtDuration(item.readTime)),
                    ),
                  ),
                ),
          ),
          h(
            'div',
            { className: 'wr-card' },
            h('h3', { className: 'wr-section-title' }, t('dash.author')),
            authors.length === 0
              ? h('div', { className: 'wr-muted' }, '—')
              : h(
                  'div',
                  { className: 'wr-list' },
                  authors.map((item, index) =>
                    h(
                      'div',
                      { className: 'wr-row', key: `${item.name}-${index}` },
                      h('div', { className: 'wr-row-rank' }, String(index + 1)),
                      h('div', { className: 'wr-row-main' }, h('div', { className: 'wr-row-title' }, item.name), h('div', { className: 'wr-row-sub' }, `${item.count} 本`)),
                      h('div', { className: 'wr-row-tail' }, item.readTime || ''),
                    ),
                  ),
                ),
          ),
        ),
        h(
          'div',
          { className: 'wr-split wr-section' },
          h(
            'div',
            { className: 'wr-card' },
            h('h3', { className: 'wr-section-title' }, t('dash.readRate')),
            readRate === null
              ? h('div', { className: 'wr-muted' }, '—')
              : h(
                  'div',
                  { className: 'wr-flex', style: { gap: '18px', alignItems: 'center' } },
                  h(Ring, { value: readRate, caption: t('dash.readRate'), label: t('dash.readRate') }),
                  h(
                    'div',
                    { className: 'wr-list', style: { flex: 1, minWidth: 0 } },
                    h('div', { className: 'wr-row' }, h('div', { className: 'wr-row-main' }, h('div', { className: 'wr-row-title' }, t('dash.text')), h('div', { className: 'wr-row-sub' }, fmtDuration(stats.wrReadTime)))),
                    h('div', { className: 'wr-row' }, h('div', { className: 'wr-row-main' }, h('div', { className: 'wr-row-title' }, t('dash.audio')), h('div', { className: 'wr-row-sub' }, fmtDuration(stats.wrListenTime)))),
                  ),
                ),
          ),
          h(
            'div',
            { className: 'wr-card' },
            h('h3', { className: 'wr-section-title' }, t('dash.hour'), h('span', { className: 'wr-section-hint' }, t('dash.hourAll'))),
            h(HourChart, { values: overall.preferTime || [] }),
          ),
        ),
        isCurrent
          ? h('div', { className: 'wr-stats wr-section' }, ['weekly', 'monthly'].map((key) => h(PeriodCard, { key, label: t(`dash.period.${key}`), period: dashboard[key] || {} })))
          : null,
      )
    }

    function ShelfView(props) {
      const data = props.data || {}
      const books = Array.isArray(data.books) ? data.books : []
      const categories = Array.isArray(data.categories) ? data.categories : []
      const [category, setCategory] = useState('all')
      const [query, setQuery] = useState('')
      const [sort, setSort] = useState('recent')
      const [year, setYear] = useState('all')

      // Every book is filed under the year it was last read, so the shelf can be
      // browsed year by year. Books that were never opened have no year (0).
      const bookYear = (book) => {
        const stamp = Number(book.readUpdateTime || book.lastNoteTime) || 0
        return stamp > 0 ? new Date(stamp * 1000).getFullYear() : 0
      }
      const yearOptions = useMemo(() => {
        const counts = new Map()
        for (const book of books) {
          const value = bookYear(book)
          counts.set(value, (counts.get(value) || 0) + 1)
        }
        return Array.from(counts.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([value, count]) => ({ value: String(value), count }))
      }, [books])
      const yearScope = useMemo(() => {
        if (year === 'all') return books
        return books.filter((book) => String(bookYear(book)) === year)
      }, [books, year])
      const chipCounts = useMemo(() => {
        const counts = new Map()
        for (const book of yearScope) {
          const group = book.group || '其他'
          counts.set(group, (counts.get(group) || 0) + 1)
        }
        return counts
      }, [yearScope])

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        const list = yearScope.filter((book) => {
          if (category !== 'all' && (book.group || '其他') !== category) return false
          if (needle === '') return true
          if (contains(book.title, needle) || contains(book.author, needle) || contains(book.category, needle) || contains(book.group, needle)) return true
          return String(bookYear(book)).includes(needle)
        })
        const sorted = list.slice()
        if (sort === 'title') sorted.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'zh-Hans-CN'))
        else if (sort === 'notes') sorted.sort((a, b) => (b.noteCount || 0) + (b.reviewCount || 0) - ((a.noteCount || 0) + (a.reviewCount || 0)))
        else sorted.sort((a, b) => (b.readUpdateTime || b.lastNoteTime || 0) - (a.readUpdateTime || a.lastNoteTime || 0))
        return sorted
      }, [yearScope, category, query, sort, year])

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-toolbar' },
          h('input', { className: 'wr-input', style: { width: '240px' }, placeholder: t('shelf.search'), value: query, onChange: (event) => setQuery(event.target.value) }),
          h(
            'select',
            { className: 'wr-select', value: sort, onChange: (event) => setSort(event.target.value) },
            h('option', { value: 'recent' }, t('shelf.sort.recent')),
            h('option', { value: 'notes' }, t('shelf.sort.notes')),
            h('option', { value: 'title' }, t('shelf.sort.title')),
          ),
          h(
            'select',
            { className: 'wr-select', style: { maxWidth: '150px' }, title: t('shelf.yearHint'), value: year, onChange: (event) => setYear(event.target.value) },
            h('option', { value: 'all' }, t('shelf.yearAll')),
            yearOptions.map((item) => h('option', { key: item.value, value: item.value }, `${item.value === '0' ? t('shelf.yearNone') : item.value} · ${item.count}`)),
          ),
          h('div', { className: 'wr-toolbar-fill' }),
          h('span', { className: 'wr-muted' }, t('shelf.count', { count: filtered.length })),
        ),
        h(
          'div',
          { className: 'wr-chips', style: { marginBottom: '16px' } },
          h('button', { className: 'wr-chip', type: 'button', 'data-active': category === 'all', onClick: () => setCategory('all') }, `${t('shelf.all')} ${yearScope.length}`),
          categories
            .filter((item) => (chipCounts.get(item.name) || 0) > 0)
            .map((item) =>
              h('button', { key: item.name, className: 'wr-chip', type: 'button', 'data-active': category === item.name, onClick: () => setCategory(item.name) }, `${item.name} ${chipCounts.get(item.name) || 0}`),
            ),
        ),
        filtered.length === 0
          ? h('div', { className: 'wr-empty' }, h('strong', null, t('shelf.empty')))
          : h('div', { className: 'wr-grid' }, filtered.map((book) => h(BookCard, { key: book.bookId, book, onOpen: props.onOpenBook }))),
      )
    }

    /** Clipboard write with a fallback for webviews without the async API. */
    async function copyText(text) {
      const value = String(text || '')
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(value)
          return true
        }
      } catch {
        // fall through to the legacy path
      }
      try {
        const area = document.createElement('textarea')
        area.value = value
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
      } catch {
        return false
      }
    }

    function CopyButton(props) {
      const [done, setDone] = useState(false)
      const timer = useRef(0)
      useEffect(
        () => () => {
          if (timer.current) clearTimeout(timer.current)
        },
        [],
      )
      const onCopy = async (event) => {
        if (event && event.stopPropagation) event.stopPropagation()
        const ok = await copyText(props.text)
        if (!ok) return
        setDone(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setDone(false), 1400)
      }
      return h(
        'button',
        { className: 'wr-copy', type: 'button', 'data-done': done, 'aria-label': t('action.copy'), onClick: onCopy },
        done ? t('action.copied') : t('action.copy'),
      )
    }

    /** Text with every case-insensitive hit of `needle` wrapped in <mark>. */
    function MarkedText(props) {
      const text = String(props.text || '')
      const needle = String(props.needle || '').toLowerCase()
      const className = props.className
      if (needle === '') return h('p', { className }, text)
      const lower = text.toLowerCase()
      const parts = []
      let at = 0
      let index = lower.indexOf(needle)
      let key = 0
      while (index >= 0) {
        if (index > at) parts.push(text.slice(at, index))
        parts.push(h('mark', { key: `hit${key}`, className: 'wr-mark' }, text.slice(index, index + needle.length)))
        key += 1
        at = index + needle.length
        index = lower.indexOf(needle, at)
      }
      if (at < text.length) parts.push(text.slice(at))
      return h('p', { className }, parts)
    }

    /** The small circle that puts a card into a batch export. */
    function PickButton(props) {
      return h(
        'button',
        {
          className: 'wr-pick',
          type: 'button',
          'data-on': props.on ? 'true' : 'false',
          'aria-label': t('export.select'),
          title: t('export.select'),
          onClick: (event) => {
            if (event && event.stopPropagation) event.stopPropagation()
            if (typeof props.onChange === 'function') props.onChange()
          },
        },
        props.on ? '✓' : '',
      )
    }

    function NoteRow(props) {
      const note = props.note
      const open = typeof props.onOpen === 'function' ? props.onOpen : null
      const pick = typeof props.onToggle === 'function' ? h(PickButton, { on: Boolean(props.selected), onChange: props.onToggle }) : null
      return h(
        'div',
        { className: 'wr-quote', 'data-clickable': open ? 'true' : 'false', 'data-picked': props.selected ? 'true' : 'false', title: open ? t('action.openBook') : undefined, onClick: open || undefined },
        pick,
        h(MarkedText, { className: 'wr-quote-text', text: note.text, needle: props.needle }),
        h(
          'div',
          { className: 'wr-quote-foot' },
          h('span', { className: 'wr-quote-book', title: note.bookTitle }, note.bookTitle || ''),
          note.chapterTitle ? h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `· ${note.chapterTitle}`) : null,
          h(
            'div',
            { className: 'wr-quote-tail' },
            h('span', null, fmtDate(note.createTime)),
            h(CopyButton, { text: note.text }),
          ),
        ),
      )
    }

    // A thought is the reader's own voice, so the card gives the text room:
    // wider line height, no clamped source label, and the left rail is a quiet
    // sage hairline instead of an accent bar. In the wall view the card has no
    // border at all and relies on spacing.
    const THOUGHT_CLAMP_CHARS = 220

    function ThoughtRow(props) {
      const thought = props.thought
      const open = typeof props.onOpen === 'function' ? props.onOpen : null
      const pick = typeof props.onToggle === 'function' ? h(PickButton, { on: Boolean(props.selected), onChange: props.onToggle }) : null
      const content = String(thought.content || '')
      const clampable = Boolean(props.wall) && content.length > THOUGHT_CLAMP_CHARS
      const [expanded, setExpanded] = useState(false)
      const [threadOpen, setThreadOpen] = useState(false)
      const context = Array.isArray(props.context) ? props.context : []
      const slice = context.slice(0, 6)
      const showClamped = clampable && !expanded
      return h(
        'div',
        { className: 'wr-thought', 'data-clickable': open ? 'true' : 'false', 'data-picked': props.selected ? 'true' : 'false', title: open ? t('action.openBook') : undefined, onClick: open || undefined },
        pick,
        h(MarkedText, { className: showClamped ? 'wr-quote-text wr-clamp' : 'wr-quote-text', text: content, needle: props.needle }),
        clampable
          ? h(
              'button',
              {
                className: 'wr-more',
                type: 'button',
                onClick: (event) => {
                  if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
                  setExpanded(!expanded)
                },
              },
              expanded ? t('thought.collapse') : t('thought.expand', { count: String(content.length - THOUGHT_CLAMP_CHARS) }),
            )
          : null,
        h(
          'div',
          { className: 'wr-quote-foot' },
          h('span', { className: 'wr-quote-book', title: thought.bookTitle }, thought.bookTitle || ''),
          thought.chapterName ? h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `· ${thought.chapterName}`) : null,
          h(
            'div',
            { className: 'wr-quote-tail' },
            thought.star >= 0 ? h('span', { className: 'wr-stars' }, '★'.repeat(Math.min(5, Math.max(0, thought.star)))) : null,
            h('span', null, fmtDate(thought.createTime)),
            h(CopyButton, { text: content }),
          ),
        ),
        // WeRead does not link a thought to the exact highlight it answers, so
        // this is chapter-level context only, labelled as such.
        slice.length === 0
          ? null
          : threadOpen
            ? h(
                'div',
                { className: 'wr-thread' },
                h('div', { className: 'wr-thread-title' }, t('thought.contextTitle')),
                slice.map((note) =>
                  h(
                    'div',
                    { className: 'wr-thread-item', key: note.id },
                    `> ${String(note.text || '').slice(0, 300)}`,
                    h('span', { className: 'wr-thread-date' }, fmtDate(note.createTime)),
                  )),
              )
            : h(
                'button',
                {
                  className: 'wr-thread-toggle',
                  type: 'button',
                  onClick: (event) => {
                    if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
                    setThreadOpen(true)
                  },
                },
                t('thought.contextToggle', { count: String(context.length) }),
              ),
      )
    }

    // ---------------------------------------------------------------- export
    function fmtBytes(bytes) {
      const value = Number(bytes) || 0
      if (value < 1024) return `${value} B`
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
      return `${(value / 1024 / 1024).toFixed(1)} MB`
    }

    function saveBlob(filename, text, type) {
      try {
        const blob = new Blob([text], { type: type || 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        setTimeout(() => URL.revokeObjectURL(url), 4000)
        return true
      } catch {
        return false
      }
    }

    const EXPORT_OPTIONS = [
      ['excerpts', 'export.opt.excerpts'],
      ['thoughts', 'export.opt.thoughts'],
      ['meta', 'export.opt.meta'],
      ['chapter', 'export.opt.chapter'],
      ['star', 'export.opt.star'],
      ['sourceUrl', 'export.opt.sourceUrl'],
    ]

    /** Preview / copy / download / save-to-folder for one selection. */
    function ExportPanel(props) {
      const selector = props.selector || {}
      const [options, setOptions] = useState({ excerpts: true, thoughts: true, meta: true, chapter: true, star: true, sourceUrl: true })
      const [preview, setPreview] = useState(null)
      const [busy, setBusy] = useState(true)
      const [saving, setSaving] = useState(false)
      const [message, setMessage] = useState('')
      const [dir, setDir] = useState('')
      const selectorKey = JSON.stringify(selector)

      useEffect(() => {
        let cancelled = false
        void (async () => {
          try {
            const info = await apiExportDir()
            if (!cancelled) setDir(info.dir || '')
          } catch {
            // the directory is informational only
          }
        })()
        return () => {
          cancelled = true
        }
      }, [])

      useEffect(() => {
        let cancelled = false
        setBusy(true)
        void (async () => {
          try {
            const result = await apiExport(JSON.parse(selectorKey), options, 'preview')
            if (cancelled) return
            setPreview(result)
            setMessage('')
          } catch (error) {
            if (!cancelled) setMessage(t('export.failed', { error: String(error.message || error) }))
          } finally {
            if (!cancelled) setBusy(false)
          }
        })()
        return () => {
          cancelled = true
        }
      }, [selectorKey, options])

      const toggleOption = (key) => setOptions((prev) => ({ ...prev, [key]: !prev[key] }))

      const lines = preview ? String(preview.markdown || '').split('\n') : []
      const shown = lines.slice(0, 30)

      const onSave = async () => {
        setSaving(true)
        setMessage('')
        try {
          const result = await apiExport(JSON.parse(selectorKey), options, 'file')
          setMessage(t('export.saved', { files: result.path || '' }))
        } catch (error) {
          setMessage(t('export.failed', { error: String(error.message || error) }))
        } finally {
          setSaving(false)
        }
      }

      const summary =
        preview === null
          ? busy
            ? t('state.loading')
            : ''
          : t('export.summary', { entries: fmtCount((preview.excerpts || 0) + (preview.thoughts || 0)), books: fmtCount(preview.books || 0) })

      return h(
        'div',
        { className: 'wr-modal-mask', onMouseDown: (event) => { if (event.target === event.currentTarget) props.onClose() } },
        h(
          'div',
          {
            className: 'wr-modal wr-export',
            role: 'dialog',
            'aria-modal': 'true',
            onKeyDown: (event) => {
              if (event.key === 'Escape') props.onClose()
            },
          },
          h('div', { className: 'wr-export-head' },
            h('h3', null, t('export.title')),
            h('span', { className: 'wr-muted' }, summary),
          ),
          h(
            'div',
            { className: 'wr-export-opts' },
            h('span', { className: 'wr-muted' }, t('export.options')),
            EXPORT_OPTIONS.map(([key, label]) =>
              h(
                'button',
                { key, className: 'wr-chip', type: 'button', 'data-active': options[key] ? 'true' : 'false', onClick: () => toggleOption(key) },
                t(label),
              ),
            ),
          ),
          h(
            'div',
            { className: 'wr-export-body' },
            busy
              ? h('div', { className: 'wr-empty' }, h('span', { className: 'wr-spinner' }), h('div', { style: { marginTop: '10px' } }, t('state.loading')))
              : preview === null || lines.length === 0
                ? h('div', { className: 'wr-empty' }, h('strong', null, t('export.emptySelection')))
                : h(
                    'div',
                    null,
                    h('div', { className: 'wr-export-label' },
                      h('span', null, t('export.previewLabel')),
                      h('span', { className: 'wr-muted' }, t('export.previewHint', { lines: String(shown.length), total: String(lines.length), bytes: fmtBytes(preview.bytes) })),
                    ),
                    h('pre', { className: 'wr-export-preview' }, shown.join('\n')),
                  ),
          ),
          message ? h('p', { className: 'wr-notice', style: { marginTop: '12px' } }, message) : null,
          dir ? h('p', { className: 'wr-muted', style: { marginTop: '10px', wordBreak: 'break-all' } }, t('settings.exportDir') + `：${dir}`) : null,
          h(
            'div',
            { className: 'wr-modal-foot' },
            h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: props.onClose }, t('export.close')),
            preview && lines.length > 0
              ? h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: () => void copyText(preview.markdown) }, t('export.copyAll'))
              : null,
            preview && lines.length > 0
              ? h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: () => saveBlob(preview.filename || 'export.md', preview.markdown) }, t('export.download'))
              : null,
            h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: saving || busy || !preview || lines.length === 0, onClick: () => void onSave() }, saving ? t('export.saving') : t('export.save')),
          ),
        ),
      )
    }

    function StreamView(props) {
      const data = props.data || {}
      const kind = props.kind === 'thought' ? 'thought' : 'note'
      const source = kind === 'note' ? data.notes || [] : data.thoughts || []
      const [query, setQuery] = useState('')
      const [bookFilter, setBookFilter] = useState('all')
      const [mode, setMode] = useState('wall')
      const [page, setPage] = useState(0)
      const [selected, setSelected] = useState(new Set())
      const [exporting, setExporting] = useState(null)

      const bookOptions = useMemo(() => {
        const seen = new Map()
        for (const item of source) {
          if (!item.bookId) continue
          seen.set(item.bookId, item.bookTitle || item.bookId)
        }
        return Array.from(seen.entries()).sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'zh-Hans-CN'))
      }, [source])

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return source.filter((item) => {
          if (bookFilter !== 'all' && item.bookId !== bookFilter) return false
          if (needle === '') return true
          if (kind === 'note') return contains(item.text, needle) || contains(item.bookTitle, needle) || contains(item.chapterTitle, needle) || contains(item.author, needle)
          return contains(item.content, needle) || contains(item.bookTitle, needle) || contains(item.chapterName, needle) || contains(item.author, needle)
        })
      }, [source, query, bookFilter, kind])

      // Thoughts carry a chapter name, highlights a chapter title, and WeRead
      // does not link them; chapter-level context is the only honest pairing.
      const chapterIndex = useMemo(() => {
        const map = new Map()
        for (const note of data.notes || []) {
          const key = `${note.bookId}|${note.chapterTitle || ''}`
          const bucket = map.get(key)
          if (bucket) bucket.push(note)
          else map.set(key, [note])
        }
        return map
      }, [data.notes])
      const contextOf = (thought) => (thought.chapterName ? chapterIndex.get(`${thought.bookId}|${thought.chapterName}`) || [] : [])

      useEffect(() => {
        setPage(0)
        setSelected(new Set())
      }, [query, bookFilter, kind, mode])

      const pageSize = kind === 'note' ? 24 : 20
      const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
      const current = Math.min(page, pageCount - 1)
      const visible = filtered.slice(current * pageSize, current * pageSize + pageSize)

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-toolbar' },
          h('input', {
            className: 'wr-input',
            style: { width: '260px' },
            placeholder: t(kind === 'note' ? 'note.search' : 'thought.search'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          h(
            'select',
            {
              className: 'wr-select',
              style: { maxWidth: '240px' },
              title: t('filter.allBooks'),
              value: bookFilter,
              onChange: (event) => setBookFilter(event.target.value),
            },
            h('option', { value: 'all' }, t('filter.allBooks')),
            // Titles are cut short: a 40-character name would otherwise blow the
            // native popup out to the width of the whole window.
            bookOptions.map(([id, title]) => h('option', { key: id, value: id, title }, clip(title, 24))),
          ),
          h('div', { className: 'wr-toolbar-fill' }),
          selected.size > 0 ? h('span', { className: 'wr-chip-stat' }, t('export.selected', { count: String(selected.size) })) : null,
          h(
            'button',
            {
              className: 'wr-btn wr-btn-ghost',
              type: 'button',
              disabled: visible.length === 0,
              onClick: () => {
                const next = new Set(selected)
                const drop = visible.every((item) => next.has(item.id))
                for (const item of visible) {
                  if (drop) next.delete(item.id)
                  else next.add(item.id)
                }
                setSelected(next)
              },
            },
            t('export.selectPage'),
          ),
          selected.size > 0
            ? h(
                'button',
                { className: 'wr-btn', type: 'button', onClick: () => setExporting(kind === 'note' ? { noteIds: Array.from(selected) } : { thoughtIds: Array.from(selected) }) },
                t('export.exportSelected'),
              )
            : null,
          selected.size > 0 ? h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: () => setSelected(new Set()) }, t('export.clear')) : null,
          h(
            'button',
            {
              className: 'wr-btn wr-btn-ghost',
              type: 'button',
              disabled: filtered.length === 0,
              onClick: () => setExporting(kind === 'note' ? { noteIds: filtered.map((item) => item.id) } : { thoughtIds: filtered.map((item) => item.id) }),
            },
            t('export.exportAll'),
          ),
          h('span', { className: 'wr-muted' }, `${filtered.length}`),
          h(
            'div',
            { className: 'wr-tabs' },
            h('button', { className: 'wr-tab', type: 'button', 'data-active': mode === 'wall', onClick: () => setMode('wall') }, t('view.wall')),
            h('button', { className: 'wr-tab', type: 'button', 'data-active': mode === 'list', onClick: () => setMode('list') }, t('view.list')),
          ),
        ),
        filtered.length === 0
          ? h(
              'div',
              { className: 'wr-empty' },
              h('strong', null, t(kind === 'note' ? 'empty.notes' : 'empty.thoughts')),
              h('span', null, t(kind === 'note' ? 'empty.notesHint' : 'empty.thoughtsHint')),
            )
          : h(
              'div',
              { className: mode === 'wall' ? 'wr-cols' : 'wr-list' },
              visible.map((item) => {
                const pick = () =>
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (next.has(item.id)) next.delete(item.id)
                    else next.add(item.id)
                    return next
                  })
                return kind === 'note'
                  ? h(NoteRow, { key: item.id, note: item, needle: query.trim(), selected: selected.has(item.id), onToggle: pick, onOpen: props.onOpenBook ? () => props.onOpenBook(item.bookId, kind) : null })
                  : h(ThoughtRow, {
                      key: item.id,
                      thought: item,
                      needle: query.trim(),
                      wall: mode === 'wall',
                      context: contextOf(item),
                      selected: selected.has(item.id),
                      onToggle: pick,
                      onOpen: props.onOpenBook ? () => props.onOpenBook(item.bookId, kind) : null,
                    })
              }),
            ),
        filtered.length > pageSize
          ? h(
              'div',
              { className: 'wr-pager' },
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: current === 0, onClick: () => setPage(Math.max(0, current - 1)) }, `‹${t('pager.prev')}`),
              h('span', { className: 'wr-muted' }, t('pager.page', { page: String(current + 1), total: String(pageCount) })),
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: current >= pageCount - 1, onClick: () => setPage(Math.min(pageCount - 1, current + 1)) }, `${t('pager.next')} →`),
            )
          : null,
        exporting ? h(ExportPanel, { selector: exporting, onClose: () => setExporting(null) }) : null,
      )
    }

    function BookView(props) {
      const book = props.book || {}
      const data = props.data || {}
      const [tab, setTab] = useState(props.initialTab === 'thoughts' ? 'thoughts' : 'notes')
      const [query, setQuery] = useState('')
      const [page, setPage] = useState(0)
      const [exporting, setExporting] = useState(false)

      const notes = useMemo(() => (data.notes || []).filter((note) => note.bookId === book.bookId), [data.notes, book.bookId])
      const thoughts = useMemo(() => (data.thoughts || []).filter((thought) => thought.bookId === book.bookId), [data.thoughts, book.bookId])
      // Highlights grouped by chapter: the only honest context a thought can
      // show, because WeRead never links a thought to one specific highlight.
      const chapterIndex = useMemo(() => {
        const map = new Map()
        for (const note of notes) {
          const key = note.chapterTitle || ''
          if (key === '') continue
          const bucket = map.get(key)
          if (bucket) bucket.push(note)
          else map.set(key, [note])
        }
        return map
      }, [notes])
      const needle = query.trim().toLowerCase()
      const visibleNotes = needle === '' ? notes : notes.filter((note) => contains(note.text, needle) || contains(note.chapterTitle, needle))
      const visibleThoughts = needle === '' ? thoughts : thoughts.filter((thought) => contains(thought.content, needle) || contains(thought.chapterName, needle))

      useEffect(() => {
        setPage(0)
      }, [tab, query])

      const activeList = tab === 'notes' ? visibleNotes : visibleThoughts
      const pageSize = 24
      const pageCount = Math.max(1, Math.ceil(activeList.length / pageSize))
      const current = Math.min(page, pageCount - 1)
      const pageItems = activeList.slice(current * pageSize, current * pageSize + pageSize)

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-toolbar' },
          h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: props.onBack }, `← ${t('book.back')}`),
        ),
        h(
          'div',
          { className: 'wr-detail-head' },
          h('div', { className: 'wr-detail-cover' }, h(Cover, { book })),
          h(
            'div',
            { className: 'wr-detail-main' },
            h('h2', { className: 'wr-detail-title' }, book.title || '未命名'),
            h('div', { className: 'wr-detail-author' }, book.author || '—'),
            h(
              'div',
              { className: 'wr-flex' },
              book.group && book.group !== book.category ? h('span', { className: 'wr-badge', style: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', border: '1px solid var(--dsw-alias-border-l1)' } }, book.group) : null,
              book.category ? h('span', { className: 'wr-badge', style: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-secondary)', border: '1px solid var(--dsw-alias-border-l1)' } }, book.category) : null,
              book.finishReading === 1 ? h('span', { className: 'wr-badge', style: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-secondary)', border: '1px solid var(--dsw-alias-border-l1)' } }, t('shelf.finished')) : null,
              book.rating > 0 ? h('span', { className: 'wr-badge', style: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-state-warn-primary)', border: '1px solid var(--dsw-alias-border-l1)' } }, `${t('book.rating')} ${(book.rating / 10).toFixed(1)}${book.ratingCount > 0 ? ` (${fmtCount(book.ratingCount)})` : ''}`) : null,
              book.publisher ? h('span', { className: 'wr-badge', style: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-secondary)', border: '1px solid var(--dsw-alias-border-l1)' } }, book.publisher) : null,
              book.publishYear ? h('span', { className: 'wr-badge', style: { background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-secondary)', border: '1px solid var(--dsw-alias-border-l1)' } }, `${t('book.year')} ${book.publishYear}`) : null,
            ),
            book.readingProgress > 0
              ? h(
                  'div',
                  { style: { marginTop: '6px', maxWidth: '320px' } },
                  h('div', { className: 'wr-row-sub' }, `${t('book.progress')} ${Math.round(book.readingProgress)}%`),
                  h('div', { className: 'wr-progress' }, h('span', { style: { width: `${Math.max(2, Math.min(100, book.readingProgress))}%` } })),
                )
              : null,
            book.intro ? h('p', { className: 'wr-notice', style: { maxHeight: '80px', overflow: 'auto' } }, book.intro) : null,
          ),
        ),
        h(
          'div',
          { className: 'wr-toolbar', style: { marginTop: '18px' } },
          h(
            'div',
            { className: 'wr-tabs' },
            h('button', { className: 'wr-tab', type: 'button', 'data-active': tab === 'notes', onClick: () => setTab('notes') }, `${t('nav.notes')} ${notes.length}`),
            h('button', { className: 'wr-tab', type: 'button', 'data-active': tab === 'thoughts', onClick: () => setTab('thoughts') }, `${t('nav.thoughts')} ${thoughts.length}`),
          ),
          h('input', { className: 'wr-input', style: { width: '240px' }, placeholder: t('book.searchNotes'), value: query, onChange: (event) => setQuery(event.target.value) }),
          h('div', { className: 'wr-toolbar-fill' }),
          h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: notes.length + thoughts.length === 0, onClick: () => setExporting(true) }, t('export.book')),
        ),
        activeList.length === 0
          ? h('div', { className: 'wr-empty' }, h('strong', null, t('book.empty')))
          : h(
              'div',
              { className: 'wr-cols' },
              pageItems.map((item) =>
                tab === 'notes'
                  ? h(NoteRow, { key: item.id, note: item, needle: needle })
                  : h(ThoughtRow, { key: item.id, thought: item, needle: needle, wall: true, context: chapterIndex.get(item.chapterName || '') || [] }),
              ),
            ),
        activeList.length > pageSize
          ? h(
              'div',
              { className: 'wr-pager' },
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: current === 0, onClick: () => setPage(Math.max(0, current - 1)) }, `‹${t('pager.prev')}`),
              h('span', { className: 'wr-muted' }, t('pager.page', { page: String(current + 1), total: String(pageCount) })),
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: current >= pageCount - 1, onClick: () => setPage(Math.min(pageCount - 1, current + 1)) }, `${t('pager.next')} →`),
            )
          : null,
        exporting ? h(ExportPanel, { selector: { bookIds: [book.bookId] }, onClose: () => setExporting(false) }) : null,
      )
    }

    function SearchResults(props) {
      const query = props.query.trim()
      const needle = query.toLowerCase()
      const data = props.data || {}
      const [type, setType] = useState('all')
      const groups = useMemo(() => {
        if (needle === '') return { books: [], notes: [], thoughts: [] }
        return {
          books: (data.books || []).filter((book) => contains(book.title, needle) || contains(book.author, needle) || contains(book.category, needle)).slice(0, 12),
          notes: (data.notes || []).filter((note) => contains(note.text, needle) || contains(note.bookTitle, needle) || contains(note.chapterTitle, needle)).slice(0, 30),
          thoughts: (data.thoughts || []).filter((thought) => contains(thought.content, needle) || contains(thought.bookTitle, needle)).slice(0, 30),
        }
      }, [data, needle])

      const bookIndex = useMemo(() => {
        const index = new Map()
        for (const book of data.books || []) index.set(book.bookId, book)
        return index
      }, [data])
      const openBookOf = (bookId, tab) => {
        const book = bookIndex.get(bookId)
        if (book && typeof props.onOpenBook === 'function') props.onOpenBook(book, tab)
      }

      const total = groups.books.length + groups.notes.length + groups.thoughts.length
      if (total === 0) return h('div', { className: 'wr-empty' }, h('strong', null, t('search.empty', { query })))

      const show = (key) => type === 'all' || type === key
      const chips = [
        ['all', t('search.typeAll'), total],
        ['books', t('search.typeBooks'), groups.books.length],
        ['notes', t('search.notes'), groups.notes.length],
        ['thoughts', t('search.thoughts'), groups.thoughts.length],
      ]

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-toolbar' },
          h(
            'div',
            { className: 'wr-chips' },
            chips.map(([key, label, count]) =>
              h('button', { key, className: 'wr-chip', type: 'button', 'data-active': type === key, onClick: () => setType(key) }, `${label} ${count}`),
            ),
          ),
          h('div', { className: 'wr-toolbar-fill' }),
        ),
        show('books') && groups.books.length > 0
          ? h(
              'div',
              { className: 'wr-section' },
              h('h3', { className: 'wr-section-title' }, t('search.books'), h('span', { className: 'wr-section-hint' }, String(groups.books.length))),
              h('div', { className: 'wr-grid' }, groups.books.map((book) => h(BookCard, { key: book.bookId, book, onOpen: props.onOpenBook }))),
            )
          : null,
        show('notes') && groups.notes.length > 0
          ? h(
              'div',
              { className: 'wr-section' },
              h('h3', { className: 'wr-section-title' }, t('search.notes'), h('span', { className: 'wr-section-hint' }, String(groups.notes.length))),
              h('div', { className: 'wr-cols' }, groups.notes.map((note) => h(NoteRow, { key: note.id, note, needle, onOpen: () => openBookOf(note.bookId, 'notes') }))),
            )
          : null,
        show('thoughts') && groups.thoughts.length > 0
          ? h(
              'div',
              { className: 'wr-section' },
              h('h3', { className: 'wr-section-title' }, t('search.thoughts'), h('span', { className: 'wr-section-hint' }, String(groups.thoughts.length))),
              h('div', { className: 'wr-cols' }, groups.thoughts.map((thought) => h(ThoughtRow, { key: thought.id, thought, needle, wall: true, onOpen: () => openBookOf(thought.bookId, 'thoughts') }))),
            )
          : null,
      )
    }

    function SettingsModal(props) {
      const state = props.state || {}
      const [key, setKey] = useState('')
      const [maxBooks, setMaxBooks] = useState(String(state.maxBooks || 60))
      const [notesPerBook, setNotesPerBook] = useState(String(state.notesPerBook || 200))
      const [busy, setBusy] = useState(false)
      const [message, setMessage] = useState('')
      const [dir, setDir] = useState(state.exportDir || '')
      const [dataMessage, setDataMessage] = useState('')
      const [pending, setPending] = useState(null)
      const [busyData, setBusyData] = useState(false)
      const fileRef = useRef(null)

      const saveDir = async () => {
        setBusyData(true)
        setDataMessage('')
        try {
          const next = await apiSetExportDir(dir.trim())
          if (next && next.dir) setDir(next.dir)
          props.onChanged(next)
          setDataMessage(t('settings.dirSaved'))
        } catch (error) {
          setDataMessage(String(error.message || error))
        } finally {
          setBusyData(false)
        }
      }

      const downloadBackup = async () => {
        setBusyData(true)
        setDataMessage('')
        try {
          const payload = await apiBackup()
          const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)
          saveBlob(`weread-gather-backup-${stamp}.json`, JSON.stringify(payload.bundle, null, 2), 'application/json;charset=utf-8')
          setDataMessage(`${t('settings.backup')} ✓`)
        } catch (error) {
          setDataMessage(String(error.message || error))
        } finally {
          setBusyData(false)
        }
      }

      const pickFile = () => {
        if (fileRef.current) fileRef.current.click()
      }

      /** Ignore the incremental ledger and re-read every book's highlights. */
      const fullRebuild = async () => {
        setBusyData(true)
        setDataMessage('')
        try {
          await apiSync({ full: true })
          setDataMessage(t('settings.fullSyncStarted'))
          if (typeof props.onSyncStarted === 'function') props.onSyncStarted()
        } catch (error) {
          setDataMessage(String(error.message || error))
        } finally {
          setBusyData(false)
        }
      }

      const onFile = async (event) => {
        const file = event.target.files && event.target.files[0]
        event.target.value = ''
        if (!file) return
        try {
          const bundle = JSON.parse(await file.text())
          if (!bundle || typeof bundle !== 'object' || !bundle.files) throw new Error(t('export.failed', { error: 'bundle' }))
          setPending(bundle)
          setDataMessage('')
        } catch (error) {
          setPending(null)
          setDataMessage(String(error.message || error))
        }
      }

      const doRestore = async () => {
        if (!pending) return
        setBusyData(true)
        setDataMessage('')
        try {
          const result = await apiRestore(pending)
          setPending(null)
          setDataMessage(t('settings.restored', { files: String((result.restored || []).length) }))
          if (typeof props.onDataChanged === 'function') props.onDataChanged()
        } catch (error) {
          setDataMessage(String(error.message || error))
        } finally {
          setBusyData(false)
        }
      }

      const save = async (patch, closeAfter) => {
        setBusy(true)
        setMessage('')
        try {
          const next = await apiConfig(patch)
          props.onChanged(next)
          if (closeAfter) props.onClose()
          else setMessage(t('settings.saved'))
        } catch (error) {
          setMessage(String(error.message || error))
        } finally {
          setBusy(false)
        }
      }

      return h(
        'div',
        { className: 'wr-modal-mask', onMouseDown: (event) => { if (event.target === event.currentTarget) props.onClose() } },
        h(
          'div',
          { className: 'wr-modal', role: 'dialog', 'aria-modal': 'true', onKeyDown: (event) => { if (event.key === 'Escape') props.onClose() } },
          h('h3', null, t('settings.title')),
          h('p', { className: 'wr-muted' }, state.configured ? t('settings.keyMasked', { key: state.maskedKey }) : t('settings.keyNone')),
          h(
            'div',
            { className: 'wr-field' },
            h('label', null, t('settings.key')),
            h('input', { className: 'wr-input', type: 'password', placeholder: 'wrk-…', value: key, autoFocus: true, onChange: (event) => setKey(event.target.value) }),
            h('p', { className: 'wr-muted', style: { margin: 0 } }, t('setup.hint')),
          ),
          h(
            'div',
            { className: 'wr-field' },
            h('label', null, t('settings.maxBooks')),
            h('input', { className: 'wr-input', type: 'number', min: '5', max: '300', value: maxBooks, onChange: (event) => setMaxBooks(event.target.value) }),
            h('p', { className: 'wr-muted', style: { margin: 0 } }, t('settings.maxBooksHint')),
          ),
          h(
            'div',
            { className: 'wr-field' },
            h('label', null, t('settings.notesPerBook')),
            h('input', { className: 'wr-input', type: 'number', min: '20', max: '2000', value: notesPerBook, onChange: (event) => setNotesPerBook(event.target.value) }),
          ),
          state.dir ? h('p', { className: 'wr-muted', style: { marginTop: '14px', wordBreak: 'break-all' } }, t('settings.dir', { dir: state.dir })) : null,
          h(
            'div',
            { className: 'wr-field' },
            h('label', null, t('settings.dataTitle')),
            h(
              'div',
              { className: 'wr-flex' },
              h('input', {
                className: 'wr-input',
                style: { flex: '1 1 auto' },
                value: dir,
                placeholder: t('settings.exportDir'),
                onChange: (event) => setDir(event.target.value),
              }),
              h('button', { className: 'wr-btn', type: 'button', disabled: busyData || dir.trim() === '', onClick: () => void saveDir() }, t('settings.dirSave')),
            ),
            h('p', { className: 'wr-muted', style: { margin: '6px 0 0' } }, t('settings.exportDirHint')),
            h(
              'div',
              { className: 'wr-flex', style: { marginTop: '10px' } },
              h('button', { className: 'wr-btn', type: 'button', disabled: busyData, onClick: () => void downloadBackup() }, t('settings.backup')),
              h('button', { className: 'wr-btn', type: 'button', disabled: busyData, onClick: pickFile }, t('settings.restore')),
              h('button', { className: 'wr-btn', type: 'button', disabled: busyData, onClick: () => void fullRebuild() }, t('settings.fullSync')),
              h('input', { ref: fileRef, type: 'file', accept: 'application/json,.json', style: { display: 'none' }, onChange: (event) => void onFile(event) }),
            ),
            h('p', { className: 'wr-muted', style: { margin: '6px 0 0' } }, t('settings.backupHint')),
            h('p', { className: 'wr-muted', style: { margin: '4px 0 0' } }, t('settings.fullSyncHint')),
            pending
              ? h(
                  'div',
                  { className: 'wr-notice', style: { marginTop: '10px' } },
                  h('div', null, t('settings.restoreConfirm')),
                  h(
                    'div',
                    { className: 'wr-flex', style: { marginTop: '8px' } },
                    h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busyData, onClick: () => void doRestore() }, t('settings.restoreYes')),
                    h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busyData, onClick: () => setPending(null) }, t('action.cancel')),
                  ),
                )
              : null,
            dataMessage ? h('p', { className: 'wr-muted', style: { margin: '8px 0 0' } }, dataMessage) : null,
            state.version ? h('p', { className: 'wr-muted', style: { margin: '8px 0 0' } }, t('settings.version', { version: state.version })) : null,
          ),
          message ? h('p', { className: 'wr-notice', style: { color: 'var(--dsw-alias-state-error-primary)' } }, message) : null,
          h(
            'div',
            { className: 'wr-modal-foot' },
            h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: () => save({ apiKey: '' }, true) }, t('action.clearKey')),
            h('button', { className: 'wr-btn', type: 'button', onClick: props.onClose }, t('action.cancel')),
            h(
              'button',
              {
                className: 'wr-btn wr-btn-primary',
                type: 'button',
                disabled: busy,
                onClick: () => save({ apiKey: key.trim() === '' ? undefined : key.trim(), maxBooks: Number(maxBooks), notesPerBook: Number(notesPerBook) }, true),
              },
              t('action.save'),
            ),
          ),
        ),
      )
    }

    function SetupPanel(props) {
      const state = props.state || {}
      const [key, setKey] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')

      const submit = async () => {
        const value = key.trim()
        if (!/^wrk-/.test(value)) {
          setError(t('setup.badKey'))
          return
        }
        setBusy(true)
        setError('')
        try {
          const next = await apiConfig({ apiKey: value })
          props.onChanged(next)
          await apiSync()
          props.onStarted()
        } catch (issue) {
          setError(String(issue.message || issue))
        } finally {
          setBusy(false)
        }
      }

      return h(
        'div',
        { className: 'wr-setup' },
        h('div', { className: 'wr-card' },
          h('h2', null, t('setup.title')),
          h('p', { style: { marginTop: '8px' } }, t('setup.desc')),
          state.fromEnv ? h('p', { style: { marginTop: '8px' } }, t('setup.onEnv')) : null,
          h(
            'div',
            { className: 'wr-field' },
            h('label', null, t('setup.keyLabel')),
            h('input', { className: 'wr-input', type: 'password', placeholder: t('setup.keyPlaceholder'), value: key, onChange: (event) => setKey(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') void submit() } }),
            h('p', { className: 'wr-muted', style: { margin: 0 } }, t('setup.hint')),
          ),
          error ? h('p', { className: 'wr-notice', style: { color: 'var(--dsw-alias-state-error-primary)' } }, error) : null,
          h(
            'div',
            { className: 'wr-modal-foot' },
            h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: () => void submit() }, busy ? t('setup.saving') : t('setup.save')),
          ),
        ),
      )
    }

    // ------------------------------------------------------------------- page
    /**
     * Sync feedback line.
     *
     * A running sync stays until it finishes, because it is live progress. A
     * finished one (done or failed) clears itself after a few seconds so the
     * reading area is not permanently occupied, and the × dismisses it right
     * away. Any new sync resets both, so a second run always shows up again.
     */
    function SyncBanner(props) {
      const sync = props && props.sync ? props.sync : null
      const phase = sync && sync.phase ? String(sync.phase) : ''
      const running = Boolean(sync && sync.running)
      const signature = [
        sync && sync.startedAt ? sync.startedAt : '',
        phase,
        sync && sync.message ? sync.message : '',
        sync && sync.error ? sync.error : '',
      ].join('|')
      const [dismissed, setDismissed] = useState(false)
      const [expired, setExpired] = useState(false)

      useEffect(() => {
        setDismissed(false)
        setExpired(false)
      }, [signature])

      useEffect(() => {
        if (!sync || running) return undefined
        if (phase !== 'done' && phase !== 'error') return undefined
        if (typeof setTimeout !== 'function') return undefined
        const timer = setTimeout(() => setExpired(true), AUTO_HIDE_MS)
        return () => clearTimeout(timer)
      }, [signature, running, phase])

      if (!sync) return null
      if (dismissed || expired) return null

      const close = h('button', {
        className: 'wr-banner-close',
        type: 'button',
        'aria-label': t('action.dismiss'),
        title: t('action.dismiss'),
        onClick: () => setDismissed(true),
      }, '×')

      if (running) {
        const total = sync.total || 0
        const done = sync.done || 0
        return h('div', { className: 'wr-banner', 'data-tone': 'run' },
          h('span', { className: 'wr-spinner' }),
          h('span', { className: 'wr-banner-text' }, total > 0 ? t('sync.running', { label: sync.label || '', done, total }) : (sync.label || t('action.syncing'))),
          sync.message ? h('span', { className: 'wr-banner-text wr-muted' }, sync.message) : null,
          close,
        )
      }
      if (phase === 'done' && sync.message) {
        return h('div', { className: 'wr-banner' },
          h('span', { className: 'wr-banner-text' }, t('sync.done', { message: sync.message })),
          close,
        )
      }
      if (phase === 'error' && sync.error) {
        return h('div', { className: 'wr-banner', 'data-tone': 'error' },
          h('span', { className: 'wr-banner-text' }, t('sync.failed', { error: sync.error })),
          close,
        )
      }
      return null
    }

    function StudyPanel() {
      const [state, setState] = useState(null)
      const [data, setData] = useState(null)
      const [error, setError] = useState('')
      const [view, setView] = useState('overview')
      const [activeBookId, setActiveBookId] = useState('')
      const [bookTab, setBookTab] = useState('notes')
      const [query, setQuery] = useState('')
      const [showSettings, setShowSettings] = useState(false)
      const [booting, setBooting] = useState(true)
      const mounted = useRef(true)

      useEffect(() => {
        mounted.current = true
        return () => {
          mounted.current = false
        }
      }, [])

      const loadData = useCallback(async () => {
        try {
          const payload = await apiData()
          if (mounted.current) setData(payload)
          return payload
        } catch (issue) {
          if (mounted.current) setError(String(issue.message || issue))
          return null
        }
      }, [])

      const refreshState = useCallback(async () => {
        try {
          const next = await apiState()
          if (mounted.current) setState(next)
          return next
        } catch (issue) {
          if (mounted.current) setError(String(issue.message || issue))
          return null
        }
      }, [])

      useEffect(() => {
        let cancelled = false
        ;(async () => {
          const next = await refreshState()
          if (cancelled) return
          if (next && next.configured) await loadData()
          if (!cancelled) setBooting(false)
        })()
        return () => {
          cancelled = true
        }
      }, [loadData, refreshState])

      const running = Boolean(state && state.sync && state.sync.running)

      useEffect(() => {
        if (!running) return undefined
        const timer = setInterval(async () => {
          const next = await refreshState()
          if (next && !(next.sync && next.sync.running)) {
            clearInterval(timer)
            await loadData()
          }
        }, 900)
        return () => clearInterval(timer)
      }, [running, loadData, refreshState])

      const startSync = useCallback(async () => {
        try {
          setError('')
          const next = await apiSync()
          if (mounted.current) setState(next)
        } catch (issue) {
          if (mounted.current) setError(String(issue.message || issue))
        }
      }, [])

      const openBook = useCallback((book, tab) => {
        setActiveBookId(book.bookId)
        setBookTab(tab === 'thoughts' ? 'thoughts' : 'notes')
        setView('book')
        setQuery('')
      }, [])

      const books = (data && data.books) || []
      const openBookById = useCallback((bookId, tab) => {
        const found = books.find((book) => book.bookId === bookId)
        if (found) openBook(found, tab)
      }, [books, openBook])
      const activeBook = useMemo(() => books.find((book) => book.bookId === activeBookId) || null, [books, activeBookId])
      const counts = (data && data.counts) || (state && state.counts) || {}
      const synced = Boolean(data && data.updatedAt)

      const head = h(
        'div',
        { className: 'wr-head' },
        h('div', { className: 'wr-brand' },
          h('div', { className: 'wr-brand-title' }, t('page.title')),
          h('div', { className: 'wr-brand-sub' },
            synced
              ? t('synced.counts', { books: fmtCount(counts.books || 0), notes: fmtCount(counts.notes || 0), thoughts: fmtCount(counts.thoughts || 0) })
              : t('synced.never'),
          ),
        ),
        h(
          'div',
          { className: 'wr-tabs' },
          ['overview', 'shelf', 'notes', 'thoughts'].map((key) =>
            h('button', {
              key,
              className: 'wr-tab',
              type: 'button',
              'data-active': view === key || (view === 'book' && key === 'shelf'),
              onClick: () => { setView(key); setActiveBookId(''); setQuery('') },
            }, t(`nav.${key}`)),
          ),
        ),
        h(
          'div',
          { className: 'wr-head-right' },
          h('div', { className: 'wr-search' },
            h('input', {
              placeholder: t('action.searchGlobal'),
              value: query,
              'aria-label': t('action.search'),
              onChange: (event) => setQuery(event.target.value),
            }),
            query === '' ? null : h('button', { className: 'wr-search-clear', type: 'button', 'aria-label': t('action.cancel'), onClick: () => setQuery('') }, '×'),
          ),
          h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: running || !state || !state.configured, onClick: () => void startSync() },
            running ? h('span', { className: 'wr-spinner' }) : null,
            running ? t('action.syncing') : t('action.sync'),
          ),
          h('button', { className: 'wr-btn', type: 'button', 'aria-label': t('action.settings'), onClick: () => setShowSettings(true) }, '⚙'),
        ),
      )

      const syncBanner = h(SyncBanner, { sync: state && state.sync })

      let body = null
      if (booting) {
        body = h('div', { className: 'wr-empty' }, h('span', { className: 'wr-spinner' }), h('div', { style: { marginTop: '10px' } }, t('state.loading')))
      } else if (state && !state.configured) {
        body = h(SetupPanel, {
          state,
          onChanged: (next) => setState(next),
          onStarted: () => { void refreshState() },
        })
      } else if (query.trim() !== '') {
        body = h(SearchResults, { data: data || {}, query, onOpenBook: openBook })
      } else if (view === 'book' && activeBook) {
        body = h(BookView, { key: `${activeBook.bookId}:${bookTab}`, data: data || {}, book: activeBook, initialTab: bookTab, onBack: () => { setView('shelf'); setActiveBookId('') } })
      } else if (view === 'shelf') {
        body = h(ShelfView, { data: data || {}, onOpenBook: openBook })
      } else if (view === 'notes') {
        body = h(StreamView, { data: data || {}, kind: 'note', onOpenBook: openBookById })
      } else if (view === 'thoughts') {
        body = h(StreamView, { data: data || {}, kind: 'thought', onOpenBook: openBookById })
      } else {
        body = h(Overview, { data: data || {} })
      }

      // Each room gets its own paper tint, and the tint follows the tab you are
      // standing in — a book's thought tab keeps the thought-room warmth.
      const room = query.trim() !== ''
        ? 'search'
        : view === 'book'
          ? (bookTab === 'thoughts' ? 'thoughts' : 'notes')
          : view

      return h(
        'div',
        { className: 'wr-root', 'data-view': room, 'data-dsh-weread-gather': '' },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        head,
        h(
          'div',
          { className: 'wr-body' },
          h(
            'div',
            { className: 'wr-body-inner' },
            syncBanner,
            error ? h('div', { className: 'wr-banner', 'data-tone': 'error' }, h('span', null, t('error.prefix') + error)) : null,
            data && data.warnings && data.warnings.length > 0 && synced
              ? h('div', { className: 'wr-banner' }, h('span', null, `部分数据同步失败：${data.warnings.slice(0, 2).join('；')}`))
              : null,
            body,
            synced
              ? h('p', { className: 'wr-notice', style: { marginTop: '22px' } }, t('synced.at', { time: fmtDateTime(data.updatedAt) }))
              : null,
          ),
        ),
        showSettings
          ? h(SettingsModal, {
              state: state || {},
              onClose: () => setShowSettings(false),
              onChanged: (next) => { setState(next); void loadData() },
              onDataChanged: () => { void loadData(); void refreshState() },
              onSyncStarted: () => { void refreshState() },
            })
          : null,
      )
    }

    function PanelIcon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 20
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block' },
        },
        h('path', { d: 'M3.2 19.4h17.6' }),
        h('path', { d: 'M4.6 19.4V6.2c0-.5.4-.9.9-.9h2.4c.5 0 .9.4.9.9v13.2' }),
        h('path', { d: 'M8.8 19.4V9.6c0-.5.4-.9.9-.9h2.2c.5 0 .9.4.9.9v9.8' }),
        h('path', { d: 'M12.8 19.4V7.6l3-.9c.5-.1 1 .2 1.1.7l2.6 11.2' }),
        h('path', { d: 'M6.9 8.6h1.2M10.6 11.6h1.1M15.3 9h.9' }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'weread-gather: dictionaries')
        } catch {
          // A deployment without the locale service still renders with the fallback copy.
        }
        try {
          translate = ctx.locale.bind(NS)
        } catch {
          translate = null
        }

        const disposers = []
        try {
          disposers.push(
            ctx.slots.inject('sidebar.panellist', () =>
              ctx.slots.register(
                { name: 'sidebar.panellist', id: PANEL_ID, order: 26, label: () => t('entry.label') },
                PanelIcon,
              ),
            ),
          )
        } catch (error) {
          console.warn('[weread-gather] sidebar entry not mounted', error)
        }
        try {
          disposers.push(
            ctx.slots.inject('main', () =>
              ctx.slots.register({ name: 'main', key: PANEL_ID }, StudyPanel),
            ),
          )
        } catch (error) {
          console.warn('[weread-gather] main panel not mounted', error)
        }
        ctx.effect(() => () => {
          for (const dispose of disposers.splice(0)) {
            try {
              dispose()
            } catch {
              // The seat owner already collapsed.
            }
          }
        }, 'weread-gather: panel seats')
      },
      // Test-only handles: the render smoke test mounts these directly, because
      // the export panel normally only appears after a click. Nothing else reads it.
      __smoke: { ExportPanel, MarkedText, PickButton, SyncBanner, clip, ThoughtRow, THOUGHT_CLAMP_CHARS },
    }
  },
})