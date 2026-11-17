// /pull-back-reveal — the camera pulls back: your shot is the preview inside Claude Code
import { seg, ease, lerp, W, H, C } from '../stage.js';
const P = { x: 560, y: 440, w: 420, h: 525 };   // 4:5 preview inside the window (final layout)
const LINES = [
  ['$ claude', '#E9E6F7'], ['› /pull-back avatar.mp4', C.lav], ['  ✓ лицо и фон найдены', '#8E89A8'],
  ['  ✓ сцена 1080×1350', '#8E89A8'], ['  ✓ звук не тронут', '#8E89A8'], ['  ▸ рендер 100%', '#E9E6F7'],
  ['› /grid-dive /portal /shatter', C.lav],
];
export default {
  init(S) {
    S.paper();
    const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
    this.g = S.el('div', `position:absolute;inset:0;transform-origin:${pcx}px ${pcy}px`);
    S.el('div', `position:absolute;left:60px;top:330px;width:960px;height:690px;border-radius:30px;background:#0E0B1F;box-shadow:0 50px 100px rgba(14,11,31,.3)`, this.g,
      `<div style="height:62px;display:flex;align-items:center;gap:11px;padding:0 26px;border-bottom:1px solid #241F3A">
        <i style="width:14px;height:14px;border-radius:50%;background:#4A4560"></i><i style="width:14px;height:14px;border-radius:50%;background:#4A4560"></i><i style="width:14px;height:14px;border-radius:50%;background:#4A4560"></i>
        <span style="margin-left:14px;font:500 20px 'JetBrains Mono';color:#8E89A8">claude code — ~/reels</span>
        <span style="margin-left:auto;font:500 18px 'JetBrains Mono';color:${C.lav};border:1px solid #3A3356;border-radius:14px;padding:4px 12px">1080×1350</span></div>`);
    this.term = S.el('div', `position:absolute;left:96px;top:430px;width:440px;font:500 22px/1.75 'JetBrains Mono';white-space:pre`, this.g);
    this.lines = LINES.map(([t, col]) => S.el('div', `color:${col};opacity:0`, this.term, t));
    this.prev = S.canvas(`left:${P.x}px;top:${P.y}px;width:${P.w}px;height:${P.h}px;border-radius:0px`, this.g, W, H);
    this.badge = S.el('div', `position:absolute;left:${P.x}px;top:${P.y + P.h + 18}px;width:${P.w}px;display:flex;gap:10px;align-items:center;font:700 20px Onest;color:#E9E6F7`, this.g,
      `<span style="width:12px;height:12px;border-radius:50%;background:${C.indigo}"></span>превью · 0:04`);
  },
  async frame(S, k, p, f) {
    this.prev.getContext('2d').drawImage(await S.full(f), 0, 0);
    const out = ease.expoIo(seg(p, 0.0, 0.32)) * (1 - ease.expoIo(seg(p, 0.74, 1.0)));
    const z0 = W / P.w, lz = lerp(Math.log(z0), 0, out), z = Math.exp(lz), q = 1 - lz / Math.log(z0);
    const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
    this.g.style.transform = `translate(${lerp(540 - pcx, 0, q)}px,${lerp(675 - pcy, 0, q)}px) scale(${z})`;
    this.prev.style.borderRadius = `${18 * out}px`;
    const shown = seg(p, 0.2, 0.62) * this.lines.length;
    this.lines.forEach((l, i) => { l.style.opacity = Math.max(0, Math.min(1, shown - i)); });
  },
};
