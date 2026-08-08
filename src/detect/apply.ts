import type { ClassStringLocation } from '../types'
import { locate } from './shared'

const APPLY_PATTERN = /@apply[ \t]+/g

export function detectApply(text: string, offset: number, uri: string): ClassStringLocation | null {
  APPLY_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = APPLY_PATTERN.exec(text)) !== null) {
    const valueStart = match.index + match[0].length
    let valueEnd = valueStart
    while (valueEnd < text.length && text[valueEnd] !== ';' && text[valueEnd] !== '}') valueEnd++

    const found = locate(
      text.slice(valueStart, valueEnd).trimEnd(),
      valueStart,
      offset,
      uri,
      'apply',
    )
    if (found !== null) return found
  }
  return null
}
