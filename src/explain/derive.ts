import type { Declaration } from '../types'

type Phrase = string | ((value: string) => string | null)

const EXACT: Record<string, Record<string, string>> = {
  display: {
    flex: 'lays children out in a row',
    grid: 'lays children out on a grid',
    block: 'takes the full width available',
    'inline-flex': 'lays children out in a row, sitting inline',
    none: 'hidden entirely',
  },
  position: {
    absolute: 'positioned against its nearest positioned ancestor',
    relative: 'positioned normally, but anchors absolute children',
    fixed: 'pinned to the viewport',
    sticky: 'sticks in place when scrolled past',
  },
  overflow: {
    hidden: 'clips anything overflowing',
    auto: 'scrolls when content overflows',
  },
  animation: { none: 'no animation' },
  filter: { none: 'no filters applied' },
  'backdrop-filter': { none: 'no backdrop filters applied' },
  transform: { none: 'no transform applied' },
}

const PHRASES: Record<string, Phrase> = {
  'align-items': (v) => `children centered on the cross axis (${v})`,
  'justify-content': (v) => `children distributed along the main axis (${v})`,
  gap: (v) => `${v} between children`,
  padding: (v) => `padding of ${v} on all sides`,
  'padding-inline': (v) => `padding of ${v} on the left and right`,
  'padding-block': (v) => `padding of ${v} on the top and bottom`,
  margin: (v) => `margin of ${v} on all sides`,
  'border-radius': (v) => `corners rounded by ${v}`,
  'border-width': (v) => `${v} border`,
  'background-color': (v) => `background ${v}`,
  color: (v) => `text ${v}`,
  'font-size': (v) => `text size ${v}`,
  'line-height': (v) => `line height ${v}`,
  'font-weight': (v) => `font weight ${v}`,
  width: (v) => `width ${v}`,
  height: (v) => `height ${v}`,
  opacity: (v) => {
    const unitlessMatch = /^(\.?\d+(?:\.\d+)?)$/.exec(v)
    if (unitlessMatch) {
      const num = Number.parseFloat(unitlessMatch[1] as string)
      if (num >= 0 && num <= 1) {
        return `${Math.round(num * 100)}% opaque`
      }
      return null
    }
    const percentMatch = /^(\.?\d+(?:\.\d+)?)%$/.exec(v)
    if (percentMatch) {
      const num = Number.parseFloat(percentMatch[1] as string)
      if (num >= 0 && num <= 100) {
        return `${percentMatch[1]}% opaque`
      }
      return null
    }
    return null
  },
  'white-space': (v) => `whitespace handling: ${v}`,
  animation: (v) => `runs the animation ${v}`,
  clip: (v) => `clipped to ${v}`,
  'max-width': (v) => `never wider than ${v}`,
  'max-height': (v) => `never taller than ${v}`,
  'min-width': (v) => `never narrower than ${v}`,
  'min-height': (v) => `never shorter than ${v}`,
}

export function isOpaque(declarations: Declaration[]): boolean {
  return declarations.some((d) => d.value.includes('--tw-'))
}

export function isConditional(declarations: Declaration[]): boolean {
  return declarations.some((d) => d.context !== undefined)
}

function phraseFor(declaration: Declaration): string | null {
  const exact = EXACT[declaration.prop]?.[declaration.value]
  if (exact !== undefined) return exact
  const phrase = PHRASES[declaration.prop]
  if (phrase === undefined) return null
  if (typeof phrase === 'string') return phrase
  const result = phrase(declaration.value)
  return result
}

export function derive(declarations: Declaration[]): string | null {
  if (isOpaque(declarations)) return null
  if (declarations.length === 0) return null
  const parts = declarations.map(phraseFor)
  if (parts.some((p) => p === null)) return null
  return parts.join('; ')
}
