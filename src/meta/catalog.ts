/**
 * Cars, performance upgrades and (re-exported) visual mods — spec §10.
 * Pure data and lookups; prices follow spec §11.1.
 */
import type { CupId } from './cups'
import type { ModDef } from './mods'

export type { ModCategory, ModDef } from './mods'
export {
  MOD_CATEGORIES,
  MOD_CATEGORY_NAMES,
  MODS,
  defaultModId,
  isModCategory,
  modById,
  modsOf,
  videosForPrice,
} from './mods'

export type CarId = string

export interface CarStats {
  readonly speed: number
  readonly accel: number
  readonly handling: number
}

export interface CarDef {
  readonly id: CarId
  readonly name: string
  /** Relative GLB path; './models/hero.glb' for the starter, './models/car-<id>.glb' for the rest. */
  readonly model: string
  /** Gold price. 0 = free (starter) or not for sale (boss prize, see `unlock`). */
  readonly price: number
  /** Present on prize cars: granted the first time this cup's boss is beaten, never sold. */
  readonly unlock?: { readonly cup: CupId }
  /** 1..10 each. */
  readonly stats: CarStats
  /** One-line Turkish character blurb for the garage card. */
  readonly character: string
  /** Dominant body hue in degrees (0..359): UI accents, and the base for paint hue shifts. */
  readonly hue: number
}

export type PerfId = 'engine' | 'nitro' | 'handling'
export const PERF_IDS: readonly PerfId[] = ['engine', 'nitro', 'handling']
export const PERF_NAMES: Readonly<Record<PerfId, string>> = { engine: 'Motor', nitro: 'Nitro', handling: 'Yol Tutuş' }
/** Which car stat each upgrade raises. */
export const PERF_STAT: Readonly<Record<PerfId, keyof CarStats>> = { engine: 'speed', nitro: 'accel', handling: 'handling' }
/** Gold for level 1..5 of each upgrade, per car. */
export const PERF_PRICES: readonly number[] = [200, 400, 800, 1500, 2500]
export const MAX_PERF_LEVEL = 5
/** Stat points one upgrade level adds (5 levels = +2). */
export const PERF_STEP = 0.4

export const STARTER_CAR: CarId = 'kivilcim'

const model = (id: string): string => `./models/car-${id}.glb`

export const CARS: readonly CarDef[] = [
  {
    id: 'kivilcim',
    name: 'Kıvılcım',
    model: './models/hero.glb',
    price: 0,
    stats: { speed: 5, accel: 5, handling: 5 },
    character: 'Her yarışa gülerek başlar, hiç pes etmez.',
    hue: 48,
  },
  {
    id: 'kumbocegi',
    name: 'Kum Böceği',
    model: model('kumbocegi'),
    price: 1000,
    stats: { speed: 4, accel: 7, handling: 7 },
    character: 'Hafif ve çevik bir buggy; virajlarda dans eder.',
    hue: 205,
  },
  {
    id: 'pitircik',
    name: 'Pıtırcık',
    model: model('pitircik'),
    price: 1800,
    stats: { speed: 4, accel: 8, handling: 7 },
    character: 'Minicik ama uzun bir böcek limuzin; dönüşümleri şimşek gibi.',
    hue: 322,
  },
  {
    id: 'roket',
    name: 'Roket',
    model: model('roket'),
    price: 0,
    unlock: { cup: 'adalar-bronz' },
    stats: { speed: 7, accel: 7, handling: 4 },
    character: 'Arkasında roket, önünde bulutlar; düz yolda yakalanmaz.',
    hue: 272,
  },
  {
    id: 'tosbik',
    name: 'Tosbik',
    model: model('tosbik'),
    price: 2500,
    stats: { speed: 5, accel: 5, handling: 7 },
    character: 'Sağlam kasalı turuncu kamyonet; tümseklere aldırmaz.',
    hue: 28,
  },
  {
    id: 'nane',
    name: 'Nane',
    model: model('nane'),
    price: 4000,
    stats: { speed: 6, accel: 6, handling: 7 },
    character: 'Yerden bir karış yukarıda süzülen serin minibüs.',
    hue: 158,
  },
  {
    id: 'firtina',
    name: 'Fırtına',
    model: model('firtina'),
    price: 0,
    unlock: { cup: 'dev-ev-bronz' },
    stats: { speed: 8, accel: 5, handling: 3 },
    character: 'Kocaman tekerlekli canavar kamyon; ağır ama durdurulamaz.',
    hue: 2,
  },
  {
    id: 'cakal',
    name: 'Çakal',
    model: model('cakal'),
    price: 6000,
    stats: { speed: 6, accel: 6, handling: 9 },
    character: 'Her yolu bilen yeşil cip; kaygan zeminde bile şaşmaz.',
    hue: 118,
  },
  {
    id: 'buzul',
    name: 'Buzul',
    model: model('buzul'),
    price: 0,
    unlock: { cup: 'adalar-gumus' },
    stats: { speed: 7, accel: 7, handling: 8 },
    character: 'Buz mavisi kar yarışçısı; soğukkanlı ve kaymaz.',
    hue: 192,
  },
  {
    id: 'simsek',
    name: 'Şimşek',
    model: model('simsek'),
    price: 9000,
    stats: { speed: 9, accel: 7, handling: 6 },
    character: 'Bembeyaz formül arabası; ışıktan hızlı olduğunu iddia eder.',
    hue: 212,
  },
  {
    id: 'magma',
    name: 'Magma',
    model: model('magma'),
    price: 0,
    unlock: { cup: 'neon-bronz' },
    stats: { speed: 9, accel: 8, handling: 5 },
    character: 'Kaputundan lav fokurdayan sıcak kanlı hotrod.',
    hue: 14,
  },
  {
    id: 'kartal',
    name: 'Altın Kartal',
    model: model('kartal'),
    price: 15000,
    stats: { speed: 10, accel: 8, handling: 8 },
    character: 'Siyah-altın süper araba; garajın en parlak yıldızı.',
    hue: 44,
  },
]

const CAR_BY_ID: ReadonlyMap<CarId, CarDef> = new Map(CARS.map((c) => [c.id, c]))

export function carById(id: CarId): CarDef | undefined {
  return CAR_BY_ID.get(id)
}

/** A car's stats with its performance levels added (each level +0.4; may exceed 10 when maxed). */
export function effectiveStats(car: CarDef, levels: Partial<Record<PerfId, number>>): CarStats {
  const add = (perf: PerfId): number => Math.max(0, Math.min(MAX_PERF_LEVEL, levels[perf] ?? 0)) * PERF_STEP
  return {
    speed: car.stats.speed + add('engine'),
    accel: car.stats.accel + add('nitro'),
    handling: car.stats.handling + add('handling'),
  }
}

/**
 * Degrees to rotate a textured car's hue so its body reads as the paint's target hue
 * (in -180..180). Factory paint → 0. The UI also gets the paint's sat/light multipliers.
 */
export function paintHueShift(car: CarDef, paint: ModDef): number {
  const target = paint.value.hue
  if (paint.category !== 'paint' || typeof target !== 'number') return 0
  const d = (((target - car.hue) % 360) + 540) % 360 - 180
  return d === -180 ? 180 : d
}
