import { describe, expect, it } from 'vitest'
import type { Candidate } from '../types'
import { type DesignSystemPort, explainCandidates } from './index'

const candidate = (text: string, index: number): Candidate => ({
  text,
  range: { start: 0, end: text.length },
  index,
})

const theme: Record<string, string> = { '--spacing': '0.25rem', '--color-brand-600': '#4f46e5' }

const fakeDs: DesignSystemPort = {
  candidatesToCss: (cs) =>
    cs.map((c) => {
      if (c === 'px-4') return '.px-4 { padding-inline: calc(var(--spacing) * 4); }'
      if (c === 'flex') return '.flex { display: flex; }'
      if (c === 'bg-brand-600') return '.bg-brand-600 { background-color: var(--color-brand-600); }'
      if (c === 'sr-only') return '.sr-only { position: absolute; width: 1px; }'
      if (c === 'shadow-lg') return '.shadow-lg { box-shadow: var(--tw-shadow); }'
      return null
    }),
  parseCandidate: (c) => [{ root: c.replace(/-\d+$|-lg$|-600$/, ''), variants: [] }],
  resolveThemeValue: (k) => theme[k],
}

describe('explainCandidates', () => {
  it('resolves values through the theme, including custom colours', () => {
    const groups = explainCandidates([candidate('bg-brand-600', 0)], fakeDs)
    const explained = groups[0]?.classes[0]
    expect(explained?.declarations).toEqual([
      { prop: 'background-color', value: '#4f46e5' },
    ])
    expect(explained?.swatch).toBe('#4f46e5')
  })

  it('converts spacing arithmetic to px', () => {
    const groups = explainCandidates([candidate('px-4', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.declarations).toEqual([
      { prop: 'padding-inline', value: '16px' },
    ])
  })

  it('prefers a curated override over derived prose', () => {
    const groups = explainCandidates([candidate('sr-only', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.prose).toBe(
      'visually hidden, but still announced by screen readers',
    )
  })

  it('falls back to derived prose when no override exists', () => {
    const groups = explainCandidates([candidate('flex', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.prose).toBe('lays children out in a row')
  })

  it('marks unknown classes invalid rather than guessing', () => {
    const groups = explainCandidates([candidate('nope-999', 0)], fakeDs)
    const explained = groups[0]?.classes[0]
    expect(explained?.valid).toBe(false)
    expect(explained?.prose).toBeNull()
  })

  it('never invents prose for opaque classes without an override', () => {
    const ds: DesignSystemPort = { ...fakeDs, parseCandidate: () => [{ root: 'unknown', variants: [] }] }
    const groups = explainCandidates([candidate('shadow-lg', 0)], ds)
    expect(groups[0]?.classes[0]?.prose).toBeNull()
  })

  it('keeps candidates and compiled CSS paired by index when an invalid class sits between valid ones', () => {
    const groups = explainCandidates(
      [candidate('px-4', 0), candidate('nope-999', 1), candidate('flex', 2)],
      fakeDs,
    )
    const byIndex = new Map(
      groups.flatMap((g) => g.classes).map((c) => [c.candidate.index, c]),
    )

    expect(byIndex.get(0)?.valid).toBe(true)
    expect(byIndex.get(0)?.declarations).toEqual([{ prop: 'padding-inline', value: '16px' }])

    expect(byIndex.get(1)?.valid).toBe(false)
    expect(byIndex.get(1)?.prose).toBeNull()

    expect(byIndex.get(2)?.valid).toBe(true)
    expect(byIndex.get(2)?.prose).toBe('lays children out in a row')
  })

  it('suppresses the swatch when a colour value still contains an unresolved custom property', () => {
    const ds: DesignSystemPort = {
      ...fakeDs,
      candidatesToCss: (cs) =>
        cs.map((c) => {
          if (c === 'grad-from') return '.grad-from { background-color: var(--tw-gradient-from); }'
          return fakeDs.candidatesToCss([c])[0] ?? null
        }),
    }

    const suppressed = explainCandidates([candidate('grad-from', 0)], ds)
    expect(suppressed[0]?.classes[0]?.swatch).toBeNull()

    const resolved = explainCandidates([candidate('bg-brand-600', 0)], ds)
    expect(resolved[0]?.classes[0]?.swatch).toBe('#4f46e5')
  })

  it('collects declarations from nested rule structures, such as variant-wrapped output', () => {
    const ds: DesignSystemPort = {
      ...fakeDs,
      candidatesToCss: (cs) =>
        cs.map((c) => {
          if (c === 'bg-red-nested')
            return '.bg-red-nested { &:hover { @media (hover: hover) { background-color: red; } } }'
          return fakeDs.candidatesToCss([c])[0] ?? null
        }),
    }

    const groups = explainCandidates([candidate('bg-red-nested', 0)], ds)
    expect(groups[0]?.classes[0]?.declarations).toEqual([
      { prop: 'background-color', value: 'red' },
    ])
  })
})
