import { describe, expect, it } from 'vitest'
import { INITIAL_ROOT_FONT_SIZE_PX, remToPx } from './flatten'

describe('remToPx', () => {
  it('uses the browser default when told nothing', () => {
    expect(remToPx('1rem')).toBe('16px')
    expect(INITIAL_ROOT_FONT_SIZE_PX).toBe(16)
  })

  it('honours a project that shrinks the root font size', () => {
    expect(remToPx('1rem', 10)).toBe('10px')
    expect(remToPx('1.5rem', 10)).toBe('15px')
  })

  it('honours a project that enlarges it', () => {
    expect(remToPx('1rem', 20)).toBe('20px')
  })

  it('converts every length in a compound value', () => {
    expect(remToPx('0 1rem 2rem', 10)).toBe('0 10px 20px')
  })

  it('still leaves rem inside a quoted string alone', () => {
    expect(remToPx("'1rem serif'", 10)).toBe("'1rem serif'")
  })

  it('ignores a nonsensical root size rather than producing NaN', () => {
    expect(remToPx('1rem', 0)).toBe('16px')
    expect(remToPx('1rem', Number.NaN)).toBe('16px')
    expect(remToPx('1rem', -5)).toBe('16px')
  })
})
