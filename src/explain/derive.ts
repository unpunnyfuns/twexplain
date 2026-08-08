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
    static: 'positioned normally, and ignores top, left, right and bottom',
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
  'text-align': {
    left: 'text aligned left',
    right: 'text aligned right',
    center: 'text centred',
    justify: 'text justified to both edges',
    start: 'text aligned to the start of the writing direction',
    end: 'text aligned to the end of the writing direction',
  },
  'text-transform': {
    uppercase: 'text in capitals',
    lowercase: 'text in lower case',
    capitalize: 'each word capitalised',
    none: 'text left as written',
  },
  'text-decoration-line': {
    underline: 'underlined',
    'line-through': 'struck through',
    overline: 'overlined',
    none: 'no underline or strikethrough',
  },
  'text-wrap': {
    nowrap: 'never wraps onto another line',
    wrap: 'wraps normally',
    balance: 'wrapped so the lines come out even',
    pretty: 'wrapped to avoid a short last line',
  },
  'font-style': { italic: 'italic', normal: 'upright rather than italic' },
  'flex-direction': {
    row: 'children laid out left to right',
    'row-reverse': 'children laid out right to left',
    column: 'children stacked top to bottom',
    'column-reverse': 'children stacked bottom to top',
  },
  'flex-wrap': {
    wrap: 'children wrap onto more lines when they run out of room',
    nowrap: 'children stay on one line even if they overflow',
    'wrap-reverse': 'children wrap onto more lines, in reverse order',
  },
  'flex-grow': { '1': 'grows to take the free space', '0': 'does not grow' },
  'flex-shrink': {
    '0': 'never shrinks below its natural size',
    '1': 'shrinks when space is tight',
  },
  visibility: {
    hidden: 'invisible, but still taking up space',
    visible: 'visible',
    collapse: 'collapsed away, as a table row or column',
  },
  'pointer-events': {
    none: 'ignores mouse and touch entirely',
    auto: 'receives mouse and touch again',
  },
  'user-select': {
    none: 'cannot be selected as text',
    text: 'selectable as text',
    all: 'selected all at once',
    auto: 'selectable as normal',
  },
  '-webkit-user-select': {
    none: 'cannot be selected as text',
    text: 'selectable as text',
    all: 'selected all at once',
    auto: 'selectable as normal',
  },
  appearance: { none: 'stripped of the browser default control styling' },
  resize: {
    none: 'cannot be resized by dragging',
    both: 'resizable by dragging',
    vertical: 'resizable vertically by dragging',
    horizontal: 'resizable horizontally by dragging',
  },
  'outline-style': { none: 'no outline' },
  'border-style': {
    solid: 'solid border line',
    dashed: 'dashed border line',
    dotted: 'dotted border line',
    double: 'double border line',
    none: 'no border line',
    hidden: 'no border line',
  },
  'list-style-type': { none: 'no bullet or number', disc: 'bulleted', decimal: 'numbered' },
  'object-fit': {
    cover: 'fills the box, cropping what does not fit',
    contain: 'fits inside the box, whole',
    fill: 'stretched to fill the box',
    none: 'kept at its natural size',
    'scale-down': 'shrunk to fit, but never enlarged',
  },
  'overflow-x': {
    hidden: 'clips anything overflowing sideways',
    auto: 'scrolls sideways when content overflows',
    scroll: 'always shows a horizontal scrollbar',
    visible: 'lets content spill out sideways',
  },
  'overflow-y': {
    hidden: 'clips anything overflowing vertically',
    auto: 'scrolls vertically when content overflows',
    scroll: 'always shows a vertical scrollbar',
    visible: 'lets content spill out vertically',
  },
  float: { left: 'floated to the left', right: 'floated to the right', none: 'not floated' },
  clear: {
    both: 'sits below any floated element',
    left: 'sits below any left-floated element',
    right: 'sits below any right-floated element',
    none: 'allowed beside floated elements',
  },
  'vertical-align': {
    middle: 'aligned to the middle of the line',
    top: 'aligned to the top of the line',
    bottom: 'aligned to the bottom of the line',
    baseline: 'sitting on the text baseline',
  },
  'aspect-ratio': { '1 / 1': 'kept square', auto: 'no fixed aspect ratio' },
  'margin-inline': {
    auto: 'equal automatic margins left and right, which centres an element that has a width',
  },
  'margin-left': { auto: 'an automatic left margin, which pushes a sized element to the right' },
  'margin-right': { auto: 'an automatic right margin, which pushes a sized element to the left' },
  flex: {
    '1': 'grows and shrinks to share the free space',
    auto: 'grows and shrinks from its natural size',
    initial: 'shrinks but does not grow',
    none: 'neither grows nor shrinks',
  },
  filter: { none: 'no filters applied' },
  'backdrop-filter': { none: 'no backdrop filters applied' },
  '-webkit-backdrop-filter': { none: 'no backdrop filters applied' },
  'transition-property': { none: 'no transition' },
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
  'margin-top': (v) => `margin of ${v} on the top`,
  'margin-bottom': (v) => `margin of ${v} on the bottom`,
  'margin-left': (v) => `margin of ${v} on the left`,
  'margin-right': (v) => `margin of ${v} on the right`,
  'margin-inline': (v) => `margin of ${v} on the left and right`,
  'margin-block': (v) => `margin of ${v} on the top and bottom`,
  'padding-top': (v) => `padding of ${v} on the top`,
  'padding-bottom': (v) => `padding of ${v} on the bottom`,
  'padding-left': (v) => `padding of ${v} on the left`,
  'padding-right': (v) => `padding of ${v} on the right`,
  'column-gap': (v) => `${v} between columns`,
  'row-gap': (v) => `${v} between rows`,
  'letter-spacing': (v) => `letter spacing ${v}`,
  'font-family': (v) => {
    const first = (v.split(',')[0] ?? v).trim().replace(/^["']|["']$/g, '')
    return first === '' ? null : `the ${first} font stack`
  },
  'z-index': (v) => `stacking order ${v}`,
  top: (v) => `${v} from the top`,
  bottom: (v) => `${v} from the bottom`,
  left: (v) => `${v} from the left`,
  right: (v) => `${v} from the right`,
  inset: (v) => `${v} from every edge`,
  'flex-basis': (v) => `starting size ${v}`,
  'border-top-left-radius': (v) => `top-left corner rounded by ${v}`,
  'border-top-right-radius': (v) => `top-right corner rounded by ${v}`,
  'border-bottom-left-radius': (v) => `bottom-left corner rounded by ${v}`,
  'border-bottom-right-radius': (v) => `bottom-right corner rounded by ${v}`,
  'border-color': (v) => `border ${v}`,
  'outline-color': (v) => `outline ${v}`,
  cursor: (v) => `${v} cursor`,
  rotate: (v) => `rotated ${v}`,
  'aspect-ratio': (v) => `aspect ratio ${v}`,
  'transition-duration': (v) => `transitions over ${v}`,
  'transition-delay': (v) => `transitions after a ${v} delay`,
  'transition-timing-function': (v) => `eased with ${v}`,
  'align-self': (v) => `this item aligned ${v} on the cross axis`,
  'align-content': (v) => `rows distributed ${v}`,
  'justify-items': (v) => `children aligned ${v} within their grid cells`,
  'place-items': (v) => `children aligned ${v} both ways`,
  'grid-template-columns': (v) => {
    const repeated = /^repeat\((\d+), minmax\(0, 1fr\)\)$/.exec(v)
    return repeated === null ? `grid columns: ${v}` : `${repeated[1]} equal columns`
  },
  'grid-template-rows': (v) => {
    const repeated = /^repeat\((\d+), minmax\(0, 1fr\)\)$/.exec(v)
    return repeated === null ? `grid rows: ${v}` : `${repeated[1]} equal rows`
  },
  'grid-column': (v) => {
    const span = /^span (\d+) \/ span \1$/.exec(v)
    return span === null ? `grid column: ${v}` : `spans ${span[1]} columns`
  },
  'grid-row': (v) => {
    const span = /^span (\d+) \/ span \1$/.exec(v)
    return span === null ? `grid row: ${v}` : `spans ${span[1]} rows`
  },
}

export function isOpaque(declarations: Declaration[]): boolean {
  return declarations.some((d) => d.value.includes('--tw-'))
}

export function isConditional(declarations: Declaration[]): boolean {
  return declarations.some((d) => d.context !== undefined || d.selector !== undefined)
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
  return [...new Set(parts as string[])].join('; ')
}
