import type { Candidate, ClassStringLocation } from '../types'

export type TextEdit = { start: number; end: number; newText: string }

function candidateAt(location: ClassStringLocation, index: number): Candidate | null {
  return location.candidates.find((c) => c.index === index) ?? null
}

export function replaceCandidate(
  location: ClassStringLocation,
  index: number,
  newText: string,
): TextEdit | null {
  const candidate = candidateAt(location, index)
  if (candidate === null) return null
  return { start: candidate.range.start, end: candidate.range.end, newText }
}

export function removeCandidate(
  text: string,
  location: ClassStringLocation,
  index: number,
): TextEdit | null {
  const candidate = candidateAt(location, index)
  if (candidate === null) return null

  const position = location.candidates.indexOf(candidate)
  const previous = location.candidates[position - 1]
  const next = location.candidates[position + 1]

  const before =
    previous === undefined ? null : text.slice(previous.range.end, candidate.range.start)
  const after = next === undefined ? null : text.slice(candidate.range.end, next.range.start)

  if (previous !== undefined && before !== null && !before.includes('\n')) {
    return { start: previous.range.end, end: candidate.range.end, newText: '' }
  }
  if (next !== undefined && after !== null && !after.includes('\n')) {
    return { start: candidate.range.start, end: next.range.start, newText: '' }
  }
  return { start: candidate.range.start, end: candidate.range.end, newText: '' }
}

export function addCandidate(location: ClassStringLocation, text: string): TextEdit | null {
  if (location.candidates.some((c) => c.text === text)) return null

  const last = location.candidates[location.candidates.length - 1]
  if (last === undefined) {
    return { start: location.range.start, end: location.range.end, newText: text }
  }
  return { start: last.range.end, end: last.range.end, newText: ` ${text}` }
}
