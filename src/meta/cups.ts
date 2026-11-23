/**
 * The cup ladder (spec §11.3): 3 worlds × bronz / gümüş / altın, each cup 5 races + 1 boss.
 * Each world has 6 base tracks; variants (reverse / night / mirror) fill the higher tiers.
 */
export type WorldId = 'adalar' | 'dev-ev' | 'neon'
export type CupMode = 'transform' | 'build' | 'chaos'
export type CupTier = 'bronz' | 'gumus' | 'altin'
export type CupId = `${WorldId}-${CupTier}`
export type Variant = 'normal' | 'reverse' | 'night' | 'mirror'

export interface RaceDef {
  readonly id: string
  readonly cup: CupId
  /** 0..4 = races, 5 = boss. */
  readonly index: number
  readonly trackId: string
  readonly variant: Variant
  readonly boss: boolean
  readonly name: string
}

export interface CupDef {
  readonly id: CupId
  readonly world: WorldId
  readonly mode: CupMode
  readonly tier: CupTier
  readonly name: string
  readonly races: readonly RaceDef[]
}

export interface WorldInfo {
  /** World name, e.g. "Uçan Adalar". */
  readonly name: string
  readonly mode: CupMode
  /** Cup family name, e.g. "Dönüşüm Kupası". */
  readonly cupName: string
  readonly bossName: string
  /** Turkish names of the 6 base tracks, index 0 = track 1. */
  readonly tracks: readonly string[]
}

export const WORLDS: readonly WorldId[] = ['adalar', 'dev-ev', 'neon']
export const TIERS: readonly CupTier[] = ['bronz', 'gumus', 'altin']
export const TIER_NAMES: Readonly<Record<CupTier, string>> = { bronz: 'Bronz', gumus: 'Gümüş', altin: 'Altın' }
export const VARIANT_NAMES: Readonly<Record<Variant, string>> = {
  normal: '',
  reverse: 'Ters Yön',
  night: 'Gece',
  mirror: 'Ayna',
}

export const WORLD_INFO: Readonly<Record<WorldId, WorldInfo>> = {
  adalar: {
    name: 'Uçan Adalar',
    mode: 'transform',
    cupName: 'Dönüşüm Kupası',
    bossName: 'Dev Balina Dalgası',
    tracks: ['Şeker Adası', 'Buz Kıyısı', 'Volkan Geçidi', 'Şelale Yolu', 'Kristal Köprü', 'Bulut Limanı'],
  },
  'dev-ev': {
    name: 'Dev Ev',
    mode: 'build',
    cupName: 'Kurgu Kupası',
    bossName: 'Robot Süpürge',
    tracks: ['Çocuk Odası', 'Mutfak Tezgâhı', 'Köpüklü Banyo', 'Bahçe Hortumu', 'Garaj Rafları', 'Çatı Arası'],
  },
  neon: {
    name: 'Neon Şehir',
    mode: 'chaos',
    cupName: 'Kaos Kupası',
    bossName: 'Hologram Ejderha',
    tracks: ['Işık Şeridi', 'Lazer Bulvarı', 'Hologram Çarşısı', 'Yağmurlu Kavşak', 'Halka Kulesi', 'Ejderha Köprüsü'],
  },
}

/** Track ids drop the dash: 'dev-ev' → 'devev1'..'devev6'. */
export function trackPrefix(world: WorldId): string {
  return world.replace('-', '')
}

type Slot = readonly [track: number, variant: Variant]

/**
 * Same plan for every world: bronz plays tracks 1-5 as built, gümüş reverses and mirrors them,
 * altın adds night. The boss always runs on track 6 (its long showpiece track) in the tier's style.
 * No track/variant pair repeats inside a world.
 */
const PLAN: Readonly<Record<CupTier, { races: readonly Slot[]; boss: Slot }>> = {
  bronz: {
    races: [[1, 'normal'], [2, 'normal'], [3, 'normal'], [4, 'normal'], [5, 'normal']],
    boss: [6, 'normal'],
  },
  gumus: {
    races: [[1, 'reverse'], [4, 'mirror'], [2, 'reverse'], [5, 'mirror'], [3, 'reverse']],
    boss: [6, 'reverse'],
  },
  altin: {
    races: [[2, 'night'], [5, 'night'], [3, 'mirror'], [1, 'night'], [4, 'night']],
    boss: [6, 'night'],
  },
}

function raceName(world: WorldId, track: number, variant: Variant): string {
  const base = WORLD_INFO[world].tracks[track - 1] ?? `Pist ${track}`
  return variant === 'normal' ? base : `${base} (${VARIANT_NAMES[variant]})`
}

function buildCup(world: WorldId, tier: CupTier): CupDef {
  const id: CupId = `${world}-${tier}`
  const info = WORLD_INFO[world]
  const plan = PLAN[tier]
  const race = (slot: Slot, index: number, boss: boolean): RaceDef => ({
    id: boss ? `${id}-boss` : `${id}-${index + 1}`,
    cup: id,
    index,
    trackId: `${trackPrefix(world)}${slot[0]}`,
    variant: slot[1],
    boss,
    name: boss ? `Boss: ${info.bossName}` : raceName(world, slot[0], slot[1]),
  })
  const races = [...plan.races.map((slot, i) => race(slot, i, false)), race(plan.boss, plan.races.length, true)]
  return { id, world, mode: info.mode, tier, name: `${TIER_NAMES[tier]} ${info.cupName}`, races }
}

export const CUPS: readonly CupDef[] = WORLDS.flatMap((w) => TIERS.map((t) => buildCup(w, t)))

const CUP_BY_ID: ReadonlyMap<string, CupDef> = new Map(CUPS.map((c) => [c.id, c]))
const RACE_BY_ID: ReadonlyMap<string, RaceDef> = new Map(CUPS.flatMap((c) => c.races.map((r) => [r.id, r] as const)))

export function cupById(id: string): CupDef | undefined {
  return CUP_BY_ID.get(id)
}

export function raceById(id: string): RaceDef | undefined {
  return RACE_BY_ID.get(id)
}

export function isCupId(x: unknown): x is CupId {
  return typeof x === 'string' && CUP_BY_ID.has(x)
}

/** The world's cups in tier order: bronz, gümüş, altın. */
export function cupsOfWorld(world: WorldId): readonly CupDef[] {
  return CUPS.filter((c) => c.world === world)
}
