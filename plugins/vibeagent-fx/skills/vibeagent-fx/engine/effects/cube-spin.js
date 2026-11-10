// /cube-spin — the shot becomes the face of a cube that turns twice, then you are back
import { seg, ease, lerp, W, H } from '../stage.js';
export default {
  init(S) {
    S.paper();
    this.shadow = S.el('div', `position:absolute;left:50%;top:1170px;width:760px;height:90px;margin-left:-380px;border-radius:50%;
      background:radial-gradient(closest-side,rgba(14,11,31,.28),rgba(14,11,31,0));filter:blur(6px)`);
    const scene = S.el('div', `position:absolute;inset:0;perspective:2600px;perspective-origin:50% 45%`);
    this.cube = S.el('div', `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-style:preserve-3d`, scene);
    const D = W / 2;
    this.faces = [0, 90, 180, 270].map(a => {
      const cv = S.canvas(`backface-visibility:hidden;transform:rotateY(${a}deg) translateZ(${D}px);border-radius:0px;`, this.cube);
      return cv;
    });
  },
  async frame(S, k, p, f) {
    const img = await S.full(f);
    for (const cv of this.faces) cv.getContext('2d').drawImage(img, 0, 0);
    const out = ease.io(seg(p, 0.0, 0.2)) * (1 - ease.io(seg(p, 0.8, 1.0)));
    const s = lerp(1, 0.56, out);
    const rot = -90 * ease.io(seg(p, 0.18, 0.46)) - 90 * ease.io(seg(p, 0.48, 0.78));
    const tilt = 10 * out;
    const r = 34 * out;
    for (const cv of this.faces) cv.style.borderRadius = `${r}px`;
    // keep the visible face flush with the screen when scale is 1
    this.cube.style.transform = `translateY(${50 * out}px) translateZ(${-W / 2}px) scale(${s}) rotateX(${-tilt * 0.35}deg) rotateY(${rot}deg)`;
    this.cube.style.transformOrigin = '50% 50% 0px';
    this.shadow.style.opacity = out;
  },
};
