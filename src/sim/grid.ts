/**
 * The starting grid. The player starts in front, centred; ghost slots fan out behind so the
 * start reads as a race instead of five cars stacked in one place.
 */
export interface GridSlot {
  readonly s: number
  readonly d: number
}

export const PLAYER_SLOT: GridSlot = { s: 26, d: 0 }

export const GHOST_SLOTS: readonly GridSlot[] = [
  { s: 22, d: -4.4 },
  { s: 22, d: 4.4 },
  { s: 13, d: -2.2 },
  { s: 13, d: 2.2 },
  { s: 4, d: 0 },
]

export const ghostSlot = (i: number): GridSlot => GHOST_SLOTS[((i % GHOST_SLOTS.length) + GHOST_SLOTS.length) % GHOST_SLOTS.length]
