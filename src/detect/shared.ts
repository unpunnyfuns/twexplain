import type { Candidate, ClassStringLocation } from '../types'

export const MAX_VALUE_LENGTH = 5000

const PUNCTUATION_ONLY = /^[^\p{L}\p{N}]+$/u

export function looksLikeClassList(value: string): boolean {
  if (value.length > MAX_VALUE_LENGTH) return false
  if (/<[a-zA-Z/]/.test(value)) return false
  return !value.split(/\s+/).some((token) => token !== '' && PUNCTUATION_ONLY.test(token))
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
  if (!looksLikeClassList(value)) return null
  const valueEnd = valueStart + value.length
  if (offset < valueStart || offset > valueEnd) return null
  return {
    uri,
    kind,
    range: { start: valueStart, end: valueEnd },
    candidates: splitCandidates(value, valueStart),
  }
}
