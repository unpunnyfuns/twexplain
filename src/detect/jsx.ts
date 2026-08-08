import type { ClassStringLocation } from '../types'
import { detectHelperCall } from './helpers'
import { detectAttribute, detectExpression } from './markup'

const CLASS_EXPRESSION = /\b(?:className|class)\s*=\s*\{/g

export function detectJsx(text: string, offset: number, uri: string): ClassStringLocation | null {
  const attribute = detectAttribute(text, offset, uri, 'jsx', ['className', 'class'])
  if (attribute !== null) return attribute
  const expression = detectExpression(text, offset, uri, 'jsx', CLASS_EXPRESSION, '{', '}')
  if (expression !== null) return expression
  return detectHelperCall(text, offset, uri, 'jsx')
}
