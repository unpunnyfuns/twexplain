import type { ClassStringLocation } from '../types'
import { detectApply } from './apply'
import { detectAttribute, detectExpression } from './markup'

const CLASS_EXPRESSION = /\bclass\s*=\s*\{/g

export function detectSvelte(
  text: string,
  offset: number,
  uri: string,
): ClassStringLocation | null {
  const expression = detectExpression(text, offset, uri, 'svelte', CLASS_EXPRESSION, '{', '}')
  if (expression !== null) return expression
  const attribute = detectAttribute(text, offset, uri, 'svelte', ['\\bclass'])
  if (attribute !== null) return attribute
  return detectApply(text, offset, uri)
}
