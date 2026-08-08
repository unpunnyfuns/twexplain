const HEX = /[0-9a-fA-F]/
const WHITESPACE = /\s/

type ClassToken = { name: string; start: number; end: number }

function isIdentChar(char: string): boolean {
  if (/[-\w]/.test(char)) return true
  return (char.codePointAt(0) ?? 0) >= 0xa0
}

function readEscape(selector: string, at: number): { text: string; next: number } {
  let cursor = at + 1
  let hex = ''
  while (cursor < selector.length && hex.length < 6 && HEX.test(selector[cursor] as string)) {
    hex += selector[cursor] as string
    cursor++
  }
  if (hex !== '') {
    if (cursor < selector.length && WHITESPACE.test(selector[cursor] as string)) cursor++
    return { text: String.fromCodePoint(Number.parseInt(hex, 16)), next: cursor }
  }
  if (cursor >= selector.length) return { text: '', next: cursor }
  return { text: selector[cursor] as string, next: cursor + 1 }
}

function skipString(selector: string, at: number): number {
  const quote = selector[at]
  let cursor = at + 1
  while (cursor < selector.length) {
    if (selector[cursor] === '\\') {
      cursor += 2
      continue
    }
    if (selector[cursor] === quote) return cursor + 1
    cursor++
  }
  return cursor
}

function readClass(selector: string, start: number): ClassToken | null {
  let cursor = start + 1
  let name = ''
  while (cursor < selector.length) {
    const char = selector[cursor] as string
    if (char === '\\') {
      const escape = readEscape(selector, cursor)
      name += escape.text
      cursor = escape.next
      continue
    }
    if (!isIdentChar(char)) break
    name += char
    cursor++
  }
  return name === '' ? null : { name, start, end: cursor }
}

function classTokens(selector: string): ClassToken[] {
  const found: ClassToken[] = []
  let cursor = 0
  while (cursor < selector.length) {
    const char = selector[cursor] as string
    if (char === '\\') {
      cursor = readEscape(selector, cursor).next
      continue
    }
    if (char === '"' || char === "'") {
      cursor = skipString(selector, cursor)
      continue
    }
    if (char === '.') {
      const token = readClass(selector, cursor)
      if (token !== null) {
        found.push(token)
        cursor = token.end
        continue
      }
    }
    cursor++
  }
  return found
}

export function selectorContext(selector: string, candidate: string): string | null {
  const matches = classTokens(selector).filter((token) => token.name === candidate)
  if (matches.length === 0) return null

  let out = ''
  let cursor = 0
  for (const token of matches) {
    out += `${selector.slice(cursor, token.start)}&`
    cursor = token.end
  }
  out += selector.slice(cursor)

  const trimmed = out.trim()
  return trimmed === '&' ? null : trimmed
}

export function resolveNesting(outer: string | null, inner: string | null): string | null {
  if (inner === null) return outer
  if (outer === null) return inner
  return inner.replace(/&/g, () => outer)
}
