import type { ClassStringLocation } from '../types'
import { detectAttribute } from './markup'
import { attributesFrom, type ClassNames } from './names'

export function detectHtml(
  text: string,
  offset: number,
  uri: string,
  names?: ClassNames,
): ClassStringLocation | null {
  return detectAttribute(text, offset, uri, 'html', attributesFrom(names))
}
