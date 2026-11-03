import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('dist')
const output = path.resolve('standalone/GLSL-Hills.html')
let html = await readFile(path.join(root, 'index.html'), 'utf8')
const localPath = (url, relativeTo = root) => {
  const candidate = path.resolve(url.startsWith('/') ? root : relativeTo, url.replace(/^\//, ''))
  if (!candidate.startsWith(root + path.sep)) throw new Error('Unexpected asset path')
  return candidate
}
const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)]
if (scripts.length !== 1) throw new Error('The standalone build expects one JavaScript entry')
for (const match of scripts) {
  const code = await readFile(localPath(match[1]), 'utf8')
  html = html.replace(match[0], () => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>`)
}
for (const match of [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)]) {
  const href = match[0].match(/href="([^"]+)"/)?.[1]
  if (!href) throw new Error('Missing CSS asset')
  const cssPath = localPath(href)
  let css = await readFile(cssPath, 'utf8')
  const assets = [...css.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/g)]
  for (const asset of assets) {
    if (/^(data:|https?:|#)/.test(asset[2])) continue
    const bytes = await readFile(localPath(asset[2], path.dirname(cssPath)))
    const mime = asset[2].endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream'
    css = css.split(asset[0]).join(`url(data:${mime};base64,${bytes.toString('base64')})`)
  }
  html = html.replace(match[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`)
}
const favicon = await readFile(path.join(root, 'favicon.svg'))
const iconTag = html.match(/<link\b[^>]*\brel="icon"[^>]*>/)?.[0]
if (!iconTag) throw new Error('Missing application icon')
html = html.replace(iconTag, () => iconTag.replace(/href="[^"]+"/, `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`))
if (/<(?:script|link)\b[^>]*(?:src|href)="\/assets\//.test(html)) throw new Error('A build asset was not embedded')
const notices = {}
for (const filename of (await readdir('licenses')).sort()) {
  notices[filename] = await readFile(path.join('licenses', filename), 'utf8')
}
// The downloadable single file also carries the bundled libraries' license
// notices, including the font license; this data block is not executable UI.
const noticeBlock = `<script type="application/json" id="third-party-notices">${JSON.stringify(notices).replace(/</g, '\\u003c')}</script>`
html = html.replace('</body>', () => `${noticeBlock}\n</body>`)
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, html)
console.log(`Standalone interactive artwork: ${output} (${Buffer.byteLength(html)} bytes)`)
