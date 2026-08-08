import type { ClassStringLocation } from '../types'
import { locate } from './shared'

const STRING_PATTERN = /(["'`])((?:(?!\1).)*)\1/gs
const INTERPOLATION = /\$\{[^}]*\}/g

function attributePattern(names: string[]): RegExp {
  const guarded = names.map((name) => `(?<![-:\\w])${name}`)
  return new RegExp(`(?:${guarded.join('|')})\\s*=\\s*(["'])((?:(?!\\1).)*)\\1`, 'gs')
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

function blankInterpolations(value: string): string {
  return value.replace(INTERPOLATION, (match) => ' '.repeat(match.length))
}

function insideInterpolation(value: string, offset: number): boolean {
  INTERPOLATION.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = INTERPOLATION.exec(value)) !== null) {
    if (offset > match.index && offset < match.index + match[0].length) return true
  }
  return false
}

function findClosing(text: string, open: number, openChar: string, closeChar: string): number {
  let depth = 1
  let quote: string | null = null

  for (let i = open + 1; i < text.length; i++) {
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
    const raw = literal[2] as string
    const valueStart = spanStart + literal.index + 1
    const value = literal[1] === '`' ? blankInterpolations(raw) : raw
    if (literal[1] === '`' && insideInterpolation(raw, offset - valueStart)) return null
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
    if (offset <= open) continue
    const end = findClosing(text, open, openChar, closeChar)
    if (end === -1 || offset > end) continue

    const found = detectStringsIn(text, offset, uri, kind, open + 1, end)
    if (found !== null) return found
  }
  return null
}
