/**
 * Stylized flowing water for the channels: vertex waves rolling down the track, foam streaks
 * carried by the current, bright foam against the banks and sun sparkles that bloom on High.
 * uv.x runs across the channel (0..1), uv.y is the track s in metres.
 */
import * as THREE from 'three'
import { WORLD_TIME } from './islandsMaterial'

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
varying vec2 vUv;
varying float vSlope;
varying vec3 vViewDir;
varying vec3 vNormalV;
void main() {
  vUv = uv;
  float s = uv.y;
  float u = uv.x;
  // The banks hold the edges still; waves roll down the channel with the current.
  float edge = smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.86, u);
  float p1 = s * 0.55 - uTime * 3.4 + u * 3.0;
  float p2 = s * 1.35 - uTime * 5.1 - u * 8.0;
  float h = (sin(p1) * 0.1 + sin(p2) * 0.045) * edge;
  vSlope = (cos(p1) * 0.055 + cos(p2) * 0.06) * edge;
  vec3 p = position + normal * h;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vViewDir = normalize(-mvPosition.xyz);
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uFoam;
varying vec2 vUv;
varying float vSlope;
varying vec3 vViewDir;
varying vec3 vNormalV;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), w.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), w.x), w.y);
}

void main() {
  float u = vUv.x;
  float s = vUv.y;
  float centre = 1.0 - abs(u - 0.5) * 2.0;
  vec3 c = mix(uShallow, uDeep, smoothstep(0.0, 0.8, centre));
  // Wave faces catch light, troughs go a touch deeper.
  c += vec3(0.22, 0.28, 0.3) * clamp(vSlope * 6.0, -0.4, 1.0);
  // Foam streaks carried by the current.
  float n = vnoise(vec2(u * 16.0, s * 0.07 - uTime * 0.55));
  n = n * 0.7 + vnoise(vec2(u * 34.0 + 3.0, s * 0.18 - uTime * 1.3)) * 0.3;
  float streak = smoothstep(0.76, 0.8, n) * 0.5;
  // Lively foam where the water licks the banks.
  float wob = vnoise(vec2(s * 0.8 - uTime * 2.0, 1.0)) * 0.05;
  float bank = smoothstep(0.1 + wob, 0.02, u) + smoothstep(0.9 - wob, 0.98, u);
  c = mix(c, uFoam, clamp(streak + bank, 0.0, 1.0));
  // Sky reflection at grazing angles.
  float fres = pow(1.0 - clamp(dot(vNormalV, vViewDir), 0.0, 1.0), 4.0);
  c = mix(c, uSky, fres * 0.3);
  // Sun glints: rare, very bright, they bloom on High.
  float g = vnoise(vec2(u * 60.0, s * 3.0 - uTime * 6.0));
  c += vec3(2.5) * smoothstep(0.93, 0.98, g) * clamp(vSlope * 12.0, 0.0, 1.0);
  gl_FragColor = vec4(c, mix(0.82, 0.95, max(streak, bank)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

export function waterMaterial(): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uDeep: { value: new THREE.Color('#0a8fd0') },
      uShallow: { value: new THREE.Color('#38d4e6') },
      uSky: { value: new THREE.Color('#a6dcff') },
      uFoam: { value: new THREE.Color('#f4fdff') },
    },
  ])
  uniforms.uTime = WORLD_TIME
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
  })
}
