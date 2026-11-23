/** GLSL for the sky dome (gradient, sun / moon, stars) and the cloud sea. */

export const DOME_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`

export const DOME_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
uniform float uTime;
varying vec3 vDir;
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 c = y > 0.0
    ? mix(mix(uHorizon, uMid, smoothstep(0.0, 0.22, y)), uZenith, smoothstep(0.22, 0.85, y))
    : mix(uHorizon, uBelow, smoothstep(0.0, -0.2, y));
  float sd = max(dot(d, uSunDir), 0.0);
  if (uNight < 0.5) {
    // Warm glow around the sun, a soft halo and a hot disc (bloom catches it on High).
    c += vec3(1.0, 0.82, 0.55) * (pow(sd, 5.0) * 0.22 + pow(sd, 60.0) * 0.55);
    c = mix(c, vec3(7.0, 6.2, 4.6), smoothstep(0.9991, 0.9995, sd));
  } else {
    // Stars: a few cells of a direction grid light up and twinkle; the moon is a pale disc.
    vec3 g = floor(d * 160.0);
    float h = hash3(g);
    float star = step(0.9965, h) * smoothstep(0.02, 0.25, y);
    float tw = 0.6 + 0.4 * sin(uTime * (2.0 + h * 5.0) + h * 60.0);
    vec3 f = fract(d * 160.0) - 0.5;
    star *= smoothstep(0.32, 0.0, length(f));
    c += vec3(1.0, 0.95, 0.85) * star * tw * 2.2;
    c += uSunColor * (pow(sd, 18.0) * 0.25 + pow(sd, 200.0) * 0.4);
    c = mix(c, vec3(3.2, 3.3, 3.6), smoothstep(0.9986, 0.9990, sd));
  }
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export const SEA_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

export const SEA_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uShade;
uniform vec3 uHaze;
uniform float uTime;
varying vec3 vWorld;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), w.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), w.x), w.y);
}
void main() {
  vec2 p = vWorld.xz * 0.0045 + vec2(uTime * 0.01, uTime * 0.004);
  float n = vn(p) * 0.55 + vn(p * 2.1 + 3.7) * 0.3 + vn(p * 4.3 + 9.1) * 0.15;
  // Billows: bright rounded tops, cool shade in the folds, a light-catching crest between.
  float lit = smoothstep(0.32, 0.62, n);
  vec3 c = mix(uShade, uTop, lit);
  c += vec3(0.06, 0.05, 0.03) * smoothstep(0.62, 0.8, n);
  float dist = length(vWorld.xz - cameraPosition.xz);
  c = mix(c, uHaze, smoothstep(900.0, 3400.0, dist));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
