import { describe, expect, it } from 'vitest'
import type { ExplainedClass } from '../types'
import { groupAll, groupFor } from './group'

const explained = (name: string, group: ExplainedClass['group']): ExplainedClass => ({
  candidate: { text: name, range: { start: 0, end: name.length }, index: 0 },
  valid: true,
  declarations: [],
  prose: null,
  group,
  variants: [],
  swatch: null,
})

describe('groupFor', () => {
  it('routes variant-bearing classes to state', () => {
    expect(groupFor([{ prop: 'background-color', value: 'red' }], ['hover'])).toBe('state')
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

  it('routes multi-declaration with variant to state despite vote', () => {
    expect(
      groupFor(
        [
          { prop: 'overflow', value: 'hidden' },
          { prop: 'text-overflow', value: 'ellipsis' },
        ],
        ['hover'],
      ),
    ).toBe('state')
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
