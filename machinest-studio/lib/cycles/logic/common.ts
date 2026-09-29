import 'server-only'

export type CycleResult =
  | { ok: true; gcode: string; svg: string; programName: string }
  | { ok: false; error: string }

export const fail = (error: string): CycleResult => ({ ok: false, error })

// sirf plain number: 12, -5.5, .5, 3.  (1e1, 0x10, Infinity sab reject)
const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

export function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return NaN
  const s = v.trim()
  if (!NUMERIC.test(s)) return NaN
  return Number(s)
}