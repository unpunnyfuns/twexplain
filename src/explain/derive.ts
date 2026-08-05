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
    const unitlessMatch = /^(\d+(?:\.\d+)?)$/.exec(v)
    if (unitlessMatch) {
      return `${Math.round(Number.parseFloat(unitlessMatch[1]) * 100)}% opaque`
    }
    const percentMatch = /^(\d+(?:\.\d+)?)%$/.exec(v)
    if (percentMatch) {
      return `${percentMatch[1]}% opaque`
    }
    return null
  },
  'white-space': (v) => `whitespace handling: ${v}`,
}

export function isOpaque(declarations: Declaration[]): boolean {
  return declarations.some((d) => d.value.includes('--tw-'))
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
  const parts = declarations.map(phraseFor).filter((p): p is string => p !== null)
  if (parts.length === 0) return null
  return parts.join('; ')
}
