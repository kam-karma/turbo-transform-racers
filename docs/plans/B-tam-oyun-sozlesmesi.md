# Stage B: full game — shared contract for parallel teams

Project: `C:\Companies\Cmd.Ai\Fikir\yaris-oyunu` (Vite + TypeScript 7 strict + three 0.187 + vitest; no new npm deps).
Read first: `docs/2026-11-23-yaris-oyunu-tasarim.md` (the approved design, Turkish) and `docs/A0-durum.md` (what exists).
Concept art (the quality bar — open with the Read tool): `docs/konsept/ucan-adalar.png`, `docs/konsept/dev-ev.png`, `docs/konsept/neon-sehir-n2.png`.

## The user's demand (verbatim intent)
"Environments must look far more detailed, eye-catching and high quality. HUD, icons — everything designed to fit our concept. Nothing may be missing; everything thought through and very high quality. A home page, the tournaments of the other worlds — finish all of it in full detail." The user will NOT be asked anything; they check at the end. Previous feedback: they reject anything that looks amateur/primitive (no emoji-as-icons, no flat grey placeholders, no programmer art left visible).

## Global rules
- Own only your folders/files (below). Never edit another team's files. If you truly need a change elsewhere, write it under "Requests to integrator" in your final report.
- `npx tsc --noEmit` clean and `npx vitest run` green at the end. Pure logic in `sim`/`meta`-style folders gets unit tests (write the failing test first).
- No external URLs at runtime, relative asset paths only (`./models/...`, `./ui/...`). Procedural/canvas textures are fine.
- Performance: ≤ 150 draw calls in a race on High (instancing/merging), Low quality = `QualityProfile.decor` 0.5, `particles` 0.5, no bloom. 60 FPS desktop, ≥ 30 FPS weak phones on Low.
- Player-facing text is Turkish; code/comments English. Files ≤ 400 lines.
- Style: stylized cartoon, chunky rounded shapes, saturated colours, soft light, emissive accents (bloom threshold is 1.6 on High).
- Browser testing: dev server already runs on http://localhost:5185 (do not stop it). Use your OWN browser tab (`mcp__Claude_Browser__tabs_create`). The pane is often hidden, which stops requestAnimationFrame: drive your test pages manually (expose a `tick(seconds)` hook) and save frames with the snapshot relay: `fetch('http://127.0.0.1:5199/?name=<file>.jpg', {method:'POST', body: blob})` writes to `assets/snaps/`; then Read the jpg. Look at your work; iterate until it looks premium.

## Assets (produced by the integrator in parallel; code must work before they land)
- Tripo3D GLB models arrive in `public/models/` (one textured mesh each, normalised to ~1 m, nose/front towards +Z). Use them through `src/assets/registry.ts` (integrator-owned) or load directly by URL with a graceful procedural fallback when the file is missing.
- UI icons arrive in `public/ui/icons/<name>.png` (transparent PNG, 256×256). Names: `form-car, form-boat, form-glider, form-climber, coin, star, star-empty, trophy, trophy-gold, trophy-silver, trophy-bronze, gear, pause, play, garage, lock, video, chest, boss, flag, home, back, sound-on, sound-off, gas-auto, cup-donusum, cup-kurgu, cup-kaos, part-wing, part-rocket, part-drill, part-magnet, part-bigwheel, part-float, shock, upgrade-engine, upgrade-nitro, upgrade-handling, paint, wheel, spoiler, neon, trail, horn, gift`. World cards: `public/ui/worlds/{adalar,dev-ev,neon}.jpg` (16:9). Logo: `public/ui/logo.png`. Until they exist, render a styled placeholder (coloured rounded badge with the first letter) — never an emoji.

## Architecture (who owns what)

### Team META — `src/meta/**`, `src/platform/**`
Pure game data + persistence + Poki platform. Exports (exact names):
```ts
// src/meta/catalog.ts
export type CarId = string
export interface CarDef { id: CarId; name: string; model: string /* './models/x.glb' */; price: number; unlock?: { cup: CupId } ; stats: { speed: number; accel: number; handling: number } /* 1..10 */; character: string; hue: number }
export const CARS: readonly CarDef[]   // 12 cars, first one free ('kivilcim' = the yellow hero, model './models/hero.glb')
export type ModCategory = 'paint' | 'wheels' | 'spoiler' | 'neon' | 'decal' | 'trail' | 'horn'
export interface ModDef { id: string; category: ModCategory; name: string; price: number; videos: 0 | 1 | 2 | 3; accountWide: boolean; value: Record<string, number | string> }
export const MODS: readonly ModDef[]   // ≥ 60 mods; trail and horn are accountWide
export type PerfId = 'engine' | 'nitro' | 'handling'
export const PERF_PRICES: readonly number[] // [200, 400, 800, 1500, 2500]
// src/meta/cups.ts
export type WorldId = 'adalar' | 'dev-ev' | 'neon'
export type CupMode = 'transform' | 'build' | 'chaos'
export type CupTier = 'bronz' | 'gumus' | 'altin'
export type CupId = `${WorldId}-${CupTier}`
export interface RaceDef { id: string; cup: CupId; index: number; trackId: string; variant: 'normal' | 'reverse' | 'night' | 'mirror'; boss: boolean; name: string }
export interface CupDef { id: CupId; world: WorldId; mode: CupMode; tier: CupTier; name: string; races: readonly RaceDef[] } // 5 races + 1 boss
export const CUPS: readonly CupDef[]   // 9 cups
// src/meta/economy.ts  — spec §11 numbers
export function raceReward(place: number, coins: number, newStars: number): number
export const BOSS_FIRST_REWARD = 500, BOSS_REPEAT_REWARD = 150
// src/meta/save.ts
export interface SaveData { v: 1; gold: number; car: CarId; owned: CarId[]; perf: Record<CarId, Record<PerfId, number>>; mods: Record<CarId, Record<ModCategory, string>>; ownedMods: Record<CarId, string[]>; accountMods: string[]; modVideoProgress: Record<string, number>; stars: Record<string /*raceId*/, [boolean, boolean, boolean]>; bestTimes: Record<string, number>; bossBeaten: Record<CupId, boolean>; racesDone: number; chest: { readyAt: number }; daily: { day: string; tasks: { id: string; progress: number; goal: number; done: boolean; claimed: boolean }[] }; firstRun: boolean }
export class SaveStore { constructor(storage?: Storage); get(): SaveData; update(fn: (s: SaveData) => SaveData): SaveData; reset(): void }
// src/meta/progress.ts
export function cupUnlocked(save: SaveData, cup: CupId): boolean
export function raceUnlocked(save: SaveData, race: RaceDef): boolean
export function nextGoal(save: SaveData): { kind: 'car' | 'cup' | 'boss'; label: string; progress: number } // "az kaldı"
export function totalStars(save: SaveData): number
// src/meta/daily.ts, chest timing etc. as you see fit (export what UI needs, document it)
// src/platform/ads.ts + adFlow.ts — port from C:\Companies\Cmd.Ai\Fikir\istanbul-taksi\src\platform (read-only source) — Poki SDK wrapper with a dev fallback (no SDK on localhost: rewarded resolves true after 1 s, logs). Export createAds(), createAdFlow(ads) with commercialBreak()/rewarded(reason)/gameplayStart()/gameplayStop().
```
Unlock rules (spec §11.3): Dönüşüm Bronz open; Kurgu Bronz opens after 2 finished races; Kaos Bronz opens after Kurgu Bronz boss is beaten OR 12 stars; Gümüş of a world opens after that world's Bronz boss; Altın after Gümüş boss. Within a cup: race N+1 opens when race N is finished; boss opens when all 5 are finished.
Ad rules (spec §13): rewarded is always optional; reward button never green; normal continue at least as large.

### Team UI — `src/app/**`, `src/ui/**` (owns `hud.ts`, `hud.css`, `input.ts` etc.)
The whole front end: app shell + every screen + the in-race HUD redesign.
- `src/app/app.ts`: `export class App { constructor(deps: AppDeps); start(): void }` — screen state machine: `boot/loading → home → cupMap(world) → raceIntro → race → results → (cupMap | garage | next race)`; plus `garage`, `settings`, `dailyChest` modal, pause.
- Home page (ana sayfa): animated 3D showroom background (current car on a turntable with the world behind), logo, big "YARIŞ" button (continues the next unfinished race), three world cards (Uçan Adalar / Dev Ev / Neon Şehir) with lock state + progress stars, garage button, daily chest with timer, daily tasks, gold counter, settings. It must feel like a top mobile racing game menu.
- Cup map: per world, the 3 tiers as a path of race nodes (5 races + boss node), stars earned, lock badges, best times, a "Boss" node with art.
- Garage: 3D car on turntable; tabs: Arabalar (12 cards with stats bars, buy/locked), Performans (engine/nitro/handling 5 levels), Görünüm (paint, wheels, spoiler, neon, decal, trail, horn). Each item: preview on the car before buying, price in gold, or "🎬 1/2/3 video" with saved progress. Applies mods visually (see "Car looks" below).
- Results: place podium, rewards breakdown, stars earned with animation, "x2 ödül (video)", "Tekrar", "Sonraki yarış", "Garaj", "Harita".
- In-race HUD redesign (replace the current one): custom-drawn icons (from `public/ui/icons`), concept-matching style (glossy candy UI for Adalar, toy-box for Dev Ev, neon glass for Neon — theme via CSS variables `data-world`), form buttons / part slots / shock meter panels supplied by modes via `hud.setModePanel(el)`, countdown, position, lap/progress with rival dots, speedometer arc, combo meter.
- Car looks: `src/app/carLook.ts` applies a car's mods to a CarView/Tripo model: paint = hue/saturation shift shader on the texture (Tripo cars are textured; keep stripes readable) or `body_paint` colour on legacy models; spoiler/neon/trail/decal as attachments.
- Uses META exports and the RaceMode interface below; the race itself is created through `src/modes/registry.ts` (integrator).

### Team ADALAR — `src/game/islands*`, `src/game/trackMesh*`, `src/game/sky*`, `src/sim/tracks/adalar*.ts`, `src/worlds/adalar/**`
- Environment quality pass for Uçan Adalar: far more detail and spectacle, matching `docs/konsept/ucan-adalar.png` (richer road with candy/glossy trims and decals, start/finish gate with banners and balloons, arches and rings over the road, roadside props near the asphalt, layered islands with foliage/candy/crystals, waterfalls, birds/butterflies, depth haze, colour grading per zone). Place Tripo landmark models when present (`island-candy.glb` exists; `island-ice.glb`, `island-volcano.glb`, `island-water.glb`, `gate-start.glb` may arrive) with procedural fallback.
- Content: 6 Adalar tracks (adalar1 exists) with distinct layouts, each using all four forms; variants (reverse / night / mirror) via a helper in `src/sim/tracks/variants.ts` (you own it; tests). Night variant = sky/lighting preset.
- Boss: "Dev Balina Dalgası" boss race for Dönüşüm (spec §9.1, §9.4): `src/worlds/adalar/whaleBoss.ts` — the chasing wave + cartoon whale (Tripo `whale.glb` when present, procedural fallback), catch/checkpoint rules as pure tested logic in `src/sim/boss.ts` (you own it; Kurgu/Kaos teams import it).
- Export `src/worlds/adalar/index.ts`: `buildAdalarWorld(track, q, variant): Promise<WorldView>`.

### Team KURGU — `src/kurgu/**` (sim, world, mode, tracks)
Kurgu Kupası in the Dev Ev world (spec §9.2) end-to-end: toy cars racing through a giant house (çocuk odası, mutfak, banyo, bahçe, garaj zones), the build-your-car-mid-race mechanic (4 slots, parts, gates that need parts, combos, parts knocked off), 6 tracks, Robot Süpürge boss (using `src/sim/boss.ts` from ADALAR — if not there yet, write your boss logic behind the same shape and note it), giant-house environment matching `docs/konsept/dev-ev.png` (huge furniture, toys, books as ramps, pencils, blocks; the player feels tiny). Reuse `src/sim/racer.ts` WITHOUT editing it: wrap `stepRacer` (parts change `RacerParams` and the form used for gaps/water: e.g. wing ⇒ can glide over gaps by stepping with form 'glider'); put your own logic in `src/kurgu/sim/*` with tests. Export `src/kurgu/mode.ts`: `createKurguMode: RaceModeFactory`.

### Team KAOS — `src/kaos/**`
Kaos Kupası in Neon Şehir (spec §9.3) end-to-end: dark-cyber cartoon city matching `docs/konsept/neon-sehir-n2.png` (light-ribbon roads, neon arches and giant rings, laser sky, hologram dragon, wet reflective ground, holographic billboards), 3-lap circuits (6 tracks), bots that follow ghost lines but collide, destructible neon blocks / hologram signs / glass barriers (reuse ideas from fx), Şok meter + shock wave, score = position + destruction, Ejderha boss (canını bitir). Same racer reuse rule as KURGU. Export `src/kaos/mode.ts`: `createKaosMode: RaceModeFactory`.

### Integrator (me) — `src/main.ts`, `src/modes/**`, `src/assets/**`, `src/game/session.ts` (Dönüşüm mode), `src/game/car*.ts`, `src/game/fx*.ts`, `src/game/audio*.ts`, `public/**`, `tools/**`
Asset production (icons, world cards, logo, Tripo models), music, wiring modes into the App, final integration and review.

## The race-mode interface (everyone codes against this; integrator creates the file early)
```ts
// src/modes/types.ts
import type * as THREE from 'three'
export type WorldId = 'adalar' | 'dev-ev' | 'neon'
export interface RaceSpec { readonly raceId: string; readonly cupId: string; readonly trackId: string; readonly variant: 'normal' | 'reverse' | 'night' | 'mirror'; readonly boss: boolean; readonly world: WorldId; readonly firstRace: boolean }
export interface RaceContext {
  readonly renderer: THREE.WebGLRenderer
  readonly camera: THREE.PerspectiveCamera
  readonly quality: import('../game/quality').QualityProfile
  readonly hud: import('../ui/raceHud').RaceHud          // UI team: generic race HUD API (see below)
  readonly input: { read(dt: number): import('../sim/racer').RaceInput; pressForm?(f: import('../sim/forms').FormId): void }
  readonly audio: import('../game/audio').RaceAudio
  readonly playerCar: { model: THREE.Object3D | null; carId: string; look: unknown /* applied by UI carLook */ ; params: import('../sim/racer').RacerParams }
  readonly settings: () => import('../ui/settings').Settings
}
export interface RaceOutcome { readonly place: number; readonly of: number; readonly time: number; readonly coins: number; readonly stars: readonly [boolean, boolean, boolean]; readonly starLabels: readonly [string, string, string]; readonly bossBeaten?: boolean; readonly extra?: Readonly<Record<string, number>>; readonly rows: readonly { name: string; badge: string; time: number | null; you: boolean; pilot: boolean }[] }
export interface RaceMode {
  readonly scene: THREE.Scene            // the mode builds and owns its scene (world + cars + fx)
  start(): void                          // countdown begins
  frame(realDt: number): void            // advance + update; the app renders scene with camera
  readonly finished: boolean
  outcome(): RaceOutcome | null
  restart(): void
  dispose(): void                        // free GPU resources, listeners
}
export type RaceModeFactory = (ctx: RaceContext, spec: RaceSpec) => Promise<RaceMode>
```
`src/ui/raceHud.ts` (UI team) — the in-race HUD API modes call:
```ts
export interface RaceHud {
  show(world: WorldId): void; hide(): void
  countdown(n: number): void                          // 3,2,1, 0 = GO
  update(v: { place: number; of: number; time: number; kmh: number; coins: number; progress: number; rivals: readonly { id: string; progress: number; color: string }[]; lap?: { n: number; of: number } }): void
  pop(text: string, kind: 'perfect' | 'combo' | 'bad' | 'soft' | 'gold'): void
  flash(color: string): void
  setModePanel(el: HTMLElement | null): void          // form buttons / part slots / shock meter
  formButtons(onForm: (f: FormId) => void): { setActive(f: FormId): void; hint(f: FormId | null): void; el: HTMLElement }  // ready-made panel for transform mode
  meter(label: string, color: string): { set(v01: number): void; el: HTMLElement } // e.g. Şok, boss health
}
```
Stars: each race defines 3 star goals (1st place, hidden part/target, a track challenge) with Turkish labels; modes compute them.
