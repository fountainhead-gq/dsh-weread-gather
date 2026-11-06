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

// 3) nav.* 模板键是否齐全
const navKeys = ['overview', 'shelf', 'notes', 'thoughts'].map((k) => `nav.${k}`)
console.log('[nav] missing=%s', navKeys.filter((k) => !zhKeys.has(k)).join(',') || 'none')

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

if (!bucketOk || !usesGroup) process.exitCode = 1
