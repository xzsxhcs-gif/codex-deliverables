import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// A local static-file preview only. No account, database endpoint or upload API.
const root = await realpath(resolve(process.argv[2] ?? fileURLToPath(new URL('../dist/', import.meta.url))));
const port = Number(process.argv[3] ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('请提供有效端口。');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  try {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    let target = resolve(root, `.${path}`);
    let info = await stat(target);
    if (info.isDirectory()) { target = resolve(target, 'index.html'); info = await stat(target); }
    target = await realpath(target);
    const within = relative(root, target);
    if (within.startsWith(`..${sep}`) || within === '..' || !info.isFile()) throw new Error('Not a public file');
    response.writeHead(200, { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (request.method === 'HEAD') response.end(); else createReadStream(target).pipe(response);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('这里没有这份文件。'); }
});
server.on('error', error => { console.error(`预览无法启动：${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`昨日的我：http://localhost:${port}\n仅在本机提供静态文件；按 Ctrl+C 退出。`));
