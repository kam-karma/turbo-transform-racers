/**
 * The six Neon Şehir circuits. Each loop comes from a small parametric shape (an ellipse or
 * a figure eight with a few harmonics on top) sampled into design points, so the curves stay
 * smooth and even; figure eights cross over themselves on a bridge at least 10 m up.
 */
import type { CircuitSpec, DesignPoint } from '../sim/circuit'
import type { KaosGoals } from '../sim/score'

export interface NeonPalette {
  /** Main and second neon colours (hex), used for road edges, rings and signs. */
  readonly a: number
  readonly b: number
  /** Accent (boost chevrons, highlights). */
  readonly c: number
}

export interface KaosCircuitDef {
  readonly spec: CircuitSpec
  readonly goals: KaosGoals
  readonly palette: NeonPalette
  /** Seed for props, towers and destructibles. */
  readonly seed: number
}

const TAU = Math.PI * 2
const N = 44

type Shape = (t: number) => DesignPoint

/** Ellipse-like loop with harmonics: radius wobble k-fold, height wave. */
function loop(rx: number, rz: number, wobble: readonly (readonly [number, number, number])[], hills: readonly (readonly [number, number, number])[], rot = 0): Shape {
  return (t) => {
    let r = 1
    for (const [k, amp, ph] of wobble) r += amp * Math.cos(k * t + ph)
    let y = 0
    for (const [k, amp, ph] of hills) y += amp * Math.sin(k * t + ph)
    const x = rx * r * Math.cos(t)
    const z = rz * r * Math.sin(t)
    return [x * Math.cos(rot) - z * Math.sin(rot), x * Math.sin(rot) + z * Math.cos(rot), y]
  }
}

/** Figure eight (lemniscate of Gerono); the crossing at t = 0 / π is split by `lift` metres. */
function eight(a: number, b: number, lift: number, extra: readonly (readonly [number, number, number])[] = [], rot = 0): Shape {
  return (t) => {
    // Shift so the start (t = 0) is on a long side, not on the crossing.
    const u = t + Math.PI / 2
    const x = a * Math.sin(u)
    const z = b * Math.sin(u) * Math.cos(u) * 2
    let y = (lift / 2) * Math.cos(u)
    for (const [k, amp, ph] of extra) y += amp * Math.sin(k * u + ph)
    return [x * Math.cos(rot) - z * Math.sin(rot), x * Math.sin(rot) + z * Math.cos(rot), y]
  }
}

const sample = (f: Shape, n = N): DesignPoint[] => Array.from({ length: n }, (_, i) => f((i / n) * TAU))

const spec = (id: string, name: string, f: Shape, extra: Partial<CircuitSpec> = {}): CircuitSpec => ({
  id, name, laps: 3, width: 18, pts: sample(f), ...extra,
})

export const NEON_CIRCUITS: readonly KaosCircuitDef[] = [
  {
    spec: spec('neon1', 'Işık Halkası', loop(235, 150, [[2, 0.08, 0], [3, 0.05, 1]], [[2, 6, 0.4], [3, 2, 0]]), {
      boosts: [0.18, 0.62], coins: [{ u: 0.08, n: 6, d: 0 }, { u: 0.45, n: 6, d: 4 }, { u: 0.8, n: 5, d: -4 }],
    }),
    goals: { destruction: 650, challenge: { kind: 'glass', n: 10 } },
    palette: { a: 0x22e6ff, b: 0xff3df2, c: 0xb6ff2e },
    seed: 11,
  },
  {
    spec: spec('neon2', 'Lazer Sekizi', eight(235, 110, 14, [[2, 3, 0]]), {
      boosts: [0.2, 0.7], coins: [{ u: 0.1, n: 6, d: 0 }, { u: 0.6, n: 6, d: 0 }],
    }),
    goals: { destruction: 700, challenge: { kind: 'botHits', n: 8 } },
    palette: { a: 0xff3df2, b: 0x7a5cff, c: 0x22e6ff },
    seed: 23,
  },
  {
    spec: spec('neon3', 'Ejderha Kulesi', loop(215, 200, [[3, 0.16, 0.5], [1, -0.06, 0]], [[1, 9, 0], [3, 3, 1]]), {
      boosts: [0.33, 0.83], coins: [{ u: 0.2, n: 6, d: -3 }, { u: 0.55, n: 6, d: 3 }],
    }),
    goals: { destruction: 700, challenge: { kind: 'shockHits', n: 3 } },
    palette: { a: 0xb6ff2e, b: 0x22e6ff, c: 0xff3df2 },
    seed: 37,
  },
  {
    spec: spec('neon4', 'Neon Kanyon', loop(290, 115, [[2, 0.08, 0], [4, 0.02, 0.3]], [[2, 8, 1.2]], 0.3), {
      boosts: [0.05, 0.52], coins: [{ u: 0.12, n: 8, d: 0 }, { u: 0.6, n: 8, d: 0 }],
    }),
    goals: { destruction: 800, challenge: { kind: 'signs', n: 8 } },
    palette: { a: 0xff9a1f, b: 0xff3df2, c: 0x22e6ff },
    seed: 41,
  },
  {
    spec: spec('neon5', 'Hologram Çarşısı', loop(225, 205, [[5, 0.08, 0.6], [2, 0.05, 0]], [[1, 5, 0.5], [2, 3, 0]]), {
      boosts: [0.25, 0.7], coins: [{ u: 0.1, n: 5, d: 3 }, { u: 0.4, n: 5, d: -3 }, { u: 0.75, n: 6, d: 0 }],
    }),
    goals: { destruction: 850, challenge: { kind: 'total', n: 1500 } },
    palette: { a: 0x7a5cff, b: 0x22e6ff, c: 0xffe03a },
    seed: 53,
  },
  {
    spec: spec('neon6', 'Gökdelen Zirvesi', eight(255, 125, 16, [[2, 4, 0.8], [1, 3, 0]], -0.4), {
      boosts: [0.15, 0.4, 0.65, 0.9], coins: [{ u: 0.3, n: 8, d: 0 }, { u: 0.8, n: 8, d: 0 }],
    }),
    goals: { destruction: 900, challenge: { kind: 'shockHits', n: 4 } },
    palette: { a: 0x22e6ff, b: 0xff2e6a, c: 0xb6ff2e },
    seed: 67,
  },
]
