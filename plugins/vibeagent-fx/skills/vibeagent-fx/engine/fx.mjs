#!/usr/bin/env node
// VibeAgent FX — one effect on your clip, MP4 back with your audio.
//   node fx.mjs <effect> <clip.mp4> [--words "ТЕКСТ"] [--out result.mp4]
//   node fx.mjs --list            node fx.mjs --setup
// First run installs the engine into ~/.vibeagent-fx (Chromium for rendering, fonts, a small
// Python venv and the matting model). Nothing is sent anywhere: everything renders on your machine.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const EFFECTS = ['grid-dive', 'title-orbit', 'magnifying-lens', 'portal', 'clone-room', 'infinite-zoom', 'cube-spin', 'liquid-glass',
  'screen-in-screen', 'frame-break', 'tile-tunnel', 'depth-ui', 'vertigo', 'phone-fan', 'shatter', 'spotlight',
  'pull-back-reveal', 'ribbon-wrap', 'zoom-through', 'head-pop-out'];
const VERSION = '1.0.0';
const SRC = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.VIBEAGENT_FX_HOME || path.join(os.homedir(), '.vibeagent-fx');
const WIN = process.platform === 'win32';
const PY = path.join(HOME, 'venv', WIN ? 'Scripts' : 'bin', WIN ? 'python.exe' : 'python');
const MODEL = path.join(HOME, 'models', 'rvm_mobilenetv3_fp32.onnx');
const MODEL_URL = 'https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx';

const say = (m) => console.log(`[fx] ${m}`);
const die = (m, code = 1) => { console.error(`[fx] ${m}`); process.exit(code); };
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: opts.quiet ? 'pipe' : 'inherit', cwd: opts.cwd || HOME, shell: WIN, env: { ...process.env, ...(opts.env || {}) } });
  if (r.status !== 0 && !opts.soft) die(`${cmd} ${args.slice(0, 3).join(' ')} … завершился с ошибкой (${r.status}).`);
  return r;
};
const has = (cmd) => spawnSync(cmd, ['-version'], { stdio: 'ignore', shell: WIN }).status === 0 || spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: WIN }).status === 0;

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return null; const v = argv[i + 1]; argv.splice(i, 2); return v ?? ''; };
if (argv.includes('--list')) { console.log(EFFECTS.map((e, i) => `${String(i + 1).padStart(2, '0')} /${e}`).join('\n')); process.exit(0); }
const onlySetup = argv.includes('--setup');
const words = flag('--words');
const outArg = flag('--out');
const [effect, clipArg] = argv.filter(a => !a.startsWith('--'));

// ---------- checks ----------
const nodeMajor = +process.versions.node.split('.')[0];
if (nodeMajor < 18) die(`Нужен Node 18 или новее, у вас ${process.versions.node}. Скачать: https://nodejs.org/`);
const missing = ['ffmpeg', 'ffprobe', WIN ? 'python' : 'python3'].filter(c => !has(c));
if (missing.length) die(`Не найдено: ${missing.join(', ')}.\n  macOS:   brew install ffmpeg python\n  Windows: winget install Gyan.FFmpeg Python.Python.3.12\n  Linux:   sudo apt install ffmpeg python3 python3-venv`, 2);
if (!onlySetup) {
  if (!effect || !EFFECTS.includes(effect)) die(`Укажите эффект: ${EFFECTS.join(', ')}`);
  if (!clipArg || !fs.existsSync(clipArg)) die(`Не нашёл клип: ${clipArg || '(не указан)'}. Запускайте из папки с видео или дайте полный путь.`);
}

// ---------- one-time setup ----------
fs.mkdirSync(path.join(HOME, 'models'), { recursive: true });
const marker = path.join(HOME, `.ready-${VERSION}`);
if (!fs.existsSync(marker)) {
  say(`Первый запуск: ставлю движок в ${HOME} (около 5 минут, один раз).`);
  if (!fs.existsSync(path.join(HOME, 'package.json')))
    fs.writeFileSync(path.join(HOME, 'package.json'), JSON.stringify({ name: 'vibeagent-fx-home', private: true }, null, 2));
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', 'playwright@1', '@fontsource/onest@5', '@fontsource/jura@5',
    '@fontsource/prosto-one@5', '@fontsource/jetbrains-mono@5']);
  run('npx', ['playwright', 'install', 'chromium']);
  if (!fs.existsSync(PY)) run(WIN ? 'python' : 'python3', ['-m', 'venv', path.join(HOME, 'venv')]);
  run(PY, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
  run(PY, ['-m', 'pip', 'install', '--quiet', 'numpy', 'opencv-python-headless', 'onnxruntime']);
  if (!fs.existsSync(MODEL)) {
    say('Скачиваю модель отделения человека от фона (15 МБ)…');
    const r = await fetch(MODEL_URL);
    if (!r.ok) die(`Не скачалась модель: HTTP ${r.status}`);
    fs.writeFileSync(MODEL, Buffer.from(await r.arrayBuffer()));
  }
  fs.writeFileSync(marker, new Date().toISOString());
  say('Движок готов.');
}
// engine files always come from the plugin, so an update of the plugin updates the effects
fs.cpSync(SRC, path.join(HOME, 'engine'), { recursive: true, force: true, filter: (s) => !s.endsWith('fx.mjs') });
if (onlySetup) process.exit(0);

// ---------- prepare the clip (cached per file) ----------
const clip = path.resolve(clipArg);
const st = fs.statSync(clip);
const key = crypto.createHash('sha1').update(`${clip}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 10);
const workRel = path.join('work', `${path.basename(clip).replace(/[^\w.-]+/g, '_')}-${key}`);
const work = path.join(HOME, workRel);
const t0 = Date.now();
if (!fs.existsSync(path.join(work, 'meta.json'))) {
  say('Готовлю клип: кадр 4:5 и маска человека…');
  run(PY, [path.join(HOME, 'engine', 'prep.py'), clip, work, '--model', MODEL]);
}
const meta = JSON.parse(fs.readFileSync(path.join(work, 'meta.json'), 'utf8'));
if (meta.n < 30) die('Клип слишком короткий: нужно хотя бы 1–2 секунды, лучше 4–6.');

// ---------- render ----------
const opts = {};
if (words) opts.words = effect === 'title-orbit' ? words.toUpperCase().slice(0, 24) : words.slice(0, 80);
const tmp = fs.mkdtempSync(path.join(work, 'r-'));
const plan = path.join(tmp, 'plan.json');
fs.writeFileSync(plan, JSON.stringify({ segments: [{ id: effect, effect, from: 0, to: meta.n, opts }] }));
say(`Рендерю /${effect}: ${meta.n} кадров…`);
run('node', [path.join(HOME, 'engine', 'render.mjs'), '--work', workRel.split(path.sep).join('/'), '--plan', plan, '--out', tmp]);

// ---------- your audio back ----------
const out = path.resolve(outArg || path.join(path.dirname(clip), `${path.parse(clip).name}-${effect}.mp4`));
const audio = path.join(work, 'audio.m4a');
const hasAudio = fs.existsSync(audio) && fs.statSync(audio).size > 1000;
run('ffmpeg', ['-v', 'error', '-y', '-i', path.join(tmp, `${effect}.mp4`), ...(hasAudio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
  '-c:v', 'copy', '-movflags', '+faststart', out]);
fs.rmSync(tmp, { recursive: true, force: true });
say(`Готово за ${((Date.now() - t0) / 1000).toFixed(0)} с → ${out}  (1080×1350, ${hasAudio ? 'ваш звук' : 'без звука'})`);
