// /portal — a ring of light opens on your face, the camera flies through it
import { seg, ease, lerp } from '../stage.js';
const FRAG = `
uniform sampler2D img; uniform vec2 c; uniform float r; uniform float big; uniform float z; uniform float blur; uniform float on;
vec3 tap(vec2 q){ return texture(img, clamp(q,0.,1.)).rgb; }
void main(){
  vec2 px = uv*res; vec2 d = px - c; float dist = length(d);
  vec3 col;
  if (dist < r) {
    vec2 q = (c + d * (big / r)) / res;       // the other side: the whole shot, small
    col = tap(q);
    col *= 0.85 + 0.15*smoothstep(r, r*0.6, dist);
  } else {
    vec3 acc = vec3(0.);
    for (int i=0;i<10;i++){ float s = 1.0 - blur*float(i)/10.; acc += tap((c + d/(z) * s)/res); }
    col = acc/10.;
    col *= 1. - 0.3*on;
  }
  // rings of light
  float a = atan(d.y,d.x);
  for (int i=0;i<4;i++){
    float rr = r*(1.0 + 0.075*float(i));
    float w = 2.0 + 1.6*float(3-i);
    float dash = 0.55 + 0.45*step(0.35, fract(a*(3.+float(i))/6.2831 + t*(0.6+0.3*float(i))*(mod(float(i),2.)*2.-1.)));
    float ring = exp(-pow((dist-rr)/w,2.)) * dash * (1.0 - 0.22*float(i));
    col = mix(col, mix(vec3(1.), vec3(0.79,0.66,1.0), 0.25*float(i)), clamp(ring*on,0.,1.));
  }
  float halo = exp(-pow((dist-r)/(r*0.09+6.),2.)) * 0.22 * on;
  col += halo;
  o = vec4(col,1.);
}`;
export default {
  init(S) { this.g = S.shader(FRAG); },
  async frame(S, k, p, f) {
    const h = S.head(f), c = [h.cx, h.fy - 30];
    const open = ease.back(seg(p, 0.0, 0.22));
    const fly = ease.in(seg(p, 0.46, 0.84));
    const R0 = 190, BIG = 1700;
    let r = R0 * open * (1 + 0.03 * Math.sin(p * 40));
    r = r * Math.exp(Math.log(BIG / R0) * fly);
    const on = p < 0.84 ? 1 : 0;
    const z = 1 + (r / R0 - 1) * 0.35;
    let big = BIG; if (p >= 0.84) { r = 1e5; big = 1e5; }
    this.g.tex('img', await S.full(f)).set('c', c).set('r', Math.max(r, 0.01)).set('big', big)
      .set('z', Math.max(1, z)).set('blur', 0.12 * fly).set('on', on * Math.min(1, open * 1.5)).set('t', p * 3).draw();
  },
};
