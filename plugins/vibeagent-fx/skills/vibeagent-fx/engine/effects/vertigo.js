// /vertigo — dolly zoom: the room stretches away behind you, you stay put
import { seg, ease, lerp, W, H, C } from '../stage.js';
export default {
  init(S) { this.cv = S.canvas(); this.ctx = this.cv.getContext('2d'); },
  async frame(S, k, p, f) {
    const c = this.ctx, h = S.head(f);
    const [img, cut] = await Promise.all([S.full(f), S.cut(f)]);
    const mixIn = ease.io(seg(p, 0.0, 0.12)) * (1 - ease.io(seg(p, 0.88, 1.0)));
    const dz = ease.io(seg(p, 0.06, 0.9));
    const ox = h.cx, oy = h.fy + 40;
    // background: paper + rushing frames + radial lines
    c.fillStyle = C.paper; c.fillRect(0, 0, W, H);
    c.save(); c.translate(ox, oy);
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * Math.PI * 2 + 0.07 * Math.sin(i * 3.1);
      const r0 = 300 + ((i * 97) % 140), len = 900;
      c.strokeStyle = i % 5 === 0 ? 'rgba(98,0,255,.28)' : 'rgba(14,11,31,.10)'; c.lineWidth = i % 5 === 0 ? 3 : 2;
      c.beginPath(); c.moveTo(Math.cos(a) * r0 * (1 + dz * 0.5), Math.sin(a) * r0 * (1 + dz * 0.5)); c.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len)); c.stroke();
    }
    // nested squares stretching away (the dolly)
    const sq = lerp(0.55, 1.45, dz);
    for (let i = 5; i >= 0; i--) {
      const s = 720 * sq * Math.pow(0.72, i) * (1 + 0.04 * Math.sin(p * 12 + i));
      c.fillStyle = i === 0 ? C.indigo : i % 2 ? '#7A33FF' : '#8F55FF';
      c.globalAlpha = i === 0 ? 1 : 0.18 + 0.1 * i;
      const rr = 60 * Math.pow(0.8, i);
      c.beginPath(); c.roundRect(-s / 2, -s / 2 - 60, s, s, rr); c.fill();
    }
    c.restore(); c.globalAlpha = 1;
    // you: counter-scale slightly (dolly zoom)
    const ps = lerp(1.0, 1.05, dz);
    c.save(); c.translate(h.cx, H * 1.02); c.scale(ps, ps); c.translate(-h.cx, -H * 1.02); c.drawImage(cut, 0, 0); c.restore();
    if (mixIn < 1) { c.globalAlpha = 1 - mixIn; c.drawImage(img, 0, 0); c.globalAlpha = 1; }
  },
};
