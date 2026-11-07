// /clone-room — copies of you step out from behind you
import { seg, ease, lerp, W, H } from '../stage.js';
const CL = [ // dx, scale, delay(frames), brightness, blur, start
  { dx: -470, s: 0.66, d: 30, b: 0.78, bl: 1.6, t: 0.12 },
  { dx: 470, s: 0.66, d: 22, b: 0.78, bl: 1.6, t: 0.16 },
  { dx: -300, s: 0.82, d: 14, b: 0.88, bl: 0.7, t: 0.04 },
  { dx: 300, s: 0.82, d: 7, b: 0.88, bl: 0.7, t: 0.08 },
];
export default {
  init(S) { this.cv = S.canvas(); this.ctx = this.cv.getContext('2d'); },
  async frame(S, k, p, f) {
    const c = this.ctx, h = S.head(f);
    c.filter = 'none'; c.drawImage(await S.full(f), 0, 0);
    // a light veil so the clones read as a group in the room
    for (const cl of CL) {
      const e = ease.back(seg(p, cl.t, cl.t + 0.24)) * (1 - ease.in(seg(p, 0.76 + cl.t * 0.3, 0.95)));
      if (e <= 0.001) continue;
      const img = await S.cut(f - cl.d);
      const sc = lerp(1, cl.s, Math.min(1, e)), ax = h.cx, ay = H * 1.08;
      c.save(); c.filter = `brightness(${cl.b}) blur(${cl.bl}px)`;
      c.translate(ax + cl.dx * e, ay); c.scale(sc, sc); c.translate(-ax, -ay);
      c.drawImage(img, 0, 0); c.restore();
    }
    c.filter = 'none';
    c.drawImage(await S.cut(f), 0, 0);
  },
};
