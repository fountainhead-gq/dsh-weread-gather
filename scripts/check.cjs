// 静态自检：组件引用、locale 键完整性、宿主/客户端契约字段
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '..')
const client = fs.readFileSync(path.join(dir, 'client.js'), 'utf8')
const host = fs.readFileSync(path.join(dir, 'index.js'), 'utf8')

// 1) 组件引用
const declared = new Set([...client.matchAll(/^\s{4}function ([A-Za-z0-9_]+)/gm)].map((m) => m[1]))
const used = new Set([...client.matchAll(/\bh\(([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]))
const assigned = new Set([...client.matchAll(/const ([A-Z][A-Za-z0-9_]*)\s*=\s*(?:\(|React|function)/g)].map((m) => m[1]))
const missingComponents = [...used].filter((name) => !declared.has(name) && !assigned.has(name))
console.log('[components] declared=%d used=%d missing=%s', declared.size, used.size, missingComponents.join(',') || 'none')

// 2) locale 键
const zhBlock = client.slice(client.indexOf('const zh = {'), client.indexOf('const en = {') > 0 ? client.indexOf('const en = {') : undefined)
const enBlock = client.indexOf('const en = {') > 0 ? client.slice(client.indexOf('const en = {'), client.indexOf('const en = {') + 60000) : ''
const keysOf = (block) => new Set([...block.matchAll(/^\s*'([\w.]+)':/gm)].map((m) => m[1]))
const zhKeys = keysOf(zhBlock)
const enKeys = keysOf(enBlock)
const usedKeys = new Set([...client.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]))
const templateKeys = new Set([...client.matchAll(/t\(`([\w.]+)\$\{/g)].map((m) => m[1]))
const missingZh = [...usedKeys].filter((k) => !zhKeys.has(k) && !k.startsWith('nav.'))
const missingEn = [...zhKeys].filter((k) => !enKeys.has(k))
console.log('[locale] zh=%d en=%d missingZh=%s missingEn=%s', zhKeys.size, enKeys.size, missingZh.join(',') || 'none', missingEn.join(',') || 'none')

// 3) nav.* 模板键是否齐全（1.2.1 起：四段旅程 + 四个 READ 内页，旧键一个不删）
const navKeys = ['read', 'think', 'create', 'grow', 'overview', 'shelf', 'notes', 'thoughts'].map((k) => `nav.${k}`)
const missingNav = navKeys.filter((k) => !zhKeys.has(k))
console.log('[nav] missing=%s', missingNav.join(',') || 'none')
if (missingNav.length > 0) process.exitCode = 1

// 4) 客户端读取的数据字段 vs 宿主写入的字段
const hostFields = new Set([...host.matchAll(/^\s{2,}(\w+):/gm)].map((m) => m[1]))
const clientReads = new Set([...client.matchAll(/\bdata\.(\w+)/g)].map((m) => m[1]))
const unread = [...clientReads].filter((f) => !host.includes(`${f}:`) && !host.includes(`${f} =`))
console.log('[contract] clientReads=%s hostMissing=%s', [...clientReads].join(','), unread.join(',') || 'none')
// 5) 书架分类必须折叠到 10 个以内（9 个固定桶 + 兜底「其他」）
const groupBlock = host.slice(host.indexOf('const CATEGORY_GROUPS = ['), host.indexOf('const FALLBACK_GROUP'))
const bucketCount = (groupBlock.match(/\{ name: '/g) || []).length
const bucketOk = bucketCount + 1 <= 10
console.log('[buckets] fixed=%d +其他=%d ok=%s', bucketCount, bucketCount + 1, bucketOk)
const usesGroup = /book\.group/.test(client)
console.log('[shelf] filtersByGroup=%s', usesGroup)

// 6) 包身份一致性：package.json / cordis.patch.yml / 客户端模块 id 必须是同一个名字
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
const patch = fs.readFileSync(path.join(dir, 'cordis.patch.yml'), 'utf8')
const patchName = (patch.match(/name:\s*(\S+)/) || [])[1]
const loaderId = (client.match(/__ModuleLoader__\.load\(\{\s*id:\s*'([^']+)'/) || [])[1]
const identityOk = patchName === manifest.name && loaderId === manifest.name
console.log('[identity] package=%s patch=%s client=%s ok=%s', manifest.name, patchName, loaderId, identityOk)
if (!identityOk) process.exitCode = 1

// 7) 每个 HTTP 路由都必须先过 connection 的信任与认证闸门（插件市场安全评审要求）
const guardOk = /const rejected = \(req, res\) =>/.test(host) && /connection\.requestRejection\(\{ headers: req\.headers \}\)/.test(host) && /if \(rejected\(req, res\)\) return true/.test(host) && /makeRoutes\(host, ctx\)/.test(host)
const guardCalls = (host.match(/rejected\(req, res\)/g) || []).length
console.log('[auth] guard=%s calls=%d ok=%s', guardOk, guardCalls, guardOk && guardCalls >= 1)
if (!guardOk || guardCalls < 1) process.exitCode = 1

if (!bucketOk || !usesGroup) process.exitCode = 1

// 8) 配色（F-28）：客户端与宿主认同六套色板，且每套都写全了同一组 token。
//    少一个 token 不会报错，只会在那套配色下悄悄用上一套的颜色 —— 所以在这里卡住。
const PALETTE_TOKENS = [
  '--wr-bg', '--wr-paper', '--wr-paper-soft', '--wr-wash', '--wr-ink', '--wr-ink-soft', '--wr-ink-mute',
  '--wr-line', '--wr-line-2', '--wr-card-line', '--wr-divider', '--wr-surface', '--wr-scrim',
  '--wr-accent', '--wr-accent-deep', '--wr-sage', '--wr-moss', '--wr-clay', '--wr-clay-soft',
  '--wr-info', '--wr-info-soft', '--wr-gold', '--wr-progress', '--wr-track', '--wr-on-accent',
  '--wr-glow', '--wr-radius',
  '--wr-heat-0', '--wr-heat-1', '--wr-heat-2', '--wr-heat-3', '--wr-heat-4',
]
const clientPalettes = [...client.matchAll(/const PALETTES = \[([^\]]*)\]/g)]
  .map((m) => [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]))
  .filter((list) => list.length > 0)
  .map((list) => list.filter((name) => name !== 'follow'))[0] || []
const hostPalettes = (() => {
  const block = host.match(/const PALETTES = \[([^\]]*)\]/)
  return block ? [...block[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : []
})()
const blockOf = (name) => {
  const at = client.indexOf(`.wr-root[data-palette="${name}"]{`)
  if (at < 0) return ''
  const end = client.indexOf('}', at)
  return end > at ? client.slice(at, end) : ''
}
const baseBlock = (() => {
  const at = client.indexOf('.wr-root{')
  const end = client.indexOf('}', at)
  return at >= 0 && end > at ? client.slice(at, end) : ''
})()
const tokenGaps = []
for (const token of PALETTE_TOKENS) {
  if (!baseBlock.includes(`${token}:`)) tokenGaps.push(`follow:${token}`)
  for (const name of clientPalettes) {
    if (!blockOf(name).includes(`${token}:`)) tokenGaps.push(`${name}:${token}`)
  }
}
const palettesAligned = clientPalettes.length > 0 && clientPalettes.join(',') === hostPalettes.join(',')
console.log('[palette] client=%s host=%s aligned=%s tokenGaps=%s',
  clientPalettes.join(',') || 'none', hostPalettes.join(',') || 'none', palettesAligned, tokenGaps.slice(0, 8).join(',') || 'none')
if (!palettesAligned || tokenGaps.length > 0) process.exitCode = 1
