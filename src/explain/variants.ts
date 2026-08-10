import type { Declaration } from '../types'
import { remToPx } from './flatten'

const SELECTOR_VARIANTS: Record<string, string> = {
  hover: 'while hovered',
  focus: 'while focused',
  'focus-visible': 'while focused from the keyboard',
  'focus-within': 'while it or something inside it is focused',
  active: 'while pressed',
  visited: 'once visited',
  target: 'when it is the link target',
  disabled: 'when disabled',
  enabled: 'when enabled',
  checked: 'when checked',
  indeterminate: 'when neither checked nor unchecked',
  required: 'when required',
  invalid: 'when its value is invalid',
  'read-only': 'when read only',
  first: 'on the first child',
  last: 'on the last child',
  only: 'when it is the only child',
  odd: 'on odd-numbered children',
  even: 'on even-numbered children',
  empty: 'when it has no content',
  placeholder: 'on the placeholder text',
  selection: 'on the selected text',
  before: 'on an inserted element before the content',
  after: 'on an inserted element after the content',
  marker: 'on the list marker',
  'first-letter': 'on the first letter',
  'first-line': 'on the first line',
  file: 'on the file-picker button',
  dark: 'in dark mode',
  rtl: 'in right-to-left text',
  ltr: 'in left-to-right text',
  print: 'when printed',
  'motion-safe': 'unless reduced motion is requested',
  'motion-reduce': 'when reduced motion is requested',
  'group-hover': 'while an ancestor group is hovered',
  'group-focus': 'while an ancestor group is focused',
  'peer-hover': 'while the paired element is hovered',
  'peer-focus': 'while the paired element is focused',
  'peer-checked': 'when the paired element is checked',
}

const MIN_WIDTH = /\(width\s*>=\s*([\d.]+rem|[\d.]+px)\)/
const MAX_WIDTH = /\(width\s*<\s*([\d.]+rem|[\d.]+px)\)/

function contexts(declarations: Declaration[]): string[] {
  const found = declarations.flatMap((d) => (d.context === undefined ? [] : [d.context]))
  return [...new Set(found)]
}

function fromMediaQuery(variant: string, all: string[]): string | null {
  const container = variant.startsWith('@')
  const source = all.find((context) =>
    container ? context.startsWith('@container') : context.startsWith('@media'),
  )
  if (source === undefined) return null

  const min = MIN_WIDTH.exec(source)
  if (min !== null) {
    const size = remToPx(min[1] as string)
    return container ? `when its container is ${size} or wider` : `from ${size} up`
  }

  const max = MAX_WIDTH.exec(source)
  if (max !== null) {
    const size = remToPx(max[1] as string)
    return container ? `when its container is narrower than ${size}` : `below ${size}`
  }

  return null
}

export function describeVariants(variants: string[], declarations: Declaration[]): string | null {
  if (variants.length === 0) return null

  const all = contexts(declarations)
  const parts: string[] = []

  for (const variant of variants) {
    const known = SELECTOR_VARIANTS[variant]
    if (known !== undefined) {
      parts.push(known)
      continue
    }
    const derived = fromMediaQuery(variant, all)
    if (derived === null) return null
    parts.push(derived)
  }

  return [...new Set(parts)].join(', ')
}
