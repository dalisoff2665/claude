// Frame-by-frame renderer: headless Chromium draws each frame of an effect, ffmpeg encodes.
// node engine/render.mjs --work work/take --plan plan.json --out out/ [--snap 6] [--only id1,id2]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]]) : a), []));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const work = args.work, outDir = path.resolve(args.out || 'out');
const plan = JSON.parse(fs.readFileSync(args.plan, 'utf8'));
const snap = args.snap ? +args.snap : 0;
const only = args.only ? String(args.only).split(',') : null;
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' });
  fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-web-security'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/engine/page.html`);
const info = await page.evaluate(w => window.boot(w), work);
const fps = info.fps;

for (const s of plan.segments) {
  if (only && !only.includes(s.id)) continue;
  const from = s.from, to = Math.min(s.to, info.n), N = to - from;
  await page.evaluate(([e, o, a, b]) => window.runSeg(e, o, a, b), [s.effect, s.opts || {}, from, to]);
  const t0 = Date.now();
  if (snap) {
    const tmp = fs.mkdtempSync(path.join(outDir, '.snap-'));
    for (let j = 0; j < snap; j++) {
      const k = Math.round((j + 0.5) / snap * (N - 1));
      await page.evaluate(([k, p, f]) => window.drawFrame(k, p, f), [k, k / (N - 1), from + k]);
      fs.writeFileSync(path.join(tmp, `${j}.jpg`), await page.screenshot({ type: 'jpeg', quality: 85 }));
    }
    const cols = Math.min(snap, 6), rows = Math.ceil(snap / cols);
    await run('ffmpeg', ['-v', 'error', '-y', '-i', path.join(tmp, '%d.jpg'), '-vf', `scale=360:450,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', path.join(outDir, `${s.id}_snap.jpg`)]);
    fs.rmSync(tmp, { recursive: true });
  } else {
    const out = path.join(outDir, `${s.id}.mp4`);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let k = 0; k < N; k++) {
      await page.evaluate(([k, p, f]) => window.drawFrame(k, p, f), [k, N > 1 ? k / (N - 1) : 0, from + k]);
      const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  console.log(`${s.id} (${s.effect}) ${N}f ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close(); server.close();

function run(cmd, a) { return new Promise((res, rej) => spawn(cmd, a, { stdio: 'inherit' }).on('close', c => (c ? rej(new Error(cmd + ' ' + c)) : res()))); }
