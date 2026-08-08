import type { ClassStringLocation } from '../types'
import { detectAttribute, detectExpression } from './markup'

const CLASS_EXPRESSION = /\b(?:className|class)\s*=\s*\{/g

export function detectJsx(text: string, offset: number, uri: string): ClassStringLocation | null {
  const attribute = detectAttribute(text, offset, uri, 'jsx', ['\\bclassName', '\\bclass'])
  if (attribute !== null) return attribute
  return detectExpression(text, offset, uri, 'jsx', CLASS_EXPRESSION, '{', '}')
}
