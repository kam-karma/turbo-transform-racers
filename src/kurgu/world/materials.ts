/**
 * The handful of shared materials the whole Dev Ev world is drawn with. All take vertex
 * colours (one material per batch), and two get a little procedural surface in the shader:
 * wood grain and fabric weave, computed from world position so giant furniture never shows
 * stretched texels.
 */
import * as THREE from 'three'
import type { MatKey } from './batch'

const WPOS_VERT = (src: string): string => src
  .replace('#include <common>', '#include <common>\nvarying vec3 vKWPos;')
  .replace('#include <project_vertex>', '#include <project_vertex>\nvKWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')

const HASH = `
varying vec3 vKWPos;
float kHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float kNoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(kHash(i), kHash(i + vec3(1,0,0)), f.x), mix(kHash(i + vec3(0,1,0)), kHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(kHash(i + vec3(0,0,1)), kHash(i + vec3(1,0,1)), f.x), mix(kHash(i + vec3(0,1,1)), kHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`

function withSurface(mat: THREE.MeshStandardMaterial, key: string, body: string): THREE.MeshStandardMaterial {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = WPOS_VERT(sh.vertexShader)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${HASH}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${body}`)
  }
  mat.customProgramCacheKey = () => key
  return mat
}

/** Wood: long soft grain bands plus fine fibres. */
const WOOD = `{
  vec3 p = vKWPos * vec3(0.35, 1.6, 0.35);
  float n = kNoise(p * 0.6);
  float bands = 0.5 + 0.5 * sin((vKWPos.x + vKWPos.z) * 0.9 + n * 6.0);
  float fibre = kNoise(vKWPos * vec3(0.4, 9.0, 0.4));
  diffuseColor.rgb *= 0.86 + 0.12 * bands + 0.06 * fibre;
}`

/** Fabric: a fine woven cross pattern and soft mottling. */
const FABRIC = `{
  float w = 0.5 + 0.5 * sin(vKWPos.x * 7.0) * sin(vKWPos.z * 7.0 + vKWPos.y * 7.0);
  float m = kNoise(vKWPos * 0.25);
  diffuseColor.rgb *= 0.88 + 0.08 * w + 0.08 * m;
}`

export type Materials = Readonly<Record<MatKey, THREE.Material>>

export function createMaterials(): Materials {
  const plastic = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, envMapIntensity: 1 })
  const matte = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.5 })
  const wood = withSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, envMapIntensity: 0.7 }), 'kwood', WOOD)
  const fabric = withSurface(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, envMapIntensity: 0.3 }), 'kfabric', FABRIC)
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.2 })
  // Lamp bulbs, LEDs, screens: above the bloom threshold on High.
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.4, 2.4, 2.4) })
  return { plastic, matte, wood, fabric, metal, glow }
}

export function disposeMaterials(m: Materials): void {
  for (const x of Object.values(m)) x.dispose()
}
