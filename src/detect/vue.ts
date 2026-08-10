import type { ClassStringLocation } from '../types'
import { detectAttribute, detectStringsIn } from './markup'
import { attributesFrom, type ClassNames } from './names'

const BOUND_CLASS = /(?::class|v-bind:class)\s*=\s*(["'])((?:(?!\1).)*)\1/gs

export function detectVue(
  text: string,
  offset: number,
  uri: string,
  names?: ClassNames,
): ClassStringLocation | null {
  BOUND_CLASS.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = BOUND_CLASS.exec(text)) !== null) {
    const value = match[2] as string
    const valueStart = match.index + match[0].length - 1 - value.length
    if (offset <= valueStart || offset > valueStart + value.length) continue

    const found = detectStringsIn(text, offset, uri, 'vue', valueStart, valueStart + value.length)
    if (found !== null) return found
  }
  return detectAttribute(text, offset, uri, 'vue', attributesFrom(names))
}
