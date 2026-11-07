// /grid-dive — pull back into a wall of tiles (other moments of the take), then dive back in
import { seg, ease, lerp, W, H } from '../stage.js';
const COLS = 7, ROWS = 7, GAP = 70, TW = 360, TH = 450, R = 70;
export default {
  async init(S) {
    S.paper();
    this.cv = S.canvas(); this.ctx = this.cv.getContext('2d');
    this.tiles = []; let n = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (r === ROWS >> 1 && c === COLS >> 1) { this.tiles.push(null); continue; }
      const t = document.createElement('canvas'); t.width = TW; t.height = TH; const x = t.getContext('2d');
      const f = Math.floor(((n++ * 7919) % 97) / 97 * (S.n - 1));
      x.beginPath(); x.roundRect(0, 0, TW, TH, R * TW / W); x.clip(); x.drawImage(await S.full(f), 0, 0, TW, TH);
      this.tiles.push(t);
    }
  },
  async frame(S, k, p, f) {
    const c = this.ctx, img = await S.full(f);
    const out = ease.expoIo(seg(p, 0.0, 0.34)) * (1 - ease.expoIo(seg(p, 0.66, 1.0)));
    const s = Math.exp(lerp(0, Math.log(0.17), out));
    const drift = Math.sin(seg(p, 0.2, 0.8) * Math.PI);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    c.translate(540 - 40 * drift, 675 + 20 * drift); c.rotate(-5 * out * Math.PI / 180); c.scale(s, s);
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
      const x = (col - (COLS >> 1)) * (W + GAP) - W / 2, y = (r - (ROWS >> 1)) * (H + GAP) - H / 2;
      const sx = Math.abs(x + W / 2) * s, sy = Math.abs(y + H / 2) * s;   // cull tiles fully off screen
      if (sx - W * s / 2 > 820 || sy - H * s / 2 > 900) continue;
      const t = this.tiles[r * COLS + col];
      if (t) c.drawImage(t, x, y, W, H);
      else { c.save(); c.beginPath(); c.roundRect(x, y, W, H, R * out); c.clip(); c.drawImage(img, x, y); c.restore(); }
    }
  },
};
