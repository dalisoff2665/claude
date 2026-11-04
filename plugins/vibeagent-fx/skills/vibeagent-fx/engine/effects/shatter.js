// /shatter — the shot cracks like glass and flies apart around you, then snaps back
import { seg, ease, lerp, rng, W, H, C } from '../stage.js';
export default {
  init(S) {
    this.cv = S.canvas(); this.ctx = this.cv.getContext('2d');
    const h = S.head(S.fi((0)));
  },
  build(I) {
    const r = rng(5), RINGS = [0, 120, 260, 430, 650, 950, 1500], SEC = 12;
    const ang = RINGS.map((_, i) => Array.from({ length: SEC }, (_, j) => (j + (i ? (r() - 0.5) * 0.7 : 0)) / SEC * Math.PI * 2));
    const rad = RINGS.map((R, i) => Array.from({ length: SEC }, () => R * (i ? 1 + (r() - 0.5) * 0.18 : 0)));
    const pt = (i, j) => { j = (j + SEC) % SEC; return [I[0] + Math.cos(ang[i][j]) * rad[i][j], I[1] + Math.sin(ang[i][j]) * rad[i][j]]; };
    this.sh = [];
    for (let i = 0; i < RINGS.length - 1; i++) for (let j = 0; j < SEC; j++) {
      const poly = i === 0 ? [I, pt(1, j), pt(1, j + 1)] : [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)];
      const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length, cy = poly.reduce((a, q) => a + q[1], 0) / poly.length;
      const dx = cx - I[0], dy = cy - I[1], d = Math.hypot(dx, dy) || 1;
      this.sh.push({ poly, cx, cy, ux: dx / d, uy: dy / d, sp: 260 + r() * 520 + d * 0.35, rot: (r() - 0.5) * 2.2, flip: 1 + r() * 2, ring: i });
    }
    this.I = I;
  },
  async frame(S, k, p, f) {
    const c = this.ctx, h = S.head(f);
    if (!this.sh) this.build([h.cx, h.fy - 30]);
    const [img, cut] = await Promise.all([S.full(f), S.cut(f)]);
    const crack = seg(p, 0.04, 0.2);
    const fly = ease.out(seg(p, 0.22, 0.5)) * (1 - ease.io(seg(p, 0.64, 0.9)));
    c.globalAlpha = 1;
    if (fly <= 0.0005) {
      c.drawImage(img, 0, 0);
      const ca = crack * (1 - seg(p, 0.9, 1.0));
      if (ca > 0) this.lines(c, ca, crack);
      return;
    }
    // behind the glass: dark room, you stay
    c.fillStyle = C.ink; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(this.I[0], this.I[1], 50, this.I[0], this.I[1], 900);
    g.addColorStop(0, 'rgba(98,0,255,.22)'); g.addColorStop(1, 'rgba(98,0,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.drawImage(cut, 0, 0);
    for (const s of this.sh) {
      const t = fly, dx = s.ux * s.sp * t, dy = s.uy * s.sp * t + 380 * t * t;
      c.save(); c.translate(s.cx + dx, s.cy + dy); c.rotate(s.rot * t);
      c.scale(Math.cos(s.flip * t * 1.4) * (1 - 0.15 * t), 1 - 0.15 * t);
      c.translate(-s.cx, -s.cy);
      c.beginPath(); s.poly.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath();
      c.save(); c.clip(); c.drawImage(img, 0, 0); c.fillStyle = `rgba(255,255,255,${0.08 * t})`; c.fill(); c.restore();
      c.strokeStyle = `rgba(255,255,255,${0.7})`; c.lineWidth = 2.2; c.stroke();
      c.restore();
    }
  },
  lines(c, a, grow) {
    c.save(); c.strokeStyle = `rgba(255,255,255,${0.85 * a})`; c.lineWidth = 2.4;
    const maxR = 1600 * ease.out(grow);
    for (const s of this.sh) {
      if (Math.hypot(s.cx - this.I[0], s.cy - this.I[1]) > maxR) continue;
      c.beginPath(); s.poly.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath(); c.stroke();
    }
    c.restore();
  },
};
