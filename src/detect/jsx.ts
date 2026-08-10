import type { ClassStringLocation } from '../types'
import { detectHelperCall } from './helpers'
import { attributesFrom, type ClassNames } from './names'
import { detectAttribute, detectExpression } from './markup'

const CLASS_EXPRESSION = /\b(?:className|class)\s*=\s*\{/g

export function detectJsx(
  text: string,
  offset: number,
  uri: string,
  names?: ClassNames,
): ClassStringLocation | null {
  const attribute = detectAttribute(text, offset, uri, 'jsx', attributesFrom(names))
  if (attribute !== null) return attribute
  const expression = detectExpression(text, offset, uri, 'jsx', CLASS_EXPRESSION, '{', '}')
  if (expression !== null) return expression
  return detectHelperCall(text, offset, uri, 'jsx', names)
}
