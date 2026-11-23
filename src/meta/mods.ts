/**
 * Visual mods for the garage (spec §10.2). Pure data: the UI reads `value` to dress the car.
 *
 * Value keys by category (colours are 0xRRGGBB numbers):
 *  - paint:   finish ('factory' | 'gloss' | 'metal' | 'pearl' | 'matte' | 'chrome' | 'rainbow'),
 *             color, hue (target hue 0..360, see `paintHueShift`), sat (saturation ×), light (lightness ×)
 *  - wheels:  part (wheel style id), rim, tire, size (wheel scale ×)
 *  - spoiler: part (spoiler style id, 'none' = no spoiler), color (0 = body colour), scale
 *  - neon:    part, color, anim ('off' | 'steady' | 'pulse' | 'flash' | 'rainbow' | 'chase')
 *  - decal:   part (decal id, 'none' = clean), color, color2
 *  - trail:   part (trail fx id, 'none' = off), color, color2
 *  - horn:    sound (sfx id), pitch (playback rate ×)
 */
export type ModCategory = 'paint' | 'wheels' | 'spoiler' | 'neon' | 'decal' | 'trail' | 'horn'

export interface ModDef {
  readonly id: string
  readonly category: ModCategory
  readonly name: string
  readonly price: number
  readonly videos: 0 | 1 | 2 | 3
  readonly accountWide: boolean
  readonly value: Readonly<Record<string, number | string>>
}

export const MOD_CATEGORIES: readonly ModCategory[] = ['paint', 'wheels', 'spoiler', 'neon', 'decal', 'trail', 'horn']

/** Turkish category names for garage tabs. */
export const MOD_CATEGORY_NAMES: Readonly<Record<ModCategory, string>> = {
  paint: 'Boya',
  wheels: 'Jant',
  spoiler: 'Spoiler',
  neon: 'Neon',
  decal: 'Çıkartma',
  trail: 'İz Efekti',
  horn: 'Korna',
}

/** Videos asked for a mod: cheap (< 300) 1, middle 2, top (≥ 1,000) 3; free mods 0. */
export function videosForPrice(price: number): 0 | 1 | 2 | 3 {
  if (price <= 0) return 0
  if (price < 300) return 1
  if (price < 1000) return 2
  return 3
}

type Row = readonly [id: string, name: string, price: number, value: Record<string, number | string>]

const PAINT: readonly Row[] = [
  ['fabrika', 'Fabrika Rengi', 0, { finish: 'factory', sat: 1, light: 1 }],
  ['kiraz', 'Kiraz Kırmızı', 150, { finish: 'gloss', color: 0xe8283c, hue: 354, sat: 1.1, light: 1 }],
  ['portakal', 'Portakal', 150, { finish: 'gloss', color: 0xff8a1f, hue: 28, sat: 1.1, light: 1.05 }],
  ['limon', 'Limon Sarısı', 150, { finish: 'gloss', color: 0xffd21f, hue: 48, sat: 1.1, light: 1.1 }],
  ['cimen', 'Çimen Yeşili', 200, { finish: 'gloss', color: 0x3ccf4e, hue: 127, sat: 1.05, light: 1 }],
  ['okyanus', 'Okyanus Mavisi', 200, { finish: 'gloss', color: 0x1f8bff, hue: 211, sat: 1.1, light: 1 }],
  ['uzum', 'Üzüm Moru', 250, { finish: 'gloss', color: 0x8a3cff, hue: 266, sat: 1.1, light: 0.95 }],
  ['sakiz', 'Sakız Pembe', 250, { finish: 'gloss', color: 0xff6fb5, hue: 330, sat: 1, light: 1.1 }],
  ['gece', 'Gece Siyahı', 400, { finish: 'metal', color: 0x23263a, hue: 232, sat: 0.35, light: 0.4 }],
  ['kar', 'Kar Beyazı', 450, { finish: 'pearl', color: 0xf4f7ff, hue: 220, sat: 0.12, light: 1.6 }],
  ['gumus', 'Gümüş Metalik', 600, { finish: 'metal', color: 0xc4ccd8, hue: 215, sat: 0.2, light: 1.25 }],
  ['zumrut', 'Zümrüt Metalik', 750, { finish: 'metal', color: 0x0fae7a, hue: 160, sat: 1.1, light: 0.9 }],
  ['inci', 'Sedef İnci', 900, { finish: 'pearl', color: 0xffe9f4, hue: 325, sat: 0.35, light: 1.45 }],
  ['lav', 'Lav Turuncusu', 1200, { finish: 'metal', color: 0xff4a12, hue: 16, sat: 1.25, light: 1 }],
  ['altin', 'Altın Kaplama', 1600, { finish: 'chrome', color: 0xffc93c, hue: 44, sat: 1.15, light: 1.15 }],
  ['gokkusagi', 'Gökkuşağı', 2500, { finish: 'rainbow', color: 0xff5fa2, hue: 330, sat: 1.2, light: 1.1 }],
]

const WHEELS: readonly Row[] = [
  ['standart', 'Standart Jant', 0, { part: 'wheel-standart', rim: 0xd8dde6, tire: 0x2a2c34, size: 1 }],
  ['yildiz', 'Yıldız Jant', 200, { part: 'wheel-yildiz', rim: 0xffd21f, tire: 0x2a2c34, size: 1 }],
  ['papatya', 'Papatya Jant', 250, { part: 'wheel-papatya', rim: 0xffffff, tire: 0xff6fb5, size: 1 }],
  ['disli', 'Dişli Jant', 300, { part: 'wheel-disli', rim: 0x8a96a8, tire: 0x2a2c34, size: 1 }],
  ['spor', 'Spor Jant', 400, { part: 'wheel-spor', rim: 0x1f2433, tire: 0x2a2c34, size: 1 }],
  ['tombul', 'Tombul Lastik', 500, { part: 'wheel-tombul', rim: 0xff8a1f, tire: 0x33363f, size: 1.15 }],
  ['sekerleme', 'Şekerleme Jant', 600, { part: 'wheel-sekerleme', rim: 0xff4f8b, tire: 0x7a3cff, size: 1 }],
  ['krom', 'Krom Jant', 800, { part: 'wheel-krom', rim: 0xeef3ff, tire: 0x1c1e26, size: 1.05 }],
  ['neon', 'Neon Jant', 1000, { part: 'wheel-neon', rim: 0x29f0ff, tire: 0x14161e, size: 1 }],
  ['dev', 'Dev Teker', 1600, { part: 'wheel-dev', rim: 0xff3b30, tire: 0x24262e, size: 1.3 }],
  ['altin', 'Altın Jant', 2200, { part: 'wheel-altin', rim: 0xffc93c, tire: 0x1c1e26, size: 1.05 }],
]

const SPOILERS: readonly Row[] = [
  ['yok', 'Spoiler Yok', 0, { part: 'none', color: 0, scale: 1 }],
  ['kanatcik', 'Kanatçık', 150, { part: 'spoiler-kanatcik', color: 0, scale: 0.8 }],
  ['ordek', 'Ördek Kuyruk', 250, { part: 'spoiler-ordek', color: 0, scale: 1 }],
  ['spor', 'Spor Kanat', 400, { part: 'spoiler-spor', color: 0x1f2433, scale: 1 }],
  ['cift', 'Çift Katlı Kanat', 700, { part: 'spoiler-cift', color: 0, scale: 1 }],
  ['roket', 'Roket Kanat', 1000, { part: 'spoiler-roket', color: 0xff8a1f, scale: 1 }],
  ['yarasa', 'Yarasa Kanat', 1300, { part: 'spoiler-yarasa', color: 0x2a1f3d, scale: 1.1 }],
  ['jet', 'Jet Kanat', 1800, { part: 'spoiler-jet', color: 0xd8dde6, scale: 1.1 }],
  ['dev', 'Dev Kanat', 2500, { part: 'spoiler-dev', color: 0xffc93c, scale: 1.35 }],
]

const NEONS: readonly Row[] = [
  ['yok', 'Neon Yok', 0, { part: 'neon', color: 0, anim: 'off' }],
  ['mavi', 'Buz Mavisi', 200, { part: 'neon', color: 0x29c8ff, anim: 'steady' }],
  ['pembe', 'Pembe Işık', 200, { part: 'neon', color: 0xff4fd8, anim: 'steady' }],
  ['yesil', 'Asit Yeşili', 250, { part: 'neon', color: 0x7dff3c, anim: 'steady' }],
  ['mor', 'Mor Nabız', 400, { part: 'neon', color: 0x9b4dff, anim: 'pulse' }],
  ['gunbatimi', 'Gün Batımı', 450, { part: 'neon', color: 0xff8a1f, anim: 'pulse' }],
  ['alarm', 'Kırmızı Alarm', 600, { part: 'neon', color: 0xff2a3c, anim: 'flash' }],
  ['gokkusagi', 'Gökkuşağı Neon', 1200, { part: 'neon', color: 0xff5fa2, anim: 'rainbow' }],
  ['lazer', 'Lazer Dalgası', 2000, { part: 'neon', color: 0x29f0ff, anim: 'chase' }],
]

const DECALS: readonly Row[] = [
  ['yok', 'Çıkartma Yok', 0, { part: 'none', color: 0xffffff, color2: 0 }],
  ['serit', 'Yarış Şeridi', 150, { part: 'decal-serit', color: 0xffffff, color2: 0x1f2433 }],
  ['numara', 'Yarış Numarası', 150, { part: 'decal-numara', color: 0xffffff, color2: 0xe8283c }],
  ['yildiz', 'Yıldızlar', 300, { part: 'decal-yildiz', color: 0xffd21f, color2: 0xffffff }],
  ['alev', 'Alevler', 400, { part: 'decal-alev', color: 0xff8a1f, color2: 0xffd21f }],
  ['yildirim', 'Yıldırım', 400, { part: 'decal-yildirim', color: 0xffe23c, color2: 0x1f2433 }],
  ['dama', 'Dama Bayrağı', 500, { part: 'decal-dama', color: 0xffffff, color2: 0x1f2433 }],
  ['balina', 'Balina Dostu', 800, { part: 'decal-balina', color: 0x29a8ff, color2: 0xffffff }],
  ['vida', 'Oyuncak Vidaları', 800, { part: 'decal-vida', color: 0xc4ccd8, color2: 0xff8a1f }],
  ['devre', 'Neon Devre', 1000, { part: 'decal-devre', color: 0x29f0ff, color2: 0xff4fd8 }],
  ['ejderha', 'Ejderha Pulları', 2000, { part: 'decal-ejderha', color: 0x0fae7a, color2: 0xffc93c }],
]

const TRAILS: readonly Row[] = [
  ['yok', 'İz Yok', 0, { part: 'none', color: 0xffffff, color2: 0xffffff }],
  ['kivilcim', 'Kıvılcım', 300, { part: 'trail-kivilcim', color: 0xffc93c, color2: 0xff6a1f }],
  ['baloncuk', 'Baloncuklar', 600, { part: 'trail-baloncuk', color: 0x9fe8ff, color2: 0xffffff }],
  ['yildiz', 'Yıldız Tozu', 500, { part: 'trail-yildiz', color: 0xffe9a8, color2: 0xb98cff }],
  ['isik', 'Işık Şeridi', 800, { part: 'trail-isik', color: 0x29f0ff, color2: 0x2a6bff }],
  ['kalp', 'Kalpler', 700, { part: 'trail-kalp', color: 0xff4f8b, color2: 0xffb3cf }],
  ['gokkusagi', 'Gökkuşağı İzi', 2000, { part: 'trail-gokkusagi', color: 0xff5fa2, color2: 0x29c8ff }],
  ['ejderha', 'Ejderha Ateşi', 2500, { part: 'trail-ejderha', color: 0xff3b1f, color2: 0xffc93c }],
]

const HORNS: readonly Row[] = [
  ['klasik', 'Bip Bip', 0, { sound: 'horn-klasik', pitch: 1 }],
  ['ordek', 'Vak Vak', 150, { sound: 'horn-ordek', pitch: 1 }],
  ['kedi', 'Miyav', 250, { sound: 'horn-kedi', pitch: 1 }],
  ['tren', 'Çuf Çuf', 300, { sound: 'horn-tren', pitch: 1 }],
  ['gemi', 'Gemi Düdüğü', 400, { sound: 'horn-gemi', pitch: 0.9 }],
  ['robot', 'Robot Bip', 900, { sound: 'horn-robot', pitch: 1 }],
  ['dino', 'Dinozor Kükremesi', 1500, { sound: 'horn-dino', pitch: 0.95 }],
]

function build(category: ModCategory, rows: readonly Row[]): ModDef[] {
  return rows.map(([slug, name, price, value]) => ({
    id: `${category}-${slug}`,
    category,
    name,
    price,
    videos: videosForPrice(price),
    accountWide: category === 'trail' || category === 'horn',
    value: Object.freeze({ ...value }),
  }))
}

export const MODS: readonly ModDef[] = Object.freeze([
  ...build('paint', PAINT),
  ...build('wheels', WHEELS),
  ...build('spoiler', SPOILERS),
  ...build('neon', NEONS),
  ...build('decal', DECALS),
  ...build('trail', TRAILS),
  ...build('horn', HORNS),
])

const BY_ID: ReadonlyMap<string, ModDef> = new Map(MODS.map((m) => [m.id, m]))

export function modById(id: string): ModDef | undefined {
  return BY_ID.get(id)
}

export function modsOf(category: ModCategory): readonly ModDef[] {
  return MODS.filter((m) => m.category === category)
}

/** The free mod every car wears in a category until something else is equipped. */
export function defaultModId(category: ModCategory): string {
  const free = MODS.find((m) => m.category === category && m.price === 0)
  if (free === undefined) throw new Error(`No default mod for ${category}`)
  return free.id
}

export function isModCategory(x: unknown): x is ModCategory {
  return typeof x === 'string' && (MOD_CATEGORIES as readonly string[]).includes(x)
}
