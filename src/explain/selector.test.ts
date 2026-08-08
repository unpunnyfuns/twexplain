import { describe, expect, it } from 'vitest'
import { resolveNesting, selectorContext } from './selector'

describe('selectorContext', () => {
  it('reports no context when the selector is only the class itself', () => {
    expect(selectorContext('.flex', 'flex')).toBeNull()
  })

  it('rewrites a pseudo-class suffix as a nesting selector', () => {
    expect(selectorContext('.hover\\:bg-red-500:hover', 'hover:bg-red-500')).toBe('&:hover')
  })

  it('keeps the class-strategy dark scope that the at-rule pass drops', () => {
    expect(selectorContext('.dark\\:bg-slate-900:where(.dark, .dark *)', 'dark:bg-slate-900')).toBe(
      '&:where(.dark, .dark *)',
    )
  })

  it('places the nesting marker inside a wrapper that targets children', () => {
    expect(selectorContext(':where(.divide-y > :not(:last-child))', 'divide-y')).toBe(
      ':where(& > :not(:last-child))',
    )
  })

  it('handles a class whose name needs escaping throughout', () => {
    expect(selectorContext(':is(.\\*\\:p-2 > *)', '*:p-2')).toBe(':is(& > *)')
  })

  it('reads a hex escape with its trailing space', () => {
    expect(selectorContext('.\\32 xl\\:flex', '2xl:flex')).toBeNull()
  })

  it('handles an arbitrary variant that expands into a combinator', () => {
    expect(selectorContext('.\\[\\&\\>\\*\\]\\:mt-2 > *', '[&>*]:mt-2')).toBe('& > *')
  })

  it('does not mistake an escaped dot inside a value for a class boundary', () => {
    expect(
      selectorContext(".bg-\\[url\\(\\'\\/img\\.png\\'\\)\\]", "bg-[url('/img.png')]"),
    ).toBeNull()
  })

  it('leaves unrelated classes in the selector alone', () => {
    expect(
      selectorContext(
        '.group-hover\\:opacity-50:is(:where(.group):hover *)',
        'group-hover:opacity-50',
      ),
    ).toBe('&:is(:where(.group):hover *)')
  })

  it('does not rewrite text inside an attribute value that looks like the class', () => {
    expect(selectorContext('.flex[data-x=".flex"]', 'flex')).toBe('&[data-x=".flex"]')
  })

  it('reports no context when the class is absent from the selector', () => {
    expect(selectorContext('.something-else', 'flex')).toBeNull()
  })
})

describe('resolveNesting', () => {
  it('keeps the outer scope when the inner adds none', () => {
    expect(resolveNesting('&:hover', null)).toBe('&:hover')
  })

  it('keeps the inner scope when there is no outer', () => {
    expect(resolveNesting(null, '&:hover')).toBe('&:hover')
  })

  it('substitutes the outer scope for the inner nesting marker', () => {
    expect(resolveNesting('&:hover', ':where(& > :not(:last-child))')).toBe(
      ':where(&:hover > :not(:last-child))',
    )
  })

  it('substitutes every nesting marker, not just the first', () => {
    expect(resolveNesting('&:hover', '& + &')).toBe('&:hover + &:hover')
  })
})
