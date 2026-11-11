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
      'action.edit': '编辑',
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
      'appearance.title': '外观',
      'appearance.hint': '只在书房面板生效，改完立刻应用；跟随 DSH 就是现在的样子。',
      'appearance.sessionOnly': '这次已经换上了，但没能写进配置文件，下次打开会还原。',
      'appearance.follow': '跟随 DSH',
      'appearance.mint': '苔纸（mint）',
      'appearance.night': '夜读（night）',
      'appearance.cream': '米色（cream）',
      'appearance.mist': '雾青（mist）',
      'appearance.glacier': '冰川（glacier）',
      'appearance.iris': '鸢尾（iris）',
      'search.typeAll': '全部',
      'search.typeBooks': '书籍',
      'count.notes': '{count} 条',
      'error.prefix': '出错了：',
      'think.packHead': '【书房来源包】',
      'think.packBook': '书名：',
      'think.packUnknown': '（未记录）',
      'think.packAuthor': '作者：',
      'think.packChapter': '章节：',
      'think.packKind': '内容类型：',
      'think.packKindNote': '书里的原文',
      'think.packKindThought': '我的想法',
      'think.packKindResponse': '我采纳的 AI 回应',
      'think.packKindMaterial': '我整理的素材',
      'think.packKindMaterialOf': '{role}（{type}）',
      // F-32: 素材里有一类是「采纳 AI 回应后整理出来的」。它不是新角色，是「我整理的素材」在
      // AI 语境下的细分——但必须与我自己写的素材分开，否则模型会把 AI 的话当成我的原话。
      'think.packKindMaterialAI': '我采纳的 AI 回应整理成的素材',
      'think.packFiledAI': '我采纳的 AI 回应整理成的素材：',
      'think.packTime': '阅读时间：',
      'think.packMine': '我的想法：',
      'think.packAdopted': '我采纳的 AI 回应：',
      'think.packFiled': '我整理的素材：',
      'think.packContext': '同章其他划线（{count} 条，供参考）：',
      'think.packContextMixed': '其他来源（{count} 条，供参考）：',
      'think.packOriginal': '原文：',
      'think.packFoot': '—— 以上来自「数字书房」。标「书里的原文」的是书里的句子，其余三类（我的想法 / 我采纳的 AI 回应 / 我整理的素材）是我这一侧的记录，引用时请分清归属。素材里带「AI」字样的，是我采纳过 AI 回应之后整理出来的，不是我亲手写的。',
      'think.empty': '想问什么？点上面的按钮，问题会先填进输入框，改完再发。',
      'think.thinking': '思考中…',
      'think.aiNote': 'AI 生成，仅供参考',
      'think.offline': '未配置可用模型，AI 对话暂时置灰；去设置里填 API Key 后重试',
      'think.mode.explain': '解释',
      'think.mode.reframe': '换角度',
      'think.mode.deeper': '深想',
      'think.mode.custom': '自己问',
      'think.ask.explain': '这段话在说什么？先用直白的话解释一遍，再指出它成立的前提，以及它在什么情况下会不成立。',
      'think.ask.reframe': '换一个角度：如果反过来看，这段话会变成什么样？给我 2-3 个不同的视角，并说明各自的前提。',
      'think.ask.deeper': '顺着这条想法继续往下想：它背后更根本的问题是什么？把它拆成几个可以一步步想下去的问题。',
      'think.customPlaceholder': '你想问什么？',
      'think.send': '放入对话',
      'think.failed': '没能打开对话，来源包也没复制成功',
      'nav.read': '阅读',
      'nav.think': '思考',
      'nav.create': '创作',
      'nav.grow': '积累',
      'nav.responses': '回应',
      'nav.materials': '素材',
      'nav.topics': '选题',
      'nav.works': '初稿',
      'nav.timeline': '时间线',
      'nav.annual': '年度回顾',
      'journey.read.hint': '摘录与想法，按书看',
      'journey.think.hint': '把读到的东西问明白',
      'journey.create.hint': '素材 → 选题 → 初稿',
      'journey.grow.hint': '走过的路，与这一年',
      'craft.loading': '正在读创作数据…',
      'craft.failed': '创作数据没读出来：{error}',
      'craft.retry': '重试',
      'craft.offline': '创作数据暂时读不到；阅读、书架、笔记、想法都不受影响。',
      'craft.count.responses': '{count} 条',
      'craft.count.materials': '{count} 条',
      'craft.count.topics': '{count} 个',
      'craft.count.works': '{count} 篇',
      'ask.adopt': '想留下哪一句？',
      'ask.adoptThought': '记成想法',
      'ask.adoptMaterial': '收为素材',
      'ask.adoptType': '素材类型',
      'ask.adoptSave': '存下',
      'ask.adoptCancel': '取消',
      'ask.adoptDone': '已存下',
      'ask.adoptHint': '对话本身不落盘，只有你存下的这一句会留下。',
      'ask.adoptFailed': '没存下：{error}',
      'mat.type.quote': '金句',
      'mat.type.idea': '观点',
      'mat.type.case': '案例',
      'mat.type.evidence': '论据',
      'mat.type.question': '问题',
      'mat.type.spark': '灵感',
      'mat.picker.title': '存为素材',
      'mat.picker.noteHint': '想法没有记录对应哪条划线；选一条同章摘录，出处会更准。',
      'mat.picker.skip': '不指定摘录',
      'mat.picker.save': '存为素材',
      'mat.picker.cancel': '取消',
      'mat.picker.empty': '这一章没有其他划线',
      'mat.picker.saved': '已存为素材',
      'mat.empty.title': '还没有素材',
      'mat.empty.next': '在思考里把一句回应收为素材，或从想法上直接存一条。',
      'mat.empty.action': '去书里找',
      'mat.sourceLabel': '出处',
      'mat.status.ok': '来源还在',
      'mat.status.changed': '来源已改',
      'mat.status.missing': '来源没找到',
      'mat.type.switch': '改类型',
      'mat.cached': '不在书架缓存',
      'mat.delete': '删除',
      'mat.sure': '确认删除？',
      'mat.added': '已收为素材',
      'mat.count': '共 {count} 条',
      'mat.fromThink': '来自回应',
      'mat.aiTag': 'AI 参与',
      'mat.failed': '没存下：{error}',
      'mat.filterAll': '全部',
      'src.note': '摘录',
      'src.thought': '想法',
      'src.response': '回应',
      'src.material': '素材',
      'topic.empty.title': '还没有选题',
      'topic.empty.next': '挑几条素材，写成一句话。',
      'topic.empty.action': '去素材篮',
      'topic.new': '立一个选题',
      'topic.statement': '一句话选题',
      'topic.statementPlaceholder': '例如：为什么记住的总是细节',
      'topic.gap': '还缺什么',
      'topic.gapPlaceholder': '还缺的关键一环（可空）',
      'topic.pickMaterials': '引用素材',
      'topic.pickNone': '还没有素材可引，先去素材篮',
      'topic.create': '立题',
      'topic.created': '已立题',
      'topic.needStatement': '先写一句话',
      'topic.needMaterial': '至少选一条素材',
      'topic.books': '涉及书目',
      'topic.materialCount': '{count} 条素材',
      'topic.draft': '去写初稿',
      'topic.delete': '删除',
      'topic.failed': '没立成：{error}',
      'topic.count': '共 {count} 个',
      'work.empty.title': '还没有初稿',
      'work.empty.next': '选一个选题，把素材写成段落。',
      'work.empty.action': '去选题',
      'work.new': '新建初稿',
      'work.titlePlaceholder': '初稿标题',
      'work.create': '建这篇',
      'work.count': '共 {count} 篇',
      'work.paragraph': '第 {index} 段',
      'work.paragraphPlaceholder': '用自己的话写这一段',
      'work.attach': '挂来源',
      'work.noSource': '不挂来源',
      'work.addParagraph': '加这一段',
      'work.deleteParagraph': '删除这一段',
      'work.confirm': '确认初稿',
      'work.confirmed': '已确认',
      'work.export': '导出',
      'work.exportPreview': '预览 Markdown',
      'work.exportFile': '写进导出目录',
      'work.exportPreviewLabel': '预览',
      'work.needParagraph': '先写一段再确认',
      'work.failed': '没存下：{error}',
      'work.emptyParagraphs': '还没有段落',
      'work.aiTag': 'AI 参与',
      'work.frontMatter': 'front-matter 带 workId / bookIds / containsAI',
      'work.saved': '已保存',
      'work.delete': '删除',
      'work.hint': '段落挂着出处，导出时可回溯。',
      'work.exported': '已导出：{path}',
      'work.paragraphDeleted': '已删除这一段',
      'work.pickFirst': '先建一篇初稿',
      'work.aiWrite': 'AI 补写这一段',
      'work.aiWriteHint': '用它挂着的出处补写，只在素材范围内写',
      'work.aiPrompt': '请基于上面的出处，为这一段补写一段 120–200 字的正文：只使用出处里出现的事实、判断与措辞，不要新增书名、人名或数据；写成可以直接放进初稿的一段话。',
      'work.aiDraft': 'AI 草稿（还没落盘）',
      'work.aiAdopt': '采纳这段',
      'work.aiRetry': '重新生成',
      'work.aiDiscard': '不用了',
      'work.aiNeedSource': '这一段还没有出处，先挑素材再让它补写',
      'work.aiNoSource': '这一段挂着的出处都找不到了，先补出处再试',
      'work.aiFailed': '没写出来：{error}',
      'chain.title': '这本书的读写链路',
      'chain.hint': '点哪一段，就带着这本书去那一段',
      'chain.notes': '摘录',
      'chain.thoughts': '想法',
      'chain.responses': '回应',
      'chain.materials': '素材',
      'chain.topics': '选题',
      'chain.works': '初稿',
      'chain.cached': '不在书架缓存',
      'chain.craftDown': '创作数据没读出来，后四段暂时为 0',
      'thinkView.title': '留下的回应',
      'thinkView.hint': '对话本身不落盘；只有你采纳的那一句留在这里，并带着出处。',
      'thinkView.empty.title': '这里还空着',
      'thinkView.empty.next': '在阅读里对一条划线或想法点「追问」，把想留的那一句存下来。',
      'thinkView.empty.action': '去书架',
      'thinkView.scope': '只看这本书',
      'thinkView.all': '看全部',
      'thinkView.count': '共 {count} 条',
      'thinkView.adoptedAt': '采纳于',
      'thinkView.source': '出处',
      'thinkView.backBook': '回到《{title}》',
      'thinkView.ai': 'AI 参与',
      'grow.event.response': '采纳了一条回应',
      'grow.event.material': '收了一条素材',
      'grow.event.topic': '立了一个选题',
      'grow.event.work': '写了一篇初稿',
      'grow.empty.title': '还没有可回顾的事',
      'grow.empty.next': '走一遍阅读 → 思考 → 创作，这里就会长出记录。',
      'grow.empty.action': '去阅读',
      'grow.monthLabel': '{year} 年 {month} 月',
      'grow.monthCount': '本月 {count} 条',
      'grow.total': '共 {count} 条',
      'grow.annual.title': '这一年读过的',
      'grow.annual.hint': '只用已有的年度阅读数据，不做评分，也不催更。',
      'grow.annual.empty': '这一年还没有阅读时长记录',
      'grow.annual.emptyNext': '先同步一次微读，再回来看看这一年留下了什么。',
      'grow.annual.emptyAction': '去看书架',
      'grow.annual.notes': '划线',
      'grow.annual.thoughts': '想法',
      'grow.annual.craft': '创作',
      'grow.annual.books': '这一年读过的书',
      'grow.annual.noBooks': '这一年没有书目记录',
      'grow.annual.export': '导出这一年',
      'grow.cross': '跨书',
      'grow.annual.note': '年度回顾只统计阅读，不代表产出。',
      'grow.annual.total': '全年阅读',
      'grow.annual.days': '有阅读的天',
      'synced.craftAt': '创作更新于 {time}',
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
      'action.edit': 'Edit',
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
      'appearance.title': 'Appearance',
      'appearance.hint': 'Applies to this panel only, and takes effect immediately. “Follow DSH” is the look you already have.',
      'appearance.sessionOnly': 'Applied for now, but it could not be written to the config file, so it will revert next time.',
      'appearance.follow': 'Follow DSH',
      'appearance.mint': 'Mint paper',
      'appearance.night': 'Night',
      'appearance.cream': 'Cream',
      'appearance.mist': 'Mist',
      'appearance.glacier': 'Glacier',
      'appearance.iris': 'Iris',
      'search.typeAll': 'All',
      'search.typeBooks': 'Books',
      'count.notes': '{count}',
      'error.prefix': 'Something went wrong: ',
      'think.packHead': '[Digital Study source pack]',
      'think.packBook': 'Book: ',
      'think.packUnknown': '(not recorded)',
      'think.packAuthor': 'Author: ',
      'think.packChapter': 'Chapter: ',
      'think.packKind': 'Content: ',
      'think.packKindNote': "the book's words",
      'think.packKindThought': 'my own thought',
      'think.packKindResponse': 'an AI reply I kept',
      'think.packKindMaterial': 'a source I filed',
      'think.packKindMaterialOf': '{role} ({type})',
      'think.packKindMaterialAI': 'a source I filed from an AI reply I kept',
      'think.packFiledAI': 'A source I filed from an AI reply I kept:',
      'think.packTime': 'Read on: ',
      'think.packMine': 'My thought:',
      'think.packAdopted': 'An AI reply I kept:',
      'think.packFiled': 'A source I filed:',
      'think.packContext': 'Other highlights in the same chapter ({count}, for context):',
      'think.packContextMixed': 'Other sources ({count}, for context):',
      'think.packOriginal': "The book's words:",
      'think.packFoot': '— From Digital Study. What is marked as the book\'s words comes from the book; the other three kinds (my own thought / an AI reply I kept / a source I filed) are my own record — keep the ownership straight when you quote. A source marked with "AI" is one I filed after keeping an AI reply: not written by me.',
      'think.empty': 'Pick a button above — the question lands in the box so you can edit it first.',
      'think.thinking': 'Thinking…',
      'think.aiNote': 'AI-generated, for reference',
      'think.offline': 'No usable model is configured, so chat is greyed out; add an API key in Settings and retry',
      'think.mode.explain': 'Explain',
      'think.mode.reframe': 'Reframe',
      'think.mode.deeper': 'Go deeper',
      'think.mode.custom': 'Ask',
      'think.ask.explain': 'What is this passage saying? Explain it plainly first, then name its premises and the cases where it stops holding.',
      'think.ask.reframe': 'Reframe it: if you reversed the claim, what would it become? Give me two or three different angles and the premise behind each.',
      'think.ask.deeper': 'Keep going from this thought: what is the more fundamental question underneath it? Break it into several questions I can think through step by step.',
      'think.customPlaceholder': 'What do you want to ask?',
      'think.send': 'Put in chat',
      'think.failed': 'Could not open a conversation, and copying failed',
      'nav.read': 'Read',
      'nav.think': 'Think',
      'nav.create': 'Create',
      'nav.grow': 'Grow',
      'nav.responses': 'Answers',
      'nav.materials': 'Material',
      'nav.topics': 'Topics',
      'nav.works': 'Drafts',
      'nav.timeline': 'Timeline',
      'nav.annual': 'Yearly review',
      'journey.read.hint': 'Highlights and thoughts, book by book',
      'journey.think.hint': 'Ask until it is clear',
      'journey.create.hint': 'Material → topic → draft',
      'journey.grow.hint': 'The path walked, and the year',
      'craft.loading': 'Loading your writing…',
      'craft.failed': 'Could not load your writing: {error}',
      'craft.retry': 'Retry',
      'craft.offline': 'Writing data is unavailable right now; reading, shelf, notes and thoughts are unaffected.',
      'craft.count.responses': '{count} kept',
      'craft.count.materials': '{count} items',
      'craft.count.topics': '{count} topics',
      'craft.count.works': '{count} drafts',
      'ask.adopt': 'Keep something?',
      'ask.adoptThought': 'Save as thought',
      'ask.adoptMaterial': 'Save as material',
      'ask.adoptType': 'Material type',
      'ask.adoptSave': 'Save',
      'ask.adoptCancel': 'Cancel',
      'ask.adoptDone': 'Saved',
      'ask.adoptHint': 'The conversation itself is not saved; only what you keep here stays.',
      'ask.adoptFailed': 'Not saved: {error}',
      'mat.type.quote': 'Quote',
      'mat.type.idea': 'Viewpoint',
      'mat.type.case': 'Case',
      'mat.type.evidence': 'Evidence',
      'mat.type.question': 'Question',
      'mat.type.spark': 'Spark',
      'mat.picker.title': 'Save as material',
      'mat.picker.noteHint': 'A thought does not record which highlight it answered; pick one to be precise.',
      'mat.picker.skip': 'Skip the highlight',
      'mat.picker.save': 'Save material',
      'mat.picker.cancel': 'Cancel',
      'mat.picker.empty': 'No other highlight in this chapter',
      'mat.picker.saved': 'Saved as material',
      'mat.empty.title': 'No material yet',
      'mat.empty.next': 'Keep an answer from THINK, or save one from a thought.',
      'mat.empty.action': 'Go to the books',
      'mat.sourceLabel': 'Source',
      'mat.status.ok': 'Source intact',
      'mat.status.changed': 'Source changed',
      'mat.status.missing': 'Source missing',
      'mat.type.switch': 'Change type',
      'mat.cached': 'Not in shelf cache',
      'mat.delete': 'Delete',
      'mat.sure': 'Delete?',
      'mat.added': 'Saved',
      'mat.count': '{count} items',
      'mat.fromThink': 'From an answer',
      'mat.aiTag': 'AI-assisted',
      'mat.failed': 'Not saved: {error}',
      'mat.filterAll': 'All',
      'src.note': 'Highlight',
      'src.thought': 'Thought',
      'src.response': 'Answer',
      'src.material': 'Material',
      'topic.empty.title': 'No topic yet',
      'topic.empty.next': 'Pick a few materials and turn them into one sentence.',
      'topic.empty.action': 'Go to material',
      'topic.new': 'Start a topic',
      'topic.statement': 'One-sentence topic',
      'topic.statementPlaceholder': 'e.g. why we remember the details',
      'topic.gap': 'What is missing',
      'topic.gapPlaceholder': 'The missing piece (optional)',
      'topic.pickMaterials': 'Materials',
      'topic.pickNone': 'No material to cite yet',
      'topic.create': 'Create',
      'topic.created': 'Created',
      'topic.needStatement': 'Write the sentence first',
      'topic.needMaterial': 'Pick at least one material',
      'topic.books': 'Books',
      'topic.materialCount': '{count} materials',
      'topic.draft': 'Draft it',
      'topic.delete': 'Delete',
      'topic.failed': 'Not created: {error}',
      'topic.count': '{count} topics',
      'work.empty.title': 'No draft yet',
      'work.empty.next': 'Pick a topic and turn material into paragraphs.',
      'work.empty.action': 'Go to topics',
      'work.new': 'New draft',
      'work.titlePlaceholder': 'Draft title',
      'work.create': 'Create',
      'work.count': '{count} drafts',
      'work.paragraph': 'Paragraph {index}',
      'work.paragraphPlaceholder': 'Write this paragraph in your own words',
      'work.attach': 'Attach sources',
      'work.noSource': 'No source',
      'work.addParagraph': 'Add paragraph',
      'work.deleteParagraph': 'Delete paragraph',
      'work.confirm': 'Confirm draft',
      'work.confirmed': 'Confirmed',
      'work.export': 'Export',
      'work.exportPreview': 'Preview Markdown',
      'work.exportFile': 'Write file',
      'work.exportPreviewLabel': 'Preview',
      'work.needParagraph': 'Write a paragraph first',
      'work.failed': 'Not saved: {error}',
      'work.emptyParagraphs': 'No paragraph yet',
      'work.aiTag': 'AI-assisted',
      'work.frontMatter': 'front-matter carries workId / bookIds / containsAI',
      'work.saved': 'Saved',
      'work.delete': 'Delete',
      'work.hint': 'Paragraphs carry their sources, so the export stays traceable.',
      'work.exported': 'Exported: {path}',
      'work.paragraphDeleted': 'Paragraph deleted',
      'work.pickFirst': 'Create a draft first',
      'work.aiWrite': 'AI draft this paragraph',
      'work.aiWriteHint': 'Grounds the draft in this paragraph’s sources, nothing else',
      'work.aiPrompt': 'Write one 120–200 word paragraph that continues this draft, using only the facts, judgements and wording found in the sources above. Do not add new titles, names or numbers. Make it read like a paragraph that can go straight into the draft.',
      'work.aiDraft': 'AI draft (not saved yet)',
      'work.aiAdopt': 'Keep this paragraph',
      'work.aiRetry': 'Generate again',
      'work.aiDiscard': 'Discard',
      'work.aiNeedSource': 'This paragraph has no source yet — pick materials first',
      'work.aiNoSource': 'None of this paragraph’s sources can be found any more — restore them first',
      'work.aiFailed': 'Not written: {error}',
      'chain.title': "This book's read-write chain",
      'chain.hint': 'Tap a step to go there with this book',
      'chain.notes': 'Highlights',
      'chain.thoughts': 'Thoughts',
      'chain.responses': 'Answers',
      'chain.materials': 'Material',
      'chain.topics': 'Topics',
      'chain.works': 'Drafts',
      'chain.cached': 'Not in shelf cache',
      'chain.craftDown': 'Writing data is unavailable; the last four steps show 0 for now',
      'thinkView.title': 'Kept answers',
      'thinkView.hint': 'Conversations are not saved; only the answer you kept stays here, with its source.',
      'thinkView.empty.title': 'Nothing kept yet',
      'thinkView.empty.next': 'In READ, ask about a highlight or thought and keep the line worth keeping.',
      'thinkView.empty.action': 'Go to the shelf',
      'thinkView.scope': 'This book only',
      'thinkView.all': 'All books',
      'thinkView.count': '{count} kept',
      'thinkView.adoptedAt': 'Kept',
      'thinkView.source': 'Source',
      'thinkView.backBook': 'Back to {title}',
      'thinkView.ai': 'AI-assisted',
      'grow.event.response': 'Kept an answer',
      'grow.event.material': 'Saved a material',
      'grow.event.topic': 'Started a topic',
      'grow.event.work': 'Wrote a draft',
      'grow.empty.title': 'Nothing to look back on yet',
      'grow.empty.next': 'Read, think, write once and the timeline starts growing.',
      'grow.empty.action': 'Go read',
      'grow.monthLabel': '{month}/{year}',
      'grow.monthCount': '{count} in this month',
      'grow.total': '{count} events',
      'grow.annual.title': 'The year in reading',
      'grow.annual.hint': 'Reuses the yearly reading data only — no scoring, no streak pressure.',
      'grow.annual.empty': 'No reading time in this year',
      'grow.annual.emptyNext': 'Sync WeRead once, then come back and see what the year left behind.',
      'grow.annual.emptyAction': 'Open the shelf',
      'grow.annual.notes': 'Highlights',
      'grow.annual.thoughts': 'Thoughts',
      'grow.annual.craft': 'Writing',
      'grow.annual.books': 'Books read this year',
      'grow.annual.noBooks': 'No books recorded for this year',
      'grow.annual.export': 'Export this year',
      'grow.cross': 'Across books',
      'grow.annual.note': 'This review counts reading only, not output.',
      'grow.annual.total': 'Total reading',
      'grow.annual.days': 'Days read',
      'synced.craftAt': 'Writing updated {time}',
    }

    /**
     * The plugin's own client context, kept for the one capability the UI
     * needs outside a component tree: opening a conversation with a source
     * pack. Null until `apply` runs, which is why every use is guarded.
     */

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
    /** The writing side of the study lives in its own file: one request, never mixed into /data. */
    const apiCraft = () => request('/craft')
    const apiCraftWrite = (op, payload, revision) => jsonPost('/craft', revision === undefined || revision === null ? { op, payload } : { op, payload, revision })
    const apiCraftExport = (id, mode) => jsonPost('/craft/export', { kind: 'work', id, mode })

    // ---------------------------------------------------------- chat probe
    /**
     * F1: whether this host can talk to a model at all is a fact we ask for up
     * front, not something the reader should discover by pressing a button and
     * reading a 400. One probe is shared by every AI entry point, and a failed
     * probe counts as "no model here" — a dead endpoint must not look clickable.
     */
    const chatAvailability = { state: 'unknown' }
    const chatWatchers = new Set()
    let chatProbe = null
    function setChatAvailability(next) {
      chatAvailability.state = next
      chatWatchers.forEach((notify) => {
        try {
          notify(next)
        } catch (issue) {
          /* a stale component must never break the probe */
        }
      })
    }
    function probeChat() {
      if (chatProbe) return chatProbe
      chatProbe = request('/chat/models')
        .then((payload) => {
          const providers = payload && Array.isArray(payload.providers) ? payload.providers : []
          const usable = Boolean(payload && payload.available) && providers.length > 0
          setChatAvailability(usable ? 'ready' : 'offline')
          return chatAvailability.state
        })
        .catch(() => {
          setChatAvailability('offline')
          return chatAvailability.state
        })
      return chatProbe
    }
    /** Settings may add a key later, so the answer is allowed to change. */
    function forgetChatProbe() {
      chatProbe = null
      setChatAvailability('unknown')
      return probeChat()
    }
    function useChatAvailability() {
      const [value, setValue] = useState(chatAvailability.state)
      useEffect(() => {
        chatWatchers.add(setValue)
        if (chatAvailability.state === 'unknown') probeChat()
        return () => {
          chatWatchers.delete(setValue)
        }
      }, [])
      return value
    }

    // ---------------------------------------------------------------- craft
    /** First element is the exact value the host stores; the second is the locale key. */
    const MATERIAL_TYPES = [
      ['金句', 'mat.type.quote'],
      ['观点', 'mat.type.idea'],
      ['案例', 'mat.type.case'],
      ['论据', 'mat.type.evidence'],
      ['问题', 'mat.type.question'],
      ['灵感', 'mat.type.spark'],
    ]
    // ---------------------------------------------------------------- palette
    /**
     * F-28: the seven options the Appearance section offers. `follow` means "whatever DSH already
     * gives us", which is exactly how the panel looked before this feature existed, so every config
     * that never wrote `palette` keeps its old look.
     */
    const PALETTES = ['follow', 'mint', 'night', 'cream', 'mist', 'glacier', 'iris']
    const PALETTE_KEYS = {
      follow: 'appearance.follow',
      mint: 'appearance.mint',
      night: 'appearance.night',
      cream: 'appearance.cream',
      mist: 'appearance.mist',
      glacier: 'appearance.glacier',
      iris: 'appearance.iris',
    }
    /** Anything the host (or an older build) hands us that is not one of the six becomes `follow`. */
    function paletteOf(value) {
      const name = String(value == null ? '' : value).trim()
      return Object.prototype.hasOwnProperty.call(PALETTE_KEYS, name) ? name : 'follow'
    }
    /** Only the six explicit palettes become a CSS attribute; `follow` leaves the root untouched. */
    function paletteAttr(value) {
      const name = paletteOf(value)
      return name === 'follow' ? {} : { 'data-palette': name }
    }

    const EMPTY_CRAFT = { hasCraft: false, revision: 0, updatedAt: 0, counts: { responses: 0, materials: 0, topics: 0, works: 0 }, responses: [], materials: [], topics: [], works: [], bookIndex: [] }
    const SOURCE_PREFIX = { note: 'note:', thought: 'thought:', response: 'response:', material: 'material:' }
    /** Whatever the host sends back, the client only ever reads these fields. */
    function asCraft(payload) {
      const source = payload && typeof payload === 'object' ? payload : {}
      const list = (value) => (Array.isArray(value) ? value : [])
      return {
        hasCraft: source.hasCraft === true,
        revision: Number(source.revision) || 0,
        updatedAt: Number(source.updatedAt) || 0,
        counts: Object.assign({}, EMPTY_CRAFT.counts, source.counts || {}),
        responses: list(source.responses),
        materials: list(source.materials),
        topics: list(source.topics),
        works: list(source.works),
        bookIndex: list(source.bookIndex),
      }
    }
    function materialTypeKey(type) {
      const hit = MATERIAL_TYPES.find((item) => item[0] === type)
      return hit ? hit[1] : 'mat.type.idea'
    }
    /** 'note:123' → 'note'; anything unexpected degrades to a neutral chip instead of throwing. */
    function sourceKind(sourceId) {
      const value = String(sourceId || '')
      const at = value.indexOf(':')
      if (at <= 0) return ''
      const kind = value.slice(0, at)
      return SOURCE_PREFIX[kind] ? kind : ''
    }
    function sourceRawId(sourceId) {
      const value = String(sourceId || '')
      const at = value.indexOf(':')
      return at < 0 ? value : value.slice(at + 1)
    }
    /** Seconds-or-milliseconds tolerant date, because craft timestamps travel through JSON. */
    function fmtStamp(value) {
      const seconds = Number(value) || 0
      if (!seconds) return ''
      return fmtDateTime(seconds > 1e12 ? Math.floor(seconds / 1000) : seconds)
    }
    function monthKeyOf(seconds) {
      const date = new Date((Number(seconds) || 0) * 1000)
      if (Number.isNaN(date.getTime())) return ''
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
    }

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
.wr-root{--wr-paper:#F6F8F7;--wr-paper-soft:#FFFFFF;--wr-wash:#F0F4F1;--wr-ink:#263C34;--wr-ink-soft:#6B7F74;--wr-ink-mute:#93A49B;--wr-sage:#A6CCB5;--wr-moss:#4F9274;--wr-clay:#A57F5B;--wr-progress:#73AD8A;--wr-track:#F0F4F1;--wr-line:#E7EEEA;--wr-line-2:#DCE6E0;--wr-card-line:#EDF1EE;--wr-divider:#EEF3F0;--wr-surface:#FBFCFB;--wr-heat-0:#F3F4F2;--wr-heat-1:#D5E9DD;--wr-heat-2:#A9D3BA;--wr-heat-3:#74B28E;--wr-heat-4:#438765;--wr-bg:#F6F8F7;--wr-glow:#FFFFFF;--wr-scrim:rgba(45,60,48,.34);--wr-accent:var(--wr-sage);--wr-accent-deep:var(--wr-moss);--wr-on-accent:#FFFFFF;--wr-clay-soft:#F2E7DC;--wr-info:#5B7A86;--wr-info-soft:#EDF3F6;--wr-gold:#B8955C;--wr-radius:12px;--dsw-alias-bg-base:var(--wr-paper);--dsw-alias-bg-layer-1:var(--wr-paper-soft);--dsw-alias-bg-layer-2:var(--wr-wash);--dsw-alias-label-primary:var(--wr-ink);--dsw-alias-label-secondary:var(--wr-ink-soft);--dsw-alias-border-l1:var(--wr-line);--dsw-alias-border-l2:var(--wr-line-2);--dsw-alias-brand-primary:var(--wr-moss);--dsw-alias-state-success-primary:#4F7A5B;--dsw-alias-state-warn-primary:#B98A57;--dsw-alias-state-error-primary:#A8574C;display:flex;flex-direction:column;height:100%;min-height:0;width:100%;box-sizing:border-box;background:radial-gradient(900px 420px at 50% -18%,var(--wr-glow) 0%,transparent 70%),var(--wr-bg);color:var(--wr-ink);font-family:inherit}
.wr-root[data-view=shelf]{--wr-paper:#EDF2EE;--wr-paper-soft:#FFFFFF;--wr-bg:#EDF2EE}
.wr-root[data-view=notes],.wr-root[data-view=thoughts]{--wr-paper:#F8FAF8;--wr-paper-soft:#FFFFFF;--wr-bg:#F8FAF8}
/* F-28: 六套显式配色。取值逐字来自 docs/backlog.md §2.5；变量名按
   文档映射表落到本仓库的 --wr-*（--green→--wr-accent、--deep→--wr-accent-deep，
   --wr-sage/--wr-moss 只作别名），不照抄原型的 --bg/--ink。显式选择优先于
   data-view 的房间底色，所以这段必须排在上面两行之后。 */
.wr-root[data-palette="mint"]{--wr-scrim:rgba(45,60,48,.34);--wr-bg:#f2f1e9;--wr-paper:#fbfaf5;--wr-paper-soft:#fbfaf5;--wr-wash:#dce7d4;--wr-ink:#20251f;--wr-ink-soft:#586251;--wr-ink-mute:#586251;--wr-accent:#718469;--wr-accent-deep:#253d2c;--wr-sage:#718469;--wr-moss:#253d2c;--wr-clay:#344e35;--wr-clay-soft:#dce7d4;--wr-info:#476260;--wr-info-soft:#e0e8e1;--wr-gold:#73613a;--wr-progress:#718469;--wr-track:#dce7d4;--wr-line:#b6c0ad;--wr-line-2:#b6c0ad;--wr-card-line:#b6c0ad;--wr-divider:#b6c0ad;--wr-surface:#fbfaf5;--wr-on-accent:#FFFFFF;--wr-glow:#FFFFFF;--wr-heat-0:#DCE7D4;--wr-heat-1:#A5B4A2;--wr-heat-2:#778A78;--wr-heat-3:#4A5F4E;--wr-heat-4:#253D2C;--wr-radius:3px}
.wr-root[data-palette="night"]{--wr-bg:#0c1117;--wr-scrim:rgba(4,7,10,.66);--wr-paper:#141b24;--wr-paper-soft:#141b24;--wr-wash:#202b35;--wr-ink:#e7ebe8;--wr-ink-soft:#a6b2b6;--wr-ink-mute:#a6b2b6;--wr-accent:#83b6a5;--wr-accent-deep:#b7bce5;--wr-sage:#83b6a5;--wr-moss:#b7bce5;--wr-clay:#b7c5ab;--wr-clay-soft:#28362d;--wr-info:#b3bcdf;--wr-info-soft:#252b42;--wr-gold:#d4bf8c;--wr-progress:#83b6a5;--wr-track:#202b35;--wr-line:#33404e;--wr-line-2:#33404e;--wr-card-line:#33404e;--wr-divider:#33404e;--wr-surface:#141b24;--wr-on-accent:#0c1117;--wr-glow:#141b24;--wr-heat-0:#202B35;--wr-heat-1:#3E5557;--wr-heat-2:#567773;--wr-heat-3:#6F9A8F;--wr-heat-4:#83B6A5;--wr-radius:10px}
.wr-root[data-palette="cream"]{--wr-scrim:rgba(45,60,48,.34);--wr-bg:#efe9d8;--wr-paper:#f9f4e5;--wr-paper-soft:#f9f4e5;--wr-wash:#e7e0c7;--wr-ink:#36382a;--wr-ink-soft:#655f4b;--wr-ink-mute:#655f4b;--wr-accent:#8c9a67;--wr-accent-deep:#4a5738;--wr-sage:#8c9a67;--wr-moss:#4a5738;--wr-clay:#a26347;--wr-clay-soft:#efddca;--wr-info:#667365;--wr-info-soft:#e3e6d6;--wr-gold:#92713f;--wr-progress:#8c9a67;--wr-track:#e7e0c7;--wr-line:#d3cbb2;--wr-line-2:#d3cbb2;--wr-card-line:#d3cbb2;--wr-divider:#d3cbb2;--wr-surface:#f9f4e5;--wr-on-accent:#FFFFFF;--wr-glow:#FFFFFF;--wr-heat-0:#E7E0C7;--wr-heat-1:#B8B79C;--wr-heat-2:#919578;--wr-heat-3:#697255;--wr-heat-4:#4A5738;--wr-radius:14px}
.wr-root[data-palette="mist"]{--wr-scrim:rgba(45,60,48,.34);--wr-bg:#f6f9f8;--wr-paper:#FFFFFF;--wr-paper-soft:#FFFFFF;--wr-wash:#eaf3ee;--wr-ink:#22362f;--wr-ink-soft:#5e7068;--wr-ink-mute:#5e7068;--wr-accent:#75aa96;--wr-accent-deep:#287e68;--wr-sage:#75aa96;--wr-moss:#287e68;--wr-clay:#477d70;--wr-clay-soft:#eaf3ee;--wr-info:#507782;--wr-info-soft:#edf3f6;--wr-gold:#8c734a;--wr-progress:#75aa96;--wr-track:#eaf3ee;--wr-line:#e0e9e4;--wr-line-2:#e0e9e4;--wr-card-line:#e0e9e4;--wr-divider:#e0e9e4;--wr-surface:#FFFFFF;--wr-on-accent:#FFFFFF;--wr-glow:#FFFFFF;--wr-heat-0:#EAF3EE;--wr-heat-1:#B0D0C6;--wr-heat-2:#7FB3A4;--wr-heat-3:#4F9583;--wr-heat-4:#287E68;--wr-radius:10px}
.wr-root[data-palette="glacier"]{--wr-scrim:rgba(45,60,48,.34);--wr-bg:#f5f8fc;--wr-paper:#FFFFFF;--wr-paper-soft:#FFFFFF;--wr-wash:#eaf1f8;--wr-ink:#28364a;--wr-ink-soft:#607086;--wr-ink-mute:#607086;--wr-accent:#8ba9c5;--wr-accent-deep:#456f9e;--wr-sage:#8ba9c5;--wr-moss:#456f9e;--wr-clay:#5f7e9b;--wr-clay-soft:#eaf1f8;--wr-info:#557ba5;--wr-info-soft:#eaf1f9;--wr-gold:#917652;--wr-progress:#8ba9c5;--wr-track:#eaf1f8;--wr-line:#e0e7f0;--wr-line-2:#e0e7f0;--wr-card-line:#e0e7f0;--wr-divider:#e0e7f0;--wr-surface:#FFFFFF;--wr-on-accent:#FFFFFF;--wr-glow:#FFFFFF;--wr-heat-0:#EAF1F8;--wr-heat-1:#B9CADD;--wr-heat-2:#8FAAC7;--wr-heat-3:#6689B0;--wr-heat-4:#456F9E;--wr-radius:10px}
.wr-root[data-palette="iris"]{--wr-scrim:rgba(45,60,48,.34);--wr-bg:#f8f8fc;--wr-paper:#FFFFFF;--wr-paper-soft:#FFFFFF;--wr-wash:#efedf7;--wr-ink:#353348;--wr-ink-soft:#6c6980;--wr-ink-mute:#6c6980;--wr-accent:#a69cbd;--wr-accent-deep:#7863a0;--wr-sage:#a69cbd;--wr-moss:#7863a0;--wr-clay:#85759d;--wr-clay-soft:#efedf7;--wr-info:#746b9b;--wr-info-soft:#eeedf7;--wr-gold:#927755;--wr-progress:#a69cbd;--wr-track:#efedf7;--wr-line:#e5e2ef;--wr-line-2:#e5e2ef;--wr-card-line:#e5e2ef;--wr-divider:#e5e2ef;--wr-surface:#FFFFFF;--wr-on-accent:#FFFFFF;--wr-glow:#FFFFFF;--wr-heat-0:#EFEDF7;--wr-heat-1:#CBC4DD;--wr-heat-2:#AEA1C7;--wr-heat-3:#907FB1;--wr-heat-4:#7863A0;--wr-radius:10px}
.wr-head{flex:none;display:flex;align-items:center;gap:16px;padding:14px 26px;border-bottom:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--wr-paper) 88%, transparent);backdrop-filter:blur(10px);flex-wrap:wrap}
.wr-brand{display:flex;flex-direction:column;gap:1px;min-width:0}
.wr-brand-title{font-size:15.5px;font-weight:700;letter-spacing:.07em;color:var(--wr-ink)}
.wr-brand-sub{font-size:11px;color:var(--wr-ink-mute);letter-spacing:.05em}
.wr-tabs{display:flex;gap:2px;padding:4px;border-radius:999px;background:var(--wr-wash);border:1px solid transparent}
.wr-tab{appearance:none;border:0;background:transparent;color:var(--wr-ink-soft);font:inherit;font-size:12.5px;padding:6px 15px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background .16s ease,color .16s ease}
.wr-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.wr-tab[data-active=true]{color:var(--wr-ink);background:var(--wr-paper-soft);font-weight:600;box-shadow:0 1px 2px color-mix(in srgb, var(--wr-ink) 8%, transparent)}
.wr-head-right{margin-left:auto;display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.wr-search{position:relative;display:flex;align-items:center}
.wr-search input{box-sizing:border-box;height:32px;width:232px;max-width:44vw;border-radius:999px;border:1px solid var(--wr-line-2);background:var(--wr-paper-soft);color:var(--wr-ink);font:inherit;font-size:12.5px;padding:0 28px 0 13px;outline:none;transition:border-color .16s ease,box-shadow .16s ease}
.wr-search input:focus{border-color:var(--wr-moss);box-shadow:0 0 0 3px color-mix(in srgb, var(--wr-moss) 14%, transparent)}
.wr-search input::placeholder{color:var(--dsw-alias-label-secondary)}
.wr-search-clear{position:absolute;right:4px;width:20px;height:20px;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center}
.wr-search-clear:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.wr-btn{appearance:none;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 14px;border-radius:999px;border:1px solid var(--wr-line-2);background:var(--wr-paper-soft);color:var(--wr-ink);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .16s ease,border-color .16s ease,transform .16s ease}
.wr-btn:hover{background:var(--wr-wash);border-color:var(--wr-sage)}
.wr-btn:disabled{opacity:.55;cursor:default}
.wr-btn-primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:var(--wr-on-accent)}
.wr-btn-primary:hover{background:var(--dsw-alias-brand-primary);filter:brightness(1.06)}
.wr-btn-ghost{border-color:var(--wr-line);background:var(--wr-paper-soft)}
.wr-btn-ghost:hover{background:var(--wr-wash);border-color:var(--wr-sage)}
.wr-body{flex:1;min-height:0;overflow:auto;padding:26px 30px 64px;scrollbar-width:thin;scrollbar-color:var(--wr-line-2) transparent}
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
.wr-chip[data-active=true]{background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--wr-on-accent);font-weight:600}
.wr-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.wr-toolbar-fill{flex:1;min-width:0}
.wr-input{box-sizing:border-box;height:32px;border-radius:10px;border:1px solid var(--wr-line-2);background:var(--wr-paper-soft);color:var(--wr-ink);font:inherit;font-size:12.5px;padding:0 11px;outline:none;transition:border-color .16s ease,box-shadow .16s ease}
.wr-input:focus{border-color:var(--wr-moss);box-shadow:0 0 0 3px color-mix(in srgb, var(--wr-moss) 14%, transparent)}
.wr-select{box-sizing:border-box;height:32px;border-radius:10px;border:1px solid var(--wr-line-2);background:var(--wr-paper-soft);color:var(--wr-ink);font:inherit;font-size:12.5px;padding:0 9px;outline:none;max-width:220px;cursor:pointer}
.wr-grid{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:12px}
@media (max-width:1240px){.wr-grid{grid-template-columns:repeat(8,minmax(0,1fr))}}
@media (max-width:920px){.wr-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
@media (max-width:640px){.wr-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
.wr-book{appearance:none;border:0;background:transparent;padding:0;margin:0;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:6px;font:inherit;color:inherit;content-visibility:auto;contain-intrinsic-size:0 220px}
.wr-book-cover-wrap{position:relative;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px color-mix(in srgb, var(--wr-ink) 8%, transparent);transition:transform .2s ease,box-shadow .2s ease}
.wr-book:hover .wr-book-cover-wrap{transform:translateY(-3px);box-shadow:0 6px 14px color-mix(in srgb, var(--wr-ink) 12%, transparent)}
.wr-cover{aspect-ratio:3/4;width:100%;background:var(--dsw-alias-bg-layer-2);display:block;overflow:hidden;position:relative}
.wr-cover img{width:100%;height:100%;object-fit:cover;display:block}
.wr-cover-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:var(--wr-on-accent);background:linear-gradient(150deg,var(--wr-sage),var(--wr-moss))}
.wr-cover-badges{position:absolute;left:4px;top:4px;display:flex;gap:3px;flex-wrap:wrap;max-width:calc(100% - 8px)}
.wr-badge{font-size:9px;line-height:1.5;padding:0 5px;border-radius:999px;background:color-mix(in srgb, var(--wr-ink) 62%, transparent);color:var(--wr-paper-soft);backdrop-filter:blur(3px)}
.wr-badge[data-tone=brand]{background:color-mix(in srgb, var(--wr-sage) 92%, transparent)}
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
.wr-quote:before{content:'“';position:absolute;left:9px;top:3px;font-size:26px;color:color-mix(in srgb, var(--wr-sage) 55%, transparent);font-family:Georgia,serif;line-height:1}
.wr-quote-text{font-size:12.8px;line-height:1.62;white-space:pre-wrap;word-break:break-word;padding-left:12px;margin:0}
.wr-quote-foot{display:flex;align-items:center;gap:6px;margin-top:9px;padding-left:12px;font-size:11px;color:var(--dsw-alias-label-secondary);min-width:0}
.wr-quote-book{font-weight:600;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
.wr-quote-tail{margin-left:auto;flex:none;display:flex;gap:6px;align-items:center}
.wr-thought{position:relative;break-inside:avoid;margin:0 0 14px;background:var(--wr-paper-soft);border:1px solid var(--wr-card-line);border-left:2px solid color-mix(in srgb, var(--wr-sage) 70%, transparent);border-radius:14px;padding:15px 17px}
.wr-cols .wr-thought{margin-bottom:20px;background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-left:2px solid color-mix(in srgb, var(--wr-sage) 70%, transparent);box-shadow:0 1px 2px color-mix(in srgb, var(--wr-ink) 5%, transparent)}
.wr-cols .wr-thought[data-clickable=true]:hover{background:var(--wr-paper-soft);border-color:var(--wr-sage);box-shadow:0 4px 12px color-mix(in srgb, var(--wr-ink) 9%, transparent)}
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
.wr-think{margin-top:8px;opacity:0;transition:opacity .14s ease}
.wr-quote:hover .wr-think,.wr-thought:hover .wr-think,.wr-cols .wr-thought:hover .wr-think,.wr-think:focus-within,.wr-think[data-busy=true]{opacity:1}
@media (hover:none){.wr-think{opacity:1}}
.wr-think-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.wr-think-btn{appearance:none;border:1px solid var(--wr-line);background:var(--wr-paper-soft);color:var(--wr-ink-soft);font:inherit;font-size:11px;line-height:1;padding:5px 10px;border-radius:999px;cursor:pointer;transition:border-color .14s ease,color .14s ease,background .14s ease}
.wr-think-btn:hover{border-color:var(--wr-moss);color:var(--wr-ink);background:var(--wr-wash)}
.wr-think-btn[data-active=true]{border-color:var(--wr-moss);color:var(--wr-moss);background:var(--wr-wash)}
.wr-think-btn:disabled{opacity:.5;cursor:default}
.wr-think-custom{display:flex;gap:6px;align-items:center;margin-top:6px}
.wr-think-input{flex:1;min-width:0;font:inherit;font-size:12px;line-height:1.5;padding:5px 10px;border-radius:999px;border:1px solid var(--wr-line);background:var(--wr-paper-soft);color:var(--wr-ink)}
.wr-think-input:focus{outline:none;border-color:var(--wr-moss);box-shadow:0 0 0 3px color-mix(in srgb, var(--wr-moss) 14%, transparent)}
.wr-think-go{border-color:var(--wr-moss);color:var(--wr-on-accent);background:var(--wr-moss)}
.wr-think-go:hover{background:var(--wr-moss);color:var(--wr-on-accent);border-color:var(--wr-moss);filter:brightness(1.04)}
.wr-think-msg{margin-top:6px;font-size:11px;line-height:1.5;color:var(--wr-ink-mute)}
.wr-think[data-open=true]{opacity:1}
.wr-ask{position:fixed;z-index:60;display:flex;flex-direction:column;max-height:min(72vh,640px);background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-radius:16px;box-shadow:0 18px 48px color-mix(in srgb, var(--wr-ink) 16%, transparent),0 2px 8px color-mix(in srgb, var(--wr-ink) 6%, transparent);overflow:hidden}
.wr-ask-head{display:flex;align-items:flex-start;gap:10px;padding:12px 14px 10px;border-bottom:1px solid var(--wr-divider)}
.wr-ask-meta{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;min-width:0;flex:1}
.wr-ask-kind{font-size:10.5px;line-height:1;padding:3px 7px;border-radius:999px;background:var(--wr-wash);color:var(--wr-ink-soft)}
.wr-ask-book{font-size:12.5px;color:var(--wr-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.wr-ask-chapter{font-size:11px;color:var(--wr-ink-mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wr-ask-close{appearance:none;flex:none;width:24px;height:24px;border-radius:50%;border:1px solid transparent;background:transparent;color:var(--wr-ink-soft);font-size:16px;line-height:1;cursor:pointer;transition:background .12s ease,color .12s ease}
.wr-ask-close:hover{background:var(--wr-wash);color:var(--wr-ink)}
.wr-ask-tools{display:flex;flex-wrap:wrap;gap:6px;padding:9px 14px 0}
.wr-ask-chip{appearance:none;border:1px solid var(--wr-line);background:var(--wr-paper);color:var(--wr-ink-soft);font:inherit;font-size:11px;line-height:1;padding:4px 9px;border-radius:999px;cursor:pointer}
.wr-ask-chip:hover{border-color:var(--wr-moss);color:var(--wr-ink)}
.wr-ask-chip[data-on=true]{border-color:var(--wr-sage);background:var(--wr-wash);color:var(--wr-ink)}
.wr-ask-chip:disabled{opacity:.5;cursor:default}
.wr-ask-body{flex:0 1 auto;min-height:0;max-height:52vh;overflow:auto;resize:vertical;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.wr-ask-empty{font-size:11.5px;line-height:1.6;color:var(--wr-ink-mute)}
.wr-ask-msg{max-width:92%;font-size:12.5px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
.wr-ask-msg[data-role=user]{align-self:flex-end;padding:7px 11px;border-radius:12px 12px 4px 12px;background:var(--wr-wash);color:var(--wr-ink)}
.wr-ask-msg[data-role=assistant]{align-self:flex-start;padding:2px 0;color:var(--wr-ink)}
.wr-ask-typing{color:var(--wr-ink-mute);font-size:11.5px}
.wr-ask-error{margin:0 14px;padding:7px 10px;border-radius:10px;background:color-mix(in srgb, var(--dsw-alias-state-error) 10%, var(--wr-paper-soft));color:var(--dsw-alias-state-error);font-size:11.5px;line-height:1.5}
.wr-ask-foot{display:flex;gap:8px;align-items:flex-end;padding:10px 14px 8px;border-top:1px solid var(--wr-divider)}
.wr-ask-input{flex:1;min-width:0;font:inherit;font-size:12.5px;line-height:1.6;padding:9px 12px;min-height:52px;max-height:132px;resize:none;overflow-y:auto;border-radius:12px;border:1px solid var(--wr-line);background:var(--wr-paper);color:var(--wr-ink)}
.wr-ask-input:focus{outline:none;border-color:var(--wr-moss);box-shadow:0 0 0 3px color-mix(in srgb, var(--wr-moss) 14%, transparent)}
.wr-ask-send{appearance:none;flex:none;align-self:flex-end;border:1px solid var(--wr-moss);background:var(--wr-moss);color:var(--wr-on-accent);font:inherit;font-size:11.5px;line-height:1;padding:9px 14px;border-radius:999px;cursor:pointer}
.wr-ask-send:disabled{opacity:.45;cursor:default}
.wr-ask-note{padding:0 14px 10px;font-size:10px;line-height:1.4;color:var(--wr-ink-mute)}
.wr-ask-offline{margin:8px 14px 0;padding:6px 9px;border:1px solid var(--wr-line-2);border-radius:8px;background:var(--wr-wash);font-size:11px;line-height:1.5;color:var(--wr-ink-soft)}
.wr-quote[data-clickable=true],.wr-thought[data-clickable=true]{cursor:pointer;transition:border-color .12s ease}
.wr-quote[data-clickable=true]:hover,.wr-thought[data-clickable=true]:hover{border-color:var(--dsw-alias-border-l2)}
.wr-copy{appearance:none;border:1px solid var(--wr-line);background:var(--wr-paper);color:var(--wr-ink-soft);font:inherit;font-size:10.5px;line-height:1;padding:4px 9px;border-radius:999px;cursor:pointer;flex:none;opacity:0;transition:opacity .14s ease,color .14s ease,border-color .14s ease}
.wr-quote:hover .wr-copy,.wr-thought:hover .wr-copy,.wr-copy:focus,.wr-copy[data-done=true]{opacity:1}
@media (hover:none){.wr-copy{opacity:1}}
.wr-copy:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.wr-copy[data-done=true]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.wr-pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:16px;font-size:12px;flex-wrap:wrap}
.wr-pick{position:absolute;right:9px;top:9px;width:18px;height:18px;border-radius:50%;border:1px solid color-mix(in srgb, var(--wr-moss) 55%, transparent);background:var(--wr-paper-soft);color:transparent;font-size:11px;line-height:1;display:grid;place-items:center;cursor:pointer;padding:0;opacity:0;transition:opacity .12s ease,border-color .12s ease,background .12s ease;z-index:2}
.wr-quote:hover .wr-pick,.wr-thought:hover .wr-pick,.wr-pick:focus-visible,.wr-pick[data-on=true]{opacity:1}
.wr-pick:hover{border-color:var(--wr-moss)}
@media (hover:none){.wr-pick{opacity:1}}
.wr-pick[data-on=true]{background:var(--wr-moss);border-color:var(--wr-moss);color:var(--wr-on-accent)}
.wr-quote[data-picked=true],.wr-thought[data-picked=true]{border-color:var(--wr-moss);box-shadow:0 0 0 2px color-mix(in srgb, var(--wr-moss) 16%, transparent)}
.wr-mark{background:var(--wr-heat-1);color:var(--wr-ink);border-radius:3px;padding:0 2px}
.wr-export{width:min(760px,94vw);max-height:88vh;display:flex;flex-direction:column}
.wr-export-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.wr-export-opts{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:10px 0}
.wr-export-body{flex:1 1 auto;min-height:120px;max-height:46vh;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1)}
.wr-export-label{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:6px}
.wr-export-preview{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.wr-stars{color:var(--wr-clay);font-size:10.5px;letter-spacing:1px}
.wr-detail-head{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
.wr-detail-cover{width:120px;flex:none;border-radius:12px;overflow:hidden;box-shadow:0 10px 24px -12px color-mix(in srgb, var(--wr-ink) 55%, transparent)}
.wr-detail-main{flex:1;min-width:220px;display:flex;flex-direction:column;gap:8px}
.wr-detail-title{font-size:18px;font-weight:700;line-height:1.35;margin:0}
.wr-detail-author{font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.wr-modal-mask{position:fixed;inset:0;z-index:1200;background:var(--wr-scrim);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:24px}
.wr-modal{width:min(480px,100%);max-height:80vh;overflow:auto;background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-radius:18px;box-shadow:0 30px 70px -30px color-mix(in srgb, var(--wr-ink) 60%, transparent);padding:22px}
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
.wr-root ::selection{background:color-mix(in srgb, var(--wr-sage) 45%, transparent);color:var(--wr-ink)}
.wr-root :focus-visible{outline:2px solid color-mix(in srgb, var(--wr-moss) 45%, transparent);outline-offset:2px}
.wr-body::-webkit-scrollbar{width:10px;height:10px}
.wr-body::-webkit-scrollbar-thumb{background:var(--wr-line-2);border-radius:999px;border:2px solid transparent;background-clip:content-box}
.wr-body::-webkit-scrollbar-track{background:transparent}
.wr-heat-legend i{width:11px;height:11px;border-radius:3px;display:inline-block}
.wr-setup{background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-radius:18px;padding:26px 28px;box-shadow:0 1px 2px color-mix(in srgb, var(--wr-ink) 4%, transparent)}
.wr-journey{display:flex;gap:2px;padding:3px;border-radius:999px;background:var(--wr-wash);border:1px solid var(--wr-line);flex-wrap:nowrap;flex:none}
.wr-journey-tab{appearance:none;display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:var(--wr-ink-soft);font:inherit;font-size:12.5px;font-weight:600;letter-spacing:.04em;padding:6px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background .16s ease,color .16s ease}
.wr-journey-tab:hover{color:var(--wr-ink);background:var(--wr-paper-soft)}
.wr-journey-tab[data-active=true],.wr-journey-tab[data-active=true]:hover{background:var(--dsw-alias-brand-primary);color:var(--wr-on-accent)}
.wr-journey-count{font-size:10px;font-weight:600;font-variant-numeric:tabular-nums;opacity:.72;background:color-mix(in srgb, var(--wr-ink) 8%, transparent);border-radius:999px;padding:1px 5px}
.wr-journey-tab[data-active=true] .wr-journey-count{background:color-mix(in srgb, var(--wr-on-accent) 24%, transparent);opacity:.92}
.wr-subnav{flex:none;display:flex;align-items:center;gap:12px;padding:9px 26px;border-bottom:1px solid var(--wr-line);background:color-mix(in srgb, var(--wr-paper) 72%, transparent);flex-wrap:wrap}
.wr-subnav-hint{font-size:11.5px;color:var(--wr-ink-mute);margin-left:auto;letter-spacing:.02em}
@media (max-width:640px){.wr-journey-tab{padding:6px 9px;font-size:12px}.wr-journey-count{display:none}.wr-subnav{padding:8px 16px}}
.wr-chain{margin-top:18px;background:var(--wr-paper-soft);border:1px solid var(--wr-line);border-radius:16px;padding:14px 16px}
.wr-chain-head{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;margin-bottom:10px}
.wr-chain-head strong{font-size:13px}
.wr-chain-row{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
@media (max-width:920px){.wr-chain-row{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:520px){.wr-chain-row{grid-template-columns:repeat(2,minmax(0,1fr))}}
.wr-chain-step{appearance:none;text-align:left;font:inherit;cursor:pointer;border:1px solid var(--wr-line);background:var(--wr-wash);border-radius:12px;padding:9px 11px;display:flex;flex-direction:column;gap:3px;min-width:0;transition:border-color .14s ease,background .14s ease}
.wr-chain-step:hover{border-color:var(--wr-sage);background:var(--wr-paper-soft)}
.wr-chain-step[data-empty=true] .wr-chain-count{color:var(--wr-ink-mute)}
.wr-chain-count{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.1}
.wr-chain-label{font-size:11px;color:var(--wr-ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wr-degraded{font-size:10.5px;line-height:1.4;padding:2px 7px;border-radius:999px;background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, var(--wr-paper-soft));color:var(--dsw-alias-state-warn-primary);border:1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 34%, transparent);white-space:nowrap}
.wr-srcs{display:inline-flex;flex-wrap:wrap;gap:4px;min-width:0;max-width:100%}
.wr-src{font-size:10.5px;line-height:1.5;padding:2px 7px;border-radius:999px;background:var(--wr-wash);color:var(--wr-ink-soft);border:1px solid var(--wr-line);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;font-family:inherit}
.wr-src[data-missing=true]{border-style:dashed;color:var(--wr-ink-mute)}
button.wr-src{cursor:pointer}
button.wr-src:not(:disabled):hover{border-color:var(--wr-sage);color:var(--wr-moss)}
.wr-src[data-kind=thought]{border-color:var(--wr-sage)}
.wr-src[data-kind=response]{border-color:color-mix(in srgb, var(--wr-moss) 40%, transparent)}
.wr-src[data-kind=material]{border-color:color-mix(in srgb, var(--wr-clay) 40%, transparent)}
.wr-src-empty{color:var(--wr-ink-mute);border-style:dashed;background:transparent}
.wr-item{background:var(--wr-paper-soft);border:1px solid var(--wr-card-line);border-radius:14px;padding:13px 15px;display:flex;flex-direction:column;gap:7px;min-width:0}
.wr-item-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.wr-item-text{margin:0;font-size:13px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
.wr-item-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--wr-ink-mute);min-width:0}
.wr-tag{font-size:10px;line-height:1.6;padding:1px 7px;border-radius:999px;background:var(--wr-wash);color:var(--wr-ink-soft);border:1px solid var(--wr-line);white-space:nowrap;flex:none}
.wr-tag[data-tone=ai]{background:color-mix(in srgb, var(--wr-moss) 12%, var(--wr-paper-soft));color:var(--wr-moss);border-color:color-mix(in srgb, var(--wr-moss) 32%, transparent)}
.wr-tag[data-tone=ok]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 32%, transparent)}
.wr-tag[data-tone=changed]{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 32%, transparent)}
.wr-tag[data-tone=missing]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 32%, transparent)}
.wr-stack{display:flex;flex-direction:column;gap:10px}
.wr-form{display:flex;flex-direction:column;gap:8px;background:var(--wr-surface);border:1px solid var(--wr-line);border-radius:14px;padding:13px 15px;margin-bottom:12px}
.wr-form-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.wr-form-row .wr-input{flex:1;min-width:180px}
.wr-picklist{display:flex;flex-direction:column;gap:2px;max-height:184px;overflow:auto;border:1px solid var(--wr-line);border-radius:10px;padding:4px}
.wr-pickrow{display:flex;align-items:flex-start;gap:8px;padding:5px 7px;border-radius:8px;font-size:12px;line-height:1.55;color:var(--wr-ink-soft);cursor:pointer;text-align:left;border:0;background:transparent;font:inherit;width:100%}
.wr-pickrow:hover{background:var(--wr-wash);color:var(--wr-ink)}
.wr-pickrow[data-on=true]{background:var(--wr-wash);color:var(--wr-ink)}
.wr-pickrow-mark{flex:none;width:14px;height:14px;border-radius:4px;border:1px solid var(--wr-line-2);display:grid;place-items:center;font-size:9px;line-height:1;margin-top:2px}
.wr-pickrow[data-on=true] .wr-pickrow-mark{background:var(--wr-moss);border-color:var(--wr-moss);color:var(--wr-on-accent)}
.wr-tl{display:flex;flex-direction:column;gap:18px}
.wr-tl-month{display:flex;align-items:baseline;gap:10px;margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:.03em}
.wr-tl-items{display:flex;flex-direction:column;gap:6px;border-left:2px solid var(--wr-line);padding-left:14px}
.wr-tl-item{display:flex;align-items:baseline;gap:9px;font-size:12.5px;line-height:1.6;min-width:0;position:relative}
.wr-tl-item{background:none;border:0;border-radius:6px;padding:0 6px 0 0;margin:0;font:inherit;color:inherit;text-align:left;width:100%;cursor:pointer}
.wr-tl-item:not(:disabled):hover{background:var(--wr-wash)}
.wr-tl-item:disabled{cursor:default;opacity:.72}
.wr-tl-cross{flex:none;font-size:10px;padding:0 5px}
.wr-tl-book{flex:none;font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wr-type-switch{flex:none;height:24px;font-size:11px;padding:0 4px}
.wr-tl-item:before{content:'';position:absolute;left:-19px;top:7px;width:7px;height:7px;border-radius:50%;background:var(--wr-sage)}
.wr-tl-kind{flex:none;font-size:10.5px;color:var(--wr-ink-mute);white-space:nowrap}
.wr-tl-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wr-draft{display:flex;flex-direction:column;gap:8px}
.wr-paragraph{display:flex;gap:10px;align-items:flex-start;background:var(--wr-paper-soft);border:1px solid var(--wr-card-line);border-radius:12px;padding:11px 13px}
.wr-paragraph-index{flex:none;font-size:11px;color:var(--wr-ink-mute);font-variant-numeric:tabular-nums;padding-top:2px;width:46px}
.wr-paragraph-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
.wr-ai{flex:0 0 auto;min-width:0}
.wr-ai[data-open=true]{flex:1 0 100%;display:flex;flex-direction:column;gap:8px;background:var(--wr-wash);border:1px solid var(--wr-line);border-radius:10px;padding:10px 12px;margin-top:2px}
.wr-ai-hint{font-size:11px;color:var(--wr-ink-mute);min-width:0}
.wr-ai-draft{margin:0;white-space:pre-wrap;font-size:13px;line-height:1.7;color:var(--wr-ink)}
.wr-ai-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wr-ai-running{font-size:12px;color:var(--wr-ink-soft)}
.wr-draft-export{background:var(--wr-surface);border:1px solid var(--wr-line);border-radius:12px;padding:10px 12px;max-height:260px;overflow:auto;margin-top:10px}
.wr-empty-next{margin:6px auto 12px;max-width:440px;font-size:12px;line-height:1.65;color:var(--wr-ink-soft)}
.wr-notice-line{font-size:11.5px;color:var(--wr-ink-soft);margin:0 0 10px}
.wr-adopt{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 14px;border-top:1px solid var(--wr-divider);background:var(--wr-surface)}
.wr-adopt-hint{font-size:10.5px;color:var(--wr-ink-mute);line-height:1.45;flex:1 1 150px;min-width:0}
.wr-adopt-actions{display:flex;gap:6px;flex-wrap:wrap}
.wr-adopt-actions .wr-btn{font-size:11px;padding:3px 9px}
.wr-adopt-types{display:flex;align-items:center;gap:5px;flex-wrap:wrap;width:100%}
.wr-adopt-types .wr-chip{font-size:11px;padding:3px 8px}
.wr-adopt-error{font-size:10.5px;color:var(--dsw-alias-state-error-primary);width:100%}
.wr-btn[data-active=true]{border-color:var(--wr-moss);color:var(--wr-moss)}
.wr-think-take{border-style:dashed;color:var(--wr-ink-soft)}
.wr-modal-body{display:flex;flex-direction:column;gap:10px;padding:4px 1px 8px;min-height:0;overflow:auto}
.wr-picker{max-width:520px}
.wr-picker-link{display:flex;flex-direction:column;gap:6px}
.wr-picker-list{display:flex;flex-direction:column;gap:4px;max-height:180px;overflow:auto}
.wr-picker-row{display:flex;align-items:flex-start;gap:8px;width:100%;text-align:left;font:inherit;font-size:12px;line-height:1.55;color:var(--wr-ink-soft);background:transparent;border:1px solid var(--wr-line);border-radius:9px;padding:6px 9px;cursor:pointer}
.wr-picker-row:hover{border-color:var(--wr-sage);color:var(--wr-ink)}
.wr-picker-row[data-on=true]{background:var(--wr-wash);border-color:var(--wr-moss);color:var(--wr-ink)}
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

    // --------------------------------------------------------------- thinking
    /**
     * The source pack: everything the model needs to answer well, and nothing
     * else. Labels say what each part IS, so the reply can tell the book's
     * words from mine.
     */
    const THINK_LIMITS = { body: 600, context: 3, contextEach: 200 }

    const THINK_MODES = [
      ['explain', 'think.mode.explain', 'think.ask.explain'],
      ['reframe', 'think.mode.reframe', 'think.ask.reframe'],
      ['deeper', 'think.mode.deeper', 'think.ask.deeper'],
    ]

    /**
     * F-29: what a source IS. A 金句 material is the book's words, not mine — the
     * pack has to say so, or the model writes in my voice about someone else's line.
     */
    const PACK_KIND_KEYS = {
      note: 'think.packKindNote',
      thought: 'think.packKindThought',
      response: 'think.packKindResponse',
      material: 'think.packKindMaterial',
    }

    /** Anything we cannot classify degrades to 「我整理的素材」: never pose as the book or as me. */
    function packKindOf(kind) {
      const name = String(kind || '')
      return PACK_KIND_KEYS[name] ? name : 'material'
    }

    /** Only the six real types get a parenthesised name; a made-up type stays neutral. */
    function materialTypeKnown(type) {
      const name = String(type || '')
      return MATERIAL_TYPES.some((item) => item[0] === name)
    }

    /**
     * F-32: 素材有作者身份。`authorType === 'ai'` 表示这条素材是我采纳了 AI 回应之后整理出来的，
     * 不是我自己敲的字；进模型时必须与自写素材分开，否则模型会把 AI 的话当我的观点复述。
     * 只认严格的 'ai'：缺失、大小写不对、写错值，一律按我自己写的处理——宁可漏标，不能误标。
     */
    function materialAuthorIsAI(authorType) {
      return String(authorType || '') === 'ai'
    }

    function packKindLabel(kind, type, authorType) {
      const name = packKindOf(kind)
      if (name !== 'material') return t(PACK_KIND_KEYS[name])
      const role = t(materialAuthorIsAI(authorType) ? 'think.packKindMaterialAI' : PACK_KIND_KEYS.material)
      if (!materialTypeKnown(type)) return role
      return t('think.packKindMaterialOf', {
        role,
        type: t(materialTypeKey(String(type || ''))),
      })
    }

    function buildSourcePack(input) {
      const entry = input && input.entry ? input.entry : {}
      const kind = packKindOf(input && input.kind)
      const type = String((input && input.type) || '')
      // F-32: 只有素材需要区分作者身份；其余三类没有这个概念（回应本身就是 AI 的，标签已写明）。
      const authorType = kind === 'material' && materialAuthorIsAI(input && input.authorType) ? 'ai' : ''
      const context = Array.isArray(input && input.context) ? input.context : []
      const question = String((input && input.question) || '').trim()
      const title = String(entry.bookTitle || '').trim()
      const author = String(entry.author || '').trim()
      const chapter = String((kind === 'note' ? entry.chapterTitle : entry.chapterName) || '').trim()
      const lines = [t('think.packHead')]
      lines.push(`${t('think.packBook')}${title === '' ? t('think.packUnknown') : `《${title}》`}`)
      if (author !== '') lines.push(`${t('think.packAuthor')}${author}`)
      if (chapter !== '') lines.push(`${t('think.packChapter')}${chapter}`)
      lines.push(`${t('think.packKind')}${packKindLabel(kind, type, authorType)}`)
      if (entry.createTime) lines.push(`${t('think.packTime')}${fmtDateTime(entry.createTime)}`)
      lines.push('')
      if (kind === 'note') {
        lines.push(t('think.packOriginal'))
        lines.push(`> ${clip(String(entry.text || '').trim(), THINK_LIMITS.body)}`)
      } else if (kind === 'thought') {
        lines.push(t('think.packMine'))
        lines.push(clip(String(entry.content || '').trim(), THINK_LIMITS.body))
      } else if (kind === 'response') {
        lines.push(t('think.packAdopted'))
        lines.push(clip(String(entry.content || entry.text || '').trim(), THINK_LIMITS.body))
      } else {
        // F-32: 「我整理的素材：」是自写素材的说法；AI 采纳来的素材要有自己的抬头，
        // 否则正文与自写素材挤在同一个标签下，模型分不清哪句是它自己说的。
        lines.push(t(authorType === 'ai' ? 'think.packFiledAI' : 'think.packFiled'))
        lines.push(clip(String(entry.content || entry.text || '').trim(), THINK_LIMITS.body))
      }
      const used = context.slice(0, THINK_LIMITS.context)
      if (used.length > 0) {
        lines.push('')
        const labelled = used.some((item) => item && item.kind)
        lines.push(
          labelled
            ? t('think.packContextMixed', { count: String(used.length) })
            : t('think.packContext', { count: String(used.length) }),
        )
        for (let index = 0; index < used.length; index += 1) {
          const item = used[index] || {}
          const text = clip(String(item.text || item.content || '').trim(), THINK_LIMITS.contextEach)
          lines.push(item.kind ? `${index + 1}. ${packKindLabel(item.kind, item.type, item.authorType)}：${text}` : `${index + 1}. ${text}`)
        }
      }
      lines.push('')
      lines.push(t('think.packFoot'))
      if (question !== '') {
        lines.push('')
        lines.push(question)
      }
      return lines.join('\n')
    }

    /**
     * F-23: one paragraph source -> the shape buildSourcePack understands. The
     * pack is the only thing the model sees, so a material grounds the draft by
     * its own text and a highlight keeps its chapter.
     */
    function paragraphSourceEntry(sourceId, ctx) {
      const kind = sourceKind(sourceId)
      const raw = sourceRawId(sourceId)
      const lookup = (ctx && ctx.lookup) || {}
      const table = lookup[kind]
      const hit = table && typeof table.get === 'function' ? table.get(raw) : null
      if (!hit) return null
      const titleOf = ctx && typeof ctx.titleOf === 'function' ? ctx.titleOf : () => ''
      if (kind === 'note') return { kind: 'note', entry: hit }
      if (kind === 'thought') {
        return {
          kind: 'thought',
          entry: {
            content: hit.content,
            bookTitle: titleOf(hit.bookId),
            chapterName: hit.chapterName,
            createTime: hit.createTime,
          },
        }
      }
      if (kind === 'response') {
        return {
          kind: 'response',
          entry: { content: hit.text, bookTitle: hit.bookTitle, author: hit.author, createTime: hit.adoptedAt },
        }
      }
      return {
        kind: 'material',
        type: String(hit.type || ''),
        // F-32: 素材的作者身份一路透传到 pack，别在成包时抹掉。
        authorType: materialAuthorIsAI(hit.authorType) ? 'ai' : '',
        entry: { content: hit.text, bookTitle: hit.bookTitle, author: hit.author, createTime: hit.createdAt },
      }
    }

    /** The paragraph's own sources, in pack form. Empty when nothing resolves. */
    function buildParagraphPack(input) {
      const sourceIds = Array.isArray(input && input.sourceIds) ? input.sourceIds : []
      const list = []
      for (const sourceId of sourceIds) {
        const hit = paragraphSourceEntry(sourceId, input)
        if (hit) list.push(hit)
      }
      if (list.length === 0) return ''
      const primary = list[0]
      const context = list.slice(1).map((item) => ({
        text: String(item.entry.content || item.entry.text || ''),
        kind: item.kind,
        type: item.type,
        authorType: item.authorType,
      }))
      return buildSourcePack({
        entry: primary.entry,
        kind: primary.kind,
        type: primary.type,
        authorType: primary.authorType,
        context,
      })
    }

/**
     * One chat turn: the host picks the model and streams text back as SSE.
     * A turn carries the source pack plus the earlier turns itself, so nothing
     * needs to be persisted between opens and every card stays independent.
     */
    async function streamChat(payload, onEvent, signal) {
      const response = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      })
      if (!response.ok) {
        let message = ''
        try {
          const data = await response.json()
          message = String((data && data.error) || '')
        } catch {
          message = ''
        }
        throw new Error(message || `HTTP ${response.status}`)
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let cut = buffer.indexOf('\n\n')
        while (cut >= 0) {
          const frame = buffer.slice(0, cut)
          buffer = buffer.slice(cut + 2)
          const line = frame.split('\n').find((item) => item.startsWith('data: '))
          if (line) {
            try {
              onEvent(JSON.parse(line.slice(6)))
            } catch {
              // A half frame is not worth failing an answer over.
            }
          }
          cut = buffer.indexOf('\n\n')
        }
      }
    }

    const ASK_WIDTH = 480

    /** Where the card sits: just under the buttons, or above them near the bottom edge. */
    function askPosition(anchor) {
      const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1200
      const viewportH = typeof window !== 'undefined' ? window.innerHeight : 900
      const width = Math.min(ASK_WIDTH, Math.max(300, viewportW - 28))
      const x = Math.min(Math.max(8, (anchor && anchor.x) || 40), Math.max(8, viewportW - width - 12))
      const y = (anchor && anchor.y) || 120
      if (viewportH - y < 400) {
        return { left: `${x}px`, bottom: `${Math.max(8, viewportH - y + 10)}px`, width: `${width}px` }
      }
      return { left: `${x}px`, top: `${y + 10}px`, width: `${width}px` }
    }

    /**
     * The conversation card that opens right where the reader is. The card it
     * belongs to stays visible, so the question and the passage are on screen
     * together; × closes it and the turns leave with it.
     */
    /* The writing side belongs to the study, but the ask card needs exactly two
       things from it: somewhere to write, and a way to read the craft snapshot.
       A tiny bridge keeps AskCard free of props it otherwise never uses. */
    const craftBridge = { write: null, craft: null }

    /** F-20: the only thing that survives a conversation is the line you keep. */
    function AskAdopt(props) {
      const [saved, setSaved] = useState('')
      const [panel, setPanel] = useState('')
      const [type, setType] = useState('观点')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const answer = String(props.answer || '').trim()
      if (answer === '') return null
      const entry = props.entry || {}
      const prefix = props.kind === 'thought' ? 'thought' : 'note'
      const sourceId = `${prefix}:${String(entry.id === undefined || entry.id === null ? '' : entry.id)}`
      const bookId = String(entry.bookId || '')

      const save = (op, payload) => {
        const write = craftBridge.write
        if (typeof write !== 'function') {
          setError(t('craft.offline'))
          return
        }
        setBusy(true)
        setError('')
        write(op, payload)
          .then(() => {
            setBusy(false)
            setPanel('')
            setSaved(op === 'response.add' ? 'thought' : 'material')
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }
      const keepThought = () =>
        save('response.add', {
          text: answer,
          sourceIds: [sourceId],
          // A thought entry has no bookId of its own; a highlight carries the
          // book, so the payload can name it and the host can cross-check.
          bookId: bookId === '' ? undefined : bookId,
          containsAI: true,
          model: props.model || '',
          origin: 'think',
        })
      const keepMaterial = () =>
        save('material.add', {
          type,
          text: answer,
          sourceIds: [sourceId],
          bookId: bookId === '' ? undefined : bookId,
          containsAI: true,
          authorType: 'ai',
          origin: 'craft',
        })

      return h(
        'div',
        { className: 'wr-adopt' },
        h('span', { className: 'wr-adopt-hint' }, t('ask.adoptHint')),
        saved === ''
          ? h(
              'div',
              { className: 'wr-adopt-actions' },
              h(
                'button',
                { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: keepThought },
                t('ask.adoptThought'),
              ),
              h(
                'button',
                {
                  className: 'wr-btn wr-btn-ghost',
                  type: 'button',
                  disabled: busy,
                  'data-active': panel === 'material' ? 'true' : 'false',
                  onClick: () => setPanel(panel === 'material' ? '' : 'material'),
                },
                t('ask.adoptMaterial'),
              ),
            )
          : h('span', { className: 'wr-tag', 'data-tone': 'ai' }, `${t('ask.adoptDone')} · ${t(saved === 'thought' ? 'nav.responses' : 'nav.materials')}`),
        saved !== '' || panel !== 'material'
          ? null
          : h(
              'div',
              { className: 'wr-adopt-types' },
              h('span', { className: 'wr-muted' }, t('ask.adoptType')),
              MATERIAL_TYPES.map(([label, key]) =>
                h(
                  'button',
                  {
                    className: 'wr-chip',
                    key: label,
                    type: 'button',
                    'data-active': type === label ? 'true' : 'false',
                    disabled: busy,
                    onClick: () => setType(label),
                  },
                  t(key),
                ),
              ),
              h('button', { className: 'wr-chip', type: 'button', disabled: busy, onClick: keepMaterial }, t('ask.adoptSave')),
              h('button', { className: 'wr-chip', type: 'button', disabled: busy, onClick: () => setPanel('') }, t('ask.adoptCancel')),
            ),
        error === '' ? null : h('span', { className: 'wr-adopt-error' }, t('ask.adoptFailed', { error })),
      )
    }

    function AskCard(props) {
      const [messages, setMessages] = useState([])
      const [draft, setDraft] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [model, setModel] = useState('')
      const [active, setActive] = useState('')
      // F1: an entry the host cannot serve is greyed before it is pressed.
      const chat = useChatAvailability()
      const offline = chat === 'offline'
      const abortRef = useRef(null)
      const bodyRef = useRef(null)
      const inputRef = useRef(null)
      const touchedRef = useRef(false)
      const turnsRef = useRef([])
      // The last answer with any text in it is what an adoption can keep.
      const lastAnswer = (() => {
        for (let at = messages.length - 1; at >= 0; at -= 1) {
          const msg = messages[at]
          if (msg && msg.role === 'assistant' && String(msg.text || '').trim() !== '') return String(msg.text)
        }
        return ''
      })()

      const scrollBody = () => {
        const node = bodyRef.current
        if (node && typeof node.scrollHeight === 'number') node.scrollTop = node.scrollHeight
      }
      useEffect(() => {
        scrollBody()
      }, [messages, busy])
      // The box grows with what is typed in it, then scrolls instead of pushing
      // the answer off screen.
      useEffect(() => {
        const node = inputRef.current
        if (!node || !node.style) return
        node.style.height = 'auto'
        const next = typeof node.scrollHeight === 'number' ? node.scrollHeight : 0
        node.style.height = `${Math.min(Math.max(next || 52, 52), 132)}px`
      }, [draft])

      const appendText = (text) => {
        setMessages((prev) => {
          if (prev.length === 0) return prev
          const next = prev.slice()
          const last = next[next.length - 1]
          next[next.length - 1] = { role: 'assistant', text: `${(last && last.text) || ''}${text}` }
          return next
        })
      }

      const send = (raw) => {
        const question = String(raw || '').trim()
        if (question === '' || busy) return
        setDraft('')
        setError('')
        setBusy(true)
        setMessages((prev) => prev.concat([{ role: 'user', text: question }, { role: 'assistant', text: '' }]))
        const history = turnsRef.current.slice(-6)
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        abortRef.current = controller
        let answer = ''
        streamChat(
          { pack: props.pack, history, question },
          (event) => {
            if (!event) return
            if (event.type === 'open') {
              setModel(event.model || '')
              return
            }
            if (event.type === 'text') {
              answer += event.text
              appendText(event.text)
              return
            }
            if (event.type === 'error') setError(event.error || t('think.failed'))
          },
          controller ? controller.signal : undefined,
        )
          .catch((thrown) => {
            if (thrown && thrown.name === 'AbortError') return
            setError(thrown instanceof Error ? thrown.message : String(thrown))
          })
          .finally(() => {
            setBusy(false)
            abortRef.current = null
            turnsRef.current = turnsRef.current.concat([{ question, answer }]).slice(-6)
          })
      }

      // 打开时只把问题放进输入框，让读者先改再发；一旦他自己动过输入框，就不再覆盖。
      useEffect(() => {
        if (props.question) setDraft(String(props.question))
        setActive(props.mode || '')
      }, [])

      const fillMode = (id, askKey) => {
        setActive(id)
        if (touchedRef.current) return
        setDraft(t(askKey))
      }

      const close = () => {
        if (abortRef.current && typeof abortRef.current.abort === 'function') abortRef.current.abort()
        if (typeof props.onClose === 'function') props.onClose()
      }

      const stop = (event) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
      }

      const kindLabel = packKindLabel(props.kind, props.type, props.authorType)
      const chapter = String(
        (props.kind === 'note' ? props.entry && props.entry.chapterTitle : props.entry && props.entry.chapterName) || '',
      )
      const book = String((props.entry && props.entry.bookTitle) || '')

      return h(
        'div',
        {
          className: 'wr-ask',
          style: askPosition(props.anchor),
          onClick: stop,
          onKeyDown: (event) => {
            if (event && event.key === 'Escape') close()
          },
        },
        h(
          'div',
          { className: 'wr-ask-head' },
          h(
            'div',
            { className: 'wr-ask-meta' },
            h('span', { className: 'wr-ask-kind' }, kindLabel),
            h('strong', { className: 'wr-ask-book', title: book }, book === '' ? t('think.packUnknown') : `《${book}》`),
            chapter === '' ? null : h('span', { className: 'wr-ask-chapter' }, chapter),
          ),
          h(
            'button',
            {
              className: 'wr-ask-close',
              type: 'button',
              'aria-label': t('action.dismiss'),
              onClick: (event) => {
                stop(event)
                close()
              },
            },
            '×',
          ),
        ),
        h(
          'div',
          { className: 'wr-ask-tools' },
          THINK_MODES.map(([id, labelKey, askKey]) =>
            h(
              'button',
              {
                className: 'wr-ask-chip',
                key: id,
                type: 'button',
                'data-on': active === id ? 'true' : 'false',
                disabled: busy || offline,
                onClick: (event) => {
                  stop(event)
                  fillMode(id, askKey)
                },
              },
              t(labelKey),
            ),
          ),
          h(
            'button',
            {
              className: 'wr-ask-chip',
              type: 'button',
              'data-on': active === 'custom' ? 'true' : 'false',
              disabled: offline,
              onClick: (event) => {
                stop(event)
                setActive('custom')
                setDraft('')
                touchedRef.current = false
              },
            },
            t('think.mode.custom'),
          ),
        ),
        h(
          'div',
          { className: 'wr-ask-body', ref: bodyRef },
          messages.length === 0 ? h('div', { className: 'wr-ask-empty' }, t('think.empty')) : null,
          messages.map((msg, index) =>
            h(
              'div',
              { className: 'wr-ask-msg', 'data-role': msg.role, key: `${msg.role}-${index}` },
              msg.role === 'assistant' && msg.text === ''
                ? h('span', { className: 'wr-ask-typing' }, t('think.thinking'))
                : msg.text,
            ),
          ),
        ),
        h(AskAdopt, { answer: lastAnswer, entry: props.entry, kind: props.kind, model }),
        error === '' ? null : h('div', { className: 'wr-ask-error' }, `${t('error.prefix')}${error}`),
        h(
          'div',
          { className: 'wr-ask-foot' },
          h('textarea', {
            className: 'wr-ask-input',
            rows: 2,
            value: draft,
            placeholder: t('think.customPlaceholder'),
            ref: inputRef,
            onChange: (event) => {
              touchedRef.current = true
              setDraft(event ? String(event.target.value || '') : '')
            },
            onKeyDown: (event) => {
              if (!event || event.key !== 'Enter') return
              if (event.shiftKey) return
              stop(event)
              send(draft)
            },
          }),
          h(
            'button',
            {
              className: 'wr-ask-send',
              type: 'button',
              disabled: busy || offline || draft.trim() === '',
              title: offline ? t('think.offline') : undefined,
              onClick: (event) => {
                stop(event)
                send(draft)
              },
            },
            busy ? t('think.thinking') : t('think.send'),
          ),
        ),
        offline ? h('div', { className: 'wr-ask-offline' }, t('think.offline')) : null,
        h('div', { className: 'wr-ask-note' }, model === '' ? t('think.aiNote') : `${t('think.aiNote')} · ${model}`),
      )
    }

    /**
     * Degradation ①: WeRead does not record which highlight a thought answered,
     * so we cannot pick the source for the reader. Ask, and let them skip — a
     * skipped thought keeps `thought:<id>` as its only source instead of a guess.
     */
    function MaterialPicker(props) {
      const entry = props.entry || {}
      const kind = props.kind === 'thought' ? 'thought' : 'note'
      const [type, setType] = useState(kind === 'note' ? '金句' : '观点')
      const [linkId, setLinkId] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const ownId = `${kind}:${String(entry.id === undefined || entry.id === null ? '' : entry.id)}`
      const text = String((kind === 'thought' ? entry.content : entry.text) || '')
      const same = Array.isArray(props.context) ? props.context.filter((note) => note && note.id !== undefined && note.id !== null) : []

      const save = () => {
        const write = craftBridge.write
        if (typeof write !== 'function') {
          setError(t('craft.offline'))
          return
        }
        const sourceIds = kind === 'thought' && linkId !== '' ? [`note:${linkId}`, ownId] : [ownId]
        setBusy(true)
        setError('')
        write('material.add', { type, text, sourceIds, authorType: 'human', origin: 'craft' })
          .then(() => {
            setBusy(false)
            if (typeof props.onClose === 'function') props.onClose(true)
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }

      return h(
        'div',
        { className: 'wr-modal-mask', onMouseDown: (event) => { if (event.target === event.currentTarget) props.onClose(false) }, onClick: (event) => { if (event && typeof event.stopPropagation === 'function') event.stopPropagation() } },
        h(
          'div',
          {
            className: 'wr-modal wr-picker',
            role: 'dialog',
            'aria-modal': 'true',
            onKeyDown: (event) => {
              if (event.key === 'Escape') props.onClose(false)
            },
          },
          h('div', { className: 'wr-export-head' },
            h('h3', null, t('mat.picker.title')),
            h('span', { className: 'wr-muted' }, kind === 'thought' ? t('nav.thoughts') : t('nav.notes')),
          ),
          h('div', { className: 'wr-modal-body' },
            h('p', { className: 'wr-item-text' }, clip(text, 160)),
            h('div', { className: 'wr-export-opts' },
              h('span', { className: 'wr-muted' }, t('ask.adoptType')),
              MATERIAL_TYPES.map(([label, key]) =>
                h(
                  'button',
                  { className: 'wr-chip', key: label, type: 'button', 'data-active': type === label ? 'true' : 'false', disabled: busy, onClick: () => setType(label) },
                  t(key),
                ),
              ),
            ),
            kind !== 'thought'
              ? null
              : h(
                  'div',
                  { className: 'wr-picker-link' },
                  h('p', { className: 'wr-notice-line' }, t('mat.picker.noteHint')),
                  same.length === 0
                    ? h('p', { className: 'wr-muted' }, t('mat.picker.empty'))
                    : h(
                        'div',
                        { className: 'wr-picklist' },
                        h(
                          'button',
                          { className: 'wr-pickrow', type: 'button', 'data-on': linkId === '' ? 'true' : 'false', disabled: busy, onClick: () => setLinkId('') },
                          h('span', { className: 'wr-pickrow-mark' }, linkId === '' ? '✓' : ''),
                          h('span', null, t('mat.picker.skip')),
                        ),
                        same.map((note) =>
                          h(
                            'button',
                            {
                              className: 'wr-pickrow',
                              key: note.id,
                              type: 'button',
                              'data-on': linkId === String(note.id) ? 'true' : 'false',
                              disabled: busy,
                              onClick: () => setLinkId(String(note.id)),
                            },
                            h('span', { className: 'wr-pickrow-mark' }, linkId === String(note.id) ? '✓' : ''),
                            h('span', null, clip(String(note.text || ''), 90)),
                          ),
                        ),
                      ),
                ),
            error === '' ? null : h('p', { className: 'wr-adopt-error' }, t('mat.failed', { error })),
          ),
          h('div', { className: 'wr-modal-foot' },
            h('button', { className: 'wr-btn', type: 'button', disabled: busy, onClick: () => props.onClose(false) }, t('mat.picker.cancel')),
            h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: save }, busy ? t('state.loading') : t('mat.picker.save')),
          ),
        ),
      )
    }

    /** Four ways to keep thinking; each opens the conversation card in place. */
    function ThinkingBar(props) {
      const [open, setOpen] = useState(null)
      const [pick, setPick] = useState(false)
      const [saved, setSaved] = useState('')
      const barRef = useRef(null)

      const stop = (event) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
      }

      const openCard = (mode, askKey) => {
        const node = barRef.current
        let anchor = { x: 40, y: 140 }
        if (node && typeof node.getBoundingClientRect === 'function') {
          const rect = node.getBoundingClientRect()
          anchor = { x: rect.left, y: rect.bottom }
        }
        setOpen({ mode, question: askKey === null ? '' : t(askKey), anchor })
      }

      const pack = open === null ? '' : buildSourcePack({ entry: props.entry, kind: props.kind, type: props.type, authorType: props.authorType, context: props.context })

      return h(
        'div',
        { className: 'wr-think', ref: barRef, 'data-open': open === null ? 'false' : 'true' },
        h(
          'div',
          { className: 'wr-think-row' },
          THINK_MODES.map(([id, labelKey, askKey]) =>
            h(
              'button',
              {
                className: 'wr-think-btn',
                key: id,
                type: 'button',
                onClick: (event) => {
                  stop(event)
                  openCard(id, askKey)
                },
              },
              t(labelKey),
            ),
          ),
          h(
            'button',
            {
              className: 'wr-think-btn',
              type: 'button',
              onClick: (event) => {
                stop(event)
                openCard('', null)
              },
            },
            t('think.mode.custom'),
          ),
          h(
            'button',
            {
              className: 'wr-think-btn wr-think-take',
              type: 'button',
              onClick: (event) => {
                stop(event)
                setPick(true)
              },
            },
            t('ask.adoptMaterial'),
          ),
          saved ? h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('mat.picker.saved')) : null,
        ),
        pick
          ? h(MaterialPicker, {
              entry: props.entry,
              kind: props.kind,
              context: props.context,
              onClose: (didSave) => {
                setPick(false)
                if (didSave === true) setSaved('material')
              },
            })
          : null,
        open === null
          ? null
          : h(AskCard, {
              pack,
              entry: props.entry,
              kind: props.kind,
              type: props.type,
              question: open.question,
              mode: open.mode,
              anchor: open.anchor,
              onClose: () => setOpen(null),
            }),
      )
    }

    function NoteRow(props) {
      const note = props.note
      const open = typeof props.onOpen === 'function' ? props.onOpen : null
      const pick = typeof props.onToggle === 'function' ? h(PickButton, { on: Boolean(props.selected), onChange: props.onToggle }) : null
      return h(
        'div',
        { className: 'wr-quote', 'data-focus': props.focus ? 'true' : 'false', 'data-clickable': open ? 'true' : 'false', 'data-picked': props.selected ? 'true' : 'false', title: open ? t('action.openBook') : undefined, onClick: open || undefined },
        pick,
        h(MarkedText, { className: 'wr-quote-text', text: note.text, needle: props.needle }),
        h(ThinkingBar, { entry: note, kind: 'note', context: [] }),
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
        { className: 'wr-thought', 'data-focus': props.focus ? 'true' : 'false', 'data-clickable': open ? 'true' : 'false', 'data-picked': props.selected ? 'true' : 'false', title: open ? t('action.openBook') : undefined, onClick: open || undefined },
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
        h(ThinkingBar, { entry: thought, kind: 'thought', context: context }),
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

    // -------------------------------------------------------------- journeys
    // Two rows: the four journeys are the top level, the views inside a journey
    // sit directly under it, so READ keeps its four pages one click away and
    // never hides them behind an abstract layer.
    const VIEW_STAGE = {
      overview: 'read',
      shelf: 'read',
      notes: 'read',
      thoughts: 'read',
      book: 'read',
      responses: 'think',
      materials: 'create',
      topics: 'create',
      works: 'create',
      timeline: 'grow',
      annual: 'grow',
    }
    const STAGES = [
      ['read', 'nav.read', 'journey.read.hint'],
      ['think', 'nav.think', 'journey.think.hint'],
      ['create', 'nav.create', 'journey.create.hint'],
      ['grow', 'nav.grow', 'journey.grow.hint'],
    ]
    const STAGE_VIEWS = {
      read: [
        ['overview', 'nav.overview'],
        ['shelf', 'nav.shelf'],
        ['notes', 'nav.notes'],
        ['thoughts', 'nav.thoughts'],
      ],
      think: [['responses', 'nav.responses']],
      create: [
        ['materials', 'nav.materials'],
        ['topics', 'nav.topics'],
        ['works', 'nav.works'],
      ],
      grow: [
        ['timeline', 'nav.timeline'],
        ['annual', 'nav.annual'],
      ],
    }

    function bookTitleOf(bookId, data, craft) {
      const id = String(bookId || '')
      if (id === '') return ''
      const books = data && Array.isArray(data.books) ? data.books : []
      const hit = books.find((book) => String(book.bookId) === id)
      if (hit) return String(hit.title || '')
      const index = craft && Array.isArray(craft.bookIndex) ? craft.bookIndex : []
      const row = index.find((item) => String(item.bookId) === id)
      return row ? String(row.bookTitle || '') : ''
    }

    /** One source id -> a short, honest label: the kind plus the first words. */
    function sourceLabel(sourceId, lookup) {
      const kind = sourceKind(sourceId)
      const id = sourceRawId(sourceId)
      const bag = lookup && lookup[kind] ? lookup[kind] : null
      const hit = bag ? bag.get(id) : null
      if (!hit) return `${kind === '' ? '?' : t(`src.${kind}`)}: ${clip(id, 10)}`
      const text = kind === 'thought' ? hit.content : hit.text
      return `${t(`src.${kind}`)} · ${clip(String(text || ''), 16)}`
    }

    /** The asset a source id points at, or null when it is gone from the books. */
    function craftSourceHit(sourceId, lookup) {
      const kind = sourceKind(sourceId)
      const bag = lookup && lookup[kind] ? lookup[kind] : null
      return bag ? bag.get(sourceRawId(sourceId)) || null : null
    }

    function SourceTags(props) {
      const ids = Array.isArray(props.sourceIds) ? props.sourceIds.filter((id) => String(id || '') !== '') : []
      if (ids.length === 0) return h('span', { className: 'wr-src wr-src-empty' }, t('work.noSource'))
      const open = typeof props.onOpenSource === 'function' ? props.onOpenSource : null
      return h(
        'span',
        { className: 'wr-srcs' },
        ids.map((id) => {
          const kind = sourceKind(id)
          const label = sourceLabel(id, props.lookup)
          // F3: a source chip is the way back to what it came from. When the
          // excerpt or material has moved out of the window it stays clickable
          // and says so instead of silently looking like a dead label.
          const known = craftSourceHit(id, props.lookup) !== null
          const text = known ? label : `${label} · ${t('mat.status.missing')}`
          const common = {
            className: 'wr-src',
            key: id,
            'data-kind': kind || 'other',
            'data-missing': known ? 'false' : 'true',
            title: String(id),
          }
          if (!open) return h('span', common, text)
          return h(
            'button',
            Object.assign({}, common, {
              type: 'button',
              onClick: (event) => {
                if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
                open(id)
              },
            }),
            text,
          )
        }),
      )
    }

    /** Two-step delete: the first tap only arms it, so a stray click cannot lose data. */
    function DangerButton(props) {
      const [armed, setArmed] = useState(false)
      return h(
        'button',
        {
          className: 'wr-btn wr-btn-ghost',
          type: 'button',
          'data-armed': armed ? 'true' : 'false',
          disabled: Boolean(props.disabled),
          onClick: (event) => {
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
            if (!armed) {
              setArmed(true)
              return
            }
            setArmed(false)
            if (typeof props.onDelete === 'function') props.onDelete()
          },
        },
        armed ? t('mat.sure') : t(props.labelKey || 'mat.delete'),
      )
    }

    /** Every empty screen says what to do next and offers the one button that does it. */
    function CraftEmpty(props) {
      return h(
        'div',
        { className: 'wr-empty' },
        h('strong', null, t(props.titleKey)),
        h('p', { className: 'wr-empty-next' }, t(props.nextKey)),
        typeof props.onAction === 'function'
          ? h('button', { className: 'wr-btn wr-btn-primary', type: 'button', onClick: props.onAction }, t(props.actionKey))
          : null,
      )
    }

    function JourneyBar(props) {
      const active = VIEW_STAGE[props.view] || 'read'
      const counts = props.counts || {}
      return h(
        'div',
        { className: 'wr-journey', role: 'tablist' },
        STAGES.map(([id, labelKey]) =>
          h(
            'button',
            {
              key: id,
              className: 'wr-journey-tab',
              type: 'button',
              role: 'tab',
              title: t(`journey.${id}.hint`),
              'aria-selected': active === id ? 'true' : 'false',
              'data-active': active === id ? 'true' : 'false',
              onClick: () => props.onPick(id),
            },
            t(labelKey),
            Number(counts[id]) > 0 ? h('span', { className: 'wr-journey-count' }, String(counts[id])) : null,
          ),
        ),
      )
    }

    function SubNav(props) {
      const stage = VIEW_STAGE[props.view] || 'read'
      const views = STAGE_VIEWS[stage] || STAGE_VIEWS.read
      const scope = String(props.scopeTitle || '')
      return h(
        'div',
        { className: 'wr-subnav' },
        h(
          'div',
          { className: 'wr-tabs' },
          views.map(([id, labelKey]) =>
            h(
              'button',
              {
                key: id,
                className: 'wr-tab',
                type: 'button',
                'data-active': props.view === id || (props.view === 'book' && id === 'shelf') ? 'true' : 'false',
                onClick: () => props.onPick(id),
              },
              t(labelKey),
            ),
          ),
        ),
        scope === ''
          ? null
          : h(
              'button',
              { className: 'wr-chip', type: 'button', 'data-active': 'true', onClick: props.onClearScope, title: scope },
              t('thinkView.backBook', { title: clip(scope, 14) }),
            ),
        h('span', { className: 'wr-subnav-hint' }, t(`journey.${stage}.hint`)),
      )
    }

    /** F-19: the six steps of one book, counted where the data actually lives. */
    function BookChain(props) {
      const book = props.book || {}
      const craft = props.craft || EMPTY_CRAFT
      const craftState = props.craftState || 'ready'
      const index = (Array.isArray(craft.bookIndex) ? craft.bookIndex : []).find((row) => String(row.bookId) === String(book.bookId))
      const host = index && index.counts ? index.counts : null
      const byBook = (list) =>
        (Array.isArray(list) ? list : []).filter((item) => String(item.bookId || '') === String(book.bookId || '')).length
      const pick = (key, list) => (host && typeof host[key] === 'number' ? host[key] : byBook(list))
      const rows = [
        ['notes', Number(book.noteCount) || 0, 'chain.notes'],
        ['thoughts', Number(book.reviewCount) || 0, 'chain.thoughts'],
        ['responses', pick('responses', craft.responses), 'chain.responses'],
        ['materials', pick('materials', craft.materials), 'chain.materials'],
        ['topics', pick('topics', craft.topics), 'chain.topics'],
        ['works', pick('works', craft.works), 'chain.works'],
      ]
      const cached = index ? index.cached !== false : true
      return h(
        'div',
        { className: 'wr-chain' },
        h(
          'div',
          { className: 'wr-chain-head' },
          h('strong', null, t('chain.title')),
          h('span', { className: 'wr-muted' }, t('chain.hint')),
          craftState !== 'ready' ? h('span', { className: 'wr-degraded' }, t('craft.offline')) : null,
          cached ? null : h('span', { className: 'wr-degraded' }, t('chain.cached')),
        ),
        h(
          'div',
          { className: 'wr-chain-row' },
          rows.map(([id, count, labelKey]) =>
            h(
              'button',
              {
                key: id,
                className: 'wr-chain-step',
                type: 'button',
                'data-empty': count > 0 ? 'false' : 'true',
                onClick: () => props.onJump(id),
              },
              h('span', { className: 'wr-chain-count' }, fmtCount(count)),
              h('span', { className: 'wr-chain-label' }, t(labelKey)),
            ),
          ),
        ),
      )
    }

    /** THINK keeps only what was adopted; the conversation itself is never stored. */
    function ResponseList(props) {
      const craft = props.craft || EMPTY_CRAFT
      const scope = String(props.scopeBookId || '')
      const rows = (Array.isArray(craft.responses) ? craft.responses : [])
        .filter((item) => scope === '' || String(item.bookId) === scope)
        .slice()
        .sort((left, right) => (Number(right.adoptedAt) || 0) - (Number(left.adoptedAt) || 0))
      if (props.craftState === 'failed') {
        return h(
          'div',
          { className: 'wr-empty' },
          h('strong', null, t('craft.failed', { error: props.craftError || '' })),
          h('p', { className: 'wr-empty-next' }, t('craft.offline')),
          h('button', { className: 'wr-btn wr-btn-primary', type: 'button', onClick: props.onRetry }, t('craft.retry')),
        )
      }
      if (rows.length === 0) {
        return h(CraftEmpty, {
          titleKey: 'thinkView.empty.title',
          nextKey: 'thinkView.empty.next',
          actionKey: 'thinkView.empty.action',
          onAction: props.onGoShelf,
        })
      }
      return h(
        'div',
        { className: 'wr-stack' },
        h('p', { className: 'wr-notice-line' }, t('thinkView.hint')),
        rows.map((item) =>
          h(
            'div',
            { className: 'wr-item', key: item.id, 'data-focus': props.focusId === item.id ? 'true' : 'false' },
            h(
              'div',
              { className: 'wr-item-head' },
              h(
                'button',
                {
                  className: 'wr-chip',
                  type: 'button',
                  onClick: () => props.onOpenBook(item.bookId, 'thoughts'),
                  title: item.bookTitle,
                },
                clip(String(item.bookTitle || bookTitleOf(item.bookId, props.data, craft) || '—'), 22),
              ),
              item.containsAI ? h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('thinkView.ai')) : null,
              item.model ? h('span', { className: 'wr-tag' }, item.model) : null,
            ),
            h('p', { className: 'wr-item-text' }, String(item.text || '')),
            h(
              'div',
              { className: 'wr-item-meta' },
              h('span', null, `${t('thinkView.adoptedAt')} ${fmtStamp(item.adoptedAt) || '—'}`),
              h(SourceTags, { sourceIds: item.sourceIds, lookup: props.lookup, onOpenSource: props.onOpenSource }),
              h(DangerButton, { onDelete: () => props.onDelete(item.id) }),
            ),
          ),
        ),
      )
    }

    function MaterialBoard(props) {
      const craft = props.craft || EMPTY_CRAFT
      const [type, setType] = useState('')
      const scope = String(props.scopeBookId || '')
      const rows = (Array.isArray(craft.materials) ? craft.materials : [])
        .filter((item) => (type === '' || item.type === type) && (scope === '' || String(item.bookId) === scope))
        .slice()
        .sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0))
      const cachedOf = (bookId) => {
        const index = (Array.isArray(craft.bookIndex) ? craft.bookIndex : []).find((row) => String(row.bookId) === String(bookId))
        return index ? index.cached !== false : true
      }
      if (props.craftState === 'failed') {
        return h(
          'div',
          { className: 'wr-empty' },
          h('strong', null, t('craft.failed', { error: props.craftError || '' })),
          h('p', { className: 'wr-empty-next' }, t('craft.offline')),
          h('button', { className: 'wr-btn wr-btn-primary', type: 'button', onClick: props.onRetry }, t('craft.retry')),
        )
      }
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-toolbar' },
          h(
            'div',
            { className: 'wr-chips' },
            h(
              'button',
              { className: 'wr-chip', type: 'button', 'data-active': type === '' ? 'true' : 'false', onClick: () => setType('') },
              t('mat.filterAll'),
            ),
            MATERIAL_TYPES.map(([label, key]) =>
              h(
                'button',
                { key: label, className: 'wr-chip', type: 'button', 'data-active': type === label ? 'true' : 'false', onClick: () => setType(label) },
                t(key),
              ),
            ),
          ),
          h('span', { className: 'wr-muted' }, t('mat.count', { count: String(rows.length) })),
        ),
        rows.length === 0
          ? h(CraftEmpty, { titleKey: 'mat.empty.title', nextKey: 'mat.empty.next', actionKey: 'mat.empty.action', onAction: props.onGoShelf })
          : h(
              'div',
              { className: 'wr-stack' },
              rows.map((item) =>
                h(
                  'div',
                  { className: 'wr-item', key: item.id, 'data-focus': props.focusId === item.id ? 'true' : 'false' },
                  h(
                    'div',
                    { className: 'wr-item-head' },
                    h('span', { className: 'wr-tag' }, t(materialTypeKey(item.type))),
                    h(
                      'button',
                      { className: 'wr-chip', type: 'button', onClick: () => props.onOpenBook(item.bookId, 'thoughts'), title: item.bookTitle },
                      clip(String(item.bookTitle || bookTitleOf(item.bookId, props.data, craft) || '—'), 20),
                    ),
                    item.authorType === 'ai' || item.containsAI ? h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('mat.aiTag')) : null,
                    cachedOf(item.bookId) ? null : h('span', { className: 'wr-degraded' }, t('mat.cached')),
                    item.verification && item.verification.status !== 'ok'
                      ? h('span', { className: 'wr-tag', 'data-tone': item.verification.status }, t(`mat.status.${item.verification.status}`))
                      : null,
                  ),
                  h('p', { className: 'wr-item-text' }, String(item.text || '')),
                  h(
                    'div',
                    { className: 'wr-item-meta' },
                    h(SourceTags, { sourceIds: item.sourceIds, lookup: props.lookup, onOpenSource: props.onOpenSource }),
                    // B3: a material can be re-typed in place — type is the only
                    // field the material board owns, so no separate editor.
                    h(
                      'select',
                      {
                        className: 'wr-select wr-type-switch',
                        value: item.type,
                        title: t('mat.type.switch'),
                        'aria-label': t('mat.type.switch'),
                        onChange: (event) => {
                          const next = event && event.target ? String(event.target.value || '') : ''
                          if (next === '' || next === item.type) return
                          props.write('material.update', { id: item.id, type: next })
                        },
                      },
                      MATERIAL_TYPES.map(([label, key]) => h('option', { key: label, value: label }, t(key))),
                    ),
                    h('span', null, fmtStamp(item.createdAt)),
                    h(DangerButton, { onDelete: () => props.onDelete(item.id) }),
                  ),
                ),
              ),
            ),
      )
    }

    function TopicBoard(props) {
      const craft = props.craft || EMPTY_CRAFT
      const materials = Array.isArray(craft.materials) ? craft.materials : []
      const topics = (Array.isArray(craft.topics) ? craft.topics : []).slice().sort((left, right) => (Number(right.createdAt) || 0) - (Number(left.createdAt) || 0))
      const scope = String(props.scopeBookId || '')
      const shown = scope === '' ? topics : topics.filter((item) => (Array.isArray(item.bookIds) ? item.bookIds : []).map(String).includes(scope))
      const [statement, setStatement] = useState('')
      const [gapNote, setGapNote] = useState('')
      const [picked, setPicked] = useState([])
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [open, setOpen] = useState(false)
      const toggle = (id) => setPicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : prev.concat([id])))
      const create = () => {
        if (statement.trim() === '') {
          setError(t('topic.needStatement'))
          return
        }
        if (picked.length === 0) {
          setError(t('topic.needMaterial'))
          return
        }
        setBusy(true)
        setError('')
        Promise.resolve(props.write('topic.add', { statement: statement.trim(), materialIds: picked, gapNote: gapNote.trim() }))
          .then(() => {
            setBusy(false)
            setStatement('')
            setGapNote('')
            setPicked([])
            setOpen(false)
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }
      if (props.craftState === 'failed') {
        return h(
          'div',
          { className: 'wr-empty' },
          h('strong', null, t('craft.failed', { error: props.craftError || '' })),
          h('p', { className: 'wr-empty-next' }, t('craft.offline')),
          h('button', { className: 'wr-btn wr-btn-primary', type: 'button', onClick: props.onRetry }, t('craft.retry')),
        )
      }
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-toolbar' },
          h('span', { className: 'wr-muted' }, t('topic.count', { count: String(shown.length) })),
          materials.length === 0
            ? null
            : h('button', { className: 'wr-btn wr-btn-primary', type: 'button', onClick: () => setOpen(!open) }, t('topic.new')),
        ),
        open
          ? h(
              'div',
              { className: 'wr-form' },
              h('input', {
                className: 'wr-input',
                value: statement,
                placeholder: t('topic.statementPlaceholder'),
                maxLength: 400,
                onChange: (event) => setStatement(event ? String(event.target.value || '') : ''),
              }),
              h('input', {
                className: 'wr-input',
                value: gapNote,
                placeholder: t('topic.gapPlaceholder'),
                onChange: (event) => setGapNote(event ? String(event.target.value || '') : ''),
              }),
              h('span', { className: 'wr-muted' }, t('topic.pickMaterials')),
              h(
                'div',
                { className: 'wr-picklist' },
                materials.map((material) =>
                  h(
                    'button',
                    {
                      className: 'wr-pickrow',
                      key: material.id,
                      type: 'button',
                      'data-on': picked.includes(material.id) ? 'true' : 'false',
                      disabled: busy,
                      onClick: () => toggle(material.id),
                    },
                    h('span', { className: 'wr-pickrow-mark' }, picked.includes(material.id) ? '✓' : ''),
                    h('span', null, `${t(materialTypeKey(material.type))} · ${clip(String(material.text || ''), 70)}`),
                  ),
                ),
              ),
              error === '' ? null : h('p', { className: 'wr-adopt-error' }, error),
              h(
                'div',
                { className: 'wr-form-row' },
                h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: create }, busy ? t('state.loading') : t('topic.create')),
                h('button', { className: 'wr-btn', type: 'button', disabled: busy, onClick: () => setOpen(false) }, t('action.cancel')),
              ),
            )
          : null,
        shown.length === 0
          ? h(CraftEmpty, {
              titleKey: 'topic.empty.title',
              nextKey: 'topic.empty.next',
              actionKey: 'topic.empty.action',
              onAction: props.onGoMaterials,
            })
          : h(
              'div',
              { className: 'wr-stack' },
              shown.map((item) =>
                h(
                  'div',
                  { className: 'wr-item', key: item.id },
                  h('p', { className: 'wr-item-text' }, String(item.statement || '')),
                  item.gapNote ? h('p', { className: 'wr-notice-line' }, `${t('topic.gap')}：${item.gapNote}`) : null,
                  h(
                    'div',
                    { className: 'wr-item-meta' },
                    (Array.isArray(item.bookIds) ? item.bookIds : []).map((bookId) =>
                      // B5: a topic's books are entry points, not decoration.
                      h(
                        'button',
                        {
                          className: 'wr-chip',
                          key: bookId,
                          type: 'button',
                          title: bookTitleOf(bookId, props.data, craft) || String(bookId),
                          onClick: () => props.onOpenBook(bookId, 'thoughts'),
                        },
                        clip(bookTitleOf(bookId, props.data, craft) || String(bookId), 18),
                      ),
                    ),
                    h('span', null, t('topic.materialCount', { count: String((item.materialIds || []).length) })),
                    h(
                      'button',
                      { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: () => props.onDraft(item) },
                      t('topic.draft'),
                    ),
                    h(SourceTags, { sourceIds: (item.materialIds || []).map((id) => `material:${id}`), lookup: props.lookup, onOpenSource: props.onOpenSource }),
                    h(DangerButton, { onDelete: () => props.onDelete(item.id) }),
                  ),
                ),
              ),
            ),
      )
    }

    /**
     * F-23: draft one paragraph from the sources that paragraph already cites.
     * The text stays a draft until it is kept — nothing is written while it
     * streams, and a failed turn leaves no half paragraph behind.
     */
    function ParagraphAI(props) {
      const chat = useChatAvailability()
      const [open, setOpen] = useState(false)
      const [stage, setStage] = useState('')
      const [draft, setDraft] = useState('')
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const abortRef = useRef(null)
      const originRef = useRef('')
      const offline = chat === 'offline'
      const sourceIds = Array.isArray(props.sourceIds) ? props.sourceIds : []
      const hasSource = sourceIds.length > 0
      const disabled = offline || !hasSource || stage === 'running'
      const title = !hasSource ? t('work.aiNeedSource') : offline ? t('think.offline') : t('work.aiWriteHint')

      const run = () => {
        if (disabled) return
        const pack = buildParagraphPack({ sourceIds, lookup: props.lookup, titleOf: props.titleOf })
        setOpen(true)
        setStage('running')
        setDraft('')
        setError('')
        if (pack === '') {
          setStage('error')
          setError(t('work.aiNoSource'))
          return
        }
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        abortRef.current = controller
        const workId = props.work && props.work.id ? String(props.work.id) : ''
        originRef.current = `think:${workId}:${Date.now().toString(36)}`
        let answer = ''
        let failed = false
        streamChat(
          { pack, history: [], question: t('work.aiPrompt') },
          (event) => {
            if (!event) return
            if (event.type === 'text') {
              answer += String(event.text || '')
              setDraft(answer)
              return
            }
            if (event.type === 'error') {
              failed = true
              setStage('error')
              setDraft('')
              setError(t('work.aiFailed', { error: event.error || t('think.failed') }))
            }
          },
          controller ? controller.signal : undefined,
        )
          .then(() => {
            if (failed) return
            if (answer.trim() === '') {
              setStage('error')
              setDraft('')
              setError(t('work.aiFailed', { error: t('think.failed') }))
            } else {
              setStage('done')
            }
          })
          .catch((thrown) => {
            if (thrown && thrown.name === 'AbortError') return
            setStage('error')
            setDraft('')
            setError(t('work.aiFailed', { error: thrown instanceof Error ? thrown.message : String(thrown) }))
          })
          .finally(() => {
            abortRef.current = null
          })
      }

      const keep = () => {
        if (draft.trim() === '' || busy) return
        // A draft that came back through a re-render still needs an id to point
        // at its turn; the loaded one wins, otherwise stamp it now.
        const workId = props.work && props.work.id ? String(props.work.id) : ''
        const originId = originRef.current === '' ? `think:${workId}:${Date.now().toString(36)}` : originRef.current
        setBusy(true)
        setError('')
        Promise.resolve(props.onAdopt(draft.trim(), originId, sourceIds))
          .then(() => {
            setBusy(false)
            setStage('')
            setDraft('')
            setOpen(false)
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }

      const stop = () => {
        if (abortRef.current && typeof abortRef.current.abort === 'function') abortRef.current.abort()
        setStage('')
        setDraft('')
        setOpen(false)
      }

      return h(
        'div',
        { className: 'wr-ai', 'data-open': open ? 'true' : 'false' },
        h(
          'button',
          { className: 'wr-btn wr-btn-ghost wr-ai-trigger', type: 'button', disabled, title, onClick: run },
          t('work.aiWrite'),
        ),
        !hasSource || offline ? h('span', { className: 'wr-ai-hint' }, title) : null,
        open
          ? h(
              'div',
              { className: 'wr-ai-actions' },
              h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('work.aiDraft')),
              stage === 'running' ? h('span', { className: 'wr-ai-running' }, t('state.loading')) : null,
            )
          : null,
        open && draft !== '' ? h('p', { className: 'wr-ai-draft' }, draft) : null,
        open && stage === 'done'
          ? h(
              'div',
              { className: 'wr-ai-actions' },
              h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: keep }, t('work.aiAdopt')),
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: run }, t('work.aiRetry')),
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: stop }, t('work.aiDiscard')),
            )
          : null,
        open && stage === 'error'
          ? h(
              'div',
              { className: 'wr-ai-actions' },
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: run }, t('work.aiRetry')),
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: stop }, t('work.aiDiscard')),
            )
          : null,
        error === '' ? null : h('p', { className: 'wr-adopt-error' }, error),
      )
    }

    function ParagraphRow(props) {
      const paragraph = props.paragraph || {}
      const [editing, setEditing] = useState(false)
      const [text, setText] = useState(String(paragraph.text || ''))
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const save = () => {
        setBusy(true)
        setError('')
        Promise.resolve(props.onSave(text))
          .then(() => {
            setBusy(false)
            setEditing(false)
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }
      return h(
        'div',
        { className: 'wr-paragraph' },
        h('span', { className: 'wr-paragraph-index' }, t('work.paragraph', { index: String(props.index + 1) })),
        h(
          'div',
          { className: 'wr-paragraph-main' },
          editing
            ? h('textarea', {
                className: 'wr-ask-input',
                rows: 3,
                value: text,
                onChange: (event) => setText(event ? String(event.target.value || '') : ''),
              })
            : h('p', { className: 'wr-item-text' }, String(paragraph.text || '')),
          h(
            'div',
            { className: 'wr-item-meta' },
            paragraph.ai ? h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('work.aiTag')) : null,
            h(SourceTags, { sourceIds: paragraph.sourceIds, lookup: props.lookup, onOpenSource: props.onOpenSource }),
            editing
              ? h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: save }, t('action.save'))
              : h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', onClick: () => setEditing(true) }, t('action.edit')),
            h(ParagraphAI, {
              work: props.work,
              paragraph,
              sourceIds: paragraph.sourceIds,
              lookup: props.lookup,
              titleOf: props.titleOf,
              onAdopt: props.onAdopt,
            }),
            h(DangerButton, { onDelete: props.onDelete }),
          ),
          error === '' ? null : h('p', { className: 'wr-adopt-error' }, error),
        ),
      )
    }

    function WorkBoard(props) {
      const craft = props.craft || EMPTY_CRAFT
      const materials = Array.isArray(craft.materials) ? craft.materials : []
      // F2: with a book in scope only that book's drafts belong on screen. A
      // work has no bookIds field on purpose — its books are whatever its
      // paragraphs cite, so the filter walks that chain.
      const scoped = String(props.scopeBookId || '')
      const bookIdOf = typeof props.bookIdOf === 'function' ? props.bookIdOf : null
      const everyWork = Array.isArray(craft.works) ? craft.works : []
      const scopedWorks =
        scoped === '' || !bookIdOf
          ? everyWork
          : everyWork.filter((item) =>
              (Array.isArray(item.paragraphs) ? item.paragraphs : []).some((paragraph) =>
                (Array.isArray(paragraph.sourceIds) ? paragraph.sourceIds : []).some((sourceId) => bookIdOf(sourceId) === scoped),
              ),
            )
      const works = scopedWorks.slice().sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0))
      const [activeId, setActiveId] = useState('')
      const [title, setTitle] = useState('')
      const [creating, setCreating] = useState(false)
      const [draft, setDraft] = useState('')
      const [picked, setPicked] = useState([])
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [markdown, setMarkdown] = useState('')
      const [path, setPath] = useState('')
      const work = works.find((item) => item.id === activeId) || works[0] || null
      const paragraphs = work && Array.isArray(work.paragraphs) ? work.paragraphs : []
      const call = (op, payload) => {
        setBusy(true)
        setError('')
        return Promise.resolve(props.write(op, payload))
          .then((created) => {
            setBusy(false)
            return created
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
            throw thrown
          })
      }
      const createWork = () => {
        call('work.add', { title: title.trim() === '' ? undefined : title.trim() })
          .then((created) => {
            setTitle('')
            setCreating(false)
            if (created && created.id) setActiveId(created.id)
          })
          .catch(() => {})
      }
      const addParagraph = () => {
        if (!work || draft.trim() === '') {
          setError(t('work.needParagraph'))
          return
        }
        const sourceIds = picked.map((id) => `material:${id}`)
        call('work.paragraph.add', { id: work.id, text: draft.trim(), sourceIds })
          .then(() => {
            setDraft('')
            setPicked([])
          })
          .catch(() => {})
      }
      const exportWork = (mode) => {
        if (!work) return
        setBusy(true)
        setError('')
        apiCraftExport(work.id, mode)
          .then((result) => {
            setBusy(false)
            const document = result && result.document ? result.document : null
            setMarkdown(document && document.markdown ? document.markdown : '')
            setPath(result && result.path ? String(result.path) : '')
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }
      if (props.craftState === 'failed') {
        return h(
          'div',
          { className: 'wr-empty' },
          h('strong', null, t('craft.failed', { error: props.craftError || '' })),
          h('p', { className: 'wr-empty-next' }, t('craft.offline')),
          h('button', { className: 'wr-btn wr-btn-primary', type: 'button', onClick: props.onRetry }, t('craft.retry')),
        )
      }
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-toolbar' },
          h('span', { className: 'wr-muted' }, t('work.count', { count: String(works.length) })),
          h('button', { className: 'wr-btn wr-btn-primary', type: 'button', onClick: () => setCreating(!creating) }, t('work.new')),
        ),
        creating
          ? h(
              'div',
              { className: 'wr-form' },
              h('div', { className: 'wr-form-row' },
                h('input', {
                  className: 'wr-input',
                  value: title,
                  placeholder: t('work.titlePlaceholder'),
                  onChange: (event) => setTitle(event ? String(event.target.value || '') : ''),
                }),
                h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: createWork }, t('work.create')),
                h('button', { className: 'wr-btn', type: 'button', disabled: busy, onClick: () => setCreating(false) }, t('action.cancel')),
              ),
            )
          : null,
        works.length === 0
          ? h(CraftEmpty, { titleKey: 'work.empty.title', nextKey: 'work.empty.next', actionKey: 'work.empty.action', onAction: props.onGoTopics })
          : h(
              'div',
              null,
              h(
                'div',
                { className: 'wr-chips' },
                works.map((item) =>
                  h(
                    'button',
                    {
                      className: 'wr-chip',
                      key: item.id,
                      type: 'button',
                      'data-active': work && work.id === item.id ? 'true' : 'false',
                      onClick: () => {
                        setActiveId(item.id)
                        setMarkdown('')
                        setPath('')
                      },
                    },
                    clip(String(item.title || '—'), 20),
                  ),
                ),
              ),
              work === null
                ? null
                : h(
                    'div',
                    { className: 'wr-draft' },
                    h(
                      'div',
                      { className: 'wr-item-head' },
                      h('strong', null, String(work.title || t('work.new'))),
                      work.status === 'confirmed'
                        ? h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('work.confirmed'))
                        : h('span', { className: 'wr-tag' }, t('nav.works')),
                      work.containsAI ? h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('work.aiTag')) : null,
                    ),
                    h('p', { className: 'wr-notice-line' }, t('work.hint')),
                    paragraphs.length === 0
                      ? h('p', { className: 'wr-muted' }, t('work.emptyParagraphs'))
                      : paragraphs.map((paragraph, index) =>
                          h(ParagraphRow, {
                            key: paragraph.id,
                            paragraph,
                            index,
                            work,
                            lookup: props.lookup,
                            titleOf: (bookId) => bookTitleOf(bookId, props.data, craft),
                            focusId: props.focusId,
                            onOpenSource: props.onOpenSource,
                            onSave: (text) => call('work.paragraph.update', { id: work.id, paragraphId: paragraph.id, text: text.trim() }),
                            // F-23: an AI paragraph lands right after the one it
                            // continues, marked ai + the id of the turn that wrote it.
                            onAdopt: (text, originId, sourceIds) =>
                              call('work.paragraph.add', {
                                id: work.id,
                                text,
                                sourceIds,
                                ai: true,
                                aiOriginIds: originId === '' ? [] : [originId],
                                index: index + 1,
                              }),
                            onDelete: () => {
                              call('work.paragraph.delete', { id: work.id, paragraphId: paragraph.id }).catch(() => {})
                            },
                          }),
                        ),
                    h(
                      'div',
                      { className: 'wr-form' },
                      h('textarea', {
                        className: 'wr-ask-input',
                        rows: 3,
                        value: draft,
                        placeholder: t('work.paragraphPlaceholder'),
                        onChange: (event) => setDraft(event ? String(event.target.value || '') : ''),
                      }),
                      materials.length === 0
                        ? null
                        : h(
                            'div',
                            null,
                            h('span', { className: 'wr-muted' }, t('work.attach')),
                            h(
                              'div',
                              { className: 'wr-picklist' },
                              materials.map((material) =>
                                h(
                                  'button',
                                  {
                                    className: 'wr-pickrow',
                                    key: material.id,
                                    type: 'button',
                                    'data-on': picked.includes(material.id) ? 'true' : 'false',
                                    onClick: () =>
                                      setPicked((prev) => (prev.includes(material.id) ? prev.filter((id) => id !== material.id) : prev.concat([material.id]))),
                                  },
                                  h('span', { className: 'wr-pickrow-mark' }, picked.includes(material.id) ? '✓' : ''),
                                  h('span', null, `[${t(materialTypeKey(material.type))}] ${clip(String(material.text || ''), 64)}`),
                                ),
                              ),
                            ),
                          ),
                      h(
                        'div',
                        { className: 'wr-form-row' },
                        h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: addParagraph }, t('work.addParagraph')),
                        h(
                          'button',
                          {
                            className: 'wr-btn wr-btn-ghost',
                            type: 'button',
                            disabled: busy || paragraphs.length === 0,
                            onClick: () => {
                              call('work.confirm', { id: work.id }).catch(() => {})
                            },
                          },
                          t('work.confirm'),
                        ),
                        h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: () => exportWork('preview') }, t('work.exportPreview')),
                        h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: () => exportWork('file') }, t('work.exportFile')),
                        h(DangerButton, { onDelete: () => { call('work.delete', { id: work.id }).catch(() => {}) } }),
                      ),
                    ),
                    error === '' ? null : h('p', { className: 'wr-adopt-error' }, error),
                    h('p', { className: 'wr-notice-line' }, t('work.frontMatter')),
                    path === '' ? null : h('p', { className: 'wr-notice-line' }, t('work.exported', { path })),
                    markdown === ''
                      ? null
                      : h(
                          'div',
                          { className: 'wr-draft-export' },
                          h('pre', { className: 'wr-export-text' }, markdown),
                          h(CopyButton, { text: markdown }),
                        ),
                  ),
            ),
      )
    }

    function GrowTimeline(props) {
      const craft = props.craft || EMPTY_CRAFT
      const bookIdOf = typeof props.bookIdOf === 'function' ? props.bookIdOf : null
      const materials = Array.isArray(craft.materials) ? craft.materials : []
      // B1: every event has to know which book it came from, so a timeline row
      // can go back to the shelf instead of being decoration. Topics and works
      // stop holding bookId on purpose — the books come from what they cite.
      const booksOf = (sourceIds) => {
        const seen = []
        for (const sourceId of Array.isArray(sourceIds) ? sourceIds : []) {
          const bookId = String((bookIdOf ? bookIdOf(sourceId) : '') || '')
          if (bookId !== '' && !seen.includes(bookId)) seen.push(bookId)
        }
        return seen
      }
      const events = []
      for (const item of Array.isArray(craft.responses) ? craft.responses : []) {
        const bookId = String(item.bookId || '')
        events.push({
          key: `response:${item.id}`,
          kind: 'response',
          at: item.adoptedAt || item.createdAt,
          text: item.text,
          bookIds: bookId === '' ? [] : [bookId],
          open: () => {
            if (typeof props.onOpenSource === 'function') props.onOpenSource(`response:${item.id}`)
          },
        })
      }
      for (const item of materials) {
        const bookId = String(item.bookId || '')
        events.push({
          key: `material:${item.id}`,
          kind: 'material',
          at: item.createdAt,
          text: item.text,
          bookIds: bookId === '' ? [] : [bookId],
          open: () => {
            if (typeof props.onOpenSource === 'function') props.onOpenSource(`material:${item.id}`)
          },
        })
      }
      for (const item of Array.isArray(craft.topics) ? craft.topics : []) {
        const sourceIds = (Array.isArray(item.materialIds) ? item.materialIds : []).map((id) => `material:${id}`)
        const bookIds = booksOf(sourceIds)
        events.push({
          key: `topic:${item.id}`,
          kind: 'topic',
          at: item.createdAt,
          text: item.statement,
          bookIds,
          open: bookIds.length === 1 ? () => props.onOpenBook(bookIds[0], 'thoughts') : null,
        })
      }
      for (const item of Array.isArray(craft.works) ? craft.works : []) {
        const sourceIds = (Array.isArray(item.paragraphs) ? item.paragraphs : []).reduce(
          (all, paragraph) => all.concat(Array.isArray(paragraph.sourceIds) ? paragraph.sourceIds : []),
          [],
        )
        const bookIds = booksOf(sourceIds)
        events.push({
          key: `work:${item.id}`,
          kind: 'work',
          at: item.updatedAt || item.createdAt,
          text: item.title,
          bookIds,
          open: bookIds.length === 1 ? () => props.onOpenBook(bookIds[0], 'thoughts') : null,
        })
      }
      const [page, setPage] = useState(0)
      const scope = String(props.scopeBookId || '')
      // B4: with a book in scope the timeline keeps only that book's events.
      const inScope = scope === '' ? events : events.filter((event) => event.bookIds.includes(scope))
      const sorted = inScope.slice().sort((left, right) => (Number(right.at) || 0) - (Number(left.at) || 0))
      const groups = []
      for (const event of sorted) {
        const month = monthKeyOf(event.at)
        if (month === '') continue
        const last = groups[groups.length - 1]
        if (last && last.month === month) last.items.push(event)
        else groups.push({ month, items: [event] })
      }
      const perPage = 6
      const pages = Math.max(1, Math.ceil(groups.length / perPage))
      const current = Math.min(page, pages - 1)
      const shown = groups.slice(current * perPage, current * perPage + perPage)
      if (props.craftState === 'failed') {
        return h(
          'div',
          { className: 'wr-empty' },
          h('strong', null, t('craft.failed', { error: props.craftError || '' })),
          h('p', { className: 'wr-empty-next' }, t('craft.offline')),
          h('button', { className: 'wr-btn wr-btn-primary', type: 'button', onClick: props.onRetry }, t('craft.retry')),
        )
      }
      if (groups.length === 0) {
        return h(CraftEmpty, { titleKey: 'grow.empty.title', nextKey: 'grow.empty.next', actionKey: 'grow.empty.action', onAction: props.onGoShelf })
      }
      return h(
        'div',
        null,
        h(
          'p',
          { className: 'wr-notice-line' },
          `${t('grow.total', { count: String(sorted.length) })}${scope === '' ? '' : ' · ' + t('thinkView.scope')}`,
        ),
        h(
          'div',
          { className: 'wr-tl' },
          shown.map((group) =>
            h(
              'div',
              { key: group.month },
              h(
                'div',
                { className: 'wr-tl-month' },
                h('span', null, t('grow.monthLabel', { year: group.month.slice(0, 4), month: group.month.slice(5, 7) })),
                h('span', { className: 'wr-muted' }, t('grow.monthCount', { count: String(group.items.length) })),
              ),
              h(
                'div',
                { className: 'wr-tl-items' },
                group.items.map((event) => {
                  const cross = event.bookIds.length !== 1
                  return h(
                    'button',
                    {
                      className: 'wr-tl-item',
                      key: event.key,
                      type: 'button',
                      'data-kind': event.kind,
                      'data-cross': cross ? 'true' : 'false',
                      disabled: cross || typeof event.open !== 'function',
                      onClick: (clickEvent) => {
                        if (cross || typeof event.open !== 'function') return
                        if (clickEvent && typeof clickEvent.stopPropagation === 'function') clickEvent.stopPropagation()
                        event.open()
                      },
                    },
                    h('span', { className: 'wr-tl-kind' }, t(`grow.event.${event.kind}`)),
                    h('span', { className: 'wr-tl-text', title: String(event.text || '') }, clip(String(event.text || '—'), 64)),
                    event.bookIds.length === 1
                      ? h(
                          'span',
                          { className: 'wr-muted wr-tl-book' },
                          clip(bookTitleOf(event.bookIds[0], props.data, craft) || event.bookIds[0], 16),
                        )
                      : null,
                    cross ? h('span', { className: 'wr-tag wr-tl-cross' }, t('grow.cross')) : null,
                    h('span', { className: 'wr-muted' }, fmtDate(event.at)),
                  )
                }),
              ),
            ),
          ),
        ),
        pages <= 1
          ? null
          : h(
              'div',
              { className: 'wr-pager' },
              h(
                'button',
                { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: current <= 0, onClick: () => setPage(Math.max(0, current - 1)) },
                t('pager.prev'),
              ),
              h('span', { className: 'wr-muted' }, t('pager.page', { page: String(current + 1), total: String(pages) })),
              h(
                'button',
                { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: current >= pages - 1, onClick: () => setPage(Math.min(pages - 1, current + 1)) },
                t('pager.next'),
              ),
            ),
      )
    }

    /** GROW reads only the yearly numbers that already exist; nothing here scores you. */
    function GrowAnnual(props) {
      const years = props.data && Array.isArray(props.data.years) ? props.data.years.map((item) => Number(item.year)).filter(Boolean) : []
      const [year, setYear] = useState(years.length > 0 ? years[0] : new Date().getFullYear())
      const [days, setDays] = useState(null)
      const [annual, setAnnual] = useState(null)
      const [error, setError] = useState('')
      const [exporting, setExporting] = useState(false)
      const [exported, setExported] = useState('')
      useEffect(() => {
        let alive = true
        apiHeat(year)
          .then((payload) => {
            if (!alive) return
            setDays(payload && payload.days ? payload.days : {})
            setAnnual(payload && payload.annual ? payload.annual : null)
          })
          .catch((thrown) => {
            if (!alive) return
            setDays({})
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
        return () => {
          alive = false
        }
      }, [year])
      // 一份年度回顾也不该在读数据时变成一颗孤零零的转圈：标题、年份、口径先站着。
      const readDays = days === null ? 0 : Object.keys(days).filter((key) => {
        const value = days[key]
        const seconds = typeof value === 'number' ? value : value && value.seconds ? value.seconds : 0
        return Number(seconds) > 0
      }).length
      const total = annual && annual.totalReadTime ? annual.totalReadTime : 0
      const counts = (props.data && props.data.counts) || {}
      const yearBooks =
        props.data && Array.isArray(props.data.books)
          ? props.data.books.filter((book) => Number(book.year) === Number(year))
          : []
      const craftCounts = (props.craft && props.craft.counts) || {}
      // B6: an empty year is a state with a next step, not a dead end.
      const empty = days !== null && readDays === 0 && yearBooks.length === 0
      const exportYear = () => {
        if (yearBooks.length === 0 || exporting) return
        setExporting(true)
        setExported('')
        const options = { excerpts: true, thoughts: true, meta: true, chapter: true, star: true, sourceUrl: true }
        apiExport({ bookIds: yearBooks.map((book) => book.bookId) }, options, 'file')
          .then((result) => {
            setExporting(false)
            const files = result && Array.isArray(result.files) ? result.files.join('、') : ''
            setExported(String((result && result.filename) || files || ''))
          })
          .catch((thrown) => {
            setExporting(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'wr-toolbar' },
          h(
            'div',
            { className: 'wr-chips' },
            years.map((item) =>
              h(
                'button',
                { key: item, className: 'wr-chip', type: 'button', 'data-active': Number(item) === Number(year) ? 'true' : 'false', onClick: () => setYear(item) },
                String(item),
              ),
            ),
          ),
          h('span', { className: 'wr-muted' }, t('grow.annual.note')),
          h(
            'button',
            {
              className: 'wr-btn wr-btn-ghost',
              type: 'button',
              disabled: exporting || yearBooks.length === 0,
              title: yearBooks.length === 0 ? t('grow.annual.noBooks') : t('grow.annual.export'),
              onClick: exportYear,
            },
            exporting ? t('state.loading') : t('grow.annual.export'),
          ),
        ),
        error === '' ? null : h('p', { className: 'wr-adopt-error' }, `${t('error.prefix')}${error}`),
        h(
          'div',
          { className: 'wr-section' },
          h('div', { className: 'wr-section-title' }, t('grow.annual.title')),
          h('div', { className: 'wr-section-hint' }, t('grow.annual.hint')),
        ),
        days === null
          ? h('div', { className: 'wr-empty' }, h('span', { className: 'wr-spinner' }), h('div', null, t('state.loading')))
          : empty
            ? h(CraftEmpty, {
                titleKey: 'grow.annual.empty',
                nextKey: 'grow.annual.emptyNext',
                actionKey: 'grow.annual.emptyAction',
                onAction: props.onGoShelf,
              })
            : h(
                'div',
                null,
                h(
                  'div',
                  { className: 'wr-kpis' },
                  h('div', { className: 'wr-kpi' }, h('span', { className: 'wr-kpi-label' }, t('grow.annual.total')), h('strong', { className: 'wr-kpi-value' }, total ? fmtDuration(total) : '—')),
                  h('div', { className: 'wr-kpi' }, h('span', { className: 'wr-kpi-label' }, t('grow.annual.days')), h('strong', { className: 'wr-kpi-value' }, fmtCount(readDays))),
                  h('div', { className: 'wr-kpi' }, h('span', { className: 'wr-kpi-label' }, t('grow.annual.notes')), h('strong', { className: 'wr-kpi-value' }, fmtCount(Number(counts.notes) || 0))),
                  h('div', { className: 'wr-kpi' }, h('span', { className: 'wr-kpi-label' }, t('grow.annual.thoughts')), h('strong', { className: 'wr-kpi-value' }, fmtCount(Number(counts.thoughts) || 0))),
                ),
                h(
                  'p',
                  { className: 'wr-notice-line' },
                  `${t('grow.annual.craft')}：${t('nav.responses')} ${fmtCount(Number(craftCounts.responses) || 0)} · ${t('nav.materials')} ${fmtCount(Number(craftCounts.materials) || 0)} · ${t('nav.topics')} ${fmtCount(Number(craftCounts.topics) || 0)} · ${t('nav.works')} ${fmtCount(Number(craftCounts.works) || 0)}`,
                ),
                h(
                  'div',
                  { className: 'wr-section' },
                  h('div', { className: 'wr-section-title' }, t('grow.annual.books')),
                ),
                yearBooks.length === 0
                  ? h('p', { className: 'wr-muted' }, t('grow.annual.noBooks'))
                  : h(
                      'div',
                      { className: 'wr-chips' },
                      yearBooks.map((book) =>
                        h(
                          'button',
                          {
                            className: 'wr-chip',
                            key: book.bookId,
                            type: 'button',
                            title: String(book.title || ''),
                            onClick: () => props.onOpenBook(book.bookId, 'notes'),
                          },
                          clip(String(book.title || '—'), 20),
                        ),
                      ),
                    ),
                exported === '' ? null : h('p', { className: 'wr-notice-line' }, t('export.saved', { files: exported })),
                readDays === 0 ? null : h(Heatmap, { year, days }),
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
                  ? h(NoteRow, { key: item.id, note: item, needle: query.trim(), selected: selected.has(item.id), focus: String(props.focusId || '') === String(item.id), onToggle: pick, onOpen: props.onOpenBook ? () => props.onOpenBook(item.bookId, kind) : null })
                  : h(ThoughtRow, {
                      key: item.id,
                      thought: item,
                      needle: query.trim(),
                      wall: mode === 'wall',
                      context: contextOf(item),
                      selected: selected.has(item.id),
                      focus: String(props.focusId || '') === String(item.id),
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

      // F3: arriving from a source chip should land on the row that was cited,
      // not on whatever page the reader left the book at.
      useEffect(() => {
        const id = String(props.focusId || '')
        if (id === '') return
        const at = activeList.findIndex((item) => String(item.id) === id)
        if (at >= 0) setPage(Math.floor(at / pageSize))
      }, [props.focusId, activeList, pageSize])

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
        // F-19: the six steps of this one book, so the page says where the
        // reading has actually gone instead of only listing highlights.
        h(BookChain, {
          book: Object.assign({}, book, { noteCount: notes.length, reviewCount: thoughts.length }),
          craft: props.craft,
          craftState: props.craftState,
          onJump: (kind) => {
            if (typeof props.onChainJump === 'function') props.onChainJump(book.bookId, kind)
          },
        }),
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
          return true
        } catch (error) {
          setMessage(String(error.message || error))
          return false
        } finally {
          setBusy(false)
        }
      }

      /**
       * F-28: 配色是「选了就看见」的开关，所以先让父级立刻换根节点属性，再写 config.json。
       * 写盘失败不回滚（否则用户点了没反应），只在下面提示「这次会话有效、下次打开会还原」。
       */
      const applyPalette = async (value) => {
        const name = paletteOf(value)
        if (paletteOf(state.palette) === name) return
        if (typeof props.onPalette === 'function') props.onPalette(name)
        const saved = await save({ palette: name === 'follow' ? '' : name }, false)
        if (!saved) setMessage(t('appearance.sessionOnly'))
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
          h(
            'div',
            { className: 'wr-field' },
            h('label', null, t('appearance.title')),
            h(
              'select',
              {
                className: 'wr-input wr-palette-select',
                value: paletteOf(state.palette),
                disabled: busy,
                'aria-label': t('appearance.title'),
                onChange: (event) => void applyPalette(event.target.value),
              },
              PALETTES.map((name) => h('option', { key: name, value: name }, t(PALETTE_KEYS[name]))),
            ),
            h('p', { className: 'wr-muted', style: { margin: 0 } }, t('appearance.hint')),
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
      // The writing side loads on its own request: if it fails, READ keeps working.
      const [craft, setCraft] = useState(EMPTY_CRAFT)
      const [craftState, setCraftState] = useState('loading')
      const [craftError, setCraftError] = useState('')
      const [scopeBookId, setScopeBookId] = useState('')
      const mounted = useRef(true)
      const craftRef = useRef(EMPTY_CRAFT)

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

      const loadCraft = useCallback(async () => {
        try {
          const payload = await apiCraft()
          const next = asCraft(payload)
          craftRef.current = next
          if (mounted.current) {
            setCraft(next)
            setCraftState('ready')
            setCraftError('')
          }
          return next
        } catch (issue) {
          if (mounted.current) {
            setCraftState('failed')
            setCraftError(String((issue && issue.message) || issue))
          }
          return null
        }
      }, [])

      /**
       * Every write carries the revision it was based on. A conflict means the
       * file moved under us, so we reload once and let the caller retry rather
       * than overwriting someone else's paragraph.
       */
      const craftWrite = useCallback(
        async (op, payload) => {
          try {
            const result = await apiCraftWrite(op, payload, craftRef.current.revision)
            const next = result && result.craft ? asCraft(result.craft) : await loadCraft()
            if (next) {
              craftRef.current = next
              if (mounted.current) {
                setCraft(next)
                setCraftState('ready')
                setCraftError('')
              }
            }
            return result && result.created ? result.created : null
          } catch (issue) {
            await loadCraft()
            throw issue
          }
        },
        [loadCraft],
      )

      useEffect(() => {
        craftBridge.write = craftWrite
        craftBridge.craft = craft
        return () => {
          craftBridge.write = null
        }
      }, [craft, craftWrite])

      // One lookup table, so a `kind:id` chip can show the first words of the
      // thing it names instead of an opaque id.
      const lookup = useMemo(() => {
        const bag = { note: new Map(), thought: new Map(), response: new Map(), material: new Map() }
        for (const note of (data && data.notes) || []) bag.note.set(String(note.id), note)
        for (const thought of (data && data.thoughts) || []) bag.thought.set(String(thought.id), thought)
        for (const item of craft.responses || []) bag.response.set(String(item.id), item)
        for (const item of craft.materials || []) bag.material.set(String(item.id), item)
        return bag
      }, [data, craft])

      useEffect(() => {
        let cancelled = false
        // F1: decide whether the AI entry points can work before anyone clicks.
        void probeChat()
        ;(async () => {
          const next = await refreshState()
          if (cancelled) return
          if (next && next.configured) {
            await loadData()
            await loadCraft()
          }
          if (!cancelled) setBooting(false)
        })()
        return () => {
          cancelled = true
        }
      }, [loadCraft, loadData, refreshState])

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

      const journeyCounts = {
        read: (Number(counts.notes) || 0) + (Number(counts.thoughts) || 0),
        think: (craft.responses || []).length,
        create: (craft.materials || []).length + (craft.topics || []).length + (craft.works || []).length,
        grow: (craft.responses || []).length + (craft.materials || []).length + (craft.topics || []).length + (craft.works || []).length,
      }
      const scopeTitle = scopeBookId === '' ? '' : bookTitleOf(scopeBookId, data, craft) || ''
      const openCraftView = (nextView, bookId) => {
        setQuery('')
        setActiveBookId('')
        setScopeBookId(String(bookId || ''))
        setView(nextView)
      }
      // Any journey can be entered from one book and come back to it.
      const chainJump = (bookId, kind) => {
        if (kind === 'notes' || kind === 'thoughts') {
          openBookById(bookId, kind)
          return
        }
        openCraftView(kind, bookId)
      }
      const draftFromTopic = (topic) => {
        craftWrite('work.add', { title: clip(String(topic.statement || ''), 48) })
          .then(() => {
            setScopeBookId('')
            setView('works')
          })
          .catch(() => {})
      }
      // F3: every source chip walks back to the asset it names — a material
      // opens in the basket, an excerpt or thought opens the book it sits in.
      const sourceFocus = useRef('')
      const openSource = (sourceId) => {
        const hit = craftSourceHit(sourceId, lookup)
        if (!hit) return
        const kind = sourceKind(sourceId)
        sourceFocus.current = sourceRawId(sourceId)
        if (kind === 'note' || kind === 'thought') {
          const tab = kind === 'note' ? 'notes' : 'thoughts'
          const bookId = String(hit.bookId || '')
          if (bookId !== '' && books.some((book) => book.bookId === bookId)) {
            openBookById(bookId, tab)
            return
          }
          // The book left the sync window: land on the stream that still holds
          // the excerpt instead of opening a book page with nothing on it.
          setQuery('')
          setView(tab)
          return
        }
        openCraftView(kind === 'response' ? 'responses' : 'materials', hit.bookId)
      }
      // F2: a work carries no bookIds of its own; the answer comes from its
      // paragraphs' sources, which is also what the reader can verify.
      const bookIdOfSource = (sourceId) => {
        const hit = craftSourceHit(sourceId, lookup)
        return hit && hit.bookId ? String(hit.bookId) : ''
      }
      const craftProps = {
        craft,
        craftState,
        craftError,
        lookup,
        data: data || {},
        scopeBookId,
        focusId: sourceFocus.current,
        onOpenSource: openSource,
        bookIdOf: bookIdOfSource,
        onRetry: () => {
          void loadCraft()
        },
        onOpenBook: (bookId, tab) => openBookById(bookId, tab),
        onGoShelf: () => {
          setScopeBookId('')
          setView('shelf')
        },
        onGoMaterials: () => {
          setScopeBookId('')
          setView('materials')
        },
        onGoTopics: () => {
          setScopeBookId('')
          setView('topics')
        },
        write: craftWrite,
        onDraft: draftFromTopic,
        onDelete: (id) => {
          const op = view === 'responses' ? 'response.delete' : view === 'materials' ? 'material.delete' : 'topic.delete'
          craftWrite(op, { id }).catch(() => {})
        },
      }
      const craftView = () => {
        if (view === 'responses') return h(ResponseList, craftProps)
        if (view === 'materials') return h(MaterialBoard, craftProps)
        if (view === 'topics') return h(TopicBoard, craftProps)
        if (view === 'works') return h(WorkBoard, craftProps)
        if (view === 'timeline') return h(GrowTimeline, craftProps)
        return h(GrowAnnual, { data: data || {}, craft, craftCounts: craft.counts, onGoShelf: craftProps.onGoShelf, onOpenBook: craftProps.onOpenBook })
      }

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
        h(JourneyBar, {
          view: query.trim() !== '' ? 'read' : view,
          counts: journeyCounts,
          onPick: (stage) => {
            setQuery('')
            setActiveBookId('')
            setScopeBookId('')
            setView(STAGE_VIEWS[stage][0][0])
          },
        }),
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

      // The second row only lists the views of the journey you are standing in,
      // so nothing from the old four pages is buried behind a new abstraction.
      const subnav = state && state.configured
        ? h(SubNav, {
            view: query.trim() !== '' ? 'overview' : view,
            scopeTitle,
            onPick: (id) => {
              setQuery('')
              setActiveBookId('')
              if (VIEW_STAGE[id] === 'read') setScopeBookId('')
              setView(id)
            },
            onClearScope: () => setScopeBookId(''),
          })
        : null

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
        body = h(BookView, {
          key: `${activeBook.bookId}:${bookTab}`,
          data: data || {},
          book: activeBook,
          initialTab: bookTab,
          focusId: sourceFocus.current,
          craft,
          craftState,
          onChainJump: chainJump,
          onBack: () => { setView('shelf'); setActiveBookId('') },
        })
      } else if (view === 'shelf') {
        body = h(ShelfView, { data: data || {}, onOpenBook: openBook })
      } else if (view === 'notes') {
        body = h(StreamView, { data: data || {}, kind: 'note', onOpenBook: openBookById })
      } else if (view === 'thoughts') {
        body = h(StreamView, { data: data || {}, kind: 'thought', onOpenBook: openBookById })
      } else if (view === 'responses' || view === 'materials' || view === 'topics' || view === 'works' || view === 'timeline' || view === 'annual') {
        body = craftView()
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
        Object.assign(
          { className: 'wr-root', 'data-view': room, 'data-dsh-weread-gather': '' },
          // F-28: one attribute is the whole switch — every colour below reads var(--wr-*).
          paletteAttr(state && state.palette),
        ),
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        head,
        subnav,
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
            // Two clocks, kept apart on purpose: reading data and writing data
            // are refreshed by different actions and can be stale independently.
            synced
              ? h('p', { className: 'wr-notice', style: { marginTop: '22px' } }, t('synced.at', { time: fmtDateTime(data.updatedAt) }))
              : null,
            craftState === 'ready' && craft.updatedAt
              ? h('p', { className: 'wr-notice', style: { marginTop: synced ? '2px' : '22px' } }, t('synced.craftAt', { time: fmtDateTime(craft.updatedAt) }))
              : null,
          ),
        ),
        showSettings
          ? h(SettingsModal, {
              state: state || {},
              onClose: () => setShowSettings(false),
              onChanged: (next) => {
      setState(next)
      void loadData()
      // A key just added in Settings must un-grey the AI entry points.
      void forgetChatProbe().catch(() => {})
    },
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
      __smoke: {
        ExportPanel,
        MarkedText,
        PickButton,
        SyncBanner,
        clip,
        ThoughtRow,
        THOUGHT_CLAMP_CHARS,
        buildSourcePack,
        ThinkingBar,
        AskCard,
        ASK_WIDTH,
        AskAdopt,
        MaterialPicker,
        ParagraphRow,
        ParagraphAI,
        buildParagraphPack,
        paragraphSourceEntry,
        packKindLabel,
        packKindOf,
        materialAuthorIsAI,
        PACK_KIND_KEYS,
        THINK_LIMITS,
        JourneyBar,
        SubNav,
        BookChain,
        ResponseList,
        MaterialBoard,
        TopicBoard,
        WorkBoard,
        GrowTimeline,
        GrowAnnual,
        asCraft,
        EMPTY_CRAFT,
        STAGES,
        STAGE_VIEWS,
        SourceTags,
        craftSourceHit,
        probeChat,
        forgetChatProbe,
        chatAvailability,
        craftBridge,
        MATERIAL_TYPES,
        SettingsModal,
        PALETTES,
        PALETTE_KEYS,
        paletteOf,
        paletteAttr,
      },
    }
  },
})