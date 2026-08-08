import type { Candidate, ClassStringLocation } from '../types'

export const MAX_VALUE_NEWLINES = 8

export function spansTooManyLines(value: string): boolean {
  return (value.match(/\n/g)?.length ?? 0) > MAX_VALUE_NEWLINES
}

export function splitCandidates(value: string, valueStart: number): Candidate[] {
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

export function locate(
  value: string,
  valueStart: number,
  offset: number,
  uri: string,
  kind: ClassStringLocation['kind'],
): ClassStringLocation | null {
  if (spansTooManyLines(value)) return null
  const valueEnd = valueStart + value.length
  if (offset < valueStart || offset > valueEnd) return null
  return {
    uri,
    kind,
    range: { start: valueStart, end: valueEnd },
    candidates: splitCandidates(value, valueStart),
  }
}
