import type { Declaration } from '../types'
import { isOpaque } from './derive'

/*
 * Two kinds of curated prose, with different validity conditions.
 *
 * EMERGENT utilities are single exact utility names whose declarations are
 * individually readable but whose combined purpose is not. Their prose is a
 * statement about the whole recipe, so it holds unconditionally.
 *
 * COMPOSITE utilities compile to `--tw-*` machinery rather than meaning. Their
 * prose stands in for CSS that cannot be read mechanically, so it only holds
 * when the class's real declarations are that machinery, and only when the
 * value the class was written with does not switch the effect off. `strip`
 * removes the one declaration that separates `shadow-lg` from `shadow-none`,
 * so the negation has to be read off the candidate value.
 */

const EMERGENT: Record<string, string> = {
  'sr-only': 'visually hidden, but still announced by screen readers',
  'not-sr-only': 'undoes sr-only, making the element visible again',
  truncate: 'one line, cut off with an ellipsis',
  antialiased: 'smoother font rendering',
  isolate: 'creates a new stacking context',
}

const COMPOSITE: Record<string, string> = {
  shadow: 'drop shadow',
  'inset-shadow': 'inner drop shadow',
  ring: 'outline ring drawn outside the border',
  'space-x': 'horizontal gap between children, except the last',
  'space-y': 'vertical gap between children, except the last',
  divide: 'dividing lines drawn between children',
  animate: 'runs a named animation',
  transform: 'applies a geometric transform',
  filter: 'applies a visual filter',
  'backdrop-filter': 'applies a filter to what is behind the element',
}

const ZERO = /^(-?[\d.]+)(px|rem|em|%|)$/

export type ParsedCandidate = {
  root: string
  value?: { value: string } | null
}

function negatesEffect(value: string): boolean {
  if (value === 'none') return true
  const match = ZERO.exec(value)
  return match !== null && Number.parseFloat(match[1] as string) === 0
}

export function overrideFor(parsed: ParsedCandidate, declarations: Declaration[]): string | null {
  const emergent = EMERGENT[parsed.root]
  if (emergent !== undefined) return emergent

  const composite = COMPOSITE[parsed.root]
  if (composite === undefined) return null
  if (!isOpaque(declarations)) return null

  const value = parsed.value?.value
  if (value !== undefined && negatesEffect(value)) return null

  return composite
}
