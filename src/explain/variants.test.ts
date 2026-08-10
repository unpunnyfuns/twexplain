import { describe, expect, it } from 'vitest'
import type { Declaration } from '../types'
import { describeVariants } from './variants'

const at = (context: string): Declaration[] => [{ prop: 'display', value: 'flex', context }]
const plain: Declaration[] = [{ prop: 'display', value: 'flex' }]

describe('breakpoints, read from the media query rather than a hardcoded scale', () => {
  it('describes a minimum width', () => {
    expect(describeVariants(['md'], at('@media (width >= 48rem)'))).toBe('from 768px up')
  })

  it('describes a maximum width', () => {
    expect(describeVariants(['max-sm'], at('@media (width < 40rem)'))).toBe('below 640px')
  })

  it('uses the project’s own breakpoint, not a Tailwind default', () => {
    expect(describeVariants(['md'], at('@media (width >= 50rem)'))).toBe('from 800px up')
  })

  it('describes a container query as being about the container', () => {
    expect(describeVariants(['@md'], at('@container (width >= 28rem)'))).toBe(
      'when its container is 448px or wider',
    )
  })
})

describe('variants whose condition is a selector', () => {
  it.each([
    ['hover', 'while hovered'],
    ['focus', 'while focused'],
    ['active', 'while pressed'],
    ['disabled', 'when disabled'],
    ['checked', 'when checked'],
    ['first', 'on the first child'],
    ['last', 'on the last child'],
    ['odd', 'on odd-numbered children'],
    ['placeholder', 'on the placeholder text'],
    ['before', 'on an inserted element before the content'],
  ])('describes %s', (variant, expected) => {
    expect(describeVariants([variant], plain)).toBe(expected)
  })

  it('describes dark mode however the project compiles it', () => {
    expect(describeVariants(['dark'], plain)).toBe('in dark mode')
    expect(describeVariants(['dark'], at('@media (prefers-color-scheme: dark)'))).toBe(
      'in dark mode',
    )
  })

  it('describes a group variant as depending on an ancestor', () => {
    expect(describeVariants(['group-hover'], plain)).toBe('while an ancestor group is hovered')
  })
})

describe('combining and refusing', () => {
  it('joins several conditions', () => {
    expect(describeVariants(['md', 'hover'], at('@media (width >= 48rem)'))).toBe(
      'from 768px up, while hovered',
    )
  })

  it('says nothing when there are no variants', () => {
    expect(describeVariants([], plain)).toBeNull()
  })

  it('refuses rather than describing only the variants it recognises', () => {
    expect(describeVariants(['hover', 'supports-[display:grid]'], plain)).toBeNull()
  })

  it('refuses an unknown variant on its own', () => {
    expect(describeVariants(['aria-expanded'], plain)).toBeNull()
  })
})
