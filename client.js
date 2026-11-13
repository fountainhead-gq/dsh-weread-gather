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
      'appearance.hint': '只在书房面板生效，改完立刻应用；默认是冰川。',
      'appearance.sessionOnly': '这次已经换上了，但没能写进配置文件，下次打开会还原。',
      'appearance.mint': '苔纸（mint）',
      'appearance.night': '夜读（night）',
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
      'think.retry': '再试一次',
      'think.failed': '没能打开对话，来源包也没复制成功',
      'nav.read': '阅读',
      'nav.think': '思考',
      'nav.create': '创作',
      'nav.grow': '积累',
      'nav.responses': '回应',
      'nav.works': '初稿',
      'nav.timeline': '时间线',
      'nav.annual': '年度回顾',
      'journey.read.hint': '摘录与想法，按书看',
      'journey.think.hint': '把读到的东西问明白',
      'journey.create.hint': '把读到的写成自己的段落',
      'journey.grow.hint': '走过的路，与这一年',
      'craft.failed': '创作数据没读出来：{error}',
      'craft.retry': '重试',
      'craft.offline': '创作数据暂时读不到；阅读、书架、笔记、想法都不受影响。',
      'mat.type.quote': '金句',
      'mat.type.idea': '观点',
      'mat.type.case': '案例',
      'mat.type.evidence': '论据',
      'mat.type.question': '问题',
      'mat.type.spark': '灵感',
      'mat.status.missing': '来源没找到',
      'mat.delete': '删除',
      'mat.sure': '确认删除？',
      'mat.filterAll': '全部',
      // 这四个键由 `src.${kind}` 模板拼接取用（kind 的取值来自 SOURCE_PREFIX），
      // 静态 grep 看不见，删任何一个都会让来源标签渲染成字面量。
      'src.note': '摘录',
      'src.thought': '想法',
      'src.response': '我采纳的 AI 回应',
      'src.material': '我整理的素材',
      'src.materialRetired': '素材已下线，仅作来源标记',
      'nav.relate': '放回书里看',
      'relate.placeholder': '想问什么可以写，不写也行',
      'relate.send': '发送',
      'relate.thinking': '正在对照…',
      'relate.together': '一起看',
      'relate.why': '为什么值得对照：',
      'relate.followup': '可以接着问',
      'relate.askPrefix': '问：',
      'relate.none': '在你现在的记录里，我没找到有依据的关联。',
      'relate.noneHint': '如果在《{chapter}》里再划一句，或把这一段后面的两段补进来，我就能把它们放在一起看。',
      'relate.noneNoChapter': '如果再划一句、或写一句想法，我就能把它们放在一起看。',
      'relate.keepThought': '记成想法',
      'relate.collapse': '收起',
      'relate.toBottom': '回到底部',
      'relate.tooFew': '这本书你现在只有这一条记录。再划一句、或写一句想法，我再帮你对照。',
      'relate.noBook': '这条记录没有关联的书，暂时没法把别的记录放回来看。',
      'relate.thisNote': '这条划线',
      'relate.thisThought': '这条想法',
      'relate.packHead': '我在微信读书里读{title}（{author}），只导入了划线和想法，没有全文。',
      'relate.packNote': '这条是我 {date} 在《{chapter}》章的划线：',
      'relate.packThought': '这条是我 {date} 在《{chapter}》章写的想法：',
      'relate.packList': '同一本书里我还有这些记录（括号里是编号）：',
      'relate.packLine': '- ({id}) {date}《{chapter}》：{text}',
      'relate.packRule': '值得对照的挑一到三条，每条用 [编号] 开头，一句话说清它和这条划线怎么接上；一条都没有就直接说没有，并告诉我补哪条划线或哪段上下文最有用。',
      'relate.packFollowRule': '最后如果有值得追问的方向，用「问：」开头列一到两条。',
      'relate.packWant': '我想问：{question}',
      'relate.packDefault': '我想知道：{this}，在我自己的记录里能和什么放在一起看？',
      'relate.dropped': '这条记录已经找不到了',
      'relate.kept': '已记成想法',
      'relate.saved': '已存下这条关系',
      'relate.saveFailed': '没存上：{error}',
      'relate.remove': '删除关系',
      'relate.label.echo': '呼应',
      'relate.label.contrast': '对照',
      'relate.label.mine': '个人回应',
      'relate.label.check': '待核实',
      'topic.statement': '一句话选题',
      'work.empty.title': '还没有初稿',
      'work.empty.next': '新建一篇初稿，把你的想法写成自己的段落。',
      'work.empty.actionShelf': '去书架',
      'work.new': '新建初稿',
      'work.titlePlaceholder': '初稿标题',
      'work.create': '建这篇',
      'work.count': '共 {count} 篇',
      'work.paragraphCount': '{count} 段',
      'work.paragraph': '第 {index} 段',
      'work.paragraphPlaceholder': '用自己的话写这一段',
      'work.attach': '挂来源',
      'work.pickSource': '挂上这本书里的记录（可多选）',
      'work.pickTitle': '这本书里的记录',
      'work.pickEmpty': '这本书还没有划线和想法，先去读几页',
      'work.editHint': '点一下就能改',
      'work.noSource': '不挂来源',
      'work.addParagraph': '加这一段',
      'work.deleteParagraph': '删除这一段',
          'work.export': '导出',
      'work.exportPreview': '预览 Markdown',
      'work.exportFile': '写进导出目录',
      'work.exportPreviewLabel': '预览',
      'work.needParagraph': '先写一段再确认',
      'work.failed': '没存下：{error}',
      'work.emptyParagraphs': '还没有段落',
      'work.aiTag': 'AI 参与',
      'work.frontMatter': 'front-matter 带 workId 与 containsAI',
      'work.previewTitle': 'Markdown 预览',
      'work.hidePreview': '隐藏预览',
      'work.menu': '本篇操作',
      'work.deleteWhole': '删除整篇，无法恢复',
      'work.deleteConfirm': '再点一次，确认删除整篇',
      'work.deleteCancel': '算了',
      'work.delete': '删除',
      'work.saved': '已保存',
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
      'work.aiNeedSource': '这一段还没有出处，先挂一条来源',
      'work.aiNoSource': '这一段挂着的出处都找不到了，先补出处再试',
      'work.aiFailed': '没写出来：{error}',
      'thread.title': '我的阅读脉络',
      'thread.coverage': '本书导入：{chapters} 章 · 划线 {notes} 条 · 想法 {thoughts} 条 · {fullText}',
      'thread.onlyHighlights': '仅摘录，无全文',
      'thread.hasFullText': '有全文',
      'thread.build': '梳理这本书',
      'thread.rebuild': '重新梳理',
      'thread.building': '正在读你的记录…',
      'thread.slow': '记录多的时候会慢一点',
      'thread.more': '还有 {count} 条',
      'thread.less': '收起',
      'thread.why': '为什么值得回看',
      'thread.link': '联系',
      'thread.write': '写进作品',
      'thread.source': '回到原文',
      'thread.empty': '这本书还没有可以串起来的记录。',
      'thread.emptyNeed': '要形成脉络，至少需要 2 条划线，或者 1 条划线 + 1 条想法。',
      'thread.emptyNone': '你还没有导入这本书的划线。先去读几页，划一句回来。',
      'thread.capped': '这次线索多，先看 5 条（还有 {count} 条没放进来）。',
      'thread.none': '这次没找到能串起来的线索。可以再划几句，或者补一条想法。',
      'thread.failed': '这次没梳理成（{error}）',
      'thread.badJson': '回答不是完整的 JSON',
      'thread.stale': '这本书又有 {count} 条新记录，可以重新梳理。',
      'thread.gapNoThought': '{chapters} 章有划线但没有想法：{names}',
      'thread.gapNoChapter': '{count} 条划线没有章节名',
      'thread.scanned': '这次扫了（按当前数据）：{chapters}',
      'thread.noChapter': '无章节',
      'thread.noEvidence': '这条线索的对照关系已经被删掉了，重新梳理一次即可。',
      'thread.needRelation': '还没有确认过的对照关系。可以点「梳理这本书」，它会先提出几条建议；也可以先去某条记录上用「放回书里看」接一对。',
      'thread.suggestTitle': '建议放一起看',
      'thread.suggest': '把 {a} 和 {b} 放一起看',
      'thread.adopt': '采纳',
      'thread.adopting': '正在存…',
      'thread.adopted': '已存下这条对照，可以重新梳理了。',
      'thread.suggestDropped': '这条建议没存下来，刷新后再试。',
      'thread.suggestReason': '整理阅读脉络时提出的一对记录',
      'thread.packHead': '这是我在微信读书里读《{title}》（{author}）留下的全部记录：{chapters} 章、{notes} 条划线、{thoughts} 条想法、{responses} 条我采纳过的回应。只有摘录，没有全文。',
      'thread.packNotes': '划线：',
      'thread.packThoughts': '想法：',
      'thread.packResponses': '我采纳过的回应：',
      'thread.packRelations': '我已经确认过的对照关系（括号里是关系编号）：',
      'thread.packCut': '（还有 {count} 条没放进来）',
      'thread.packRule': '请从这些记录里找出 3 到 5 条线索，说明我当时其实在反复追问同一件事。每条都要有：标题（一句具体的问题或观察，不要「关于 X 的思考」这种写法）、为什么值得回看（一句话）、对照关系的编号（只写上面出现过的 rel_ 编号）、联系（这两三句具体怎么接上的，一两句话，不要评价我这个人）。',
      'thread.packSuggest': '如果发现两条记录明显该放一起看、但还没有对照关系，可以另外提出：suggest 里放一到三对，两端都只写上面出现过的编号。',
      'thread.packSuggestOnly': '现在还没有任何已确认的对照关系，所以线索只能靠你提出建议对：suggest 里放一到三对，两端都只写上面出现过的编号。',
      'thread.packJson': '只返回 JSON，不要别的文字：{"threads":[{"title":"…","why":"…","relations":["rel_xxx"],"suggest":[["note:1","thought:2"]]}]}',
      'thinkView.empty.title': '这里还空着',
      'thinkView.empty.next': '在阅读里对一条划线或想法点「追问」，把想留的那一句存下来。',
      'thinkView.empty.action': '去书架',
      'thinkView.scope': '只看这本书',
      'thinkView.adoptedAt': '采纳于',
      'thinkView.backBook': '回到《{title}》',
      'thinkView.ai': 'AI 参与',
      // 时间线只构造 response / work 两类事件；素材与选题退场后不再有事件，
      // 对应的 grow.event.* 键也一起删，避免留下取不到的半套文案。
      'grow.event.response': '采纳了回应',
      'grow.event.work': '新建初稿',
        'grow.empty.title': '还没有可回顾的事',
      'grow.empty.next': '走一遍阅读 → 思考 → 创作，这里就会长出记录。',
      'grow.empty.action': '去阅读',
      'grow.monthLabel': '{year} 年 {month} 月',
      'grow.monthCountInline': '{count} 条',
      'grow.multiBooks': '{title} 等 {count} 本',
      'grow.noBook': '未关联书',
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
      'appearance.hint': 'Applies to this panel only and takes effect immediately. Glacier is the default.',
      'appearance.sessionOnly': 'Applied for now, but it could not be written to the config file, so it will revert next time.',
      'appearance.mint': 'Mint paper',
      'appearance.night': 'Night',
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
      'think.retry': 'Try again',
      'think.failed': 'Could not open a conversation, and copying failed',
      'nav.read': 'Read',
      'nav.think': 'Think',
      'nav.create': 'Create',
      'nav.grow': 'Grow',
      'nav.responses': 'Answers',
      'nav.works': 'Drafts',
      'nav.timeline': 'Timeline',
      'nav.annual': 'Yearly review',
      'journey.read.hint': 'Highlights and thoughts, book by book',
      'journey.think.hint': 'Ask until it is clear',
      'journey.create.hint': 'Turn what you read into paragraphs of your own',
      'journey.grow.hint': 'The path walked, and the year',
      'craft.failed': 'Could not load your writing: {error}',
      'craft.retry': 'Retry',
      'craft.offline': 'Writing data is unavailable right now; reading, shelf, notes and thoughts are unaffected.',
      'mat.type.quote': 'Quote',
      'mat.type.idea': 'Viewpoint',
      'mat.type.case': 'Case',
      'mat.type.evidence': 'Evidence',
      'mat.type.question': 'Question',
      'mat.type.spark': 'Spark',
      'mat.status.missing': 'Source missing',
      'mat.delete': 'Delete',
      'mat.sure': 'Delete?',
      'mat.filterAll': 'All',
      'src.note': 'Highlight',
      'src.thought': 'Thought',
      'src.response': 'An AI reply I kept',
      'src.material': 'A source I filed',
      'src.materialRetired': 'Sources retired; kept as a citation only',
      'nav.relate': 'Put it back in the book',
      'relate.placeholder': 'Ask anything, or leave it empty',
      'relate.send': 'Send',
      'relate.thinking': 'Looking across your notes…',
      'relate.together': 'Read together',
      'relate.why': 'Why it belongs together: ',
      'relate.followup': 'You could ask',
      'relate.askPrefix': 'Ask: ',
      'relate.none': 'I found no grounded connection in your notes.',
      'relate.noneHint': 'Highlight one more line in {chapter}, or add the next two paragraphs, and I can read them together.',
      'relate.noneNoChapter': 'Highlight one more line, or write one more thought, and I can read them together.',
      'relate.keepThought': 'Keep as my thought',
      'relate.collapse': 'Collapse',
      'relate.toBottom': 'Back to bottom',
      'relate.tooFew': 'Only one record so far. Add a highlight or a thought, then I can read them together.',
      'relate.noBook': 'This record has no book attached, so there is nothing to put it back beside.',
      'relate.thisNote': 'This highlight',
      'relate.thisThought': 'This thought',
      'relate.packHead': 'I read {title} ({author}) in WeRead. Only my highlights and thoughts were imported — no full text.',
      'relate.packNote': 'This is a highlight I made on {date}, in the chapter «{chapter}»:',
      'relate.packThought': 'This is a thought I wrote on {date}, in the chapter «{chapter}»:',
      'relate.packList': 'In the same book I also have these records (the id is in brackets):',
      'relate.packLine': '- ({id}) {date} «{chapter}»: {text}',
      'relate.packRule': 'Pick one to three worth contrasting. Start each line with [id] and say in one sentence how it connects to this highlight. If none does, say so plainly and tell me which highlight or passage would help most.',
      'relate.packFollowRule': 'If there is a direction worth asking about, list one or two at the end, each starting with "问：".',
      'relate.packWant': 'What I want to ask: {question}',
      'relate.packDefault': 'What I want to know: {this} — what in my own records could be read alongside it?',
      'relate.dropped': 'that record can no longer be found',
      'relate.kept': 'Kept as a thought',
      'relate.saved': 'Relation saved',
      'relate.saveFailed': 'Not saved: {error}',
      'relate.remove': 'Delete relation',
      'relate.label.echo': 'Echo',
      'relate.label.contrast': 'Contrast',
      'relate.label.mine': 'Personal reply',
      'relate.label.check': 'To verify',
      'topic.statement': 'One-sentence topic',
      'work.empty.title': 'No draft yet',
      'work.empty.next': 'Start a draft and write your thoughts as paragraphs.',
      'work.empty.actionShelf': 'Go to the shelf',
      'work.new': 'New draft',
      'work.titlePlaceholder': 'Draft title',
      'work.create': 'Create',
      'work.count': '{count} drafts',
      'work.paragraphCount': '{count} paragraphs',
      'work.paragraph': 'Paragraph {index}',
      'work.paragraphPlaceholder': 'Write this paragraph in your own words',
      'work.attach': 'Attach sources',
      'work.pickSource': 'Attach records from this book (pick as many as you like)',
      'work.pickTitle': 'Records in this book',
      'work.pickEmpty': 'No highlights or thoughts in this book yet — read a few pages first',
      'work.editHint': 'Click to edit',
      'work.noSource': 'No source',
      'work.addParagraph': 'Add paragraph',
      'work.deleteParagraph': 'Delete paragraph',
          'work.export': 'Export',
      'work.exportPreview': 'Preview Markdown',
      'work.exportFile': 'Write file',
      'work.exportPreviewLabel': 'Preview',
      'work.needParagraph': 'Write a paragraph first',
      'work.failed': 'Not saved: {error}',
      'work.emptyParagraphs': 'No paragraph yet',
      'work.aiTag': 'AI-assisted',
      'work.frontMatter': 'front-matter carries workId and containsAI',
      'work.previewTitle': 'Markdown preview',
      'work.hidePreview': 'Hide preview',
      'work.menu': 'This draft',
      'work.deleteWhole': 'Delete the whole draft — cannot be undone',
      'work.deleteConfirm': 'Click again to delete the whole draft',
      'work.deleteCancel': 'Never mind',
      'work.delete': 'Delete',
      'work.saved': 'Saved',
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
      'work.aiNeedSource': 'This paragraph has no source yet — attach a source first',
      'work.aiNoSource': 'None of this paragraph’s sources can be found any more — restore them first',
      'work.aiFailed': 'Not written: {error}',
      'thread.title': 'My reading threads',
      'thread.coverage': 'Imported: {chapters} chapters · {notes} highlights · {thoughts} thoughts · {fullText}',
      'thread.onlyHighlights': 'highlights only, no full text',
      'thread.hasFullText': 'full text',
      'thread.build': 'Read this book together',
      'thread.rebuild': 'Read it again',
      'thread.building': 'Reading your records…',
      'thread.slow': 'Slower when there are many records',
      'thread.more': '{count} more',
      'thread.less': 'Collapse',
      'thread.why': 'Why it is worth going back',
      'thread.link': 'How they connect',
      'thread.write': 'Write into a draft',
      'thread.source': 'Back to the text',
      'thread.empty': 'Nothing in this book can be threaded together yet.',
      'thread.emptyNeed': 'A thread needs at least 2 highlights, or 1 highlight + 1 thought.',
      'thread.emptyNone': 'You have not imported any highlight of this book yet. Read a few pages and highlight a line.',
      'thread.capped': 'This run found more than five; five are here ({count} left out).',
      'thread.none': 'No thread came out of this run. Highlight a few more lines, or add one thought.',
      'thread.failed': 'Could not read it this time ({error})',
      'thread.badJson': 'the answer was not complete JSON',
      'thread.stale': '{count} new records in this book — you can read it again.',
      'thread.gapNoThought': '{chapters} chapters have highlights but no thoughts: {names}',
      'thread.gapNoChapter': '{count} highlights have no chapter name',
      'thread.scanned': 'Scanned (live data): {chapters}',
      'thread.noChapter': 'no chapter',
      'thread.noEvidence': 'The pairs behind this thread were deleted; read the book again.',
      'thread.needRelation': 'No confirmed pairs yet. Run “Read this book together” and it will propose a few, or open a record and use “Put it back in the book” first.',
      'thread.suggestTitle': 'Suggested pairs',
      'thread.suggest': 'Put {a} and {b} together',
      'thread.adopt': 'Keep it',
      'thread.adopting': 'Saving…',
      'thread.adopted': 'Saved that pair — you can read the book again now.',
      'thread.suggestDropped': 'That pair was not saved; refresh and try again.',
      'thread.suggestReason': 'A pair proposed while reading the threads',
      'thread.packHead': 'These are all the records I kept while reading 《{title}》 ({author}): {chapters} chapters, {notes} highlights, {thoughts} thoughts, {responses} replies I kept. Highlights only, no full text.',
      'thread.packNotes': 'Highlights:',
      'thread.packThoughts': 'Thoughts:',
      'thread.packResponses': 'Replies I kept:',
      'thread.packRelations': 'Pairs I have already confirmed (the id in brackets is the relation id):',
      'thread.packCut': '({count} more left out)',
      'thread.packRule': 'Find 3 to 5 threads in these records that show what I kept circling around. Each thread needs: a title (one concrete question or observation, not “thoughts on X”); why it is worth going back to (one sentence); the relation ids (only the rel_ ids that appear above); how they connect (one or two sentences about what actually links them, do not judge me as a person).',
      'thread.packSuggest': 'If two records clearly belong together but have no relation yet, propose them separately: one to three pairs in suggest, both ends using only ids that appear above.',
      'thread.packSuggestOnly': 'There are no confirmed pairs yet, so the threads can only come from pairs you propose: one to three pairs in suggest, both ends using only ids that appear above.',
      'thread.packJson': 'Return JSON only, nothing else: {"threads":[{"title":"…","why":"…","relations":["rel_xxx"],"suggest":[["note:1","thought:2"]]}]}',
      'thinkView.empty.title': 'Nothing kept yet',
      'thinkView.empty.next': 'In READ, ask about a highlight or thought and keep the line worth keeping.',
      'thinkView.empty.action': 'Go to the shelf',
      'thinkView.scope': 'This book only',
      'thinkView.adoptedAt': 'Kept',
      'thinkView.backBook': 'Back to {title}',
      'thinkView.ai': 'AI-assisted',
      'grow.event.response': 'Kept an answer',
      'grow.event.work': 'Started a draft',
        'grow.empty.title': 'Nothing to look back on yet',
      'grow.empty.next': 'Read, think, write once and the timeline starts growing.',
      'grow.empty.action': 'Go read',
      'grow.monthLabel': '{month}/{year}',
      'grow.monthCountInline': '{count} entries',
      'grow.multiBooks': '{title} and {count} books',
      'grow.noBook': 'No book attached',
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
     * F-28: the five palettes the Appearance section offers. Glacier is the default, not a
     * separate "follow the host" mode: the panel has its own paper look, and following the host
     * only made the colours change under the reader's feet when DSH switched theme. So a config
     * with no `palette` (or with a stale/unknown one) renders glacier, and every value still
     * accepted here — including the retired `cream` name — lands on a real palette.
     */
    const PALETTES = ['glacier', 'mint', 'night', 'mist', 'iris']
    const PALETTE_KEYS = {
      glacier: 'appearance.glacier',
      mint: 'appearance.mint',
      night: 'appearance.night',
      mist: 'appearance.mist',
      iris: 'appearance.iris',
    }
    /** Anything the host (or an older build) hands us that is not one of the five becomes `glacier`. */
    function paletteOf(value) {
      const name = String(value == null ? '' : value).trim()
      return Object.prototype.hasOwnProperty.call(PALETTE_KEYS, name) ? name : 'glacier'
    }
    /** The root always carries the palette it is painting in, so there is no "unstyled" state. */
    function paletteAttr(value) {
      return { 'data-palette': paletteOf(value) }
    }

    const EMPTY_CRAFT = { hasCraft: false, revision: 0, updatedAt: 0, counts: { responses: 0, materials: 0, topics: 0, works: 0 }, responses: [], materials: [], topics: [], works: [], relations: [], threads: [], bookIndex: [] }
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
        // 1.2.2: the relate card reads and writes these, so the snapshot has to carry
        // them; an older host that does not know them simply yields empty lists.
        relations: list(source.relations),
        threads: list(source.threads),
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
      // 微读给的是秒，但真出现过毫秒级的 createTime（pack 里会写出「55840-11-09」这种年份）。
      // 这里只做单位归一化：大于 1e11 当毫秒，否则当秒。别把秒级的 1.79e9 当毫秒。
      const value = Number(seconds)
      if (!Number.isFinite(value) || value <= 0) return ''
      const millis = value > 1e11 ? value : value * 1000
      const date = new Date(millis)
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
/* Chapter context opens as a small popover panel instead of a stack of quotes:
   bounded height, its own scroll area, one close button, no repeated date. */
.wr-thread-pop{display:flex;flex-direction:column;margin-top:8px;border:1px solid var(--wr-divider);border-radius:10px;background:var(--wr-surface);max-height:240px;overflow:hidden}
.wr-thread-pop-head{display:flex;align-items:center;gap:8px;flex:none;padding:7px 8px 6px 11px;border-bottom:1px solid var(--wr-divider)}
.wr-thread-pop-title{margin:0;font-size:11px;color:var(--wr-ink-mute);letter-spacing:.03em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wr-thread-pop-close{appearance:none;margin-left:auto;flex:none;width:20px;height:20px;border-radius:50%;border:1px solid transparent;background:transparent;color:var(--wr-ink-soft);font-size:14px;line-height:1;cursor:pointer}
.wr-thread-pop-close:hover{background:var(--wr-wash);color:var(--wr-ink)}
.wr-thread-pop-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:2px 11px 8px}
.wr-thread-item{padding:6px 0;border-top:1px dashed var(--wr-divider)}
.wr-thread-item:first-child{border-top:0;padding-top:4px}
.wr-thread-quote{margin:0;font-size:12px;line-height:1.6;color:var(--wr-ink-soft)}
.wr-thread-chapter{display:block;margin-top:2px;font-size:10.5px;color:var(--wr-ink-mute)}
.wr-relate{margin-top:8px;opacity:0;transition:opacity .14s ease}
.wr-quote:hover .wr-relate,.wr-thought:hover .wr-relate,.wr-relate:focus-within,.wr-relate[data-open=true]{opacity:1}
@media (hover:none){.wr-relate{opacity:1}}
.wr-relate-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.wr-quote-tail .wr-relate,.wr-thought .wr-quote-tail .wr-relate{margin-top:0}
.wr-relate-go{appearance:none;border:1px solid var(--wr-line);background:var(--wr-paper-soft);color:var(--wr-ink-soft);font:inherit;font-size:11px;line-height:1;padding:5px 10px;border-radius:999px;cursor:pointer;transition:border-color .14s ease,color .14s ease,background .14s ease}
.wr-relate-go:hover{border-color:var(--wr-moss);color:var(--wr-ink);background:var(--wr-wash)}
.wr-relate-go:disabled{opacity:.45;cursor:default}
.wr-relate-modal{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--wr-scrim)}
.wr-relate-card{position:relative;display:flex;flex-direction:column;width:min(600px,calc(100vw - 32px));max-width:600px;max-height:min(84vh,760px);padding:12px 14px;border:1px solid var(--wr-line);border-radius:14px;background:var(--wr-paper-soft);box-shadow:0 14px 44px color-mix(in srgb, var(--wr-ink) 20%, transparent);overflow:hidden}
/* No fixed height here on purpose: short answer → short sheet, long answer →
   the card stops at its cap and this area scrolls. */
.wr-relate-body{display:flex;flex:1 1 auto;flex-direction:column;gap:10px;min-height:0;overflow-y:auto;padding-right:2px}
.wr-relate-compose{display:flex;flex:none;flex-direction:column;gap:8px;margin-top:8px;padding-top:10px;border-top:1px solid var(--wr-line)}
.wr-relate-jump{appearance:none;flex:none;border:1px dashed var(--wr-line);background:var(--wr-paper);color:var(--wr-ink-soft);font:inherit;font-size:10.5px;line-height:1;padding:5px 9px;border-radius:999px;cursor:pointer}
.wr-relate-jump:hover{border-color:var(--wr-moss);color:var(--wr-ink)}
.wr-relate-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wr-relate-kind{font-size:10.5px;line-height:1;padding:3px 7px;border-radius:999px;background:var(--wr-wash);color:var(--wr-ink-soft)}
.wr-relate-book{font-size:12px;color:var(--wr-ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wr-relate-close{appearance:none;margin-left:auto;flex:none;width:22px;height:22px;border-radius:50%;border:1px solid transparent;background:transparent;color:var(--wr-ink-soft);font-size:15px;line-height:1;cursor:pointer}
.wr-relate-close:hover{background:var(--wr-wash);color:var(--wr-ink)}
.wr-relate-summary{font-size:11px;color:var(--wr-ink-mute);line-height:1.5}
.wr-relate-input{flex:none;width:100%;min-width:0;font:inherit;font-size:12.5px;line-height:1.6;padding:7px 11px;min-height:34px;max-height:104px;resize:none;overflow-y:auto;border-radius:11px;border:1px solid var(--wr-line);background:var(--wr-paper);color:var(--wr-ink)}
.wr-relate-input:focus{outline:none;border-color:var(--wr-moss);box-shadow:0 0 0 3px color-mix(in srgb, var(--wr-moss) 14%, transparent)}
.wr-relate-send{appearance:none;flex:none;border:1px solid var(--wr-moss);background:var(--wr-moss);color:var(--wr-on-accent);font:inherit;font-size:11.5px;line-height:1;padding:8px 13px;border-radius:999px;cursor:pointer}
.wr-relate-send:disabled{opacity:.45;cursor:default}
.wr-relate-answer{margin:0;font-size:12.5px;line-height:1.75;color:var(--wr-ink);white-space:pre-wrap;word-break:break-word}
.wr-relate-title{margin:0;font-size:11px;color:var(--wr-ink-mute);letter-spacing:.02em}
.wr-relate-list{display:flex;flex-direction:column;gap:8px}
.wr-relate-item{border:1px solid var(--wr-line);border-radius:11px;padding:9px 11px;background:var(--wr-paper);display:flex;flex-direction:column;gap:6px}
.wr-relate-item[data-missing=true]{border-style:dashed;background:transparent}
.wr-relate-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.wr-relate-chip{appearance:none;border:1px solid var(--wr-line);background:var(--wr-paper-soft);color:var(--wr-moss);font:inherit;font-size:10.5px;line-height:1;padding:3px 7px;border-radius:999px;cursor:pointer}
.wr-relate-chip:hover{border-color:var(--wr-moss);color:var(--wr-ink)}
.wr-relate-chip[data-missing=true]{border-style:dashed;color:var(--wr-ink-mute);cursor:default}
.wr-relate-when{font-size:10.5px;color:var(--wr-ink-mute)}
.wr-relate-text{margin:0;font-size:12px;line-height:1.65;color:var(--wr-ink-soft)}
.wr-relate-why{margin:0;font-size:11px;line-height:1.6;color:var(--wr-ink-mute)}
.wr-relate-labels{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.wr-relate-label{appearance:none;border:1px solid var(--wr-line);background:var(--wr-paper-soft);color:var(--wr-ink-soft);font:inherit;font-size:10.5px;line-height:1;padding:3px 8px;border-radius:999px;cursor:pointer}
.wr-relate-label:hover{border-color:var(--wr-sage);color:var(--wr-ink)}
.wr-relate-label[data-on=true]{border-color:var(--wr-moss);background:var(--wr-wash);color:var(--wr-moss)}
.wr-relate-label:disabled{opacity:.5;cursor:default}
.wr-relate-saved{font-size:10.5px;color:var(--wr-moss)}
.wr-relate-asks{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.wr-relate-ask{appearance:none;text-align:left;border:1px dashed var(--wr-line);background:transparent;color:var(--wr-ink-soft);font:inherit;font-size:11.5px;line-height:1.5;padding:5px 10px;border-radius:10px;cursor:pointer}
.wr-relate-ask:hover{border-color:var(--wr-moss);color:var(--wr-ink);background:var(--wr-wash)}
.wr-relate-error{margin:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-state-error)}
.wr-relate-foot{display:flex;flex:none;flex-direction:column;align-items:stretch;gap:8px;padding-top:8px}
.wr-relate-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wr-relate-spacer{flex:1 1 auto}
.wr-relate-actions .wr-relate-send{margin-right:8px}
.wr-relate-notice{margin:0;font-size:11px;line-height:1.5;color:var(--wr-ink-soft)}
.wr-relate-offline{margin:0;font-size:11.5px;line-height:1.6;color:var(--wr-ink-mute)}
.wr-line-input{flex:1;min-width:0;font:inherit;font-size:12.5px;line-height:1.6;padding:8px 12px;min-height:38px;max-height:150px;resize:none;overflow-y:auto;border-radius:12px;border:1px solid var(--wr-line);background:var(--wr-paper);color:var(--wr-ink)}
.wr-line-input:focus{outline:none;border-color:var(--wr-moss);box-shadow:0 0 0 3px color-mix(in srgb, var(--wr-moss) 14%, transparent)}
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
.wr-page-head{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap;margin:0 0 16px;min-width:0}
.wr-page-title{margin:0;font-size:19px;line-height:1.3;font-weight:700;letter-spacing:.01em;color:var(--wr-ink)}
.wr-page-hint{flex:1 1 240px;min-width:0;font-size:12px;line-height:1.65;color:var(--wr-ink-mute);text-align:right;white-space:normal;overflow-wrap:anywhere}
.wr-page-count{flex:none;font-size:11.5px;color:var(--wr-ink-mute);font-variant-numeric:tabular-nums}
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
.wr-tl{display:flex;flex-direction:column;gap:22px}
.wr-tl-month{display:flex;align-items:baseline;gap:8px;margin-bottom:10px;font-size:12px;font-weight:700;letter-spacing:.03em;color:var(--wr-ink)}
.wr-tl-month-count{font-weight:400;font-size:11.5px;color:var(--wr-ink-mute)}
.wr-tl-items{display:flex;flex-direction:column;gap:4px;border-left:2px solid var(--wr-line);padding-left:16px}
.wr-tl-item{display:flex;flex-direction:column;gap:3px;align-items:stretch;position:relative;min-width:0;width:100%;margin:0;background:none;border:0;border-radius:8px;padding:8px 10px 8px 0;font:inherit;color:inherit;text-align:left;cursor:pointer}
.wr-tl-item:hover{background:var(--wr-wash)}
.wr-tl-item:focus-visible{outline:2px solid var(--wr-moss);outline-offset:1px}
.wr-tl-item:before{content:'';position:absolute;left:-21px;top:14px;width:7px;height:7px;border-radius:50%;background:var(--wr-sage)}
.wr-tl-meta{display:flex;align-items:baseline;gap:8px;font-size:12px;line-height:1.4;color:var(--wr-ink-soft)}
.wr-tl-time{font-variant-numeric:tabular-nums;color:var(--wr-ink-mute)}
.wr-tl-action{color:var(--wr-ink-soft)}
.wr-tl-body{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14.5px;line-height:1.6;color:var(--wr-ink);word-break:break-word}
.wr-tl-where{display:block;font-size:12px;line-height:1.4;color:var(--wr-ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wr-draft{display:flex;flex-direction:column;gap:8px}
.wr-paragraph{display:flex;gap:10px;align-items:flex-start;background:var(--wr-paper-soft);border:1px solid var(--wr-card-line);border-radius:12px;padding:11px 13px}
.wr-paragraph-index{flex:none;font-size:11px;color:var(--wr-ink-mute);font-variant-numeric:tabular-nums;padding-top:2px;width:46px}
.wr-paragraph-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
.wr-item-text[data-editable=true]{cursor:text;border-radius:6px;padding:2px 4px;margin:-2px -4px;transition:background .12s ease}
.wr-item-text[data-editable=true]:hover{background:var(--wr-wash)}
.wr-paragraph-input{min-height:64px}
.wr-paragraph-sources{display:contents}
.wr-paragraph-sources > .wr-picklist{flex:1 0 100%;background:var(--wr-wash);border:1px solid var(--wr-line);border-radius:10px;padding:8px 10px;margin-top:2px}
.wr-ai{flex:0 0 auto;min-width:0}
.wr-ai[data-open=true]{flex:1 0 100%;display:flex;flex-direction:column;gap:8px;background:var(--wr-wash);border:1px solid var(--wr-line);border-radius:10px;padding:10px 12px;margin-top:2px}
.wr-ai-hint{font-size:11px;color:var(--wr-ink-mute);min-width:0}
.wr-ai-draft{margin:0;white-space:pre-wrap;font-size:13px;line-height:1.7;color:var(--wr-ink)}
.wr-ai-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wr-ai-running{font-size:12px;color:var(--wr-ink-soft)}
.wr-draft-export{background:var(--wr-surface);border:1px solid var(--wr-line);border-radius:12px;padding:10px 12px;max-height:260px;overflow:auto;margin-top:10px}
/* 初稿页：整篇删除收进「⋯」菜单，默认折叠，避免和「加这一段」挤在同一排误点。 */
.wr-draft-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wr-draft-head-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;flex:1}
.wr-draft-title{color:var(--wr-ink);font-weight:700}
.wr-draft-meta{font-size:11.5px;color:var(--wr-ink-mute);font-variant-numeric:tabular-nums}
.wr-menu{position:relative;display:inline-flex;flex:none}
.wr-menu-btn{min-width:64px;height:32px;padding:0 10px;font-size:14px;line-height:1}
.wr-menu-panel{position:absolute;right:0;top:calc(100% + 6px);z-index:10;min-width:210px;display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--wr-line);border-radius:10px;background:var(--wr-paper-soft);box-shadow:0 10px 26px color-mix(in srgb, var(--wr-ink) 16%, transparent)}
.wr-menu-danger{appearance:none;display:flex;align-items:center;min-height:44px;text-align:left;font:inherit;font-size:11.5px;line-height:1.5;padding:6px 9px;border-radius:8px;border:1px dashed var(--wr-clay);background:transparent;color:var(--wr-clay);cursor:pointer}
.wr-menu-danger[data-armed=true]{border-style:solid;background:color-mix(in srgb, var(--wr-clay) 14%, transparent);font-weight:600}
.wr-menu-cancel{appearance:none;text-align:left;font:inherit;font-size:11px;padding:4px 9px;border:0;background:transparent;color:var(--wr-ink-soft);cursor:pointer}
/* 次级按钮：比主操作小一号、浅底，用在浮层底部这类「顺手一下」的动作上。 */
.wr-btn-quiet{height:26px;font-size:11.5px;padding:0 10px;border:1px solid var(--wr-line);background:var(--wr-wash);color:var(--wr-ink-soft)}
.wr-btn-quiet:hover{color:var(--wr-ink);border-color:var(--wr-line-2)}
.wr-draft-preview{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.wr-draft-preview .wr-draft-export{margin-top:0}
.wr-empty-next{margin:6px auto 12px;max-width:440px;font-size:12px;line-height:1.65;color:var(--wr-ink-soft)}
.wr-notice-line{font-size:11.5px;color:var(--wr-ink-soft);margin:0 0 10px}
.wr-adopt-error{font-size:10.5px;color:var(--dsw-alias-state-error-primary);width:100%}
.wr-btn[data-active=true]{border-color:var(--wr-moss);color:var(--wr-moss)}
.wr-modal-body{display:flex;flex-direction:column;gap:10px;padding:4px 1px 8px;min-height:0;overflow:auto}
.wr-threads{margin:18px 0 0;padding:14px 16px;border:1px solid var(--wr-card-line);border-radius:var(--wr-radius);background:var(--wr-paper-soft)}
.wr-threads-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wr-threads-head strong{font-size:13.5px;color:var(--wr-ink)}
.wr-threads-coverage{font-size:11.5px;color:var(--wr-ink-soft)}
.wr-threads-meta{margin:6px 0 0;font-size:11px;color:var(--wr-ink-mute);display:flex;gap:10px;flex-wrap:wrap}
.wr-threads-stale{color:var(--wr-clay)}
.wr-threads-gate{margin:10px 0 0;font-size:12.5px;color:var(--wr-ink-soft);line-height:1.8}
.wr-threads-loading{display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:12px;color:var(--wr-ink-soft)}
.wr-threads-error{margin:10px 0 0;font-size:12px;color:var(--dsw-alias-state-error-primary);display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.wr-threads-notice{margin:8px 0 0;font-size:11.5px;color:var(--wr-moss)}
.wr-thread{display:flex;gap:10px;margin:12px 0 0;padding:10px 0 0;border-top:1px solid var(--wr-divider)}
.wr-thread-index{flex:none;width:20px;font-size:11px;color:var(--wr-ink-mute);padding-top:3px}
.wr-thread-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
.wr-thread-title{margin:0;font-size:13.5px;font-weight:600;color:var(--wr-ink);line-height:1.5}
.wr-thread-why{margin:0;font-size:12.5px;color:var(--wr-ink-soft);line-height:1.7}
.wr-thread-evidence{display:flex;flex-direction:column;gap:4px}
.wr-thread-record{appearance:none;text-align:left;background:none;border:1px solid var(--wr-line);border-radius:8px;padding:5px 8px;font:inherit;font-size:11.5px;color:var(--wr-ink-soft);cursor:pointer;line-height:1.6}
.wr-thread-record:hover{background:var(--wr-wash)}
.wr-thread-chapter{color:var(--wr-ink-mute)}
.wr-thread-link{margin:0;font-size:11.5px;color:var(--wr-moss);line-height:1.7}
.wr-thread-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
.wr-thread-suggest{margin:12px 0 0;padding-top:10px;border-top:1px dashed var(--wr-line-2)}
.wr-thread-suggest-title{margin:0 0 6px;font-size:11.5px;color:var(--wr-ink-mute)}
.wr-thread-suggest-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--wr-ink-soft);margin:0 0 6px}
.wr-threads-gaps{margin:12px 0 0;padding-top:10px;border-top:1px solid var(--wr-divider);font-size:11.5px;color:var(--wr-ink-mute);line-height:1.8}
.wr-threads-more{margin:10px 0 0}
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

    /* The writing side belongs to the study, but a record card needs exactly three
       things from it: somewhere to write, the craft snapshot, and a way back to what
       a source id names. A tiny bridge keeps RelateCard free of props it never uses. */
    const craftBridge = { write: null, craft: null }

// ---------------------------------------------------------------- relate
    // 「放回书里看」is one entry, one card, and one rule that cannot move: the model
    // may only name records we actually sent it. A made-up id is dropped before it
    // is rendered, because a chip that leads nowhere is worse than no chip.

    const RELATE_LIMIT = 12
    const RELATE_SAME_CHAPTER = 6
    const RELATION_LABELS = [
      ['呼应', 'relate.label.echo'],
      ['对照', 'relate.label.contrast'],
      ['个人回应', 'relate.label.mine'],
      ['待核实', 'relate.label.check'],
    ]
    /** One line = one candidate; anything else is prose the model wrote around it. */
    const RELATE_LINE = /^\[((?:note|thought|response):[^\]]+)\]\s*(.+)$/
    const RELATE_ASK = /^问[:：]\s*(.+)$/
    const RELATE_NONE = /(没找到|没有找到|未找到|没有可靠的关联|没有依据)/
    /** A bullet is decoration, not content: 「- [note:x] …」 still names a candidate. */
    const RELATE_BULLET = /^(?:[-*+•]|\d+[.)、])\s+/
    // The reply card floats over the panel: 600px wide, at most 84% of the viewport
    // or 760px, whichever is smaller. Height is never fixed — a short answer keeps
    // the card short, and a long one stops at the cap and scrolls inside.
    const RELATE_CARD_MAX = 760
    const RELATE_CARD_VH = 0.84
    const RELATE_CARD_MIN_WIDTH = 32

    const relateViewportHeight = () => {
      const view = typeof window !== 'undefined' ? window : null
      const height = view && Number(view.innerHeight) > 0 ? Number(view.innerHeight) : 0
      return height > 0 ? height : 900
    }

    /** The tallest the card may get on this viewport (px). */
    const relateCardCap = (viewportHeight) => {
      const height = Number(viewportHeight) > 0 ? Number(viewportHeight) : relateViewportHeight()
      return Math.min(Math.round(height * RELATE_CARD_VH), RELATE_CARD_MAX)
    }

    /**
     * How tall the card actually is, given its content: never taller than the cap,
     * never taller than the content itself (so a short answer does not leave a
     * half-empty sheet), and 0 when there is nothing to show.
     */
    const relateCardBox = (options) => {
      const input = options || {}
      const cap = relateCardCap(input.viewportHeight)
      const content = Number(input.contentHeight) > 0 ? Number(input.contentHeight) : 0
      const height = Math.min(content, cap)
      return { cap, height, capped: content > cap }
    }

    /** Sticky-to-bottom check: within 8px of the end still counts as 「at bottom」. */
    const relateAtBottom = (box) => {
      if (!box) return true
      const scrollHeight = Number(box.scrollHeight) || 0
      const scrollTop = Number(box.scrollTop) || 0
      const clientHeight = Number(box.clientHeight) || 0
      if (scrollHeight <= clientHeight) return true
      return scrollHeight - scrollTop - clientHeight <= 8
    }

    // Textareas that grow with what is typed. `field-sizing: content` is not in
    // every browser this panel runs in, so the row count is computed here and
    // handed to the textarea as `rows`; CSS caps the height at the same number.
    const TEXTAREA_MAX_ROWS = 6
    const TEXTAREA_CHARS_PER_ROW = 46

    /** How many visual rows a draft needs (explicit breaks + soft wraps). */
    const textareaRowsOf = (text) => {
      const value = String(text === undefined || text === null ? '' : text)
      if (value === '') return 1
      return value.split('\n').reduce((total, line) => {
        if (line === '') return total + 1
        return total + Math.max(1, Math.ceil(line.length / TEXTAREA_CHARS_PER_ROW))
      }, 0)
    }

    /** The `rows` attribute: one row to start, never more than six. */
    const textareaRows = (text) => Math.min(TEXTAREA_MAX_ROWS, Math.max(1, textareaRowsOf(text)))

    // The relate sheet's input is a one-liner that grows a little, not a box:
    // it starts at one row and stops at four, so the sheet stays compact.
    const RELATE_INPUT_MAX_ROWS = 4

    /** The relate input's `rows`: 1..4 depending on what is typed. */
    const relateInputRows = (text) => Math.min(RELATE_INPUT_MAX_ROWS, textareaRows(text))

    /** How many records the 「挂来源」picker offers at most. */
    const PICKER_LIMIT = 40

    /**
     * Is there a live text selection? On a touch screen a long press selects a
     * word before the click lands, and opening the editor would wipe that
     * selection — so the editor only opens when nothing is selected.
     */
    const hasTextSelection = () => {
      try {
        const selection = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null
        return Boolean(selection && String(selection.toString() || '') !== '')
      } catch (error) {
        return false
      }
    }

    /** Caret offset under a click, so the editor opens where the reader pointed. */
    const caretOffsetFromPoint = (element, point) => {
      if (!element) return 0
      const text = String(element.textContent || '')
      const x = point && typeof point.x === 'number' ? point.x : 0
      const y = point && typeof point.y === 'number' ? point.y : 0
      if (x === 0 && y === 0) return text.length
      try {
        const doc = element.ownerDocument || (typeof document !== 'undefined' ? document : null)
        if (!doc) return text.length
        let node = null
        let offset = 0
        if (typeof doc.caretRangeFromPoint === 'function') {
          const range = doc.caretRangeFromPoint(x, y)
          if (range) {
            node = range.startContainer
            offset = range.startOffset
          }
        } else if (typeof doc.caretPositionFromPoint === 'function') {
          const position = doc.caretPositionFromPoint(x, y)
          if (position) {
            node = position.offsetNode
            offset = position.offset
          }
        }
        if (!node || !element.contains(node)) return text.length
        const prefix = doc.createRange()
        prefix.selectNodeContents(element)
        prefix.setEnd(node, offset)
        return String(prefix.toString() || '').length
      } catch (error) {
        return text.length
      }
    }

    /**
     * The records a paragraph may cite: this book's highlights, thoughts and
     * the replies the reader kept. Materials used to feed this list, but that
     * shelf is gone — so the list is built from what the reader actually has.
     * With no book in scope every book is fair game, newest first.
     */
    function sourcePoolOf(data, craft, bookId) {
      const wanted = String(bookId || '')
      const source = data || {}
      const rows = []
      const push = (kind, item, chapter, text, at, book) => {
        if (!item || item.id === undefined || item.id === null) return
        if (wanted !== '' && String(book || '') !== wanted) return
        const body = clip(String(text || '').replace(/\s+/g, ' ').trim(), 72)
        if (body === '') return
        rows.push({
          sourceId: `${kind}:${String(item.id)}`,
          kind,
          chapter: String(chapter || ''),
          text: body,
          at: Number(at) || 0,
        })
      }
      const notes = Array.isArray(source.notes) ? source.notes : []
      notes.forEach((note) => push('note', note, note.chapterTitle, note.text, note.createTime, note.bookId))
      const thoughts = Array.isArray(source.thoughts) ? source.thoughts : []
      thoughts.forEach((thought) => push('thought', thought, thought.chapterName, thought.content, thought.createTime, thought.bookId))
      const kept = craft && Array.isArray(craft.responses) ? craft.responses : []
      kept.forEach((response) => push('response', response, '', response.text, response.adoptedAt || response.createdAt, response.bookId))
      return rows.sort((left, right) => right.at - left.at).slice(0, PICKER_LIMIT)
    }

    /** What the record cards need from the study (book list, craft snapshot, jumps). */
    const relateBridge = { data: {}, craft: null, lookup: null, openSource: null }

    /** One record's id, as a string, even when the source omitted it. */
    function relateIdOf(entry) {
      const value = entry && entry.id !== undefined && entry.id !== null ? entry.id : ''
      return String(value)
    }

    function relationLabelKey(label) {
      const hit = RELATION_LABELS.find((item) => item[0] === label)
      return hit ? hit[1] : ''
    }

    /** Unknown labels are read back as 「对照」: the store stays authoritative on write. */
    function normalizeRelationLabel(label) {
      const name = String(label || '')
      return relationLabelKey(name) === '' ? '对照' : name
    }

    function relateChapterOf(entry, kind) {
      return String((kind === 'note' ? entry.chapterTitle : entry.chapterName) || '')
    }

    /**
     * The only records the model is allowed to name: same book, not the one you are
     * standing on, same chapter first, then the newest up to twelve. The ids in this
     * list are the whole validation set — nothing outside it may reach the screen.
     */
    function relateCandidates(input) {
      const entry = (input && input.entry) || {}
      const kind = input && input.kind === 'thought' ? 'thought' : 'note'
      const data = (input && input.data) || {}
      const craft = (input && input.craft) || {}
      const bookId = String(entry.bookId || '')
      if (bookId === '') return []
      const own = `${kind}:${relateIdOf(entry)}`
      const chapter = relateChapterOf(entry, kind)
      const rows = []
      const add = (row) => {
        if (row.id === own || row.text === '') return
        rows.push(row)
      }
      for (const note of data.notes || []) {
        if (String(note.bookId || '') !== bookId) continue
        add({
          id: `note:${String(note.id)}`,
          kind: 'note',
          rawId: String(note.id),
          text: String(note.text || ''),
          chapter: String(note.chapterTitle || ''),
          time: Number(note.createTime) || 0,
        })
      }
      for (const thought of data.thoughts || []) {
        if (String(thought.bookId || '') !== bookId) continue
        add({
          id: `thought:${String(thought.id)}`,
          kind: 'thought',
          rawId: String(thought.id),
          text: String(thought.content || ''),
          chapter: String(thought.chapterName || ''),
          time: Number(thought.createTime) || 0,
        })
      }
      for (const item of craft.responses || []) {
        if (String(item.bookId || '') !== bookId) continue
        add({
          id: `response:${String(item.id)}`,
          kind: 'response',
          rawId: String(item.id),
          text: String(item.text || ''),
          chapter: '',
          time: Number(item.adoptedAt || item.createdAt) || 0,
        })
      }
      const newest = (left, right) => right.time - left.time
      const same = chapter === '' ? [] : rows.filter((row) => row.chapter !== '' && row.chapter === chapter).sort(newest).slice(0, RELATE_SAME_CHAPTER)
      const taken = new Set(same.map((row) => row.id))
      const rest = rows.filter((row) => !taken.has(row.id)).sort(newest)
      return same.concat(rest).slice(0, RELATE_LIMIT)
    }

    /**
     * §4.2 in one place: a paragraph the reader could have typed, the numbered
     * candidates, and the one line that is actually the question. The narrative goes
     * in `pack`, the question in `question`, so the host prompt stays a normal turn.
     */
    function buildRelateAsk(input) {
      const entry = (input && input.entry) || {}
      const kind = input && input.kind === 'thought' ? 'thought' : 'note'
      const candidates = Array.isArray(input && input.candidates) ? input.candidates : []
      const data = (input && input.data) || {}
      const asked = String((input && input.question) || '').trim()
      const bookId = String(entry.bookId || '')
      const book = (data.books || []).find((item) => String(item.bookId) === bookId) || null
      const title = String(entry.bookTitle || (book && book.title) || '').trim()
      const author = String(entry.author || (book && book.author) || '').trim()
      const chapter = relateChapterOf(entry, kind)
      const when = fmtDate(entry.createTime)
      const body = String((kind === 'thought' ? entry.content : entry.text) || '').trim()
      const lines = [
        t('relate.packHead', {
          title: title === '' ? t('think.packUnknown') : `《${title}》`,
          author: author === '' ? '—' : author,
        }),
      ]
      lines.push(
        t(kind === 'thought' ? 'relate.packThought' : 'relate.packNote', {
          date: when,
          chapter: chapter === '' ? '—' : chapter,
        }),
      )
      lines.push(kind === 'note' ? `> ${clip(body, 600)}` : clip(body, 600))
      if (candidates.length > 0) {
        lines.push('')
        lines.push(t('relate.packList'))
        for (const row of candidates) {
          lines.push(
            t('relate.packLine', {
              id: row.id,
              date: fmtDate(row.time),
              chapter: row.chapter === '' ? '—' : row.chapter,
              text: clip(row.text, 120),
            }),
          )
        }
      }
      lines.push('')
      lines.push(t('relate.packRule'))
      lines.push(t('relate.packFollowRule'))
      return {
        pack: lines.join('\n'),
        question: asked === ''
          ? t('relate.packDefault', { this: t(kind === 'thought' ? 'relate.thisThought' : 'relate.thisNote') })
          : t('relate.packWant', { question: asked }),
      }
    }

    /**
     * Parsing is where the guarantee lives: a `[id]` line whose id is not in the set
     * we sent is dropped here, so it can neither be rendered nor be saved as a
     * relation. Everything shown around a row (chapter, date, text) comes from the
     * local candidate, never from what the model said about it.
     */
    function parseRelateAnswer(text, candidates) {
      const table = new Map((Array.isArray(candidates) ? candidates : []).map((row) => [row.id, row]))
      const rows = []
      const asks = []
      const prose = []
      let saidNone = false
      for (const raw of String(text || '').split(/\r?\n/)) {
        const trimmed = String(raw || '').trim()
        if (trimmed === '') continue
        // L1: models like to number their picks (「- [note:x] …」 / 「1. [note:x] …」).
        // Drop that marker first, or the whole line falls through to prose and the
        // candidate looks like it was never found.
        const line = trimmed.replace(RELATE_BULLET, '')
        if (line === '') continue
        const ask = line.match(RELATE_ASK)
        if (ask) {
          asks.push(String(ask[1]).trim())
          continue
        }
        const hit = line.match(RELATE_LINE)
        if (hit) {
          const id = String(hit[1]).trim()
          if (!table.has(id)) continue
          if (rows.some((row) => row.id === id)) continue
          rows.push({ id, why: clip(String(hit[2]).trim(), 60), candidate: table.get(id) })
          continue
        }
        if (RELATE_NONE.test(line)) saidNone = true
        prose.push(line)
      }
      return {
        rows,
        asks: asks.slice(0, 2),
        prose: prose.join('\n').trim(),
        none: rows.length === 0 && (saidNone || String(text || '').trim() !== ''),
      }
    }

    /** The relation already stored for one end of this record, if any. */
    function storedRelation(relations, ownId, sourceId) {
      const ends = (rel) => [rel.from, rel.to].map((item) => (item ? `${item.kind}:${item.id}` : ''))
      return (
        (Array.isArray(relations) ? relations : []).find((rel) => {
          const pair = ends(rel || {})
          return pair.includes(ownId) && pair.includes(sourceId)
        }) || null
      )
    }

    function RelateCard(props) {
      const entry = props.entry || {}
      const kind = props.kind === 'thought' ? 'thought' : 'note'
      const store = craftBridge.craft || EMPTY_CRAFT
      const data = relateBridge.data || {}
      const relations = Array.isArray(store.relations) ? store.relations : []
      const ownId = `${kind}:${relateIdOf(entry)}`
      const bookId = String(entry.bookId || '')
      const book = String(entry.bookTitle || '') || bookTitleOf(bookId, data, store)
      const chapter = relateChapterOf(entry, kind)
      const [draft, setDraft] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [answer, setAnswer] = useState('')
      const [kept, setKept] = useState('')
      const [saved, setSaved] = useState({})
      const [rowBusy, setRowBusy] = useState('')
      const [rowError, setRowError] = useState('')
      const [stuck, setStuck] = useState(false)
      const abortRef = useRef(null)
      const turnsRef = useRef([])
      const lastQuestionRef = useRef('')
      const bodyRef = useRef(null)
      const inputRef = useRef(null)
      // Closed it is mounted but renders nothing, so the kept answer, the rows and
      // the saved labels survive a close/reopen instead of starting over.
      const open = props.open === undefined ? true : Boolean(props.open)

      const candidates = useMemo(
        () => relateCandidates({ entry, kind, data, craft: store }),
        [entry, kind, data, store],
      )
      const tooFew = candidates.length === 0
      const noBook = bookId === ''
      const parsed = parseRelateAnswer(answer, candidates)
      // Only an answer with something in it can become a thought.
      const canKeep = answer !== '' && (parsed.prose !== '' || parsed.rows.length > 0)

      const stop = (event) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
      }

      const close = () => {
        if (abortRef.current && typeof abortRef.current.abort === 'function') abortRef.current.abort()
        if (typeof props.onToggle === 'function') props.onToggle(false)
      }

      // Leaving the card stops the request: an answer nobody sees must not keep
      // running, and nothing is written when it stops.
      useEffect(() => () => {
        if (abortRef.current && typeof abortRef.current.abort === 'function') abortRef.current.abort()
      }, [])

      // Typing should work the moment the sheet opens, without a second click.
      useEffect(() => {
        const field = inputRef.current
        if (!open || !field || typeof field.focus !== 'function') return
        field.focus()
      }, [open])

      // Follow the stream while the reader is still at the bottom; once they scroll
      // up we stop moving the viewport and offer 「回到底部」 instead.
      useEffect(() => {
        const box = bodyRef.current
        if (!open || !box || stuck) return
        if (typeof box.scrollHeight !== 'number') return
        box.scrollTop = box.scrollHeight
      }, [answer, busy, open, stuck])

      const onBodyScroll = (event) => {
        const box = event && event.target ? event.target : null
        if (!box) return
        setStuck(!relateAtBottom(box))
      }

      const jumpToBottom = () => {
        const box = bodyRef.current
        if (box && typeof box.scrollHeight === 'number') box.scrollTop = box.scrollHeight
        setStuck(false)
      }

      const run = (raw) => {
        const question = String(raw || '').trim()
        if (busy || noBook || tooFew) return
        const ask = buildRelateAsk({ entry, kind, question, candidates, data })
        lastQuestionRef.current = question
        setDraft(question)
        setError('')
        setKept('')
        setBusy(true)
        setAnswer('')
        let text = ''
        const controller = typeof AbortController === 'function' ? new AbortController() : null
        abortRef.current = controller
        streamChat(
          { pack: ask.pack, question: ask.question, mode: 'relate', history: turnsRef.current.slice(-6) },
          (event) => {
            if (!event) return
            if (event.type === 'text') {
              text += event.text
              setAnswer(text)
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
            if (text !== '') turnsRef.current = turnsRef.current.concat([{ question: ask.question, answer: text }]).slice(-6)
          })
      }

      const rawIdOf = (sourceId) => {
        const kindOf = sourceKind(sourceId)
        return kindOf === '' ? '' : sourceRawId(sourceId)
      }

      const savedOf = (sourceId) => {
        const local = saved[sourceId]
        if (local) return local
        const found = storedRelation(relations, ownId, sourceId)
        return found ? { id: found.id, label: normalizeRelationLabel(found.label) } : null
      }

      const write = (op, payload) => {
        const writeFn = craftBridge.write
        if (typeof writeFn !== 'function') return Promise.reject(new Error(t('craft.offline')))
        return writeFn(op, payload)
      }

      const saveRelation = (row, label) => {
        const current = savedOf(row.id)
        setRowBusy(row.id)
        setRowError('')
        const done = (result) => {
          setRowBusy('')
          if (result && result.dropped) {
            setRowError(t('relate.saveFailed', { error: t('relate.dropped') }))
            return
          }
          const created = result && result.created && result.created.relation ? result.created.relation : null
          const id = created && created.id ? String(created.id) : current ? current.id : ''
          if (id === '') {
            setRowError(t('relate.saveFailed', { error: t('craft.failed') }))
            return
          }
          setSaved((prev) => Object.assign({}, prev, { [row.id]: { id, label } }))
        }
        const fail = (thrown) => {
          setRowBusy('')
          setRowError(t('relate.saveFailed', { error: thrown && thrown.message ? thrown.message : String(thrown) }))
        }
        if (current) {
          write('relation.update', { id: current.id, label }).then(done).catch(fail)
          return
        }
        write('relation.add', {
          from: { kind, id: relateIdOf(entry) },
          to: { kind: row.candidate.kind, id: rawIdOf(row.candidate.id) },
          label,
          reason: row.why,
          bookId: bookId === '' ? undefined : bookId,
          origin: 'ai',
        }).then(done).catch(fail)
      }

      const dropRelation = (row) => {
        const current = savedOf(row.id)
        if (!current) return
        setRowBusy(row.id)
        setRowError('')
        write('relation.delete', { id: current.id })
          .then(() => {
            setRowBusy('')
            setSaved((prev) => {
              const next = Object.assign({}, prev)
              delete next[row.id]
              return next
            })
          })
          .catch((thrown) => {
            setRowBusy('')
            setRowError(t('relate.saveFailed', { error: thrown && thrown.message ? thrown.message : String(thrown) }))
          })
      }

      const keepThought = () => {
        const text = parsed.prose !== '' ? parsed.prose : parsed.rows.map((row) => row.why).join('；')
        if (text === '') return
        setRowBusy('keep')
        setRowError('')
        write('response.add', {
          text: clip(text, 600),
          sourceIds: [ownId],
          bookId: bookId === '' ? undefined : bookId,
          containsAI: true,
          origin: 'think',
        })
          .then(() => {
            setRowBusy('')
            setKept('thought')
          })
          .catch((thrown) => {
            setRowBusy('')
            setRowError(t('relate.saveFailed', { error: thrown && thrown.message ? thrown.message : String(thrown) }))
          })
      }

      const jump = (sourceId) => {
        const open = relateBridge.openSource
        if (typeof open === 'function') open(sourceId)
      }

      const summary = [
        t(kind === 'thought' ? 'relate.thisThought' : 'relate.thisNote'),
        fmtDate(entry.createTime),
        chapter === '' ? '' : `《${chapter}》`,
      ].filter((item) => item !== '').join(' · ')

      const rowsView = parsed.rows.map((row) => {
        const current = savedOf(row.id)
        const candidate = row.candidate || null
        // L3: holding a candidate payload is not the same as the record still being
        // here. Both ends have to resolve through lookup, or the chip becomes a
        // button that does nothing when pressed — a missing record says so instead.
        const known = candidate !== null && craftSourceHit(row.id, relateBridge.lookup || {}) !== null
        const whenText = candidate === null
          ? ''
          : [fmtDate(candidate.time), candidate.chapter === '' ? '' : `《${candidate.chapter}》`].filter((item) => item !== '').join(' · ')
        return h(
          'div',
          { className: 'wr-relate-item', key: row.id, 'data-missing': known ? 'false' : 'true' },
          h(
            'div',
            { className: 'wr-relate-meta' },
            known
              ? h(
                  'button',
                  {
                    className: 'wr-relate-chip',
                    type: 'button',
                    title: row.id,
                    onClick: (event) => {
                      stop(event)
                      jump(row.id)
                    },
                  },
                  row.id,
                )
              : h('span', { className: 'wr-relate-chip', 'data-missing': 'true', title: row.id }, `${row.id} · ${t('mat.status.missing')}`),
            whenText === '' ? null : h('span', { className: 'wr-relate-when' }, whenText),
          ),
          h('p', { className: 'wr-relate-text' }, clip(candidate === null ? '' : candidate.text, 90)),
          h('p', { className: 'wr-relate-why' }, `${t('relate.why')}${row.why}`),
          h(
            'div',
            { className: 'wr-relate-labels' },
            RELATION_LABELS.map(([label, key]) =>
              h(
                'button',
                {
                  className: 'wr-relate-label',
                  key,
                  type: 'button',
                  'data-on': current && current.label === label ? 'true' : 'false',
                  disabled: rowBusy !== '',
                  onClick: (event) => {
                    stop(event)
                    saveRelation(row, label)
                  },
                },
                t(key),
              ),
            ),
            current
              ? h(
                  'button',
                  {
                    className: 'wr-relate-label',
                    type: 'button',
                    disabled: rowBusy !== '',
                    onClick: (event) => {
                      stop(event)
                      dropRelation(row)
                    },
                  },
                  t('relate.remove'),
                )
              : null,
            current ? h('span', { className: 'wr-relate-saved' }, t('relate.saved')) : null,
          ),
        )
      })

      const resultView = answer === ''
        ? null
        : h(
            'div',
            { className: 'wr-relate-list' },
            parsed.prose === '' ? null : h('p', { className: 'wr-relate-answer' }, parsed.prose),
            parsed.rows.length === 0
              ? h(
                  'div',
                  null,
                  h('p', { className: 'wr-relate-answer' }, t('relate.none')),
                  h(
                    'p',
                    { className: 'wr-relate-why' },
                    chapter === '' ? t('relate.noneNoChapter') : t('relate.noneHint', { chapter }),
                  ),
                )
              : h('div', { className: 'wr-relate-list' }, h('p', { className: 'wr-relate-title' }, t('relate.together')), rowsView),
          )

      const asksView = parsed.asks.length === 0 || busy
        ? null
        : h(
            'div',
            { className: 'wr-relate-asks' },
            h('p', { className: 'wr-relate-title' }, t('relate.followup')),
            parsed.asks.map((text, index) =>
              h(
                'button',
                {
                  className: 'wr-relate-ask',
                  key: `${index}-${text}`,
                  type: 'button',
                  onClick: (event) => {
                    stop(event)
                    run(text)
                  },
                },
                `${t('relate.askPrefix')}${text}`,
              ),
            ),
          )

if (!open) return null

      const cap = relateCardCap(relateViewportHeight())

      return h(
        'div',
        {
          className: 'wr-relate-modal',
          role: 'dialog',
          'aria-modal': 'true',
          'data-backdrop': 'true',
          onClick: (event) => {
            const target = event && event.target ? event.target : null
            const current = event && event.currentTarget ? event.currentTarget : null
            // Only the backdrop closes: a click that started inside the card must not.
            if (target !== null && current !== null && target !== current) return
            stop(event)
            close()
          },
          onKeyDown: (event) => {
            if (event && event.key === 'Escape') {
              stop(event)
              close()
            }
          },
        },
        h(
          'div',
          {
            className: 'wr-relate-card',
            'data-kind': kind,
            style: { maxHeight: `${cap}px` },
            onClick: stop,
          },
          h(
            'div',
            { className: 'wr-relate-head' },
            h('span', { className: 'wr-relate-kind' }, t(kind === 'thought' ? 'src.thought' : 'src.note')),
            h('strong', { className: 'wr-relate-book', title: book }, book === '' ? t('think.packUnknown') : `《${book}》`),
            h(
              'button',
              {
                className: 'wr-relate-close',
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
          // The scrolling part: it takes whatever height is left and never grows
          // past the card, so a long answer stays inside the sheet.
          h(
            'div',
            { className: 'wr-relate-body', ref: bodyRef, onScroll: onBodyScroll },
            h('p', { className: 'wr-relate-summary' }, summary),
            noBook ? h('p', { className: 'wr-relate-offline' }, t('relate.noBook')) : null,
            tooFew && !noBook ? h('p', { className: 'wr-relate-offline' }, t('relate.tooFew')) : null,
            busy && answer === '' ? h('p', { className: 'wr-relate-offline' }, t('relate.thinking')) : null,
            resultView,
            asksView,
            error === ''
              ? null
              : h(
                  'div',
                  { className: 'wr-relate-error' },
                  `${t('error.prefix')}${error}`,
                  h(
                    'button',
                    {
                      className: 'wr-relate-ask',
                      type: 'button',
                      disabled: busy,
                      onClick: (event) => {
                        stop(event)
                        run(lastQuestionRef.current)
                      },
                    },
                    t('think.retry'),
                  ),
                ),
          ),
          // One row for the input, one row for the actions: the send button leads
          // that row and the follow-ups sit on the right, never on the textarea.
          noBook || tooFew
            ? null
            : h(
                'div',
                { className: 'wr-relate-compose' },
                stuck
                  ? h(
                      'button',
                      {
                        className: 'wr-relate-jump',
                        type: 'button',
                        onClick: (event) => {
                          stop(event)
                          jumpToBottom()
                        },
                      },
                      t('relate.toBottom'),
                    )
                  : null,
                h('textarea', {
                  className: 'wr-relate-input',
                  ref: inputRef,
                  rows: relateInputRows(draft),
                  value: draft,
                  placeholder: t('relate.placeholder'),
                  disabled: busy,
                  onChange: (event) => setDraft(event ? String(event.target.value || '') : ''),
                  onKeyDown: (event) => {
                    if (!event || event.key !== 'Enter' || event.shiftKey) return
                    stop(event)
                    run(draft)
                  },
                }),
              ),
          h(
            'div',
            { className: 'wr-relate-foot' },
            kept === ''
              ? null
              : h('span', { className: 'wr-relate-notice' }, `${t('relate.kept')} · ${t('nav.responses')}`),
            rowError === '' ? null : h('span', { className: 'wr-relate-error' }, rowError),
            h(
              'div',
              { className: 'wr-relate-actions' },
              noBook || tooFew
                ? null
                : h(
                    'button',
                    {
                      className: 'wr-relate-send',
                      type: 'button',
                      disabled: busy,
                      onClick: (event) => {
                        stop(event)
                        run(draft)
                      },
                    },
                    busy ? t('relate.thinking') : t('relate.send'),
                  ),
              h('span', { className: 'wr-relate-spacer' }),
              // Nothing to keep means nothing to show: a dead grey button is noise.
              canKeep
                ? h(
                    'button',
                    {
                      // Secondary weight on purpose: keeping a thought and closing
                      // the card are follow-ups, not the send action.
                      className: 'wr-btn wr-btn-ghost wr-btn-quiet',
                      type: 'button',
                      disabled: rowBusy !== '',
                      onClick: (event) => {
                        stop(event)
                        keepThought()
                      },
                    },
                    t('relate.keepThought'),
                  )
                : null,
              h(
                'button',
                {
                  className: 'wr-btn wr-btn-ghost wr-btn-quiet',
                  type: 'button',
                  onClick: (event) => {
                    stop(event)
                    close()
                  },
                },
                t('relate.collapse'),
              ),
            ),
          ),
        ),
      )
    }

    /** The one entry a record card shows: 「放回书里看」, and then the card in place. */
    function RelateBar(props) {
      const entry = props.entry || {}
      const kind = props.kind === 'thought' ? 'thought' : 'note'
      const open = Boolean(props.open)
      const stop = (event) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
      }
      return h(
        'div',
        // data-in-tail: the entry is rendered inside the card's right-hand group
        // (see the call sites), so tests can tell it apart from the old layout.
        { className: 'wr-relate', 'data-open': open ? 'true' : 'false', 'data-in-tail': props.inTail ? 'true' : 'false' },
        h(
          'div',
          { className: 'wr-relate-row' },
          open
            ? null
            : h(
                'button',
                {
                  className: 'wr-relate-go',
                  type: 'button',
                  onClick: (event) => {
                    stop(event)
                    if (typeof props.onToggle === 'function') props.onToggle(true)
                  },
                },
                t('nav.relate'),
              ),
        ),
        // Mounted from the first open on, hidden when closed: the kept answer and the
        // saved labels must survive a close/reopen instead of starting over.
        h(RelateCard, {
          entry,
          kind,
          open,
          onToggle: (next) => {
            if (typeof props.onToggle === 'function') props.onToggle(next)
          },
        }),
      )
    }

    function NoteRow(props) {
      const note = props.note
      const open = typeof props.onOpen === 'function' ? props.onOpen : null
      const pick = typeof props.onToggle === 'function' ? h(PickButton, { on: Boolean(props.selected), onChange: props.onToggle }) : null
      // The relate sheet is a layer of its own now, so the card keeps its size.
      const [relate, setRelate] = useState(false)
      return h(
        'div',
        { className: 'wr-quote', 'data-focus': props.focus ? 'true' : 'false', 'data-clickable': open ? 'true' : 'false', 'data-picked': props.selected ? 'true' : 'false', title: open ? t('action.openBook') : undefined, onClick: open || undefined },
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
            h(RelateBar, { entry: note, kind: 'note', open: relate, onToggle: setRelate, inTail: true }),
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
      const [relate, setRelate] = useState(false)
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
        h(
          'div',
          { className: 'wr-quote-foot' },
          h('span', { className: 'wr-quote-book', title: thought.bookTitle }, thought.bookTitle || ''),
          thought.chapterName ? h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, `· ${thought.chapterName}`) : null,
          h(
            'div',
            { className: 'wr-quote-tail' },
            h(RelateBar, { entry: thought, kind: 'thought', open: relate, onToggle: setRelate, inTail: true }),
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
                { className: 'wr-thread-pop' },
                h(
                  'div',
                  { className: 'wr-thread-pop-head' },
                  h('span', { className: 'wr-thread-pop-title' }, t('thought.contextTitle')),
                  h(
                    'button',
                    {
                      className: 'wr-thread-pop-close',
                      type: 'button',
                      'aria-label': t('action.dismiss'),
                      onClick: (event) => {
                        if (event && typeof event.stopPropagation === 'function') event.stopPropagation()
                        setThreadOpen(false)
                      },
                    },
                    '×',
                  ),
                ),
                h(
                  'div',
                  { className: 'wr-thread-pop-body' },
                  slice.map((note) =>
                    h(
                      'div',
                      { className: 'wr-thread-item', key: note.id },
                      h('p', { className: 'wr-thread-quote' }, String(note.text || '').slice(0, 300)),
                      note.chapterTitle ? h('span', { className: 'wr-thread-chapter' }, `《${note.chapterTitle}》`) : null,
                    )),
                ),
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
      // 1.2.2 §5.1: the material basket and the topic board left the interface. The
      // data and the host routes stay (old works still cite materials), so nothing is
      // lost — but CREATE now has exactly one page.
      create: [['works', 'nav.works']],
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
          // 1.2.2 §5.6: materials left the interface, so their chips are plain text
          // that says so, and stay that way even where other chips can be clicked.
          if (kind === 'material') {
            return h(
              'span',
              { className: 'wr-src', key: id, 'data-kind': 'material', 'data-retired': 'true', title: t('src.materialRetired') },
              label,
            )
          }
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

    /** A craft page's own title line: the page name, then one plain sentence. */
    function PageHead(props) {
      const count = String(props.countText || '')
      const scope = String(props.scopeTitle || '')
      return h(
        'div',
        { className: 'wr-page-head' },
        h('h2', { className: 'wr-page-title' }, t(props.titleKey)),
        // The book scope used to ride in the second navigation row; single-destination
        // pages have no such row, so it rides here and still clears with one click.
        scope === ''
          ? null
          : h(
              'button',
              {
                className: 'wr-chip',
                type: 'button',
                'data-active': 'true',
                onClick: props.onClearScope,
                title: scope,
              },
              t('thinkView.backBook', { title: clip(scope, 14) }),
            ),
        String(props.hintKey || '') === '' ? null : h('span', { className: 'wr-page-hint' }, t(props.hintKey)),
        count === '' ? null : h('span', { className: 'wr-page-count' }, count),
      )
    }

    function SubNav(props) {
      const stage = VIEW_STAGE[props.view] || 'read'
      const views = STAGE_VIEWS[stage] || STAGE_VIEWS.read
      const scope = String(props.scopeTitle || '')
      // One destination is not a navigation row: THINK has only the replies and
      // CREATE only the drafts, so their titles live in the page head instead.
      if (views.length <= 1) return null
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
        // Stages with several destinations carry their one-liner here; the title
        // line of a single-destination page would otherwise repeat it.
        h('span', { className: 'wr-subnav-hint' }, t(`journey.${stage}.hint`)),
      )
    }

    /** F-19: the four steps of one book that still have a page, counted where the data lives. */
/* ---------------------------------------------------------------- threads
       1.2.2「我的阅读脉络」：一本书读完以后回头看的整体形状，不是「这条能和什么
       一起看」。证据只走已经确认过的对照关系（threads 里存的是 relationIds），
       正文 / 章节 / 日期一律在本机渲染，模型只给标题、理由和「这两条该放一起」
       这样的建议。 */

    const THREAD_LIMIT = 5
    const THREAD_SUGGEST_LIMIT = 3
    const THREAD_EMPTY_TITLE = /^(关于.{1,20}的(思考|感想|体会|梳理)|.{1,20}的(几点|一些)(思考|体会|感想)|浅析|浅谈)/

    function threadChapterOf(entry) {
      const value = entry && (entry.chapterTitle || entry.chapterName)
      return String(value || '').trim()
    }

    function threadRecordText(entry, kind) {
      if (!entry) return ''
      if (kind === 'thought') return String(entry.content || '')
      return String(entry.text || '')
    }

    /** Everything this book has, split by the shape each store uses. */
    function threadBookPool(data, craft, bookId) {
      const id = String(bookId || '')
      const ofBook = (item) => String((item && item.bookId) || '') === id
      return {
        notes: (Array.isArray(data && data.notes) ? data.notes : []).filter(ofBook),
        thoughts: (Array.isArray(data && data.thoughts) ? data.thoughts : []).filter(ofBook),
        responses: (Array.isArray(craft && craft.responses) ? craft.responses : []).filter(ofBook),
        relations: (Array.isArray(craft && craft.relations) ? craft.relations : []).filter(ofBook),
      }
    }

    function threadChapters(pool) {
      const chapters = []
      const add = (value) => {
        const text = String(value || '').trim()
        if (text !== '' && chapters.indexOf(text) === -1) chapters.push(text)
      }
      ;(pool.notes || []).forEach((note) => add(threadChapterOf(note)))
      ;(pool.thoughts || []).forEach((thought) => add(threadChapterOf(thought)))
      return chapters
    }

    function threadRecordMap(pool) {
      const map = new Map()
      for (const note of pool.notes || []) map.set(`note:${note.id}`, { kind: 'note', item: note })
      for (const thought of pool.thoughts || []) map.set(`thought:${thought.id}`, { kind: 'thought', item: thought })
      for (const response of pool.responses || []) map.set(`response:${response.id}`, { kind: 'response', item: response })
      return map
    }

    /**
     * One natural-language pack: the whole book by chapter, plus the edges the
     * reader already confirmed. The closing instruction is what makes a first run
     * possible on a book with no edges yet — the model may *propose* a pair, but
     * nothing is written until the reader taps 采纳.
     */
    function buildThreadsPack(input) {
      const book = (input && input.book) || {}
      const pool = (input && input.pool) || { notes: [], thoughts: [], responses: [], relations: [] }
      const chapters = threadChapters(pool)
      const lines = []
      lines.push(
        t('thread.packHead', {
          title: String(book.title || '') || '—',
          author: String(book.author || '') || '—',
          chapters: chapters.length,
          notes: (pool.notes || []).length,
          thoughts: (pool.thoughts || []).length,
          responses: (pool.responses || []).length,
        }),
      )
      lines.push('')
      if ((pool.notes || []).length > 0) {
        lines.push(t('thread.packNotes'))
        for (const note of pool.notes.slice(0, 40)) {
          lines.push(`- (note:${note.id}) ${fmtDate(note.createTime)}《${threadChapterOf(note) || t('thread.noChapter')}》：${clip(note.text, 120)}`)
        }
        if (pool.notes.length > 40) lines.push(t('thread.packCut', { count: pool.notes.length - 40 }))
        lines.push('')
      }
      if ((pool.thoughts || []).length > 0) {
        lines.push(t('thread.packThoughts'))
        for (const thought of pool.thoughts.slice(0, 24)) {
          lines.push(`- (thought:${thought.id}) ${fmtDate(thought.createTime)}《${threadChapterOf(thought) || t('thread.noChapter')}》：${clip(thought.content, 120)}`)
        }
        if (pool.thoughts.length > 24) lines.push(t('thread.packCut', { count: pool.thoughts.length - 24 }))
        lines.push('')
      }
      if ((pool.responses || []).length > 0) {
        lines.push(t('thread.packResponses'))
        for (const response of pool.responses.slice(0, 12)) {
          lines.push(`- (response:${response.id}) ${fmtDate(response.adoptedAt)}：${clip(response.text, 120)}`)
        }
        lines.push('')
      }
      if ((pool.relations || []).length > 0) {
        lines.push(t('thread.packRelations'))
        for (const relation of pool.relations.slice(0, 40)) {
          lines.push(`- (${relation.id}) ${relation.from.id} ↔ ${relation.to.id}【${relation.label}】${clip(relation.reason, 100)}`)
        }
        lines.push('')
      }
      lines.push(t('thread.packRule'))
      lines.push((pool.relations || []).length > 0 ? t('thread.packSuggest') : t('thread.packSuggestOnly'))
      lines.push(t('thread.packJson'))
      return lines.join('\n')
    }

    /** The model answers with JSON only; a half frame is not worth rendering. */
    function parseThreadsAnswer(text) {
      const source = String(text || '')
      const start = source.indexOf('{')
      const end = source.lastIndexOf('}')
      if (start === -1 || end <= start) return { ok: false, threads: [] }
      let parsed = null
      try {
        parsed = JSON.parse(source.slice(start, end + 1))
      } catch {
        return { ok: false, threads: [] }
      }
      const list = Array.isArray(parsed && parsed.threads) ? parsed.threads : []
      const threads = []
      for (const raw of list) {
        const item = raw && typeof raw === 'object' ? raw : {}
        const relations = (Array.isArray(item.relations) ? item.relations : [])
          .map((id) => String(id || '').trim())
          .filter((id) => id !== '')
        const suggest = (Array.isArray(item.suggest) ? item.suggest : [])
          .map((pair) => (Array.isArray(pair) ? [String(pair[0] || '').trim(), String(pair[1] || '').trim()] : null))
          .filter((pair) => pair !== null && pair[0] !== '' && pair[1] !== '' && pair[0] !== pair[1])
        threads.push({ title: String(item.title || '').trim(), why: String(item.why || '').trim(), relations, suggest })
      }
      return { ok: true, threads }
    }

    /**
     * 渲染前校验（与「放回书里看」同一条纪律）：relation 编号必须在本书已存的
     * 对照里，建议对的两端必须在本次 pack 的记录里；一条证据都没有的线索整条
     * 丢弃，空标题（「关于…的思考」这类）也丢弃。超过 5 条先截断并告知。
     */
    function validateThreads(input, pool) {
      const relationIds = new Set((pool.relations || []).map((item) => String(item.id)))
      const records = new Set()
      for (const note of pool.notes || []) records.add(`note:${note.id}`)
      for (const thought of pool.thoughts || []) records.add(`thought:${thought.id}`)
      for (const response of pool.responses || []) records.add(`response:${response.id}`)
      const seen = new Set()
      const threads = []
      let dropped = 0
      for (const raw of Array.isArray(input) ? input : []) {
        const title = String((raw && raw.title) || '').trim()
        if (title === '' || THREAD_EMPTY_TITLE.test(title)) {
          dropped += 1
          continue
        }
        const relations = (raw.relations || []).filter((id) => relationIds.has(id))
        const suggest = []
        for (const pair of raw.suggest || []) {
          if (!records.has(pair[0]) || !records.has(pair[1])) continue
          const key = `${pair[0]}|${pair[1]}`
          if (seen.has(key)) continue
          seen.add(key)
          suggest.push([pair[0], pair[1]])
          if (suggest.length >= THREAD_SUGGEST_LIMIT) break
        }
        if (relations.length === 0 && suggest.length === 0) {
          dropped += 1
          continue
        }
        threads.push({ title, why: String((raw && raw.why) || '').trim(), relations, suggest })
      }
      const kept = threads.slice(0, THREAD_LIMIT)
      return { threads: kept, dropped, overflow: Math.max(0, threads.length - kept.length) }
    }

    /** 一条线索里的证据：关系 → 两端记录，正文一律本地取。 */
    function threadEvidence(thread, relationById, recordById) {
      const rows = []
      for (const id of thread.relationIds || []) {
        const relation = relationById.get(String(id))
        if (!relation) continue
        // Relationships store bare ids; the record map is keyed by 编号 (kind:id),
        // so the two ends resolve through their kind, never by bare id alone.
        const from = relation.from ? recordById.get(`${relation.from.kind}:${relation.from.id}`) || null : null
        const to = relation.to ? recordById.get(`${relation.to.kind}:${relation.to.id}`) || null : null
        if (!from && !to) continue
        rows.push({ id: String(id), label: relation.label, reason: relation.reason, from, to })
      }
      return rows
    }

    function BookThreads(props) {
      const book = props.book || {}
      const data = props.data || {}
      const craft = props.craft || EMPTY_CRAFT
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [suggests, setSuggests] = useState([])
      const [adopting, setAdopting] = useState('')
      const [saving, setSaving] = useState('')
      const [expand, setExpand] = useState(false)

      const pool = useMemo(() => threadBookPool(data, craft, book.bookId), [data, craft, book.bookId])
      const chapters = useMemo(() => threadChapters(pool), [pool])
      const recordById = useMemo(() => threadRecordMap(pool), [pool])
      const relationById = useMemo(() => {
        const map = new Map()
        for (const relation of pool.relations) map.set(String(relation.id), relation)
        return map
      }, [pool])
      const rows = useMemo(() => {
        const list = (Array.isArray(craft.threads) ? craft.threads : []).filter((item) => String(item.bookId) === String(book.bookId))
        return list.slice().sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0))
      }, [craft.threads, book.bookId])
      const snapshot = rows[0] || null
      const coverage = snapshot && snapshot.coverage ? snapshot.coverage : null
      // The gate is the one number we must compute locally: without it there is no
      // button, and without a button there is no first run. It is never rendered as
      // a coverage claim — the card only ever prints the host's numbers.
      const enough = pool.notes.length >= 2 || (pool.notes.length >= 1 && pool.thoughts.length >= 1)
      const stale = coverage
        ? Math.abs(Number(coverage.notes) - pool.notes.length) + Math.abs(Number(coverage.thoughts) - pool.thoughts.length)
        : 0
      const gaps = useMemo(() => {
        const thoughtChapters = new Set(pool.thoughts.map(threadChapterOf).filter((item) => item !== ''))
        const counts = new Map()
        for (const note of pool.notes) {
          const chapter = threadChapterOf(note)
          if (chapter === '') continue
          counts.set(chapter, (counts.get(chapter) || 0) + 1)
        }
        const missing = Array.from(counts.keys()).filter((chapter) => !thoughtChapters.has(chapter))
        const lines = []
        if (missing.length > 0) {
          const names = missing.slice(0, 3).map((chapter) => `《${chapter}》`).join('')
          lines.push(t('thread.gapNoThought', { chapters: missing.length, names }))
        }
        const noChapter = pool.notes.filter((note) => threadChapterOf(note) === '').length
        if (noChapter > 0) lines.push(t('thread.gapNoChapter', { count: noChapter }))
        return lines.slice(0, 2)
      }, [pool])

      // threads.save replaces the whole set for one book, so the caller must hand
      // over the complete list — never "existing plus new", which would grow past
      // the host's five-thread limit on the second run.
      const saveRows = async (list) => {
        const outgoing = (list || []).map((row) => ({
          ...(row.id ? { id: row.id } : {}),
          title: row.title,
          why: row.why || '',
          relationIds: (row.relationIds || []).slice(),
        }))
        await props.write('threads.save', { bookId: book.bookId, threads: outgoing })
      }
      const rowsOut = () => rows.map((row) => ({ id: row.id, title: row.title, why: row.why, relationIds: (row.relationIds || []).slice() }))

      const generate = async () => {
        if (busy || !enough || typeof props.write !== 'function') return
        setBusy(true)
        setError('')
        setNotice('')
        setSuggests([])
        let text = ''
        let failed = ''
        try {
          await streamChat({ pack: buildThreadsPack({ book, pool, data }), question: '', mode: 'threads', history: [] }, (event) => {
            if (!event) return
            if (event.type === 'text' && typeof event.text === 'string') text += event.text
            if (event.type === 'error') failed = String(event.message || event.error || '')
          })
        } catch (issue) {
          failed = String((issue && issue.message) || issue || '')
        }
        if (failed !== '') {
          setBusy(false)
          setError(failed)
          return
        }
        const parsed = parseThreadsAnswer(text)
        if (!parsed.ok) {
          setBusy(false)
          setError(t('thread.badJson'))
          return
        }
        const checked = validateThreads(parsed.threads, pool)
        const ready = checked.threads.filter((item) => item.relations.length > 0)
        const pending = checked.threads.filter((item) => item.relations.length === 0)
        if (ready.length > 0) {
          try {
            await saveRows(ready.map((item) => ({ title: item.title, why: item.why, relationIds: item.relations })))
          } catch (issue) {
            setBusy(false)
            setError(String((issue && issue.message) || issue || ''))
            return
          }
        }
        setSuggests(pending.map((item) => ({ thread: item })))
        if (checked.overflow > 0) setNotice(t('thread.capped', { count: checked.overflow }))
        else if (ready.length === 0 && pending.length === 0) setNotice(t('thread.none'))
        setBusy(false)
      }

      // Cold start: a proposed pair only becomes an edge when the reader taps it.
      const adopt = async (entry, pair) => {
        if (adopting !== '' || typeof props.write !== 'function') return
        setAdopting(`${pair[0]}|${pair[1]}`)
        setError('')
        try {
          const result = await props.write('relation.add', {
            from: relateEndOf(pair[0]),
            to: relateEndOf(pair[1]),
            label: '待核实',
            reason: entry.thread.why || t('thread.suggestReason'),
            bookId: book.bookId,
            origin: 'ai',
          })
          // /craft answers { revision, created:{ relation }, craft } — the new edge is
          // one level down, and a dropped pair simply has no created.relation.
          const id = result && result.created && result.created.relation ? String(result.created.relation.id || '') : ''
          if (id !== '') {
            // Merge into the current set: the new edge joins this thread (or starts
            // it), and every other thread stays exactly as it was.
            const next = rowsOut()
            const twin = next.find((row) => row.title === entry.thread.title)
            if (twin) twin.relationIds = Array.from(new Set(twin.relationIds.concat([id])))
            else next.push({ title: entry.thread.title, why: entry.thread.why, relationIds: [id] })
            // The adopted thread goes first: at the five-thread ceiling it is the one
            // that must survive the trim, not the oldest one.
            const adoptedRow = next.find((row) => row.title === entry.thread.title)
            const ordered = adoptedRow ? [adoptedRow].concat(next.filter((row) => row !== adoptedRow)) : next
            await saveRows(ordered.slice(0, THREAD_LIMIT))
            setSuggests((list) => list.filter((item) => item !== entry))
            setNotice(t('thread.adopted'))
          } else {
            setNotice(t('thread.suggestDropped'))
          }
        } catch (issue) {
          setError(String((issue && issue.message) || issue || ''))
        }
        setAdopting('')
      }

      const writeIntoWork = async (thread, evidence) => {
        if (saving !== '' || typeof props.write !== 'function') return
        setSaving(String(thread.id || thread.title))
        setError('')
        const sourceIds = []
        for (const row of evidence) {
          for (const end of [row.from, row.to]) {
            if (!end) continue
            const id = `${end.kind}:${end.item.id}`
            if (sourceIds.indexOf(id) === -1) sourceIds.push(id)
          }
        }
        const lines = [String(thread.title || '')]
        if (thread.why) lines.push('', String(thread.why))
        for (const row of evidence) {
          const left = row.from ? threadRecordText(row.from.item, row.from.kind) : ''
          const right = row.to ? threadRecordText(row.to.item, row.to.kind) : ''
          const pair = [left, right].filter((item) => item !== '').map((item) => `「${clip(item, 60)}」`).join(' ↔ ')
          if (pair !== '') lines.push('', pair)
          if (row.reason) lines.push(String(row.reason))
        }
        try {
          await props.write('work.add', {
            title: clip(String(thread.title || t('nav.works')), 40),
            paragraphs: [
              {
                text: lines.join('\n'),
                sourceIds,
                ai: true,
                aiOriginIds: [`thread:${String(thread.id || '')}`],
              },
            ],
          })
          if (typeof props.onSwitchToWorks === 'function') props.onSwitchToWorks()
        } catch (issue) {
          setError(String((issue && issue.message) || issue || ''))
        }
        setSaving('')
      }

      const coverageText = coverage
        ? t('thread.coverage', {
            chapters: (coverage.chapters || []).length,
            notes: Number(coverage.notes) || 0,
            thoughts: Number(coverage.thoughts) || 0,
            fullText: coverage.hasFullText === true ? t('thread.hasFullText') : t('thread.onlyHighlights'),
          })
        : ''

      const renderEvidence = (thread) =>
        threadEvidence(thread, relationById, recordById).map((row) =>
          h(
            'div',
            { className: 'wr-thread-evidence', key: `${thread.id}:${row.id}` },
            row.from
              ? h(
                  'button',
                  {
                    className: 'wr-thread-record',
                    type: 'button',
                    'data-kind': row.from.kind,
                    title: String(row.from.item.id),
                    onClick: () => {
                      if (typeof props.onOpenSource === 'function') props.onOpenSource(`${row.from.kind}:${row.from.item.id}`)
                    },
                  },
                  h('span', { className: 'wr-thread-chapter' }, `《${threadChapterOf(row.from.item) || t('thread.noChapter')}》`),
                  h('span', { className: 'wr-thread-text' }, clip(threadRecordText(row.from.item, row.from.kind), 80)),
                )
              : null,
            row.to
              ? h(
                  'button',
                  {
                    className: 'wr-thread-record',
                    type: 'button',
                    'data-kind': row.to.kind,
                    title: String(row.to.item.id),
                    onClick: () => {
                      if (typeof props.onOpenSource === 'function') props.onOpenSource(`${row.to.kind}:${row.to.item.id}`)
                    },
                  },
                  h('span', { className: 'wr-thread-chapter' }, `《${threadChapterOf(row.to.item) || t('thread.noChapter')}》`),
                  h('span', { className: 'wr-thread-text' }, clip(threadRecordText(row.to.item, row.to.kind), 80)),
                )
              : null,
            row.reason ? h('div', { className: 'wr-thread-link' }, `${t('thread.link')}：${row.reason}`) : null,
            h('span', { className: 'wr-tag' }, row.label),
          ),
        )

      const renderThread = (thread, index) => {
        const evidence = threadEvidence(thread, relationById, recordById)
        return h(
          'article',
          { className: 'wr-thread', key: String(thread.id || index) },
          h('h4', { className: 'wr-thread-title' }, `${fmtCount(index + 1)} · ${thread.title}`),
          thread.why ? h('p', { className: 'wr-thread-why' }, `${t('thread.why')}：${thread.why}`) : null,
          evidence.length === 0 ? h('p', { className: 'wr-muted' }, t('thread.noEvidence')) : h('div', { className: 'wr-thread-body' }, renderEvidence(thread)),
          h(
            'div',
            { className: 'wr-thread-actions' },
            h(
              'button',
              { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: evidence.length === 0 || saving !== '', onClick: () => void writeIntoWork(thread, evidence) },
              t('thread.write'),
            ),
            evidence.length > 0 && evidence[0].from
              ? h(
                  'button',
                  {
                    className: 'wr-btn wr-btn-ghost',
                    type: 'button',
                    onClick: () => {
                      if (typeof props.onOpenSource === 'function') props.onOpenSource(`${evidence[0].from.kind}:${evidence[0].from.item.id}`)
                    },
                  },
                  t('thread.source'),
                )
              : null,
          ),
        )
      }

      const renderSuggest = (entry) => {
        const allowed = (entry.thread.suggest || []).slice(0, THREAD_SUGGEST_LIMIT)
        return h(
          'div',
          { className: 'wr-thread-suggest', key: `suggest:${entry.thread.title}` },
          h('div', { className: 'wr-thread-suggest-head' }, h('strong', null, t('thread.suggestTitle')), h('span', { className: 'wr-muted' }, entry.thread.title)),
          allowed.map((pair) =>
            h(
              'div',
              { className: 'wr-thread-suggest-row', key: `${pair[0]}|${pair[1]}` },
              h('span', { className: 'wr-thread-suggest-text' }, t('thread.suggest', { a: threadPairLabel(pair[0], recordById), b: threadPairLabel(pair[1], recordById) })),
              h(
                'button',
                {
                  className: 'wr-btn wr-btn-ghost wr-thread-adopt',
                  type: 'button',
                  disabled: adopting !== '',
                  onClick: () => void adopt(entry, pair),
                },
                adopting === `${pair[0]}|${pair[1]}` ? t('thread.adopting') : t('thread.adopt'),
              ),
            ),
          ),
        )
      }

      const visible = expand ? rows : rows.slice(0, 3)

      return h(
        'section',
        { className: 'wr-threads', 'data-empty': rows.length === 0 ? 'true' : 'false' },
        h(
          'div',
          { className: 'wr-threads-head' },
          h('strong', null, t('thread.title')),
          coverage ? h('span', { className: 'wr-threads-coverage' }, coverageText) : null,
          h('div', { className: 'wr-toolbar-fill' }),
          enough
            ? h(
                'button',
                { className: 'wr-btn wr-btn-ghost wr-threads-build', type: 'button', disabled: busy || typeof props.write !== 'function', onClick: () => void generate() },
                busy ? t('thread.building') : rows.length > 0 ? t('thread.rebuild') : t('thread.build'),
              )
            : null,
        ),
        // The page footer already prints when writing data was refreshed; a second
        // formatted timestamp here only repeats it. The stale hint stays — it counts
        // new records, it does not restate a clock.
        snapshot && stale > 0
          ? h('div', { className: 'wr-threads-meta' }, h('span', { className: 'wr-threads-stale' }, t('thread.stale', { count: stale })))
          : null,
        busy ? h('div', { className: 'wr-threads-loading' }, h('span', { className: 'wr-spinner' }), h('span', null, t('thread.building')), h('span', { className: 'wr-muted' }, t('thread.slow'))) : null,
        error
          ? h(
              'div',
              { className: 'wr-adopt-error' },
              h('span', null, t('thread.failed', { error })),
              h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: () => void generate() }, t('think.retry')),
            )
          : null,
        notice ? h('p', { className: 'wr-threads-notice' }, notice) : null,
        !enough
          ? h(
              'div',
              { className: 'wr-threads-gate' },
              h('strong', null, t('thread.empty')),
              h('p', null, t('thread.emptyNeed')),
              pool.notes.length === 0 ? h('p', { className: 'wr-muted' }, t('thread.emptyNone')) : null,
            )
          : null,
        enough && rows.length === 0 && !busy && pool.relations.length === 0 && suggests.length === 0
          ? h('p', { className: 'wr-threads-hint' }, t('thread.needRelation'))
          : null,
        visible.map(renderThread),
        rows.length > 3
          ? h('button', { className: 'wr-btn wr-btn-ghost wr-threads-more', type: 'button', onClick: () => setExpand(!expand) }, expand ? t('thread.less') : t('thread.more', { count: rows.length - 3 }))
          : null,
        suggests.map(renderSuggest),
        h(
          'div',
          { className: 'wr-threads-gaps' },
          chapters.length > 0 ? h('span', { className: 'wr-muted' }, t('thread.scanned', { chapters: chapters.slice(0, 6).map((item) => `《${item}》`).join('') })) : null,
          gaps.map((line) => h('span', { className: 'wr-threads-gap', key: line }, line)),
        ),
      )
    }

        /** 建议对是编号字符串（note:x），关系端点要的是 {kind,id}。 */
    function relateEndOf(value) {
      const text = String(value === undefined || value === null ? '' : value)
      const at = text.indexOf(':')
      if (at <= 0) return null
      return { kind: text.slice(0, at), id: text.slice(at + 1) }
    }

function threadPairLabel(id, recordById) {
      const hit = recordById.get(String(id))
      if (!hit) return String(id)
      const chapter = threadChapterOf(hit.item)
      const text = clip(threadRecordText(hit.item, hit.kind), 24)
      return `${chapter === '' ? '' : `《${chapter}》`}${text}`
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

    function ParagraphAI(props) {
      const [open, setOpen] = useState(false)
      const [stage, setStage] = useState('')
      const [draft, setDraft] = useState('')
      const [error, setError] = useState('')
      const [busy, setBusy] = useState(false)
      const abortRef = useRef(null)
      const originRef = useRef('')
      const sourceIds = Array.isArray(props.sourceIds) ? props.sourceIds : []
      const hasSource = sourceIds.length > 0
      // 入口只在「没有出处」时禁用：有没有模型由真实请求说了算，不预检、不提前置灰。
      const disabled = !hasSource || stage === 'running'
      const title = !hasSource ? t('work.aiNeedSource') : t('work.aiWriteHint')

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
        // No visible hint line: "no source yet" belongs in the button's title, not
        // in the paragraph's reading width.
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

/**
     * Attach real sources to an existing paragraph. The composer below can pick
     * sources for a new paragraph, but a paragraph written before this existed
     * (or one whose sources went stale) had no way back in — the AI helper was
     * greyed out with nothing the reader could do about it.
     */
    function ParagraphSources(props) {
      const [open, setOpen] = useState(false)
      const [picked, setPicked] = useState([])
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const paragraph = props.paragraph || {}
      const pool = Array.isArray(props.pool) ? props.pool : []
      const existing = Array.isArray(paragraph.sourceIds) ? paragraph.sourceIds.map(String) : []
      const toggle = (sourceId) => {
        setPicked((prev) => (prev.indexOf(sourceId) >= 0 ? prev.filter((id) => id !== sourceId) : prev.concat([sourceId])))
      }
      const close = () => {
        setPicked([])
        setError('')
        setOpen(false)
      }
      const attach = () => {
        const extra = picked.filter((id) => existing.indexOf(id) < 0)
        if (extra.length === 0) {
          close()
          return
        }
        setBusy(true)
        setError('')
        Promise.resolve(props.onAttach(existing.concat(extra)))
          .then(() => {
            setBusy(false)
            close()
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }
      return h(
        'span',
        { className: 'wr-paragraph-sources' },
        h(
          'button',
          {
            className: 'wr-btn wr-btn-ghost',
            type: 'button',
            'data-on': open ? 'true' : 'false',
            'aria-expanded': open ? 'true' : 'false',
            disabled: busy || pool.length === 0,
            title: pool.length === 0 ? t('work.pickEmpty') : t('work.attach'),
            onClick: () => (open ? close() : setOpen(true)),
          },
          t('work.attach'),
        ),
        open
          ? h(
              'span',
              { className: 'wr-picklist' },
              h('span', { className: 'wr-muted' }, t('work.pickTitle')),
              pool.map((row) =>
                h(
                  'button',
                  {
                    key: row.sourceId,
                    className: 'wr-pickrow',
                    type: 'button',
                    'data-on': picked.indexOf(row.sourceId) >= 0 ? 'true' : 'false',
                    onClick: () => toggle(row.sourceId),
                  },
                  h('span', { className: 'wr-pickrow-mark' }, picked.indexOf(row.sourceId) >= 0 ? '✓' : ''),
                  h('span', { className: 'wr-tag' }, t(`src.${row.kind}`)),
                  h('span', { className: 'wr-muted' }, row.chapter),
                  h('span', null, row.text),
                ),
              ),
              h(
                'span',
                { className: 'wr-form-row' },
                h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: attach }, t('action.save')),
                h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: close }, t('action.cancel')),
              ),
              error === '' ? null : h('span', { className: 'wr-adopt-error' }, error),
            )
          : null,
      )
    }

    /**
     * One paragraph of a draft. Clicking the text opens it for editing where the
     * reader pointed; Esc puts the old sentence back, clicking away or
     * Cmd/Ctrl+Enter keeps the new one, and the two buttons are there because a
     * keyboard user has nowhere to click away to.
     */
    function ParagraphRow(props) {
      const paragraph = props.paragraph || {}
      const original = String(paragraph.text || '')
      const [editing, setEditing] = useState(false)
      const [text, setText] = useState(original)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const areaRef = useRef(null)
      const caretRef = useRef(-1)
      const skipBlurRef = useRef(false)
      const open = (event) => {
        if (hasTextSelection()) return
        if (event && event.currentTarget) {
          caretRef.current = caretOffsetFromPoint(event.currentTarget, { x: event.clientX, y: event.clientY })
        }
        setText(original)
        setError('')
        setEditing(true)
      }
      useEffect(() => {
        if (!editing) return
        const area = areaRef.current
        if (!area || typeof area.focus !== 'function') return
        area.focus()
        const value = String(area.value === undefined ? text : area.value)
        const at = caretRef.current >= 0 ? Math.min(caretRef.current, value.length) : value.length
        if (typeof area.setSelectionRange === 'function') {
          try {
            area.setSelectionRange(at, at)
          } catch (thrown) {
            // A detached textarea cannot take a selection; focusing is enough.
          }
        }
      }, [editing])
      const cancel = () => {
        skipBlurRef.current = false
        setText(original)
        setError('')
        setEditing(false)
      }
      const save = () => {
        const next = text.trim() === '' ? original : text.trim()
        setBusy(true)
        setError('')
        Promise.resolve(props.onSave(next))
          .then(() => {
            setBusy(false)
            setEditing(false)
          })
          .catch((thrown) => {
            setBusy(false)
            setError(thrown && thrown.message ? thrown.message : String(thrown))
          })
      }
      const onKeyDown = (event) => {
        if (!event) return
        if (event.key === 'Escape') {
          if (typeof event.preventDefault === 'function') event.preventDefault()
          cancel()
          return
        }
        if (event.key === 'Enter' && (event.ctrlKey === true || event.metaKey === true)) {
          if (typeof event.preventDefault === 'function') event.preventDefault()
          save()
        }
      }
      const onBlur = () => {
        if (skipBlurRef.current) {
          skipBlurRef.current = false
          return
        }
        if (text.trim() === original.trim()) {
          setEditing(false)
          return
        }
        save()
      }
      return h(
        'div',
        { className: 'wr-paragraph', 'data-editing': editing ? 'true' : 'false' },
        h('span', { className: 'wr-paragraph-index' }, t('work.paragraph', { index: String(props.index + 1) })),
        h(
          'div',
          { className: 'wr-paragraph-main' },
          editing
            ? h('textarea', {
                ref: areaRef,
                className: 'wr-line-input wr-paragraph-input',
                rows: textareaRows(text),
                value: text,
                placeholder: t('work.paragraphPlaceholder'),
                onChange: (event) => setText(event ? String(event.target.value || '') : ''),
                onKeyDown,
                onBlur,
              })
            : h(
                'p',
                {
                  className: 'wr-item-text',
                  'data-editable': 'true',
                  title: t('work.editHint'),
                  onClick: open,
                },
                original,
              ),
          h(
            'div',
            { className: 'wr-item-meta' },
            paragraph.ai ? h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('work.aiTag')) : null,
            h(SourceTags, { sourceIds: paragraph.sourceIds, lookup: props.lookup, onOpenSource: props.onOpenSource }),
            editing
              ? h(
                  'span',
                  { className: 'wr-form-row' },
                  h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: save }, t('action.save')),
                  h(
                    'button',
                    {
                      className: 'wr-btn wr-btn-ghost',
                      type: 'button',
                      disabled: busy,
                      onMouseDown: () => {
                        skipBlurRef.current = true
                      },
                      onClick: cancel,
                    },
                    t('action.cancel'),
                  ),
                )
              : h(
                  'button',
                  {
                    className: 'wr-btn wr-btn-ghost',
                    type: 'button',
                    onClick: () => {
                      caretRef.current = -1
                      setText(original)
                      setError('')
                      setEditing(true)
                    },
                  },
                  t('action.edit'),
                ),
            h(ParagraphSources, {
              paragraph,
              pool: props.sourcePool,
              onAttach: (sourceIds) => props.onAttachSources(sourceIds),
            }),
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

    /**
     * 「⋯」for a whole draft. Deleting a draft is the one irreversible thing on
     * this page, so it lives behind a menu and behind a second click that says
     * what it does — it used to sit in the same row as 「加这一段」, where people
     * mistook it for clearing the input.
     */
    function WorkMenu(props) {
      const [open, setOpen] = useState(false)
      const [armed, setArmed] = useState(false)
      const work = props.work || null
      return h(
        'div',
        { className: 'wr-menu' },
        h(
          'button',
          {
            className: 'wr-btn wr-btn-ghost wr-menu-btn',
            type: 'button',
            'aria-label': t('work.menu'),
            title: t('work.menu'),
            'aria-expanded': open ? 'true' : 'false',
            disabled: Boolean(props.busy) || !work,
            onClick: () => {
              setArmed(false)
              setOpen((prev) => !prev)
            },
          },
          '⋯',
        ),
        open
          ? h(
              'div',
              { className: 'wr-menu-panel', role: 'menu' },
              h(
                'button',
                {
                  className: 'wr-menu-danger',
                  type: 'button',
                  role: 'menuitem',
                  'data-armed': armed ? 'true' : 'false',
                  disabled: Boolean(props.busy),
                  onClick: () => {
                    if (!armed) {
                      setArmed(true)
                      return
                    }
                    setArmed(false)
                    setOpen(false)
                    props.onDelete()
                  },
                },
                armed ? t('work.deleteConfirm') : t('work.deleteWhole'),
              ),
              h(
                'button',
                { className: 'wr-menu-cancel', type: 'button', onClick: () => { setArmed(false); setOpen(false) } },
                t('work.deleteCancel'),
              ),
            )
          : null,
      )
    }

    function WorkBoard(props) {
      const craft = props.craft || EMPTY_CRAFT
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
      // 时间线里点「作品」必须打开那一篇：多书作品本来就没有唯一归属书，
      // 靠书过滤会开错篇，所以这里按 id 定位。
      const focusWorkId = String(props.focusWorkId || '')
      const [activeId, setActiveId] = useState(focusWorkId)
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
      // Which book's records may be cited here: the book in scope, or the one
      // book this draft already quotes. With neither, every book is offered —
      // the composer is the only way in, so an empty list would be a dead end.
      const composerBookId = (() => {
        if (scoped !== '') return scoped
        const books = []
        paragraphs.forEach((paragraph) => {
          const ids = Array.isArray(paragraph.sourceIds) ? paragraph.sourceIds : []
          ids.forEach((sourceId) => {
            const bookId = bookIdOf ? bookIdOf(sourceId) : ''
            if (bookId && books.indexOf(bookId) < 0) books.push(bookId)
          })
        })
        return books.length === 1 ? books[0] : ''
      })()
      const sourcePool = sourcePoolOf(props.data, craft, composerBookId)
      // 从时间线跳进来时 focusWorkId 会变，组件若已经挂着就同步选中的那一篇。
      useEffect(() => {
        if (focusWorkId === '') return
        if (works.some((item) => item.id === focusWorkId)) setActiveId(focusWorkId)
      }, [focusWorkId])
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
        const sourceIds = picked.slice()
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
          h('div', { className: 'wr-toolbar-fill' }),
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
          // The empty screen states the next step in words; a second button here
          // only competes with the one that matters.
          ? h(CraftEmpty, { titleKey: 'work.empty.title', nextKey: 'work.empty.next' })
          : h(
              'div',
              null,
              // With a single draft the picker would print the same title twice
              // (chip + card head), so it appears only once there is a choice.
              works.length > 1
                ? h(
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
                  )
                : null,
              work === null
                ? null
                : h(
                    'div',
                    { className: 'wr-draft' },
                    h(
                      'div',
                      { className: 'wr-item-head wr-draft-head' },
                      h(
                        'div',
                        { className: 'wr-draft-head-title' },
                        h('strong', { className: 'wr-draft-title' }, String(work.title || t('work.new'))),
                        h('span', { className: 'wr-draft-meta' }, t('work.paragraphCount', { count: String(paragraphs.length) })),
                        work.containsAI ? h('span', { className: 'wr-tag', 'data-tone': 'ai' }, t('work.aiTag')) : null,
                      ),
                      // Deleting the whole draft stays behind this menu, away from
                      // the row where a new paragraph is added.
                      h(WorkMenu, {
                        work,
                        busy,
                        onDelete: () => {
                          call('work.delete', { id: work.id }).catch(() => {})
                        },
                      }),
                    ),
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
                            sourcePool,
                            onAttachSources: (sourceIds) =>
                              call('work.paragraph.update', {
                                id: work.id,
                                paragraphId: paragraph.id,
                                text: paragraph.text,
                                sourceIds,
                              }),
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
                        className: 'wr-line-input',
                        rows: textareaRows(draft),
                        value: draft,
                        placeholder: t('work.paragraphPlaceholder'),
                        onChange: (event) => setDraft(event ? String(event.target.value || '') : ''),
                      }),
                      sourcePool.length === 0
                        ? h('span', { className: 'wr-muted' }, t('work.pickEmpty'))
                        : h(
                            'div',
                            null,
                            h('span', { className: 'wr-muted' }, t('work.pickSource')),
                            h(
                              'div',
                              { className: 'wr-picklist' },
                              sourcePool.map((row) =>
                                h(
                                  'button',
                                  {
                                    className: 'wr-pickrow',
                                    key: row.sourceId,
                                    type: 'button',
                                    'data-on': picked.includes(row.sourceId) ? 'true' : 'false',
                                    onClick: () =>
                                      setPicked((prev) =>
                                        prev.includes(row.sourceId) ? prev.filter((id) => id !== row.sourceId) : prev.concat([row.sourceId]),
                                      ),
                                  },
                                  h('span', { className: 'wr-pickrow-mark' }, picked.includes(row.sourceId) ? '✓' : ''),
                                  h('span', { className: 'wr-tag' }, t(`src.${row.kind}`)),
                                  row.chapter === '' ? null : h('span', { className: 'wr-muted' }, row.chapter),
                                  h('span', null, row.text),
                                ),
                              ),
                            ),
                          ),
                      h(
                        'div',
                        { className: 'wr-form-row' },
                        h('button', { className: 'wr-btn wr-btn-primary', type: 'button', disabled: busy, onClick: addParagraph }, t('work.addParagraph')),
                        // One button, two states: opening the preview and hiding it
                        // are the same control, so the YAML never lingers under the input.
                        h(
                          'button',
                          {
                            className: 'wr-btn wr-btn-ghost',
                            type: 'button',
                            'data-on': markdown === '' ? 'false' : 'true',
                            'aria-expanded': markdown === '' ? 'false' : 'true',
                            disabled: busy,
                            onClick: () => {
                              if (markdown !== '') {
                                setMarkdown('')
                                return
                              }
                              exportWork('preview')
                            },
                          },
                          markdown === '' ? t('work.exportPreview') : t('work.hidePreview'),
                        ),
                        h('button', { className: 'wr-btn wr-btn-ghost', type: 'button', disabled: busy, onClick: () => exportWork('file') }, t('work.exportFile')),
                      ),
                    ),
                    error === '' ? null : h('p', { className: 'wr-adopt-error' }, error),
                    path === '' ? null : h('p', { className: 'wr-notice-line' }, t('work.exported', { path })),
                    markdown === ''
                      ? null
                      : h(
                          'div',
                          { className: 'wr-draft-preview' },
                          h(
                            'div',
                            { className: 'wr-item-head' },
                            h('strong', null, t('work.previewTitle')),
                            h('span', { className: 'wr-muted' }, t('work.frontMatter')),
                          ),
                          h(
                            'div',
                            { className: 'wr-draft-export' },
                            h('pre', { className: 'wr-export-text' }, markdown),
                            h(CopyButton, { text: markdown }),
                          ),
                        ),
                  ),
            ),
      )
    }

// 1.2.3：时间线是给人看的，不是给后台看的。每条只有三行——
    // 什么时候做了什么（小字次要色）、做了什么内容的摘要（主字号、两行封顶）、
    // 出自哪本书的哪一章（小字、单行省略）。整行可点，不再有「跨书」这类后台标签。
    function GrowTimeline(props) {
      const craft = props.craft || EMPTY_CRAFT
      const bookIdOf = typeof props.bookIdOf === 'function' ? props.bookIdOf : null
      const titleOf = (bookId) => bookTitleOf(bookId, props.data, craft) || bookId
      const clockOf = (at) => {
        const stamp = fmtDateTime(at)
        return stamp.length >= 16 ? stamp.slice(11, 16) : ''
      }
      const booksOf = (sourceIds) => {
        const seen = []
        for (const sourceId of Array.isArray(sourceIds) ? sourceIds : []) {
          const bookId = String((bookIdOf ? bookIdOf(sourceId) : '') || '')
          if (bookId !== '' && !seen.includes(bookId)) seen.push(bookId)
        }
        return seen
      }
      // 第三行：一本书就写书名，多本就写「第一本 等 N 本」，没有就直说未关联书。
      const whereOf = (bookIds, chapter) => {
        if (bookIds.length === 0) return t('grow.noBook')
        const head = bookIds.length > 1
          ? t('grow.multiBooks', { title: titleOf(bookIds[0]), count: String(bookIds.length) })
          : titleOf(bookIds[0])
        const name = String(chapter || '')
        return name === '' ? head : `${head} · ${name}`
      }
      // 1.2.2 §5.1: materials and topics left the interface, so their events are no
      // longer shown. The records themselves stay in craft.json untouched.
      // 1.2.4: 时间线只放「思考」与「创作」——想法与划线属于阅读，
      // 它们留在书页的记录列表里，这里不再重复一遍。
      const events = []
      for (const item of Array.isArray(craft.responses) ? craft.responses : []) {
        const bookId = String(item.bookId || '')
        events.push({
          key: `response:${item.id}`,
          kind: 'response',
          actionKey: 'grow.event.response',
          at: item.adoptedAt || item.createdAt,
          text: item.text,
          chapter: '',
          bookIds: bookId === '' ? [] : [bookId],
          open: () => {
            if (typeof props.onOpenSource === 'function') props.onOpenSource(`response:${item.id}`)
          },
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
          actionKey: 'grow.event.work',
          at: item.updatedAt || item.createdAt,
          text: item.title,
          chapter: '',
          bookIds,
          // 多书作品也必须能打开「那一篇」：交给上层按 id 定位，而不是猜一本书。
          open: () => {
            if (typeof props.onOpenWork === 'function') {
              props.onOpenWork(item.id)
              return
            }
            if (bookIds.length === 1 && typeof props.onOpenBook === 'function') props.onOpenBook(bookIds[0], 'thoughts')
          },
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
        { className: 'wr-tl' },
        shown.map((group) =>
          h(
            'div',
            { key: group.month, className: 'wr-tl-group' },
            // 月份只有一行：2026 年 3 月 · 7 条。不再另起一行「本月 N 条」。
            h(
              'div',
              { className: 'wr-tl-month' },
              h('span', null, t('grow.monthLabel', { year: group.month.slice(0, 4), month: group.month.slice(5, 7) })),
              h('span', { className: 'wr-tl-month-count' }, t('grow.monthCountInline', { count: String(group.items.length) })),
            ),
            h(
              'div',
              { className: 'wr-tl-items' },
              group.items.map((event) =>
                h(
                  'button',
                  {
                    className: 'wr-tl-item',
                    key: event.key,
                    type: 'button',
                    'data-kind': event.kind,
                    title: String(event.text || ''),
                    onClick: (clickEvent) => {
                      if (clickEvent && typeof clickEvent.stopPropagation === 'function') clickEvent.stopPropagation()
                      if (typeof event.open === 'function') event.open()
                    },
                  },
                  h(
                    'span',
                    { className: 'wr-tl-meta' },
                    h('span', { className: 'wr-tl-time' }, clockOf(event.at)),
                    h('span', { className: 'wr-tl-action' }, t(event.actionKey)),
                  ),
                  h('span', { className: 'wr-tl-body' }, clip(String(event.text || ''), 180)),
                  h('span', { className: 'wr-tl-where' }, whereOf(event.bookIds, event.chapter)),
                ),
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
                  `${t('grow.annual.craft')}：${t('nav.responses')} ${fmtCount(Number(craftCounts.responses) || 0)} · ${t('nav.works')} ${fmtCount(Number(craftCounts.works) || 0)}`,
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
                // 热力图在总览里已经有了，积累页再画一遍只是重复。
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
        // 1.2.2: the six-step counter became 「我的阅读脉络」. A count says how
        // many; threads say which few are worth going back to.
        h(BookThreads, {
          book,
          data,
          craft: props.craft,
          craftState: props.craftState,
          write: props.onWrite,
          onOpenSource: props.onOpenSource,
          onSwitchToWorks: props.onSwitchToWorks,
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
        // 五套都是实体配色，没有「空值 = 跟随宿主」这一档，所以总是写回一个具体名字。
        const saved = await save({ palette: name }, false)
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
        // 1.2.2 §5.1: materials and topics left the interface, so they no longer
        // advertise themselves in the journey bar either.
        create: (craft.works || []).length,
        grow: (Number(counts.thoughts) || 0) + (craft.responses || []).length + (craft.works || []).length,
      }
      const scopeTitle = scopeBookId === '' ? '' : bookTitleOf(scopeBookId, data, craft) || ''
      const openCraftView = (nextView, bookId) => {
        setQuery('')
        setActiveBookId('')
        setScopeBookId(String(bookId || ''))
        setView(nextView)
      }
      // F3: every source chip walks back to the asset it names — an excerpt or a
      // thought opens the book it sits in, a kept reply opens in THINK. Materials
      // are retired from the interface, so their chips stay inert (see SourceTags).
      const sourceFocus = useRef('')
      // 时间线点作品时用它指定「哪一篇」；用 ref 是因为 setView 已经会触发重渲染。
      const focusWorkRef = useRef('')
      const openWork = (workId) => {
        focusWorkRef.current = String(workId || '')
        setQuery('')
        setActiveBookId('')
        setScopeBookId('')
        setView('works')
      }
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
        if (kind === 'response') {
          openCraftView('responses', hit.bookId)
        }
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
        onOpenWork: openWork,
        focusWorkId: focusWorkRef.current,
        onGoShelf: () => {
          setScopeBookId('')
          setView('shelf')
        },
        write: craftWrite,
        onDelete: (id) => {
          craftWrite('response.delete', { id }).catch(() => {})
        },
      }
      // The record cards read the same snapshot the journeys do, through one bridge:
      // a card deep inside a list cannot be handed props by every parent in between.
      relateBridge.data = data || {}
      relateBridge.craft = craft
      relateBridge.lookup = lookup
      relateBridge.openSource = openSource
      // THINK / CREATE / GROW each open with one title line: what this page is,
      // and one plain sentence about what it holds. No second navigation row and no
      // per-page timestamp (the footer carries both clocks, labelled).
      const PAGE_HEAD = {
        responses: ['nav.responses', 'journey.think.hint', ''],
        works: ['nav.works', 'journey.create.hint', t('work.count', { count: String((craft.works || []).length) })],
        timeline: ['nav.timeline', '', ''],
        annual: ['nav.annual', '', ''],
      }
      const pageHead = () => {
        const spec = PAGE_HEAD[view]
        if (!spec) return null
        return h(PageHead, {
          titleKey: spec[0],
          hintKey: spec[1],
          countText: spec[2],
          scopeTitle,
          onClearScope: () => {
            setScopeBookId('')
          },
        })
      }
      const craftView = () => {
        if (view === 'responses') return h(ResponseList, craftProps)
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
          onWrite: craftWrite,
          onOpenSource: openSource,
          onSwitchToWorks: () => {
            setScopeBookId(activeBook.bookId)
            setView('works')
          },
          onBack: () => { setView('shelf'); setActiveBookId('') },
        })
      } else if (view === 'shelf') {
        body = h(ShelfView, { data: data || {}, onOpenBook: openBook })
      } else if (view === 'notes') {
        body = h(StreamView, { data: data || {}, kind: 'note', onOpenBook: openBookById })
      } else if (view === 'thoughts') {
        body = h(StreamView, { data: data || {}, kind: 'thought', onOpenBook: openBookById })
      } else if (view === 'responses' || view === 'works' || view === 'timeline' || view === 'annual') {
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
            pageHead(),
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
        PageHead,
        ExportPanel,
        MarkedText,
        PickButton,
        SyncBanner,
        clip,
        ThoughtRow,
        THOUGHT_CLAMP_CHARS,
        buildSourcePack,
        RelateBar,
        RelateCard,
        NoteRow,
        relateCandidates,
        buildRelateAsk,
        parseRelateAnswer,
        storedRelation,
        RELATION_LABELS,
        relateBridge,
        relateCardCap,
        relateCardBox,
        relateAtBottom,
        WorkBoard,
        WorkMenu,
        textareaRows,
        textareaRowsOf,
        TEXTAREA_MAX_ROWS,
        ParagraphRow,
        ParagraphAI,
        ParagraphSources,
        sourcePoolOf,
        hasTextSelection,
        caretOffsetFromPoint,
        PICKER_LIMIT,
        buildParagraphPack,
        paragraphSourceEntry,
        packKindLabel,
        packKindOf,
        materialAuthorIsAI,
        PACK_KIND_KEYS,
        THINK_LIMITS,
        JourneyBar,
        SubNav,
        BookThreads,
        buildThreadsPack,
        parseThreadsAnswer,
        validateThreads,
        threadBookPool,
        threadEvidence,
        threadPairLabel,
        THREAD_LIMIT,
        THREAD_SUGGEST_LIMIT,
        ResponseList,
        WorkBoard,
        GrowTimeline,
        GrowAnnual,
        asCraft,
        EMPTY_CRAFT,
        STAGES,
        STAGE_VIEWS,
        SourceTags,
        craftSourceHit,
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