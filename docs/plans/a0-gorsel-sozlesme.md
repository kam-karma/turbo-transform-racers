# A0 visual layer: shared contract (for parallel implementers)

Project: `C:\Companies\Cmd.Ai\Fikir\yaris-oyunu` (Vite + TypeScript 7 strict + three 0.187, no other deps).
Design doc: `docs/2026-11-23-yaris-oyunu-tasarim.md` (§8, §9.1, §15). Plan: `docs/plans/2026-11-23-a0-his-prototipi.md`.
Look/feel reference: `docs/konsept/ucan-adalar.png` (stylized cartoon, saturated, soft light, floating islands of candy / ice / volcano / water, puffy clouds, blue sky). READ THE IMAGE before you start.

## Hard rules
- Only touch the files you own (listed in your brief). Never edit `src/sim/**` or another owner's file.
- `npx tsc --noEmit` must pass for the whole project (unused locals/params are errors).
- No external URLs, no new npm packages, no audio/texture files: everything procedural (canvas textures, shaders, synthesized audio).
- Files ≤ 400 lines; split helpers into extra files you own (prefix them with your module name, e.g. `islandsProps.ts`).
- Performance: whole race ≤ 150 draw calls on High; use InstancedMesh / merged geometry (`BufferGeometryUtils.mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js`). Low quality = `QualityProfile.decor` 0.5, `particles` 0.5, no bloom.
- Glow: emissive colours > 1 (e.g. `emissive` + `emissiveIntensity` 2-4) are picked up by the bloom pass on High; on Low they still read as bright.
- Comment the "why", not the "what". English identifiers and comments, Turkish only in player-facing text.

## The simulation you draw (read-only, already written and tested)
- `src/sim/track.ts`: `Track` with `length`, `frames: Frame[]` (one per metre), `frameAt(s)`, `surfaceAt(s)`, `sectionAt(s)`, `def` (`sections`, `coins`, `themes`), `boostAt(s)`, `themeAt(s)`, `toWorld(s, d, y): V3`.
  - `Frame = { s, pos: V3, t: V3 (forward), left: V3, up: V3, pitch, curvV, curvH, width, surface }`. Track space: `s` metres along, `d` metres to the LEFT, `y` metres above the road along `up`.
  - Surfaces: `'road' | 'ice' | 'water' | 'gap' | 'climb'`. Gap = no road (the car glides or falls). Sections may carry `boost: [[from,to]]` (metres from the section start) and `ramp: true` (ends in a jump lip).
  - Themes along s: `'candy' | 'ice' | 'volcano' | 'water'`.
  - Track world scale: ~3.75 km long, spans roughly ±1500 m in x/z, elevation roughly -60…+120 m.
- `src/sim/forms.ts`: `FormId = 'car' | 'boat' | 'glider' | 'climber'`, `FORM_FOR: Record<Surface, FormId>`, `FORMS`.
- `src/sim/racer.ts`: `RacerState` (s, d, y, vy, yaw (rad, + = left), speed m/s, form, formT (s left of the 0.25 s transform animation), turbo (s), boost (s), combo, airborne, surface, finished…), `RacerEvent { kind, value? }` with kinds `'perfect' | 'early' | 'late' | 'wrongForm' | 'transform' | 'boost' | 'jump' | 'land' | 'splash' | 'wall' | 'fall' | 'respawn' | 'coin' | 'finish'`.
- `src/sim/ghost.ts`: `GhostSample { t, s, d, y, yaw, form, fx }`, fx bits `FX_TURBO 1, FX_FLAME 2 (combo ≥ 3), FX_BOOST 4, FX_AIR 8`.
- `src/game/quality.ts`: `QualityProfile { pixelRatio, decor, particles, bloom }`; `src/ui/settings.ts`: `type Quality = 'low' | 'high'`.
- Car models: `public/models/rt40.glb` (player), `r40_lod.glb`, `r245_lod.glb`, `rt40_lod.glb` (ghosts). Nodes: `body_paint`, `body_details`, `glass`, `lamps_front`, `lamps_rear`, `wheel_FL/FR/RL/RR` (origins at wheel centres), `steering_wheel`. Nose +Z, Y up, ~1.8 m wide, ~3.6 m long, wheels' bottom ≈ y −0.35. Draco: decoder at `./draco/`.

## Pose convention (everyone)
A pose in world space for something at (s, d, y) with yaw ψ:
`pos = track.toWorld(s, d, y)`; forward = `t·cosψ + left·sinψ`; up = frame `up`; the model's +Z = forward, +Y = up, +X = `left` rotated by ψ (three's +X is to the model's left when +Z is forward and +Y up).

## Public interfaces (owners must export exactly these)

### Owner W: world — `src/game/trackMesh.ts`, `src/game/islands.ts`, `src/game/sky.ts` (+ helpers)
```ts
export interface TrackView { readonly group: THREE.Group; update(timeS: number, playerS: number, playerSpeed: number): void; collectCoin(index: number): void }
export function buildTrackMesh(track: Track, q: QualityProfile): TrackView
export function buildIslands(track: Track, q: QualityProfile, seed: number): THREE.Group
export interface SkyView { readonly group: THREE.Group; update(camera: THREE.Camera, timeS: number): void }
export function buildSky(scene: THREE.Scene, q: QualityProfile): SkyView   // also sets scene.background / fog and adds the lights (hemisphere + warm sun with shadow on High)
```
- `update` animates water, boost arrows, coins (spinning, hidden after `collectCoin(i)`, i = index in `track.def.coins`) and the **perfect line**: for the next form boundary ahead of `playerS` (use `track.sectionAt` / sections; a boundary is where `FORM_FOR` changes), a glowing band across the road from `boundary − playerSpeed·0.3` m to the boundary, tinted with the colour of the form needed after it. FORM colours: car `#ffd23f`, boat `#2ec5ff`, glider `#ff6bd6`, climber `#7dff5a`.
- Road by surface: road = warm light asphalt with candy-stripe kerbs; ice = pale blue glossy; water = channel with animated translucent water (vertex waves in a shader or onBeforeCompile) and low banks; climb = rocky orange wall with grip ribs; gap = nothing, but a glowing lip at the take-off and a landing pad at the far side. Barriers: candy-cane rails along road/ice (none over gaps). Underside of the road visible (thickness ~1.2 m) since it floats.
- Islands: floating islands under/around the track themed by `themeAt(s)` (candy: lollipops, gumdrops, cookies, pink/mint grass; ice: crystals, snow caps; volcano: dark rock, lava rivers glowing, smoke puffs; water: waterfalls pouring off islands into the cloud sea). Big hero landmarks every ~400 m (giant lollipop, ice castle spire, volcano cone, waterfall island). Never intersect the road corridor (keep ≥ 12 m from the centre line).

### Owner C: car — `src/game/car.ts` (+ helpers like `carForms.ts`, `carLabel.ts`)
```ts
export interface Pose { s: number; d: number; y: number; yaw: number; form: FormId; speed: number; fx: number; surface: Surface; formT: number }
export class CarView {
  readonly root: THREE.Group
  constructor(model: THREE.Object3D | null, color: number, opts?: { label?: string; badge?: string; shadows?: boolean })
  setForm(form: FormId, animate: boolean): void
  update(pose: Pose, track: Track, dt: number): void   // places itself (pose convention), spins wheels, plays the transform
  setOpacity(a: number): void                         // ghosts fade when close
  get worldPos(): THREE.Vector3
}
export async function loadCarModel(url: string): Promise<THREE.Object3D>  // GLTF+Draco, returns a clone-able scene; rejects on failure
```
- Paint `body_paint` with `color` (saturated, slightly glossy), keep details. If `model` is null build a chunky procedural cartoon car (same proportions).
- Form parts, procedural low-poly, parented to the car, animated over 0.25 s (scale/pop + unfold) when the form changes:
  - boat: wheels rotate flat & shrink, a hull skirt under the body, a spinning propeller at the back; when on water the hull sits in the water.
  - glider: wings unfold from the sides (span ~5 m, bright pink/white), tail fin; slight bank with yaw.
  - climber: tracks (caterpillar treads) replace wheels, front grip claws.
  - car: everything folded away.
- Sink: when `surface === 'water'` and form ≠ boat, lower the car 0.5 m and tilt the nose down slightly.
- Air: small nose pitch with vertical speed is fine (derive from pose changes).
- Label (ghosts): a sprite above the car with badge + name on a rounded pill (canvas texture), always facing the camera, readable at 30 m.

### Owner X: effects + audio — `src/game/fx.ts`, `src/game/audio.ts` (+ helpers)
```ts
export class Fx {
  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, q: QualityProfile)
  onEvent(e: RacerEvent, at: THREE.Vector3): void
  update(dt: number, carPos: THREE.Vector3, carForward: THREE.Vector3, st: RacerState): void
}
export class RaceAudio {
  start(): void                       // after a user gesture
  setMuted(m: boolean): void
  suspend(on: boolean): void          // ads / tab hidden
  update(st: RacerState, throttle: number): void
  onEvent(e: RacerEvent): void
  countdown(n: number): void          // 3,2,1 beeps; 0 = GO
}
```
- Fx: speed lines (thin bright streaks around the camera when speed > 30 m/s or turbo), exhaust flame/turbo trail behind the car (blue on boost, orange-pink on turbo, fiery when combo flame fx), water splash burst + spray while boating, dust/snow puffs on landing, sparks on `wall`, a ring burst + sparkle on `perfect` (bigger with combo), coin sparkle on `coin`, a poof on `respawn`. Pools of `THREE.Points` / InstancedMesh, no per-frame allocation, budget scaled by `q.particles`.
- Audio: WebAudio synthesis only. Engine (two detuned oscillators + filter, pitch by speed, timbre per form: boat deeper + water noise, glider wind noise, climber clanky), transform "vınn" sweep, perfect: rising arpeggio pitched up with combo, early: soft tick, wrongForm: low buzz, splash: filtered noise burst, land: thump, wall: crunch, coin: bright "ting", boost: whoosh, countdown beeps + GO chord, finish fanfare. Master gain ~0.5, no clipping.
