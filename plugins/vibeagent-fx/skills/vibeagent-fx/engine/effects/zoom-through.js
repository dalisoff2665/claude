// /zoom-through — a crash zoom punches through your face and comes out the other side
import { seg, ease, lerp } from '../stage.js';
const FRAG = `
uniform sampler2D img; uniform vec2 c; uniform float Z; uniform float bl; uniform float fl;
void main(){
  vec2 px = uv*res; vec2 d = px - c; vec3 acc = vec3(0.);
  for (int i=0;i<14;i++){ float s = 1.0 - bl*float(i)/14.; acc += texture(img, clamp((c + d/(Z) * s)/res, 0., 1.)).rgb; }
  vec3 col = acc/14.;
  col = mix(col, vec3(1.), fl);
  o = vec4(col,1.);
}`;
export default {
  init(S) { this.g = S.shader(FRAG); },
  async frame(S, k, p, f) {
    const h = S.head(f);
    let Z = 1, bl = 0;
    const a = seg(p, 0.08, 0.48), b = seg(p, 0.48, 0.92);
    if (p < 0.48) { Z = Math.exp(lerp(0, Math.log(9), ease.in(a))); bl = 0.35 * ease.in(a); }
    else { Z = Math.exp(lerp(Math.log(3.2), 0, ease.out(b))); bl = 0.3 * (1 - ease.out(b)); }
    const fl = Math.max(0, 1 - Math.abs(p - 0.48) / 0.07) ** 1.5;
    this.g.tex('img', await S.full(f)).set('c', [h.cx, h.fy + 10]).set('Z', Z).set('bl', bl).set('fl', fl).draw();
  },
};
