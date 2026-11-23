/**
 * GLSL for the instanced sky life (skyLife.ts). Every kind shares the header, the basis
 * maths and a small lit fragment shader that reads the live, zone-graded light colours.
 *
 * Per instance: iPos (anchor), iParam (kind-specific: x = scale, y = phase, z, w), iColA,
 * iColB. Local geometry space: x = left wing, y = up, z = forward.
 */
import type * as THREE from 'three'

/** Light colours the life shaders read (shared objects, graded live by the sky). */
export interface LivePaletteRef {
  readonly hemiSky: THREE.Color
  readonly hemiGround: THREE.Color
  readonly sun: THREE.Color
  readonly sunDir: THREE.Vector3
  /** Overall light level (1 by day, lower at night). */
  readonly level: { value: number }
}

const HEAD = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
attribute vec3 iPos;
attribute vec4 iParam;
attribute vec3 iColA;
attribute vec3 iColB;
varying vec3 vNormal;
varying vec3 vCol;
varying vec3 vView;
varying float vGloss;
vec2 rot(vec2 v, float a) { float c = cos(a); float s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
`

const TAIL = /* glsl */ `
  vec3 left = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, left);
  vec3 world = iPos + off + (left * p.x + up * p.y + fwd * p.z) * sc;
  vNormal = normalize(left * nn.x + up * nn.y + fwd * nn.z);
  vView = cameraPosition - world;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

export const BIRD_VERT = `${HEAD}
attribute float aWing;
void main() {
  float sc = iParam.x;
  float ph = iParam.y;
  float a = ph + uTime * iParam.w;
  vec3 off = vec3(cos(a) * iParam.z, sin(a * 2.0 + ph) * 1.5, sin(a) * iParam.z);
  vec3 fwd = normalize(vec3(-sin(a), 0.0, cos(a)) * sign(iParam.w));
  float flap = sin(uTime * 6.5 + ph * 3.0) * 0.6 + 0.15;
  float ang = flap * sign(aWing) * (0.7 + 0.5 * abs(aWing));
  vec3 p = position;
  vec3 nn = normal;
  p.xy = rot(p.xy, ang * step(0.001, abs(aWing)));
  nn.xy = rot(nn.xy, ang * step(0.001, abs(aWing)));
  // Bank into the circle.
  p.xy = rot(p.xy, -0.25 * sign(iParam.w));
  vCol = color * iColA;
  vGloss = 0.0;
${TAIL}`

export const BUTTERFLY_VERT = `${HEAD}
attribute float aWing;
void main() {
  float sc = iParam.x;
  float ph = iParam.y;
  float R = iParam.z;
  float t = uTime * iParam.w + ph;
  vec3 off = vec3(sin(t * 0.7) * R, sin(t * 1.9) * 0.5 + sin(t * 0.5) * 0.4, cos(t * 0.9 + ph) * R);
  vec3 vel = vec3(cos(t * 0.7) * 0.7 * R, 0.0, -sin(t * 0.9 + ph) * 0.9 * R);
  vec3 fwd = normalize(vel + vec3(0.0001, 0.0, 0.0));
  float flap = (0.15 + 1.0 * abs(sin(uTime * 15.0 + ph * 5.0))) * sign(aWing) * min(1.0, abs(aWing) * 2.0);
  vec3 p = position;
  vec3 nn = normal;
  p.xy = rot(p.xy, flap);
  nn.xy = rot(nn.xy, flap);
  vCol = mix(iColA, iColB, color.r);
  vGloss = 0.2;
${TAIL}`

export const BALLOON_VERT = `${HEAD}
attribute float aGore;
void main() {
  float sc = iParam.x;
  float ph = iParam.y;
  vec3 off = vec3(sin(uTime * 0.05 + ph) * 9.0, sin(uTime * 0.33 + ph) * 3.0, cos(uTime * 0.04 + ph) * 9.0);
  float yaw = uTime * 0.04 + ph;
  vec3 fwd = vec3(sin(yaw), 0.0, cos(yaw));
  vec3 p = position;
  vec3 nn = normal;
  float stripe = mod(floor(aGore * 12.0), 2.0);
  vCol = color.g > 0.5 ? vec3(0.55, 0.33, 0.2) : mix(iColA, iColB, stripe);
  vGloss = color.g > 0.5 ? 0.0 : 0.35;
${TAIL}`

export const PARTY_VERT = `${HEAD}
void main() {
  float sc = iParam.x;
  float ph = iParam.y;
  vec3 off = vec3(0.0, sin(uTime * 1.3 + ph) * 0.3, 0.0);
  vec3 fwd = vec3(sin(ph), 0.0, cos(ph));
  vec3 p = position;
  vec3 nn = normal;
  // Sway about the end of the string.
  float tilt = sin(uTime * 0.9 + ph) * 0.12;
  p.y += 3.1;
  p.xy = rot(p.xy, tilt);
  p.y -= 3.1;
  nn.xy = rot(nn.xy, tilt);
  vCol = color.g > 0.5 ? vec3(1.0) : iColA;
  vGloss = color.g > 0.5 ? 0.0 : 1.0;
${TAIL}`

export const LIFE_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uSky;
uniform vec3 uGround;
uniform vec3 uSun;
uniform vec3 uSunDir;
uniform float uLight;
varying vec3 vNormal;
varying vec3 vCol;
varying vec3 vView;
varying float vGloss;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float h = 0.5 + 0.5 * n.y;
  vec3 amb = mix(uGround, uSky, h) * 0.62;
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 c = vCol * (amb + uSun * ndl * 0.7) * uLight;
  vec3 hv = normalize(uSunDir + normalize(vView));
  c += uSun * pow(max(dot(n, hv), 0.0), 36.0) * vGloss * uLight;
  float rim = 1.0 - max(dot(n, normalize(vView)), 0.0);
  c += vCol * rim * rim * 0.25 * uLight;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`
