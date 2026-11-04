// the untouched take
export default {
  init(S) { this.cv = S.canvas(); this.ctx = this.cv.getContext('2d'); },
  async frame(S, k, p, f) { this.ctx.drawImage(await S.full(f), 0, 0); },
};
