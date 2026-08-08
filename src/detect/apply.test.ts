import { describe, expect, it } from 'vitest'
import { detectApply } from './apply'

const at = (source: string, needle: string): number => source.indexOf(needle)

describe('detectApply', () => {
  const source = '.btn {\n  @apply px-4 py-2 rounded;\n  color: red;\n}'

  it('finds the classes in an @apply directive', () => {
    const found = detectApply(source, at(source, 'py-2'), 'file:///a.css')

    expect(found?.kind).toBe('apply')
    expect(found?.candidates.map((c) => c.text)).toEqual(['px-4', 'py-2', 'rounded'])
  })

  it('reports offsets that recover each candidate', () => {
    const found = detectApply(source, at(source, 'px-4'), 'file:///a.css')

    for (const candidate of found?.candidates ?? []) {
      expect(source.slice(candidate.range.start, candidate.range.end)).toBe(candidate.text)
    }
  })

  it('returns null when the cursor is on an ordinary declaration', () => {
    expect(detectApply(source, at(source, 'color'), 'file:///a.css')).toBeNull()
  })

  it('returns null when the cursor is on the directive itself', () => {
    expect(detectApply(source, at(source, '@apply'), 'file:///a.css')).toBeNull()
  })

  it('picks the directive containing the cursor when a file has several', () => {
    const two = '.a { @apply px-1; }\n.b { @apply m-2 flex; }'
    const found = detectApply(two, at(two, 'flex'), 'file:///a.css')

    expect(found?.candidates.map((c) => c.text)).toEqual(['m-2', 'flex'])
  })

  it('handles a directive terminated by the closing brace rather than a semicolon', () => {
    const noSemi = '.a { @apply px-4 py-2 }'
    const found = detectApply(noSemi, at(noSemi, 'py-2'), 'file:///a.css')

    expect(found?.candidates.map((c) => c.text)).toEqual(['px-4', 'py-2'])
  })

  it('handles classes wrapped over several lines', () => {
    const wrapped = '.a {\n  @apply px-4\n    py-2\n    rounded;\n}'
    const found = detectApply(wrapped, at(wrapped, 'rounded'), 'file:///a.css')

    expect(found?.candidates.map((c) => c.text)).toEqual(['px-4', 'py-2', 'rounded'])
  })

  it('returns null for a file with no @apply at all', () => {
    expect(detectApply('.a { color: red; }', 8, 'file:///a.css')).toBeNull()
  })
})
