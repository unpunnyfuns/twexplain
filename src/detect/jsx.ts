import type { Candidate, ClassStringLocation } from '../types'

const ATTRIBUTE_PATTERN = /\b(?:className|class)\s*=\s*(["'])((?:(?!\1).)*)\1/gs

const MAX_VALUE_NEWLINES = 8

function spansTooManyLines(value: string): boolean {
  return (value.match(/\n/g)?.length ?? 0) > MAX_VALUE_NEWLINES
}

function splitCandidates(value: string, valueStart: number): Candidate[] {
  const candidates: Candidate[] = []
  const pattern = /\S+/g
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(value)) !== null) {
    candidates.push({
      text: match[0],
      range: { start: valueStart + match.index, end: valueStart + match.index + match[0].length },
      index,
    })
    index++
  }
  return candidates
}

export function detectJsx(text: string, offset: number, uri: string): ClassStringLocation | null {
  ATTRIBUTE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE_PATTERN.exec(text)) !== null) {
    const value = match[2] as string
    if (spansTooManyLines(value)) continue
    const valueStart = match.index + match[0].length - 1 - value.length
    const valueEnd = valueStart + value.length
    if (offset < valueStart || offset > valueEnd) continue
    return {
      uri,
      kind: 'jsx',
      range: { start: valueStart, end: valueEnd },
      candidates: splitCandidates(value, valueStart),
    }
  }
  return null
}
