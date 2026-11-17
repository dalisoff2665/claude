// /title-orbit — your words circle your head like a ring, then the camera flies through a letter
import { seg, ease, lerp, W, H } from '../stage.js';
export default {
  init(S, o) {
    this.cv = S.canvas(); this.ctx = this.cv.getContext('2d');
    const words = (o.words || 'ЦИФРОВОЙ АВАТАР').toUpperCase();
    this.size = o.size || 104;
    this.ctx.font = `800 ${this.size}px Onest`;
    this.unit = (words + ' • ');
  },
  async frame(S, k, p, f) {
    const c = this.ctx, h = S.head(f), fs = this.size;
    const [img, cut] = await Promise.all([S.full(f), S.cut(f)]);
    const rx = Math.max(h.hw * 0.92, 400), ry = rx * 0.2, cx = h.cx, y0 = h.top + h.hw * 0.44;
    c.font = `800 ${fs}px Onest`;
    // fill the circle with whole repeats of the phrase
    const unitW = c.measureText(this.unit).width, circ = 2 * Math.PI * rx;
    const reps = Math.max(1, Math.round(circ / unitW));
    const text = this.unit.repeat(reps), scaleArc = circ / (unitW * reps);
    const grow = ease.back(seg(p, 0.0, 0.18));
    const flyT = seg(p, 0.74, 0.93);
    const spin = Math.min(p, 0.74) * Math.PI * 2.1;
    // letters with angle (theta=0 is front centre)
    const L = []; let acc = 0;
    for (const ch of text) { const w = c.measureText(ch).width * scaleArc; L.push({ ch, th: (acc + w / 2) / rx + spin, w }); acc += w; }
    // camera: zoom into the front-most letter
    let front = L[0]; for (const l of L) if (Math.cos(l.th) > Math.cos(front.th)) front = l;
    const fx = cx + rx * Math.sin(front.th), fy = y0 + ry * Math.cos(front.th);
    const z = Math.exp(lerp(0, Math.log(26), ease.in(flyT)));
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    c.setTransform(z, 0, 0, z, fx - fx * z, fy - fy * z);
    c.drawImage(img, 0, 0);
    const draw = (back) => {
      for (const l of L) {
        const cs = Math.cos(l.th); if ((cs < 0) !== back) continue;
        const x = cx + rx * Math.sin(l.th) * grow, y = y0 + ry * cs * grow;
        const ps = (1 + 0.16 * cs) * grow;
        c.save(); c.translate(x, y); c.scale(Math.max(0.02, Math.abs(cs)) * Math.sign(cs || 1) * ps, ps);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18;
        c.fillStyle = back ? 'rgba(255,255,255,.72)' : '#fff';
        c.fillText(l.ch, 0, 0); c.restore();
      }
    };
    if (grow > 0.001) draw(true);
    c.drawImage(cut, 0, 0);
    if (grow > 0.001) draw(false);
    c.setTransform(1, 0, 0, 1, 0, 0);
    // through the letter: white, then back to the take
    const wht = ease.in(seg(p, 0.86, 0.93)) * (1 - ease.out(seg(p, 0.93, 1.0)));
    if (p > 0.93) { c.globalAlpha = 1; c.drawImage(img, 0, 0); }
    if (wht > 0) { c.fillStyle = `rgba(255,255,255,${wht})`; c.fillRect(0, 0, W, H); }
  },
};
