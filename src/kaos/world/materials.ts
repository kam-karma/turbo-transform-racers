/**
 * Shared Neon Şehir materials: a lit "neon metal" standard material whose vertices can glow
 * (per-vertex aGlow × vertex colour as emissive, so one mesh carries dark metal and its neon
 * strips), the additive hologram material (fresnel rim, scanlines, flicker), and a small
 * PMREM environment of neon panels so glossy cars and metal reflect the city.
 */
import * as THREE from 'three'

/** MeshStandardMaterial + vertex colours; vertices with aGlow > 0 emit colour × aGlow. */
export function neonMetal(opts: { roughness?: number; metalness?: number; side?: THREE.Side } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: opts.roughness ?? 0.35, metalness: opts.metalness ?? 0.55, side: opts.side ?? THREE.FrontSide })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow;\ndiffuseColor.rgb *= 1.0 - min(vGlow, 1.0);')
  }
  m.customProgramCacheKey = () => 'neonMetal'
  return m
}

/** Adds colour + glow attributes to a geometry (one colour for all of it). */
export function paintGeo(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, glow = 0): THREE.BufferGeometry {
  const g = geo.index !== null ? geo.toNonIndexed() : geo
  const n = g.getAttribute('position').count
  const c = new THREE.Color(color)
  const col = new Float32Array(n * 3)
  const gl = new Float32Array(n).fill(glow)
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1))
  if (g.hasAttribute('uv')) g.deleteAttribute('uv')
  return g
}

/** Additive glows fade to nothing in the fog (FogExp2) instead of turning fog-coloured. */
export const FOG_FADE = /* glsl */ `
  #ifdef USE_FOG
  #ifdef FOG_EXP2
  gl_FragColor *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
  #else
  gl_FragColor *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  #endif
`

const HOLO_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  #ifdef USE_INSTANCING
  w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  #endif
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const HOLO_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uTime;
uniform float uAlpha;
uniform float uGrid;
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
varying vec2 vUv;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(f, 2.2);
  float scan = 0.55 + 0.45 * sin(vW.y * 6.0 - uTime * 7.0);
  float band = smoothstep(0.92, 1.0, sin(vW.y * 0.35 - uTime * 2.5));
  // hologram mesh lines along the body (uv) for the wireframe look
  vec2 g = abs(fract(vUv * vec2(uGrid, 6.0)) - 0.5);
  float grid = smoothstep(0.42, 0.5, max(g.x, g.y));
  float flick = 0.88 + 0.12 * sin(uTime * 31.0 + vW.x * 0.2);
  vec3 col = mix(uColor, uColor2, rim) * (0.25 + 1.6 * rim + 0.8 * grid + 0.6 * band) * scan * flick;
  float a = clamp(0.18 + rim * 0.9 + grid * 0.5 + band * 0.4, 0.0, 1.0) * uAlpha;
  gl_FragColor = vec4(col * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  ${FOG_FADE}
}
`

export interface HoloMaterial extends THREE.ShaderMaterial {
  uniforms: { uColor: { value: THREE.Color }; uColor2: { value: THREE.Color }; uTime: { value: number }; uAlpha: { value: number }; uGrid: { value: number } }
}

/** Additive hologram: colour × intensity (values > 1 bloom), rim brightening, scanlines. */
export function holoMaterial(color: THREE.ColorRepresentation, color2: THREE.ColorRepresentation, intensity = 2.2, grid = 40): HoloMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color).multiplyScalar(intensity) },
      uColor2: { value: new THREE.Color(color2).multiplyScalar(intensity * 1.3) },
      uTime: { value: 0 },
      uAlpha: { value: 1 },
      uGrid: { value: grid },
      ...THREE.UniformsLib.fog,
    },
    vertexShader: HOLO_VERT,
    fragmentShader: HOLO_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  })
  return m as HoloMaterial
}

/** A tiny neon room baked into a PMREM env map: glossy paint and metal pick up city colours. */
export function neonEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x06051a)
  const panel = (color: number, k: number, pos: [number, number, number], size: [number, number]): void => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.lookAt(0, 0, 0)
    scene.add(m)
  }
  panel(0x22e6ff, 4, [-8, 2, 0], [3, 8])
  panel(0xff3df2, 4, [8, 2, 2], [3, 8])
  panel(0x7a5cff, 2.5, [0, 8, 0], [12, 12])
  panel(0xb6ff2e, 3, [0, 1, -9], [6, 1.2])
  panel(0xff9a1f, 3, [2, 1.5, 9], [5, 1])
  panel(0x22e6ff, 2, [-4, -3, 6], [4, 1])
  const gen = new THREE.PMREMGenerator(renderer)
  const tex = gen.fromScene(scene, 0.03).texture
  gen.dispose()
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
  })
  return tex
}
