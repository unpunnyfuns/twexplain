import { describe, expect, it } from 'vitest'
import { flattenValue, remToPx } from './flatten'

const theme: Record<string, string> = {
  '--spacing': '0.25rem',
  '--radius-md': '0.375rem',
  '--color-brand-600': '#4f46e5',
}
const resolve = (k: string): string | null => theme[k] ?? null

describe('flattenValue', () => {
  it('substitutes a theme variable', () => {
    expect(flattenValue('var(--color-brand-600)', resolve)).toBe('#4f46e5')
  })

  it('evaluates multiplication through a substituted variable', () => {
    expect(flattenValue('calc(var(--spacing) * 4)', resolve)).toBe('1rem')
  })

  it('evaluates unspaced fractions', () => {
    expect(flattenValue('calc(1/2 * 100%)', resolve)).toBe('50%')
  })

  it('uses the fallback when a variable is unresolvable', () => {
    expect(flattenValue('var(--nope, 3px)', resolve)).toBe('3px')
  })

  it('leaves unresolvable --tw-* references intact as a tier-3 signal', () => {
    expect(flattenValue('var(--tw-shadow)', resolve)).toBe('var(--tw-shadow)')
  })

  it('leaves non-arithmetic values alone', () => {
    expect(flattenValue('oklch(48.8% 0.243 264.376)', resolve)).toBe(
      'oklch(48.8% 0.243 264.376)',
    )
  })
})

describe('remToPx', () => {
  it('converts rem to px at a 16px root', () => {
    expect(remToPx('1rem')).toBe('16px')
    expect(remToPx('0.375rem')).toBe('6px')
  })

  it('leaves other units alone', () => {
    expect(remToPx('50%')).toBe('50%')
  })
})
