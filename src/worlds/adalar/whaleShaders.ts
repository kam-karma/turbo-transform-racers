/** GLSL for the whale boss wave (rolling water sheet with foam) and its crest spray. */

export const WAVE_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform float uDanger;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
void main() {
  vUv = uv;
  vec3 p = position;
  // Ripples run along the crest; the lip surges forward and back.
  float crest = smoothstep(0.35, 0.7, uv.y) * (1.0 - smoothstep(0.85, 1.0, uv.y));
  p.y += sin(p.x * 0.35 + uTime * 3.0) * 0.7 * crest + sin(p.x * 0.9 - uTime * 5.0) * 0.25 * crest;
  p.z += sin(uTime * 2.2 + p.x * 0.2) * 0.8 * crest * (1.0 + uDanger);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = cameraPosition - w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

export const WAVE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uDanger;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vView;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), w.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), w.x), w.y);
}
void main() {
  vec3 deep = vec3(0.01, 0.16, 0.46);
  vec3 mid = vec3(0.03, 0.45, 0.82);
  vec3 light = vec3(0.3, 0.85, 1.0);
  float v = vUv.y;
  // v along the profile: back slope < 0.52, crest 0.52-0.66, lip 0.66-0.74, curl face
  // 0.74-0.9 (dark, the inside of the barrel), foot > 0.9.
  vec3 c = mix(mid, light, smoothstep(0.2, 0.55, v));
  c = mix(c, mid, smoothstep(0.66, 0.74, v));
  c = mix(c, deep, smoothstep(0.74, 0.84, v));
  c = mix(c, mid, smoothstep(0.86, 0.95, v));
  float streak = vn(vec2(vUv.x * 46.0, v * 9.0 + uTime * 1.6));
  c += vec3(0.1, 0.22, 0.26) * smoothstep(0.6, 0.92, streak) * smoothstep(0.66, 0.8, v);
  float n = vn(vec2(vUv.x * 70.0 + uTime * 0.4, v * 26.0 - uTime * 2.2));
  float crest = smoothstep(0.5, 0.56, v) * (1.0 - smoothstep(0.66, 0.72, v));
  float foam = crest * smoothstep(0.2, 0.5, n + 0.3);
  foam = max(foam, smoothstep(0.91, 0.97, v) * smoothstep(0.25, 0.55, n + 0.15));
  foam = max(foam, smoothstep(0.44, 0.52, v) * (1.0 - smoothstep(0.52, 0.6, v)) * step(0.62, n));
  c = mix(c, vec3(1.0), clamp(foam, 0.0, 1.0));
  vec3 n3 = normalize(vN);
  if (!gl_FrontFacing) n3 = -n3;
  vec3 vd = normalize(vView);
  float fres = pow(1.0 - max(dot(n3, vd), 0.0), 3.0);
  c += vec3(0.5, 0.8, 1.0) * fres * 0.45;
  c *= 1.0 + uDanger * 0.15;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

export const SPRAY_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform float uScale;
attribute vec2 aSeed;
varying float vA;
void main() {
  float life = fract(uTime * (0.45 + aSeed.y * 0.4) + aSeed.x);
  vec3 p = position;
  p.z += life * (5.0 + aSeed.y * 6.0);
  p.y += life * (4.0 + aSeed.x * 4.0) - life * life * 9.0;
  p.x += (aSeed.y - 0.5) * life * 3.0;
  vA = (1.0 - life) * smoothstep(0.0, 0.08, life);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = (1.4 + aSeed.x * 1.8) * uScale * (300.0 / -mvPosition.z) * (0.6 + life);
  #include <fog_vertex>
}`

export const SPRAY_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
varying float vA;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.15, r) * vA;
  gl_FragColor = vec4(vec3(0.95, 0.99, 1.0), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`
