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

function whitespaceBefore(text: string, from: number, floor: number): number {
  let index = from
  while (index > floor && /\s/.test(text[index - 1] as string)) index--
  return index
}

function whitespaceAfter(text: string, from: number, ceiling: number): number {
  let index = from
  while (index < ceiling && /\s/.test(text[index] as string)) index++
  return index
}

export function removeCandidate(
  text: string,
  location: ClassStringLocation,
  index: number,
): TextEdit | null {
  const candidate = candidateAt(location, index)
  if (candidate === null) return null

  const { start, end } = candidate.range
  const first = location.candidates[0] === candidate
  const beforeStart = whitespaceBefore(text, start, location.range.start)
  const afterEnd = whitespaceAfter(text, end, location.range.end)
  const before = text.slice(beforeStart, start)

  if (!first && before !== '' && !before.includes('\n')) {
    return { start: beforeStart, end, newText: '' }
  }
  if (afterEnd > end) return { start, end: afterEnd, newText: '' }

  let trimmed = start
  while (trimmed > location.range.start && /[ \t]/.test(text[trimmed - 1] as string)) trimmed--
  return { start: trimmed, end, newText: '' }
}

export function addCandidate(location: ClassStringLocation, text: string): TextEdit | null {
  if (location.candidates.some((c) => c.text === text)) return null

  const last = location.candidates[location.candidates.length - 1]
  if (last === undefined) {
    return { start: location.range.start, end: location.range.end, newText: text }
  }
  return { start: last.range.end, end: last.range.end, newText: ` ${text}` }
}
