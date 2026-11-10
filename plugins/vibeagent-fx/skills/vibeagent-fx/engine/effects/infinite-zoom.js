// /infinite-zoom — a window with your shot inside your shot; the camera zooms through, two levels deep
import { seg, ease, lerp } from '../stage.js';
const FRAG = `
uniform sampler2D img; uniform vec2 cw; uniform float s; uniform float Z; uniform vec2 A; uniform float on;
float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
void main(){
  vec2 q = A + (uv - A)/Z;
  vec3 col = vec3(0.); float lvl = 0.; bool done = false;
  for (int i=0;i<7;i++){
    vec2 dp = (q - cw)*res;                      // px relative to window centre
    vec2 half_ = 0.5*s*res;
    float d = sdRR(dp, half_, 34.*s/0.3);
    if (on > 0.0 && d < 0.){
      float bw = 10.*s/0.3;
      if (d > -bw){ col = vec3(1.); done = true; break; }   // white frame
      q = vec2(0.5) + (q - cw)/s;                 // step into the window
      lvl += 1.;
    } else {
      col = texture(img, clamp(q,0.,1.)).rgb;
      float sh = (on > 0.0) ? smoothstep(60.*s/0.3, 0., d) * 0.45 : 0.;
      col *= 1. - sh;
      done = true; break;
    }
  }
  o = vec4(col,1.);
}`;
export default {
  init(S) { this.g = S.shader(FRAG); },
  async frame(S, k, p, f) {
    const h = S.head(f);
    const appear = ease.back(seg(p, 0.0, 0.16)) * (1 - ease.in(seg(p, 0.88, 1.0)));
    const s0 = 0.3, s = Math.max(0.001, s0 * appear);
    const cw = [0.74, 0.2];
    const A = [(cw[0] - 0.5 * s0) / (1 - s0), (cw[1] - 0.5 * s0) / (1 - s0)];
    const z = p >= 0.86 ? 1 : Math.exp(Math.log(1 / s0) * 2 * ease.io(seg(p, 0.18, 0.86)));
    this.g.tex('img', await S.full(f)).set('cw', cw).set('s', s).set('Z', z).set('A', A).set('on', appear > 0.002 ? 1 : 0).draw();
  },
};
