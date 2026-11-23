/**
 * Vector stand-ins for the custom PNG icons (public/ui/icons/<name>.png). They are drawn in the
 * same chunky candy style (gradient fill, thick dark outline, a gloss highlight) so the menus
 * look finished even before the PNGs land. Unknown names fall back to a lettered badge.
 */

const INK = '#2b1460'
const O = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`
const THIN = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`
const GLOSS = (x: number, y: number, rx: number, ry: number): string =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55" transform="rotate(-20 ${x} ${y})"/>`

/** Gradients shared by every inline icon (inserted once into the document). */
export const ICON_DEFS: Readonly<Record<string, readonly [string, string, string]>> = {
  gold: ['#fff6b0', '#ffc81f', '#f08400'],
  silver: ['#ffffff', '#d4dcec', '#8f9cb8'],
  bronze: ['#ffd9b0', '#e2894a', '#9c4f26'],
  red: ['#ff9a9a', '#ff4b5c', '#c8183a'],
  blue: ['#9fe3ff', '#2fa8ff', '#1557d6'],
  purple: ['#e2b8ff', '#a24bff', '#5d1bd1'],
  green: ['#d4ff9a', '#62d935', '#258a1c'],
  pink: ['#ffc4ec', '#ff5fc8', '#c21c8e'],
  cyan: ['#c4fbff', '#33e0ff', '#0a8fc4'],
  orange: ['#ffd49a', '#ff9a2e', '#d9530b'],
  white: ['#ffffff', '#f1f4ff', '#c9d2f2'],
  dark: ['#8a7fb8', '#4c3d86', '#24164f'],
}

export const iconDefsMarkup = (): string =>
  Object.entries(ICON_DEFS)
    .map(([k, [a, b, c]]) => `<linearGradient id="kg-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`)
    .join('')

const g = (k: string): string => `url(#kg-${k})`

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const pts: string[] = []
  const step = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i++) {
    const a = i * step
    for (const [da, r] of [[-0.3, inner], [-0.18, outer], [0.18, outer], [0.3, inner]] as const) {
      const t = a + da * step * 1.6
      pts.push(`${(cx + Math.cos(t) * r).toFixed(1)},${(cy + Math.sin(t) * r).toFixed(1)}`)
    }
  }
  return `M${pts.join('L')}Z`
}

const STAR = starPath(32, 34, 28, 13)

const trophy = (tint: string): string =>
  `<path d="M14 12h36v8c0 12-8 20-18 20S14 32 14 20z" fill="${g(tint)}" ${O}/>` +
  `<path d="M14 16H7c0 9 4 13 9 14M50 16h7c0 9-4 13-9 14" fill="none" ${O}/>` +
  `<path d="M27 40h10v8H27z" fill="${g(tint)}" ${O}/><path d="M18 48h28v8H18z" fill="${g(tint)}" ${O}/>` +
  `<path d="${starPath(32, 24, 8, 3.6)}" fill="#fff" opacity=".85"/>` + GLOSS(22, 20, 4, 7)

const carSide = (tint: string): string =>
  `<path d="M6 40c0-6 3-9 9-10l8-10c2-2 4-3 7-3h10c3 0 5 1 7 3l6 9c6 1 9 4 9 10v4H6z" fill="${g(tint)}" ${O}/>` +
  `<path d="M26 21h6v9h-12zM36 21h4c2 0 3 1 4 2l4 7H36z" fill="#bfefff" ${THIN}/>` +
  `<circle cx="18" cy="45" r="7" fill="#3a2a6e" ${O}/><circle cx="46" cy="45" r="7" fill="#3a2a6e" ${O}/>` +
  `<circle cx="18" cy="45" r="2.5" fill="#fff"/><circle cx="46" cy="45" r="2.5" fill="#fff"/>` + GLOSS(16, 33, 3, 5)

/** name → inner SVG markup on a 64×64 canvas. */
export const GLYPHS: Readonly<Record<string, string>> = {
  coin:
    `<circle cx="32" cy="32" r="26" fill="${g('gold')}" ${O}/><circle cx="32" cy="32" r="18" fill="none" stroke="#c46a00" stroke-width="3" opacity=".7"/>` +
    `<path d="${starPath(32, 33, 11, 5)}" fill="#fff7c2" stroke="#c46a00" stroke-width="2" stroke-linejoin="round"/>` + GLOSS(22, 20, 5, 9),
  star: `<path d="${STAR}" fill="${g('gold')}" ${O}/>` + GLOSS(24, 26, 4, 7),
  'star-empty': `<path d="${STAR}" fill="#2b1460" fill-opacity=".35" stroke="#fff" stroke-opacity=".6" stroke-width="3.5" stroke-linejoin="round"/>`,
  trophy: trophy('gold'),
  'trophy-gold': trophy('gold'),
  'trophy-silver': trophy('silver'),
  'trophy-bronze': trophy('bronze'),
  gear:
    `<path d="${gearPath(32, 32, 28, 21, 8)}" fill="${g('white')}" ${O}/><circle cx="32" cy="32" r="9" fill="${g('blue')}" ${O}/>`,
  pause: `<rect x="14" y="10" width="13" height="44" rx="5" fill="${g('white')}" ${O}/><rect x="37" y="10" width="13" height="44" rx="5" fill="${g('white')}" ${O}/>`,
  play: `<path d="M18 9c0-3 3-4 5-3l31 22c3 2 3 6 0 8L23 58c-2 1-5 0-5-3z" fill="${g('white')}" ${O}/>`,
  home:
    `<path d="M8 32 32 10l24 22h-7v22H15V32z" fill="${g('white')}" ${O}/><path d="M27 54V40h10v14" fill="${g('orange')}" ${O}/>` +
    `<path d="M6 33 32 9l26 24" fill="none" stroke="#ff4b5c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  back: `<path d="M28 10 6 32l22 22V41h12c8 0 14 4 18 11 0-16-8-27-30-27V10z" fill="${g('white')}" ${O}/>`,
  lock:
    `<path d="M20 28v-7a12 12 0 0 1 24 0v7" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>` +
    `<path d="M20 28v-7a12 12 0 0 1 24 0v7" fill="none" stroke="#c9d2f2" stroke-width="4.5" stroke-linecap="round"/>` +
    `<rect x="11" y="27" width="42" height="30" rx="8" fill="${g('gold')}" ${O}/><path d="M32 37v9" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` + GLOSS(19, 34, 3, 5),
  video:
    `<rect x="6" y="14" width="40" height="36" rx="9" fill="${g('white')}" ${O}/><path d="M46 26l12-7v26l-12-7z" fill="${g('white')}" ${O}/>` +
    `<path d="M21 23v18l14-9z" fill="#a24bff" stroke="#5d1bd1" stroke-width="2.5" stroke-linejoin="round"/>`,
  chest:
    `<path d="M8 30h48v24H8z" fill="${g('orange')}" ${O}/><path d="M8 30c0-12 8-18 24-18s24 6 24 18z" fill="${g('red')}" ${O}/>` +
    `<path d="M14 30v24M50 30v24M10 30h44" stroke="${INK}" stroke-width="3"/><path d="M18 14v40M46 14v40" stroke="#ffc81f" stroke-width="4" opacity=".9"/>` +
    `<rect x="26" y="26" width="12" height="14" rx="3" fill="${g('gold')}" ${O}/>` + GLOSS(20, 20, 3, 6),
  gift:
    `<rect x="9" y="26" width="46" height="30" rx="5" fill="${g('pink')}" ${O}/><rect x="6" y="18" width="52" height="12" rx="4" fill="${g('pink')}" ${O}/>` +
    `<path d="M32 18v38" stroke="${g('gold')}" stroke-width="9"/><path d="M32 18v38" stroke="${INK}" stroke-width="3" opacity=".3"/>` +
    `<path d="M32 18c-6-10-18-10-16-2 1 3 9 3 16 2zM32 18c6-10 18-10 16-2-1 3-9 3-16 2z" fill="${g('gold')}" ${O}/>`,
  flag:
    `<path d="M12 6v52" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M14 9h38l-6 12 6 12H14z" fill="#fff" ${O}/>` +
    `<path d="M14 9h9v8h-9zM32 9h9v8h-9zM23 17h9v8h-9zM41 17h8l-3 5 1 3h-6zM14 25h9v8h-9zM32 25h9v8h-9z" fill="${INK}"/>`,
  garage:
    `<path d="M6 26 32 8l26 18v30H6z" fill="${g('blue')}" ${O}/><rect x="14" y="30" width="36" height="26" rx="3" fill="${g('white')}" ${O}/>` +
    `<path d="M14 37h36M14 44h36M14 51h36" stroke="${INK}" stroke-width="3" opacity=".55"/>`,
  boss:
    `<path d="M10 30c0-14 10-22 22-22s22 8 22 22c0 10-5 16-10 18v8H20v-8c-5-2-10-8-10-18z" fill="${g('purple')}" ${O}/>` +
    `<path d="M14 18 6 6l14 6M50 18l8-12-14 6" fill="${g('gold')}" ${O}/>` +
    `<path d="M19 30l9 4-9 4zM45 30l-9 4 9 4z" fill="#fff36b" ${THIN}/><path d="M24 48v-6M32 48v-6M40 48v-6" stroke="${INK}" stroke-width="3"/>`,
  'sound-on':
    `<path d="M8 24h10l14-12v40L18 40H8z" fill="${g('white')}" ${O}/><path d="M40 22c4 3 4 17 0 20M46 15c9 6 9 28 0 34" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  'sound-off':
    `<path d="M8 24h10l14-12v40L18 40H8z" fill="${g('white')}" ${O}/><path d="M40 24l16 16M56 24 40 40" stroke="#ff4b5c" stroke-width="6" stroke-linecap="round"/>`,
  'form-car': carSide('gold'),
  'form-boat':
    `<path d="M6 34h52l-8 14H14z" fill="${g('blue')}" ${O}/><path d="M22 34V18h10l10 16" fill="${g('white')}" ${O}/>` +
    `<path d="M4 54c5-4 9-4 14 0s9 4 14 0 9-4 14 0 9 4 14 0" fill="none" stroke="#33e0ff" stroke-width="5" stroke-linecap="round"/>`,
  'form-glider':
    `<path d="M4 30 32 16l28 14-28 6z" fill="${g('pink')}" ${O}/><path d="M32 16v20" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M24 38h16l-3 10H27z" fill="${g('white')}" ${O}/><path d="M10 52c6-3 10-3 16 0M38 52c6-3 10-3 16 0" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>`,
  'form-climber':
    `<path d="M10 56 30 14l8 14 6-6 12 34z" fill="${g('green')}" ${O}/><path d="M24 28c4 2 8 2 10-2" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M40 30l6-8 4 4M44 40l6-6 4 4" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  shock:
    `<path d="M36 4 12 36h16l-6 24 30-36H36z" fill="${g('cyan')}" ${O}/>` + GLOSS(30, 18, 3, 6),
  'upgrade-engine':
    `<rect x="10" y="20" width="40" height="30" rx="6" fill="${g('red')}" ${O}/><rect x="18" y="10" width="24" height="10" rx="3" fill="${g('silver')}" ${O}/>` +
    `<path d="M50 28h6v14h-6M4 30h6v10H4" fill="${g('silver')}" ${O}/><path d="M32 24 24 37h8l-3 9 10-13h-8l3-9z" fill="#fff36b" ${THIN}/>`,
  'upgrade-nitro':
    `<rect x="18" y="16" width="20" height="40" rx="9" fill="${g('blue')}" ${O}/><rect x="23" y="8" width="10" height="9" rx="2" fill="${g('silver')}" ${O}/>` +
    `<path d="M44 54c-6-6 0-12 4-20 4 8 10 14 4 20-2 2-6 2-8 0z" fill="${g('orange')}" ${O}/><path d="M22 28h12" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`,
  'upgrade-handling':
    `<circle cx="32" cy="32" r="24" fill="none" stroke="${INK}" stroke-width="13"/><circle cx="32" cy="32" r="24" fill="none" stroke="${g('silver')}" stroke-width="7"/>` +
    `<path d="M10 32h44M32 32v22" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M10 32h44M32 32v22" stroke="#d4dcec" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="32" cy="32" r="8" fill="${g('red')}" ${O}/>`,
  paint:
    `<path d="M40 6l18 18-20 20-18-18z" fill="${g('pink')}" ${O}/><path d="M20 26 10 36c-3 3-3 7 0 10l8 8c3 3 7 3 10 0l10-10" fill="${g('white')}" ${O}/>` +
    `<path d="M14 50c-4 4-8 6-8 8" stroke="#ff5fc8" stroke-width="6" stroke-linecap="round"/>`,
  wheel:
    `<circle cx="32" cy="32" r="26" fill="#3a2a6e" ${O}/><circle cx="32" cy="32" r="15" fill="${g('silver')}" ${O}/>` +
    `<path d="M32 17v30M17 32h30M21 21l22 22M43 21 21 43" stroke="${INK}" stroke-width="2.5"/><circle cx="32" cy="32" r="5" fill="${g('gold')}" ${THIN}/>`,
  spoiler:
    `<path d="M6 18h52l-4 10H10z" fill="${g('orange')}" ${O}/><path d="M18 28l-4 24h8l4-24M42 28l4 24h-8l-4-24" fill="${g('dark')}" ${O}/>` +
    `<path d="M8 52h48" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
  neon:
    `<ellipse cx="32" cy="46" rx="28" ry="10" fill="#ff5fc8" opacity=".45"/><path d="M8 34c0-6 3-9 8-10l8-8h16l8 8c5 1 8 4 8 10v6H8z" fill="${g('dark')}" ${O}/>` +
    `<path d="M10 46h44" stroke="#ff5fc8" stroke-width="6" stroke-linecap="round"/><path d="M10 46h44" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
  trail:
    `<path d="M4 44c14-2 24-10 34-22" stroke="#33e0ff" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M4 52c16 0 30-8 40-18" stroke="#ff5fc8" stroke-width="6" stroke-linecap="round" fill="none"/>` +
    `<path d="${starPath(48, 18, 14, 6)}" fill="${g('gold')}" ${O}/>`,
  horn:
    `<path d="M8 26h8l30-14v40L16 38H8z" fill="${g('gold')}" ${O}/><path d="M18 38l4 14h8l-4-12" fill="${g('orange')}" ${O}/>` +
    `<path d="M52 24l6-4M54 32h7M52 40l6 4" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  'gas-auto':
    `<rect x="16" y="6" width="32" height="52" rx="8" fill="${g('dark')}" ${O}/><path d="M22 16h20M22 26h20M22 36h20M22 46h20" stroke="#8a7fb8" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="46" cy="46" r="12" fill="${g('green')}" ${O}/><path d="M40 46l4 4 8-8" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  clock:
    `<circle cx="32" cy="35" r="24" fill="${g('white')}" ${O}/><rect x="26" y="4" width="12" height="8" rx="3" fill="${g('red')}" ${O}/>` +
    `<path d="M32 35V21M32 35l9 6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="35" r="3.5" fill="#ff4b5c"/>`,
  brake:
    `<path d="M22 6h20l16 16v20L42 58H22L6 42V22z" fill="${g('red')}" ${O}/><rect x="18" y="28" width="28" height="8" rx="4" fill="#fff"/>`,
  'part-wing': `<path d="M4 34 30 18h28l-6 10H34L12 40z" fill="${g('cyan')}" ${O}/><path d="M18 30h30" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
  'part-rocket':
    `<path d="M32 4c10 8 12 22 8 36H24C20 26 22 12 32 4z" fill="${g('white')}" ${O}/><circle cx="32" cy="22" r="5" fill="${g('blue')}" ${THIN}/>` +
    `<path d="M24 34l-8 10 8-2M40 34l8 10-8-2" fill="${g('red')}" ${O}/><path d="M26 42c0 8 6 16 6 16s6-8 6-16z" fill="${g('orange')}" ${O}/>`,
  'part-magnet':
    `<path d="M12 10h14v24a6 6 0 0 0 12 0V10h14v24a20 20 0 0 1-40 0z" fill="${g('red')}" ${O}/><path d="M12 10h14v9H12zM38 10h14v9H38z" fill="${g('silver')}" ${O}/>`,
  'part-drill': `<path d="M8 22h18v20H8z" fill="${g('orange')}" ${O}/><path d="M26 18l30 14-30 14z" fill="${g('silver')}" ${O}/><path d="M32 24l6 16M42 28l4 10" stroke="${INK}" stroke-width="3"/>`,
  'part-bigwheel':
    `<circle cx="32" cy="32" r="27" fill="#3a2a6e" ${O}/><circle cx="32" cy="32" r="13" fill="${g('green')}" ${O}/>` +
    `<path d="M32 5v8M32 51v8M5 32h8M51 32h8M13 13l6 6M45 45l6 6M13 51l6-6M45 19l6-6" stroke="#8a7fb8" stroke-width="5" stroke-linecap="round"/>`,
  'part-float': `<ellipse cx="32" cy="36" rx="26" ry="18" fill="${g('orange')}" ${O}/><ellipse cx="32" cy="34" rx="10" ry="6" fill="#33e0ff" ${THIN}/><path d="M10 30h8M46 30h8" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
  'cup-donusum': trophy('blue'),
  'cup-kurgu': trophy('orange'),
  'cup-kaos': trophy('purple'),
}

/** Lettered badge used for names with no glyph yet. */
export function letterBadge(name: string, hue: number): string {
  const letter = (name.replace(/^(form|part|upgrade|cup|trophy)-/, '')[0] ?? '?').toUpperCase()
  return (
    `<rect x="4" y="4" width="56" height="56" rx="18" fill="hsl(${hue} 85% 58%)" ${O}/>` +
    `<rect x="9" y="8" width="46" height="20" rx="10" fill="#fff" opacity=".3"/>` +
    `<text x="32" y="44" text-anchor="middle" font-size="30" font-weight="900" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke" font-family="Kupa, Nunito, sans-serif">${letter}</text>`
  )
}
