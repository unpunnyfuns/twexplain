import type { ClassStringLocation } from '../types'
import { detectAttribute } from './markup'

export function detectHtml(text: string, offset: number, uri: string): ClassStringLocation | null {
  return detectAttribute(text, offset, uri, 'html', ['\\bclass'])
}
