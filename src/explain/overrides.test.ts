import { describe, expect, it } from 'vitest'
import { overrideFor } from './overrides'

describe('overrideFor', () => {
  it('explains emergent-meaning utilities by purpose', () => {
    expect(overrideFor('sr-only')).toBe(
      'visually hidden, but still announced by screen readers',
    )
  })

  it('explains composite utilities the derive stage cannot resolve', () => {
    expect(overrideFor('shadow')).toBe('drop shadow')
    expect(overrideFor('space-x')).toBe('horizontal gap between children, except the last')
  })

  it('returns null for roots with no curated entry', () => {
    expect(overrideFor('px')).toBeNull()
  })
})
