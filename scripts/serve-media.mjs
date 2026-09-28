// 动态壁纸的本地视频服务：把 assets/ 下的 mp4 用 HTTP 暴露给新标签页。
//
// 为什么要有这个脚本：58 段视频接近 2GB，塞进扩展包会让 wxt build 每次都整份复制、
// zip 直接撑爆、chrome://extensions 加载也卡死；而 <video> 又必须有支持 Range 的
// HTTP 源才能拖动/循环。所以视频留在仓库里按需串流，封面（1.5MB）才打进包里。
//
// 用法：
//   npm run media                      → http://127.0.0.1:4321
//   npm run media -- --port 5000       → 换端口（插件设置里填同一个地址）
// 只放行 /videos/<名称>.mp4 与 /thumbnails/<名称>.jpg，其它路径一律 404。
import { createServer } from 'node:http';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'assets');
const ALLOWED_DIRS = new Set(['videos', 'thumbnails']);
const TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const portFlag = process.argv.indexOf('--port');
const PORT = Number(process.env.PORT || (portFlag > -1 ? process.argv[portFlag + 1] : '') || 4321);

function count(dir) {
  try {
    return readdirSync(join(ROOT, dir)).length;
  } catch {
    return 0;
  }
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = createServer((req, res) => {
  // 扩展页面（chrome-extension://）跨源 fetch 需要 CORS；这里没有凭据，直接放开
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  if (req.method === 'OPTIONS') return send(res, 204, {}, '');

  let pathname = '/';
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
  } catch {
    return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'bad request');
  }

  if (pathname === '/__health') {
    return send(
      res,
      200,
      { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      JSON.stringify({ ok: true, videos: count('videos'), thumbnails: count('thumbnails') }),
    );
  }

  // 名称里不允许出现分隔符，天然挡掉 ../ 这类穿越
  const hit = /^\/(videos|thumbnails)\/([\w.-]+)(\.[a-z0-9]+)$/.exec(pathname);
  if (!hit || !ALLOWED_DIRS.has(hit[1]) || !TYPES[hit[3].toLowerCase()]) {
    return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'not found');
  }

  const file = join(ROOT, hit[1], hit[2] + hit[3]);
  let size = 0;
  try {
    size = statSync(file).size;
  } catch {
    return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'no such file');
  }

  const type = TYPES[hit[3].toLowerCase()];
  const common = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');

  if (range) {
    let start = range[1] ? Number(range[1]) : 0;
    let end = range[2] ? Number(range[2]) : size - 1;
    if (range[1] === '' && range[2] !== '') {
      // bytes=-5000 这类「最后若干字节」
      start = Math.max(0, size - Number(range[2]));
      end = size - 1;
    }
    if (!Number.isFinite(start) || start >= size || end < start || end >= size) {
      return send(res, 416, { ...common, 'Content-Range': 'bytes */' + size }, '');
    }
    if (req.method === 'HEAD') {
      return send(res, 206, { ...common, 'Content-Length': String(end - start + 1), 'Content-Range': 'bytes ' + start + '-' + end + '/' + size }, '');
    }
    res.writeHead(206, {
      ...common,
      'Content-Length': String(end - start + 1),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
    });
    stream(req, res, file, start, end);
    return;
  }

  if (req.method === 'HEAD') return send(res, 200, { ...common, 'Content-Length': String(size) }, '');
  res.writeHead(200, { ...common, 'Content-Length': String(size) });
  stream(req, res, file, 0, size - 1);
});

/** 视频播放器会频繁掐断请求，出错直接销毁，别留一堆 unhandled error */
function stream(req, res, file, start, end) {
  const rs = createReadStream(file, { start, end });
  rs.on('error', () => {
    res.destroy();
  });
  res.on('close', () => {
    rs.destroy();
  });
  req.on('error', () => {
    rs.destroy();
  });
  rs.pipe(res);
}

server.listen(PORT, '127.0.0.1', () => {
  const base = 'http://127.0.0.1:' + PORT;
  console.log('动态壁纸视频服务已启动：' + base);
  console.log('  /videos/<名称>.mp4       → assets/videos（' + count('videos') + ' 段）');
  console.log('  /thumbnails/<名称>.jpg   → assets/thumbnails（' + count('thumbnails') + ' 张）');
  console.log('  /__health                → 插件用它判断服务是否在线');
  console.log('插件「设置 → 壁纸 → 动态壁纸」里的服务地址保持默认即可；Ctrl+C 停止。');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 已被占用——多半是已经有一个媒体服务在跑了。');
    process.exit(1);
  }
  throw e;
});
