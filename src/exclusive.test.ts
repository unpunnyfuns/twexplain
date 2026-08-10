import { describe, expect, it } from 'vitest'
import { conflictingVariants } from './exclusive'

const breakpoints = new Map([
  ['sm', '40rem'],
  ['md', '48rem'],
  ['lg', '64rem'],
])

const ds = {
  theme: { namespace: () => breakpoints },
}

describe('conflictingVariants', () => {
  it('reports the breakpoint already on the class when another is added', () => {
    expect(conflictingVariants(['md'], 'lg', ds)).toEqual(['md'])
  })

  it('reports every breakpoint present, so a broken class can be repaired', () => {
    expect(conflictingVariants(['sm', 'md'], 'lg', ds)).toEqual(['sm', 'md'])
  })

  it('reports nothing when the variant being added is not a breakpoint', () => {
    expect(conflictingVariants(['md'], 'hover', ds)).toEqual([])
  })

  it('leaves non-breakpoint variants alone', () => {
    expect(conflictingVariants(['hover', 'dark', 'md'], 'lg', ds)).toEqual(['md'])
  })

  it('does not treat a max-width variant as conflicting, since a range is legal', () => {
    expect(conflictingVariants(['max-md'], 'sm', ds)).toEqual([])
  })

  it('does not treat a container query as conflicting with a breakpoint', () => {
    expect(conflictingVariants(['@md'], 'lg', ds)).toEqual([])
  })

  it('reports nothing when re-adding the breakpoint already there', () => {
    expect(conflictingVariants(['md'], 'md', ds)).toEqual([])
  })

  it('uses the project’s own breakpoint names, not a fixed list', () => {
    const custom = { theme: { namespace: () => new Map([['wide', '100rem']]) } }

    expect(conflictingVariants(['wide'], 'sm', custom)).toEqual([])
    expect(conflictingVariants(['wide'], 'wide', custom)).toEqual([])
  })
})
