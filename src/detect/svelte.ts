import type { ClassStringLocation } from '../types'
import { detectApply } from './apply'
import { detectAttribute, detectExpression } from './markup'
import { attributesFrom, type ClassNames } from './names'
import { locate } from './shared'

const CLASS_EXPRESSION = /\bclass\s*=\s*\{/g
const CLASS_DIRECTIVE = /(?<=[\s{])class:([^\s=>/"'`{}]+)/g

export function detectSvelte(
  text: string,
  offset: number,
  uri: string,
  names?: ClassNames,
): ClassStringLocation | null {
  const expression = detectExpression(text, offset, uri, 'svelte', CLASS_EXPRESSION, '{', '}')
  if (expression !== null) return expression
  const attribute = detectAttribute(text, offset, uri, 'svelte', attributesFrom(names))
  if (attribute !== null) return attribute

  CLASS_DIRECTIVE.lastIndex = 0
  let directive: RegExpExecArray | null
  while ((directive = CLASS_DIRECTIVE.exec(text)) !== null) {
    const name = directive[1] as string
    const nameStart = directive.index + directive[0].length - name.length
    const found = locate(name, nameStart, offset, uri, 'svelte')
    if (found !== null) return found
  }

  return detectApply(text, offset, uri)
}
