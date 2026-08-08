import { describe, expect, it } from 'vitest'
import type { Declaration } from '../types'
import { overrideFor } from './overrides'

const OPAQUE_SHADOW: Declaration[] = [
  {
    prop: 'box-shadow',
    value:
      'var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)',
  },
]

const OPAQUE_SPACE_X: Declaration[] = [
  { prop: 'margin-inline-start', value: 'calc(16px * var(--tw-space-x-reverse))' },
  { prop: 'margin-inline-end', value: 'calc(16px * calc(1 - var(--tw-space-x-reverse)))' },
]

describe('overrideFor', () => {
  it('explains emergent-meaning utilities by purpose, whatever their declarations', () => {
    expect(overrideFor({ root: 'sr-only' }, [{ prop: 'position', value: 'absolute' }])).toBe(
      'visually hidden, but still announced by screen readers',
    )
    expect(overrideFor({ root: 'truncate' }, [{ prop: 'overflow', value: 'hidden' }])).toBe(
      'one line, cut off with an ellipsis',
    )
  })

  it('explains composite utilities whose declarations really are opaque machinery', () => {
    expect(overrideFor({ root: 'shadow', value: { value: 'lg' } }, OPAQUE_SHADOW)).toBe(
      'drop shadow',
    )
    expect(overrideFor({ root: 'shadow', value: null }, OPAQUE_SHADOW)).toBe('drop shadow')
    expect(overrideFor({ root: 'space-x', value: { value: '4' } }, OPAQUE_SPACE_X)).toBe(
      'horizontal gap between children, except the last',
    )
  })

  it('withholds a composite override when the value negates the effect', () => {
    expect(overrideFor({ root: 'shadow', value: { value: 'none' } }, OPAQUE_SHADOW)).toBeNull()
    expect(
      overrideFor({ root: 'inset-shadow', value: { value: 'none' } }, OPAQUE_SHADOW),
    ).toBeNull()
    expect(overrideFor({ root: 'ring', value: { value: '0' } }, OPAQUE_SHADOW)).toBeNull()
    expect(overrideFor({ root: 'ring', value: { value: '0px' } }, OPAQUE_SHADOW)).toBeNull()
  })

  it('withholds a composite override when the declarations are not opaque', () => {
    expect(
      overrideFor({ root: 'animate', value: { value: 'none' } }, [
        { prop: 'animation', value: 'none' },
      ]),
    ).toBeNull()
    expect(
      overrideFor({ root: 'filter', value: { value: 'none' } }, [
        { prop: 'filter', value: 'none' },
      ]),
    ).toBeNull()
    expect(
      overrideFor({ root: 'divide', value: { value: 'red-500' } }, [
        { prop: 'border-color', value: 'oklch(63.7% 0.237 25.331)' },
      ]),
    ).toBeNull()
    expect(
      overrideFor({ root: 'space-x', value: { value: '0' } }, [
        { prop: 'margin-inline-start', value: '0' },
        { prop: 'margin-inline-end', value: '0' },
      ]),
    ).toBeNull()
  })

  it('withholds a composite override when the class contributes no declarations at all', () => {
    expect(overrideFor({ root: 'shadow', value: { value: 'blue-500' } }, [])).toBeNull()
    expect(overrideFor({ root: 'ring', value: { value: 'white' } }, [])).toBeNull()
  })

  it('returns null for roots with no curated entry', () => {
    expect(overrideFor({ root: 'px', value: { value: '4' } }, [])).toBeNull()
  })
})

const OPAQUE_DIVIDE_Y = [
  { prop: 'border-top-width', value: 'calc(1px * var(--tw-divide-y-reverse))' },
  { prop: 'border-bottom-width', value: 'calc(1px * calc(1 - var(--tw-divide-y-reverse)))' },
]

describe('reachable override roots', () => {
  it('covers the real divide roots, which is how Tailwind actually parses them', () => {
    expect(overrideFor({ root: 'divide-y', value: null }, OPAQUE_DIVIDE_Y)).toBe(
      'horizontal dividing lines between children, except the last',
    )
  })

  it('no longer carries entries for roots Tailwind never produces', () => {
    expect(overrideFor({ root: 'divide', value: null }, OPAQUE_DIVIDE_Y)).toBeNull()
    expect(overrideFor({ root: 'animate', value: { value: 'spin' } }, OPAQUE_DIVIDE_Y)).toBeNull()
  })

  it('still withholds a divide override when a zero value negates it', () => {
    expect(overrideFor({ root: 'divide-y', value: { value: '0' } }, OPAQUE_DIVIDE_Y)).toBeNull()
  })
})
