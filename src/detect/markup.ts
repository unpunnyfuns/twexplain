import type { ClassStringLocation } from '../types'
import { locate } from './shared'

const MAX_EXPRESSION_LENGTH = 2000
const STRING_PATTERN = /(["'])((?:(?!\1).)*)\1/gs

function attributePattern(names: string[]): RegExp {
  return new RegExp(`(?:${names.join('|')})\\s*=\\s*(["'])((?:(?!\\1).)*)\\1`, 'gs')
}

export function detectAttribute(
  text: string,
  offset: number,
  uri: string,
  kind: ClassStringLocation['kind'],
  names: string[],
): ClassStringLocation | null {
  const pattern = attributePattern(names)
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const value = match[2] as string
    const valueStart = match.index + match[0].length - 1 - value.length
    const found = locate(value, valueStart, offset, uri, kind)
    if (found !== null) return found
  }
  return null
}

function findClosing(text: string, open: number, openChar: string, closeChar: string): number {
  const limit = Math.min(text.length, open + MAX_EXPRESSION_LENGTH)
  let depth = 1
  let quote: string | null = null

  for (let i = open + 1; i < limit; i++) {
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
    if (char === openChar) depth++
    else if (char === closeChar) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

export function detectStringsIn(
  text: string,
  offset: number,
  uri: string,
  kind: ClassStringLocation['kind'],
  spanStart: number,
  spanEnd: number,
): ClassStringLocation | null {
  const body = text.slice(spanStart, spanEnd)
  STRING_PATTERN.lastIndex = 0
  let literal: RegExpExecArray | null
  while ((literal = STRING_PATTERN.exec(body)) !== null) {
    const value = literal[2] as string
    const valueStart = spanStart + literal.index + 1
    const found = locate(value, valueStart, offset, uri, kind)
    if (found !== null) return found
  }
  return null
}

export function detectExpression(
  text: string,
  offset: number,
  uri: string,
  kind: ClassStringLocation['kind'],
  pattern: RegExp,
  openChar: string,
  closeChar: string,
): ClassStringLocation | null {
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const open = match.index + match[0].length - 1
    const end = findClosing(text, open, openChar, closeChar)
    if (end === -1 || offset <= open || offset > end) continue

    const found = detectStringsIn(text, offset, uri, kind, open + 1, end)
    if (found !== null) return found
  }
  return null
}
