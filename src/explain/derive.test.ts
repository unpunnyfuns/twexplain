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
    expect(
      derive([
        { prop: 'font-size', value: '14px' },
        { prop: 'line-height', value: '1.428571' },
      ]),
    ).toBe('text size 14px; line height 1.428571')
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
    expect(
      derive([
        { prop: 'display', value: 'flex' },
        { prop: 'scroll-behavior', value: 'smooth' },
      ]),
    ).toBeNull()
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

describe('animation and transform phrases', () => {
  it('describes a named animation', () => {
    expect(derive([{ prop: 'animation', value: 'spin 1s linear infinite' }])).toBe(
      'runs the animation spin 1s linear infinite',
    )
  })

  it('describes animation: none as no animation', () => {
    expect(derive([{ prop: 'animation', value: 'none' }])).toBe('no animation')
  })

  it('describes a filter value', () => {
    expect(derive([{ prop: 'filter', value: 'none' }])).toBe('no filters applied')
  })

  it('describes a transform value', () => {
    expect(derive([{ prop: 'transform', value: 'none' }])).toBe('no transform applied')
  })

  it('describes a clip value', () => {
    expect(derive([{ prop: 'clip', value: 'rect(0, 0, 0, 0)' }])).toBe(
      'clipped to rect(0, 0, 0, 0)',
    )
  })
})

describe('derive over shorthands that need reading, not restating', () => {
  it('reads a repeat() grid as a plain column count', () => {
    expect(derive([{ prop: 'grid-template-columns', value: 'repeat(3, minmax(0, 1fr))' }])).toBe(
      '3 equal columns',
    )
  })

  it('falls back to stating an unusual grid rather than claiming a count', () => {
    expect(
      derive([{ prop: 'grid-template-columns', value: 'repeat(auto-fill, minmax(200px, 1fr))' }]),
    ).toBe('grid columns: repeat(auto-fill, minmax(200px, 1fr))')
  })

  it('reads a span shorthand as a span', () => {
    expect(derive([{ prop: 'grid-column', value: 'span 2 / span 2' }])).toBe('spans 2 columns')
  })

  it('reads the flex shorthand rather than echoing it', () => {
    expect(derive([{ prop: 'flex', value: '1' }])).toBe('grows and shrinks to share the free space')
    expect(derive([{ prop: 'flex', value: 'none' }])).toBe('neither grows nor shrinks')
  })

  it('names a square aspect ratio', () => {
    expect(derive([{ prop: 'aspect-ratio', value: '1 / 1' }])).toBe('kept square')
  })

  it('hedges an automatic margin, since it only centres a sized element', () => {
    expect(derive([{ prop: 'margin-inline', value: 'auto' }])).toBe(
      'equal automatic margins left and right, which centres an element that has a width',
    )
  })

  it('states a measured margin plainly', () => {
    expect(derive([{ prop: 'margin-top', value: '16px' }])).toBe('margin of 16px on the top')
  })
})

describe('derive when two declarations say the same thing', () => {
  it('states a vendor-prefixed pair once rather than twice', () => {
    expect(
      derive([
        { prop: '-webkit-user-select', value: 'none' },
        { prop: 'user-select', value: 'none' },
      ]),
    ).toBe('cannot be selected as text')
  })

  it('still states two genuinely different effects', () => {
    expect(
      derive([
        { prop: 'display', value: 'flex' },
        { prop: 'text-align', value: 'center' },
      ]),
    ).toBe('lays children out in a row; text centred')
  })
})
