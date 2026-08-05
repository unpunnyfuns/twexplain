import type { Candidate, ClassStringLocation } from '../types'

const ATTRIBUTE_PATTERN = /\b(?:className|class)\s*=\s*(["'])((?:(?!\1).)*)\1/gs
const EXPRESSION_PATTERN = /\b(?:className|class)\s*=\s*\{/g
const STRING_PATTERN = /(["'])((?:(?!\1).)*)\1/gs

const MAX_VALUE_NEWLINES = 8
const MAX_EXPRESSION_LENGTH = 2000

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

function locate(
  value: string,
  valueStart: number,
  offset: number,
  uri: string,
): ClassStringLocation | null {
  if (spansTooManyLines(value)) return null
  const valueEnd = valueStart + value.length
  if (offset < valueStart || offset > valueEnd) return null
  return {
    uri,
    kind: 'jsx',
    range: { start: valueStart, end: valueEnd },
    candidates: splitCandidates(value, valueStart),
  }
}

function findExpressionEnd(text: string, openBrace: number): number {
  const limit = Math.min(text.length, openBrace + MAX_EXPRESSION_LENGTH)
  let depth = 1
  let quote: string | null = null

  for (let i = openBrace + 1; i < limit; i++) {
    const char = text[i] as string
    if (quote !== null) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function detectInAttribute(text: string, offset: number, uri: string): ClassStringLocation | null {
  ATTRIBUTE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE_PATTERN.exec(text)) !== null) {
    const value = match[2] as string
    const valueStart = match.index + match[0].length - 1 - value.length
    const found = locate(value, valueStart, offset, uri)
    if (found !== null) return found
  }
  return null
}

function detectInExpression(text: string, offset: number, uri: string): ClassStringLocation | null {
  EXPRESSION_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = EXPRESSION_PATTERN.exec(text)) !== null) {
    const openBrace = match.index + match[0].length - 1
    const end = findExpressionEnd(text, openBrace)
    if (end === -1 || offset <= openBrace || offset > end) continue

    const body = text.slice(openBrace + 1, end)
    STRING_PATTERN.lastIndex = 0
    let literal: RegExpExecArray | null
    while ((literal = STRING_PATTERN.exec(body)) !== null) {
      const value = literal[2] as string
      const valueStart = openBrace + 1 + literal.index + 1
      const found = locate(value, valueStart, offset, uri)
      if (found !== null) return found
    }
  }
  return null
}

export function detectJsx(text: string, offset: number, uri: string): ClassStringLocation | null {
  return detectInAttribute(text, offset, uri) ?? detectInExpression(text, offset, uri)
}
