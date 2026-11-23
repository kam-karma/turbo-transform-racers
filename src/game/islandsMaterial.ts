/**
 * Shared materials for the floating-island world (islands, track, sky all use them).
 *
 * The look is "soft cartoon": vertex-coloured gradients lit by a hemisphere + warm sun, plus a
 * cool rim light so chunky shapes read against the sky the way the concept art's do.
 */
import * as THREE from 'three'

/**
 * One clock for every world shader. `TrackView.update` and `SkyView.update` both write it,
 * so animated island materials (which have no update hook in the contract) still move.
 */
export const WORLD_TIME: { value: number } = { value: 0 }

export interface ToonOptions {
  readonly roughness?: number
  readonly metalness?: number
  /** Strength of the cool rim light (0 = none). */
  readonly rim?: number
  readonly map?: THREE.Texture | null
  readonly vertexColors?: boolean
  readonly color?: THREE.ColorRepresentation
  readonly emissive?: THREE.ColorRepresentation
  readonly emissiveIntensity?: number
  readonly flatShading?: boolean
  readonly envMapIntensity?: number
}

const RIM_COLOR = new THREE.Color('#d8ecff')

/** MeshStandardMaterial with a fresnel rim added to the emissive term. */
export function toonMaterial(o: ToonOptions = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    roughness: o.roughness ?? 0.78,
    metalness: o.metalness ?? 0,
    vertexColors: o.vertexColors ?? true,
    color: o.color ?? 0xffffff,
    map: o.map ?? null,
    emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveIntensity ?? 1,
    flatShading: o.flatShading ?? false,
    envMapIntensity: o.envMapIntensity ?? 1,
  })
  const rim = o.rim ?? 0.35
  if (rim > 0) {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: RIM_COLOR.clone().multiplyScalar(rim) }
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
            totalEmissiveRadiance += uRimColor * (rimF * rimF * rimF) * (0.35 + 0.65 * diffuseColor.rgb);
          }`,
        )
    }
    m.customProgramCacheKey = () => `toon-rim-${rim.toFixed(2)}`
  }
  return m
}

/**
 * Candy-stripe material: the texture is a black/white stripe mask; white parts take the
 * vertex colour (theme tint), black parts stay cream. One material serves every theme.
 */
export function stripeMaterial(mask: THREE.Texture, cream: THREE.ColorRepresentation = '#fff6ec'): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: mask, vertexColors: true, roughness: 0.42, metalness: 0 })
  const creamC = new THREE.Color(cream)
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCream = { value: creamC }
    shader.uniforms.uRimColor = { value: RIM_COLOR.clone().multiplyScalar(0.3) }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uCream;\nuniform vec3 uRimColor;')
      .replace('#include <map_fragment>', 'float stripeMask = texture2D( map, vMapUv ).r;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb = mix( uCream, vColor.rgb, stripeMask );')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float rimF = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          totalEmissiveRadiance += uRimColor * (rimF * rimF * rimF);
        }`,
      )
  }
  m.customProgramCacheKey = () => 'candy-stripe'
  return m
}

const GLOW_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
uniform float uTime;
uniform float uIntensity;
uniform float uPulse;
varying vec3 vCol;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float ph = uTime * 3.0 + (wp.x + wp.z) * 0.08 + wp.y * 0.05;
  vCol = color * uIntensity * (1.0 - uPulse + uPulse * (0.5 + 0.5 * sin(ph)));
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const GLOW_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

/**
 * Unlit vertex-coloured glow. Colours are multiplied past 1 so the High bloom pass picks them
 * up; on Low they simply read as the brightest things on screen.
 */
export function glowMaterial(intensity: number, pulse = 0.25): THREE.ShaderMaterial {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uIntensity: { value: intensity }, uPulse: { value: pulse } }])
  uniforms.uTime = WORLD_TIME
  return new THREE.ShaderMaterial({ uniforms, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, vertexColors: true, fog: true })
}
