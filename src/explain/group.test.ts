import { describe, expect, it } from 'vitest'
import type { ExplainedClass } from '../types'
import { groupAll, groupFor } from './group'

const explained = (name: string, group: ExplainedClass['group']): ExplainedClass => ({
  candidate: { text: name, range: { start: 0, end: name.length }, index: 0 },
  valid: true,
  root: null,
  declarations: [],
  prose: null,
  condition: null,
  group,
  variants: [],
  swatch: null,
  numericValue: null,
  modifier: null,
  arbitraryValue: null,
})

describe('groupFor', () => {
  it('routes a variant-bearing class by its property, not into a separate bucket', () => {
    expect(groupFor([{ prop: 'background-color', value: 'red' }], ['hover'])).toBe('color')
  })

  it('routes by property when there are no variants', () => {
    expect(groupFor([{ prop: 'display', value: 'flex' }], [])).toBe('layout')
    expect(groupFor([{ prop: 'padding-inline', value: '16px' }], [])).toBe('spacing')
    expect(groupFor([{ prop: 'background-color', value: 'red' }], [])).toBe('color')
    expect(groupFor([{ prop: 'font-size', value: '14px' }], [])).toBe('typography')
    expect(groupFor([{ prop: 'border-radius', value: '6px' }], [])).toBe('border')
    expect(groupFor([{ prop: 'box-shadow', value: 'none' }], [])).toBe('effects')
  })

  it('falls back to other for unknown properties', () => {
    expect(groupFor([{ prop: 'nonsense', value: '1' }], [])).toBe('other')
  })

  it('uses majority vote across multiple declarations', () => {
    expect(
      groupFor(
        [
          { prop: 'overflow', value: 'hidden' },
          { prop: 'text-overflow', value: 'ellipsis' },
          { prop: 'white-space', value: 'nowrap' },
        ],
        [],
      ),
    ).toBe('typography')
  })

  it('breaks ties by earliest voting declaration', () => {
    expect(
      groupFor(
        [
          { prop: 'display', value: 'flex' },
          { prop: 'color', value: 'red' },
        ],
        [],
      ),
    ).toBe('layout')
    expect(
      groupFor(
        [
          { prop: 'color', value: 'red' },
          { prop: 'display', value: 'flex' },
        ],
        [],
      ),
    ).toBe('color')
  })

  it('routes overflow-wrap to typography', () => {
    expect(groupFor([{ prop: 'overflow-wrap', value: 'break-word' }], [])).toBe('typography')
  })

  it('applies the majority vote even when the class carries a variant', () => {
    expect(
      groupFor(
        [
          { prop: 'overflow', value: 'hidden' },
          { prop: 'text-overflow', value: 'ellipsis' },
          { prop: 'white-space', value: 'nowrap' },
        ],
        ['hover'],
      ),
    ).toBe('typography')
  })
})

describe('groupAll', () => {
  it('buckets classes and drops empty groups', () => {
    const result = groupAll([explained('flex', 'layout'), explained('px-4', 'spacing')])
    expect(result.map((g) => g.name)).toEqual(['layout', 'spacing'])
  })

  it('preserves canonical group order regardless of input order', () => {
    const result = groupAll([explained('px-4', 'spacing'), explained('flex', 'layout')])
    expect(result.map((g) => g.name)).toEqual(['layout', 'spacing'])
  })
})

describe('variants do not move a class to a different group', () => {
  it('keeps a variant colour class with the other colours', () => {
    expect(groupFor([{ prop: 'background-color', value: 'red' }], ['hover'])).toBe('color')
  })

  it('keeps a variant spacing class with the other spacing', () => {
    expect(groupFor([{ prop: 'padding-inline', value: '16px' }], ['md'])).toBe('spacing')
  })

  it('groups a stacked-variant class by its properties too', () => {
    expect(groupFor([{ prop: 'display', value: 'flex' }], ['md', 'hover'])).toBe('layout')
  })

  it('still falls back to other for an unknown property with a variant', () => {
    expect(groupFor([{ prop: 'nonsense', value: '1' }], ['hover'])).toBe('other')
  })
})
