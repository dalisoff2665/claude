// /screen-in-screen — pull back: you are playing on a laptop screen on the desk
import { seg, ease, lerp, W, H, C } from '../stage.js';
const SW = 860, SH = 538, SCX = 540, SCY = 660;   // laptop screen, final layout
export default {
  init(S) {
    S.paper();
    this.g = S.el('div', `position:absolute;inset:0;transform-origin:${SCX}px ${SCY}px`);
    // lid
    S.el('div', `position:absolute;left:${SCX - SW / 2 - 22}px;top:${SCY - SH / 2 - 22}px;width:${SW + 44}px;height:${SH + 50}px;border-radius:30px 30px 10px 10px;
      background:#16151c;box-shadow:0 0 0 2px #c9ccd4, 0 40px 80px rgba(14,11,31,.25)`, this.g);
    S.el('div', `position:absolute;left:${SCX - 4}px;top:${SCY - SH / 2 - 14}px;width:8px;height:8px;border-radius:50%;background:#2c2b35`, this.g);
    this.scr = S.canvas(`left:${SCX - SW / 2}px;top:${SCY - SH / 2}px;width:${SW}px;height:${SH}px;border-radius:6px`, this.g, SW, SH);
    S.el('div', `position:absolute;left:${SCX - SW / 2}px;top:${SCY - SH / 2}px;width:${SW}px;height:${SH}px;border-radius:6px;
      background:linear-gradient(115deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 38%)`, this.g);
    // deck
    S.el('div', `position:absolute;left:${SCX - 560}px;top:${SCY + SH / 2 + 28}px;width:1120px;height:44px;
      clip-path:polygon(4% 0,96% 0,100% 70%,99% 100%,1% 100%,0 70%);background:linear-gradient(#e9ebef,#c3c6ce 70%,#9fa3ad)`, this.g);
    S.el('div', `position:absolute;left:${SCX - 90}px;top:${SCY + SH / 2 + 28}px;width:180px;height:12px;border-radius:0 0 12px 12px;background:#b4b8c1`, this.g);
    S.el('div', `position:absolute;left:${SCX - 520}px;top:${SCY + SH / 2 + 80}px;width:1040px;height:40px;border-radius:50%;
      background:radial-gradient(closest-side,rgba(14,11,31,.22),rgba(14,11,31,0))`, this.g);
    this.ff = S.canvas('');
  },
  async frame(S, k, p, f) {
    const img = await S.full(f), h = S.head(f);
    const bandH = W * SH / SW, y0 = Math.max(0, Math.min(H - bandH, h.fy - bandH * 0.45));
    this.scr.getContext('2d').drawImage(img, 0, y0, W, bandH, 0, 0, SW, SH);
    const ff = this.ff.getContext('2d'); ff.drawImage(img, 0, 0);
    const out = ease.expoIo(seg(p, 0.02, 0.34)) * (1 - ease.expoIo(seg(p, 0.7, 0.98)));
    const z0 = W / SW, z = Math.exp(lerp(Math.log(z0), 0, out));
    const bandC = y0 + bandH / 2, Y = lerp(bandC, SCY, out);
    this.g.style.transform = `translate(0px,${Y - SCY}px) scale(${z})`;
    this.ff.style.transformOrigin = `540px ${bandC}px`;
    this.ff.style.transform = `translate(0px,${Y - bandC}px) scale(${z / z0})`;
    this.ff.style.opacity = 1 - ease.io(seg(out, 0.0, 0.35));
  },
};
