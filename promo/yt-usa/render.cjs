// Рендер рилса: reel.html → кадры (headless Chromium) → ffmpeg.
//   node render.cjs                       полный рендер в build/reel_video.mp4
//   node render.cjs --stills 1.2,7,16     кадры-проверки в build/still-<t>.jpg
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 30, TAIL = 1.6;
const dir = __dirname;
const tl = JSON.parse(fs.readFileSync(path.join(dir, 'build/timeline.json'), 'utf8'));

(async () => {
  const stillsArg = process.argv.indexOf('--stills');
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? {} : {});
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('page:', m.text()); });
  await page.goto('file://' + path.join(dir, 'reel.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(t => window.setup(t), tl);
  fs.writeFileSync(path.join(dir, 'build/sfx.json'), JSON.stringify(await page.evaluate(() => window.SFX), null, 1));

  if (stillsArg > 0) {
    for (const s of process.argv[stillsArg + 1].split(',')) {
      const t = parseFloat(s);
      await page.evaluate(x => window.seek(x), t);
      await page.screenshot({ path: path.join(dir, `build/still-${t}.jpg`), type: 'jpeg', quality: 85 });
      console.log('still', t);
    }
    await browser.close();
    return;
  }

  const total = tl.duration + TAIL, n = Math.ceil(total * FPS);
  const out = path.join(dir, 'build/reel_video.mp4');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate(x => window.seek(x), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`кадр ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('✓', out, n, 'кадров');
})();
