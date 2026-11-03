import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname,'..');
let html = await readFile(resolve(root,'dist/index.html'),'utf8');
const javascript = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
if(!javascript)throw new Error('Built entry point is missing');
const script = await readFile(resolve(root,'dist',javascript[1]),'utf8');
html=html.replace(javascript[0],()=>`<script type="module">${script.replace(/<\/script/gi,'<\\/script')}</script>`);
const sheets=[...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)];
for(const sheet of sheets){const css=await readFile(resolve(root,'dist',sheet[1]),'utf8');html=html.replace(sheet[0],()=>`<style>${css}</style>`);}
const license=await readFile(resolve(root,'node_modules/three/LICENSE'),'utf8');
html=html.replace('</body>',()=>`<script type="application/json" id="third-party-licenses">${JSON.stringify({three:license}).replace(/</g,'\\u003c')}</script>\n</body>`);
await writeFile(resolve(root,'dist/Synthetic-Clawd-King.html'),html);
await copyFile(resolve(root,'node_modules/three/LICENSE'),resolve(root,'dist/THREE-LICENSE.txt'));
await writeFile(resolve(root,'dist/START-HERE.txt'),`Synthetic Clawd — The King Awakens\n\n简体中文\n1. 单文件版：用支持 WebGL 的现代浏览器打开 Synthetic-Clawd-King.html。\n2. 若本地文件受浏览器安全策略限制，在此目录运行 python -m http.server 8080，再访问 http://localhost:8080。\n3. 标准部署版：将 index.html 和 assets/ 一起放到任意静态网站。无需服务器业务逻辑、账号或 API Key。\n4. 合成第八级蟹王，会进入第一人称战斗。开始战斗按钮请求鼠标锁定；锁定失败时按住拖动瞄准。手机有触控操作。\n5. 第一次进入后，可从图鉴再次挑战。失败可直接重试；胜利返回原棋盘。\n6. 记录保存在浏览器 localStorage，绑定网页来源。旧版同源记录沿用。不同域名/端口/浏览器不会自动共享记录。\n\nControls\nWASD: move | Mouse: aim | Space: jump | Shift: sprint | Ctrl: slide/crouch | Hold left click: bubbles | Esc: pause\n\nBuilt without external images, audio files or models. Three.js MIT license: THREE-LICENSE.txt.\n`);
console.log(`Standalone built: dist/Synthetic-Clawd-King.html (${Buffer.byteLength(html)} bytes)`);
