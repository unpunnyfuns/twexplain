import { describe, expect, it } from 'vitest'
import { derive, isOpaque } from './derive'

describe('isOpaque', () => {
  it('flags declarations with residual --tw-* references', () => {
    expect(isOpaque([{ prop: 'box-shadow', value: 'var(--tw-shadow)' }])).toBe(true)
  })

  it('does not flag fully resolved declarations', () => {
    expect(isOpaque([{ prop: 'padding-inline', value: '16px' }])).toBe(false)
  })
})

describe('derive', () => {
  it('describes a known property', () => {
    expect(derive([{ prop: 'display', value: 'flex' }])).toBe('lays children out in a row')
  })

  it('describes a dimensional property with its value', () => {
    expect(derive([{ prop: 'padding-inline', value: '16px' }])).toBe(
      'padding of 16px on the left and right',
    )
  })

  it('joins multiple declarations', () => {
    expect(derive([
      { prop: 'font-size', value: '14px' },
      { prop: 'line-height', value: '1.428571' },
    ])).toBe('text size 14px; line height 1.428571')
  })

  it('returns null for opaque declarations', () => {
    expect(derive([{ prop: 'box-shadow', value: 'var(--tw-shadow)' }])).toBeNull()
  })

  it('returns null when no property is known', () => {
    expect(derive([{ prop: 'nonsense-prop', value: '1' }])).toBeNull()
  })
})
