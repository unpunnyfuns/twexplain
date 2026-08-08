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
  container: 'full width, but never wider than the current breakpoint',
  from: 'the colour a gradient starts from',
  via: 'the colour a gradient passes through',
  to: 'the colour a gradient ends at',
  divide: 'the colour of the dividing lines between children',
  'ring-inset': 'draws the ring inside the edge rather than outside it',
  'space-x-reverse': 'reverses which side the horizontal gap is added to',
  'space-y-reverse': 'reverses which side the vertical gap is added to',
  'translate-none': 'no translation applied',
}

type Composite = string | ((declarations: Declaration[], parsed: ParsedCandidate) => string)

function borderOn(where: string): (declarations: Declaration[]) => string {
  return (declarations) => {
    const width = declarations.find((d) => d.prop.endsWith('-width'))?.value
    return width === undefined ? `a border on ${where}` : `${width} border on ${where}`
  }
}

const COMPOSITE: Record<string, Composite> = {
  shadow: 'drop shadow',
  'inset-shadow': 'inner drop shadow',
  border: borderOn('all sides'),
  'border-t': borderOn('the top'),
  'border-b': borderOn('the bottom'),
  'border-l': borderOn('the left'),
  'border-r': borderOn('the right'),
  'border-x': borderOn('the left and right'),
  'border-y': borderOn('the top and bottom'),
  'divide-x': 'vertical dividing lines between children, except the last',
  'divide-y': 'horizontal dividing lines between children, except the last',
  ring: 'outline ring drawn outside the border',
  'space-x': 'horizontal gap between children, except the last',
  'space-y': 'vertical gap between children, except the last',
  transform: 'applies a geometric transform',
  filter: 'applies a visual filter',
  'backdrop-filter': 'applies a filter to what is behind the element',
  blur: 'blurred',
  'backdrop-blur': 'blurs what is behind the element',
  transition: 'animates changes to most properties',
  scale: (_, parsed) => {
    const value = parsed.value?.value
    return value !== undefined && /^\d+(?:\.\d+)?$/.test(value) ? `scaled to ${value}%` : 'scaled'
  },
  'translate-x': 'moved horizontally',
  'translate-y': 'moved vertically',
  translate: 'moved',
}

const NEGATED: Record<string, string> = {
  shadow: 'no drop shadow',
  'inset-shadow': 'no inner drop shadow',
  ring: 'no ring',
  'inset-ring': 'no inner ring',
  border: 'no border',
  'border-t': 'no border on the top',
  'border-b': 'no border on the bottom',
  'border-l': 'no border on the left',
  'border-r': 'no border on the right',
  'border-x': 'no border on the left or right',
  'border-y': 'no border on the top or bottom',
  filter: 'no filters applied',
  'backdrop-filter': 'no backdrop filters applied',
  transform: 'no transform applied',
  blur: 'no blur',
  'backdrop-blur': 'no blur behind the element',
  transition: 'no transition',
  scale: 'scaled to nothing',
  'translate-x': 'not moved horizontally',
  'translate-y': 'not moved vertically',
  translate: 'not moved',
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
  if (value !== undefined && negatesEffect(value)) return NEGATED[parsed.root] ?? null

  return typeof composite === 'string' ? composite : composite(declarations, parsed)
}
