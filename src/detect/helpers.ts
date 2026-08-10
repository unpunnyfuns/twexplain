import type { ClassStringLocation } from '../types'
import { detectStringsIn } from './markup'
import { type ClassNames, functionsFrom } from './names'

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findCallEnd(text: string, open: number): number {
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
    if (char === '(') depth++
    else if (char === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

export function detectHelperCall(
  text: string,
  offset: number,
  uri: string,
  kind: ClassStringLocation['kind'],
  names?: ClassNames,
): ClassStringLocation | null {
  const HELPER_CALL = new RegExp(
    `\\b(?:${functionsFrom(names).map(escapeName).join('|')})\\s*\\(`,
    'g',
  )
  let match: RegExpExecArray | null
  while ((match = HELPER_CALL.exec(text)) !== null) {
    const open = match.index + match[0].length - 1
    if (offset <= open) continue
    const end = findCallEnd(text, open)
    if (end === -1 || offset > end) continue

    const found = detectStringsIn(text, offset, uri, kind, open + 1, end)
    if (found !== null) return found
  }
  return null
}
