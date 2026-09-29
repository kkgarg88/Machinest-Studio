import 'server-only'
import { CycleResult } from './common'
import { millingG81 } from './milling-g81'
import { millingPeck } from './milling-peck'
import { millingEllipse } from './milling-ellipse'
import { buildPeckIntroSvg } from './peck-svg'

type Logic = (v: Record<string, unknown>) => CycleResult
type Intro = () => string

const registry: Record<string, Logic> = {
  'milling-studio:G81': millingG81,
  'milling-studio:G83/G73': millingPeck,
  'milling-studio:ELLIPSE': millingEllipse,
}

// page khulte hi dikhne wala example / animation (optional, har cycle ke liye)
const intros: Record<string, Intro> = {
  'milling-studio:G83/G73': buildPeckIntroSvg,
}

export function getCycleLogic(key: string): Logic | undefined {
  return registry[key]
}

export function getCycleIntro(key: string): Intro | undefined {
  return intros[key]
}