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

  it('describes opacity for unitless decimal values', () => {
    expect(derive([{ prop: 'opacity', value: '0.5' }])).toBe('50% opaque')
  })

  it('describes opacity for percentage values', () => {
    expect(derive([{ prop: 'opacity', value: '73%' }])).toBe('73% opaque')
  })

  it('returns null for opacity with keyword values', () => {
    expect(derive([{ prop: 'opacity', value: 'inherit' }])).toBeNull()
  })

  it('returns null when any declaration is undescribable', () => {
    expect(derive([
      { prop: 'display', value: 'flex' },
      { prop: 'clip', value: 'rect(0, 0, 0, 0)' },
    ])).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(derive([])).toBeNull()
  })

  it('returns null for unitless opacity out of range', () => {
    expect(derive([{ prop: 'opacity', value: '50' }])).toBeNull()
  })

  it('returns null for percentage opacity out of range', () => {
    expect(derive([{ prop: 'opacity', value: '150%' }])).toBeNull()
  })

  it('describes opacity for leading-dot decimal values', () => {
    expect(derive([{ prop: 'opacity', value: '.5' }])).toBe('50% opaque')
  })
})
