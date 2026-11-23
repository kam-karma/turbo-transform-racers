/**
 * Paint for cars. Tripo cars are one textured mesh, so a repaint is a hue/saturation shift in
 * the fragment shader, limited to texels near the car's own body hue: stripes, lights, tyres
 * and windows (other hues, greys) keep their colours and stay readable.
 * Legacy cars with a `body_paint` mesh simply get a new colour.
 */
import * as THREE from 'three'

export type Finish = string

export interface PaintSpec {
  /** Hue shift in degrees (−180..180), from meta paintHueShift(). */
  readonly shiftDeg: number
  /** The car's own body hue in degrees (CarDef.hue): only texels near it are shifted. */
  readonly baseHueDeg: number
  /** Target colour, used on legacy body_paint meshes. */
  readonly color: number
  readonly finish: Finish
  /** Saturation and lightness multipliers (ModDef.value.sat / light). */
  readonly sat: number
  readonly light: number
}

interface PaintUniforms {
  uHue: { value: number }
  uBase: { value: number }
  uSat: { value: number }
  uLight: { value: number }
  uRainbow: { value: number }
}

const PAINT_GLSL = /* glsl */ `
{
  vec3 c0 = diffuseColor.rgb;
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c0.bg, K.wz), vec4(c0.gb, K.xy), step(c0.b, c0.g));
  vec4 q = mix(vec4(p.xyw, c0.r), vec4(c0.r, p.yzx), step(p.x, c0.r));
  float d = q.x - min(q.w, q.y);
  vec3 hsv = vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
  float dh = abs(fract(hsv.x - uBase + 0.5) - 0.5);
  float band = uRainbow > 0.5 ? 1.0 : 1.0 - smoothstep(0.07, 0.13, dh);
  float mask = band * smoothstep(0.16, 0.38, hsv.y) * smoothstep(0.06, 0.18, hsv.z);
  float rb = uRainbow > 0.5 ? fract(gl_FragCoord.x / 520.0 + gl_FragCoord.y / 900.0) : 0.0;
  hsv.x = fract(hsv.x + uHue + rb);
  hsv.y = clamp(hsv.y * uSat, 0.0, 1.0);
  hsv.z = clamp(hsv.z * uLight, 0.0, 1.0);
  vec3 c1 = hsv.z * mix(vec3(1.0), clamp(abs(fract(hsv.x + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0), hsv.y);
  diffuseColor.rgb = mix(c0, c1, mask);
}
`

const painted = new WeakMap<THREE.Material, PaintUniforms>()

function finishProps(finish: Finish): { roughness?: number; metalness?: number } {
  switch (finish) {
    case 'metal': return { roughness: 0.28, metalness: 0.45 }
    case 'chrome': return { roughness: 0.12, metalness: 0.7 }
    case 'pearl': return { roughness: 0.18, metalness: 0.2 }
    case 'matte': return { roughness: 0.95, metalness: 0 }
    case 'rainbow': return { roughness: 0.3, metalness: 0.15 }
    case 'gloss': return { roughness: 0.22, metalness: 0.05 }
    default: return {}
  }
}

/** Makes `mat` shiftable (once) and returns its uniforms. The material must be car-owned. */
function paintable(mat: THREE.MeshStandardMaterial): PaintUniforms {
  const known = painted.get(mat)
  if (known !== undefined) return known
  const u: PaintUniforms = { uHue: { value: 0 }, uBase: { value: 0 }, uSat: { value: 1 }, uLight: { value: 1 }, uRainbow: { value: 0 } }
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uHue;\nuniform float uBase;\nuniform float uSat;\nuniform float uLight;\nuniform float uRainbow;\nvoid main() {')
      .replace('#include <map_fragment>', `#include <map_fragment>\n${PAINT_GLSL}`)
  }
  mat.customProgramCacheKey = () => 'kupa-paint'
  mat.needsUpdate = true
  painted.set(mat, u)
  return u
}

/**
 * Gives every mesh under `root` its own material copies (so a repaint never leaks into the
 * shared GLB cache). Returns the originals → copies map for disposal.
 */
export function ownMaterials(root: THREE.Object3D): THREE.Material[] {
  const made: THREE.Material[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || mesh.userData.kupaOwned === true) return
    mesh.userData.kupaOwned = true
    const swap = (m: THREE.Material): THREE.Material => {
      const c = m.clone()
      made.push(c)
      return c
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material)
  })
  return made
}

const factoryProps = new WeakMap<THREE.MeshStandardMaterial, { roughness: number; metalness: number; color: THREE.Color }>()

/** Applies (or re-applies) paint to a car whose materials are already car-owned. */
export function applyPaint(root: THREE.Object3D, spec: PaintSpec): void {
  const legacy = root.getObjectByName('body_paint') as THREE.Mesh | undefined
  const fin = finishProps(spec.finish)
  if (legacy?.isMesh === true) {
    for (const m of Array.isArray(legacy.material) ? legacy.material : [legacy.material]) {
      const std = m as THREE.MeshStandardMaterial
      if (!std.isMeshStandardMaterial) continue
      remember(std)
      const f = factoryProps.get(std)!
      std.color.copy(spec.finish === 'factory' ? f.color : new THREE.Color(spec.color))
      std.roughness = fin.roughness ?? f.roughness
      std.metalness = fin.metalness ?? f.metalness
    }
    return
  }
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || mesh.userData.kupaAttachment === true) return
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const std = m as THREE.MeshStandardMaterial
      if (!std.isMeshStandardMaterial || std.map === null) continue
      remember(std)
      const f = factoryProps.get(std)!
      const u = paintable(std)
      u.uHue.value = spec.finish === 'factory' ? 0 : ((spec.shiftDeg % 360) + 360) % 360 / 360
      u.uBase.value = (((spec.baseHueDeg % 360) + 360) % 360) / 360
      u.uSat.value = spec.finish === 'factory' ? 1 : spec.sat
      u.uLight.value = spec.finish === 'factory' ? 1 : spec.light
      u.uRainbow.value = spec.finish === 'rainbow' ? 1 : 0
      std.roughness = fin.roughness ?? f.roughness
      std.metalness = fin.metalness ?? f.metalness
    }
  })
}

function remember(m: THREE.MeshStandardMaterial): void {
  if (!factoryProps.has(m)) factoryProps.set(m, { roughness: m.roughness, metalness: m.metalness, color: m.color.clone() })
}
