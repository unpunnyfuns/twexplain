import type { ClassStringLocation } from '../types'
import { locate } from './shared'

const INTERPOLATION = /\$\{[^}]*\}/g

function attributePattern(names: string[]): RegExp {
  const guarded = names.map((name) => `(?<![-:\\w])${name}`)
  return new RegExp(`(?:${guarded.join('|')})\\s*=\\s*(["'])((?:(?!\\1).)*)\\1`, 'gs')
}

export function blankBraces(value: string): string {
  const characters = [...value]
  let depth = 0

  for (let index = 0; index < characters.length; index++) {
    const char = characters[index] as string
    if (char === '{') {
      depth++
      characters[index] = ' '
      continue
    }
    if (char === '}') {
      if (depth > 0) {
        depth--
        characters[index] = ' '
      }
      continue
    }
    if (depth > 0) characters[index] = ' '
  }

  return characters.join('')
}

export function detectAttribute(
  text: string,
  offset: number,
  uri: string,
  kind: ClassStringLocation['kind'],
  names: string[],
  expressions = false,
): ClassStringLocation | null {
  const pattern = attributePattern(names)
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const raw = match[2] as string
    const valueStart = match.index + match[0].length - 1 - raw.length
    const value = expressions ? blankBraces(raw) : raw

    const cursor = offset - valueStart
    if (expressions && cursor >= 0 && cursor < raw.length && raw[cursor] !== value[cursor]) {
      return null
    }

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

type StringLiteral = { quote: string; valueStart: number; raw: string }

function scanStrings(text: string, from: number, to: number): StringLiteral[] {
  const found: StringLiteral[] = []
  let index = from

  while (index < to) {
    const char = text[index] as string
    if (char !== '"' && char !== "'" && char !== '`') {
      index++
      continue
    }

    const valueStart = index + 1
    let cursor = valueStart
    while (cursor < to) {
      const inner = text[cursor] as string
      if (inner === '\\') {
        cursor += 2
        continue
      }
      if (inner === char) break
      cursor++
    }
    if (cursor >= to) break

    found.push({ quote: char, valueStart, raw: text.slice(valueStart, cursor) })
    index = cursor + 1
  }

  return found
}

export function detectStringsIn(
  text: string,
  offset: number,
  uri: string,
  kind: ClassStringLocation['kind'],
  spanStart: number,
  spanEnd: number,
): ClassStringLocation | null {
  for (const literal of scanStrings(text, spanStart, spanEnd)) {
    const value = literal.quote === '`' ? blankInterpolations(literal.raw) : literal.raw
    if (literal.quote === '`' && insideInterpolation(literal.raw, offset - literal.valueStart)) {
      return null
    }
    const found = locate(value, literal.valueStart, offset, uri, kind)
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
