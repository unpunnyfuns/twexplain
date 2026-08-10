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
  printVariant: (v) => v.root ?? '',
  resolveThemeValue: (k) => theme[k],
}

const VARIANT_SHAPES: Record<string, { kind: string; root?: string; printed: string }[]> = {
  'hover:flex': [{ kind: 'static', root: 'hover', printed: 'hover' }],
  'md:hover:flex': [
    { kind: 'static', root: 'hover', printed: 'hover' },
    { kind: 'static', root: 'md', printed: 'md' },
  ],
  '[&>*]:flex': [{ kind: 'arbitrary', printed: '[&>*]' }],
  'group-hover:flex': [{ kind: 'compound', root: 'group', printed: 'group-hover' }],
  'data-[state=open]:flex': [{ kind: 'functional', root: 'data', printed: 'data-[state=open]' }],
}

const variantDs: DesignSystemPort = {
  candidatesToCss: (cs) => cs.map(() => '.x { display: flex; }'),
  parseCandidate: (c) => [{ root: 'flex', variants: VARIANT_SHAPES[c] ?? [] }],
  printVariant: (v) => (v as { printed?: string }).printed ?? '',
  resolveThemeValue: (k) => theme[k],
}

const variantsOf = (text: string): string[] | undefined => {
  const groups = explainCandidates([candidate(text, 0)], variantDs)
  return groups.flatMap((g) => g.classes)[0]?.variants
}

describe('explainCandidates', () => {
  it('resolves values through the theme, including custom colours', () => {
    const groups = explainCandidates([candidate('bg-brand-600', 0)], fakeDs)
    const explained = groups[0]?.classes[0]
    expect(explained?.declarations).toEqual([{ prop: 'background-color', value: '#4f46e5' }])
    expect(explained?.swatch).toBe('#4f46e5')
  })

  it('converts spacing arithmetic to px', () => {
    const groups = explainCandidates([candidate('px-4', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.declarations).toEqual([{ prop: 'padding-inline', value: '16px' }])
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
    const ds: DesignSystemPort = {
      ...fakeDs,
      parseCandidate: () => [{ root: 'unknown', variants: [] }],
    }
    const groups = explainCandidates([candidate('shadow-lg', 0)], ds)
    expect(groups[0]?.classes[0]?.prose).toBeNull()
  })

  it('keeps candidates and compiled CSS paired by index when an invalid class sits between valid ones', () => {
    const groups = explainCandidates(
      [candidate('px-4', 0), candidate('nope-999', 1), candidate('flex', 2)],
      fakeDs,
    )
    const byIndex = new Map(groups.flatMap((g) => g.classes).map((c) => [c.candidate.index, c]))

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
      { prop: 'background-color', value: 'red', context: '@media (hover: hover)' },
    ])
  })
})

const BOX_SHADOW =
  'box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);'

const REAL_CSS: Record<string, string> = {
  shadow: `.shadow { --tw-shadow: 0 1px 3px 0 #0000001a; ${BOX_SHADOW} }`,
  'shadow-lg': `.shadow-lg { --tw-shadow: 0 10px 15px -3px #0000001a; ${BOX_SHADOW} }`,
  'shadow-none': `.shadow-none { --tw-shadow: 0 0 #0000; ${BOX_SHADOW} }`,
  'shadow-blue-500': '.shadow-blue-500 { --tw-shadow-color: oklch(62.3% 0.214 259.815); }',
  'inset-shadow-sm': `.inset-shadow-sm { --tw-inset-shadow: inset 0 2px 4px #0000000d; ${BOX_SHADOW} }`,
  'inset-shadow-none': `.inset-shadow-none { --tw-inset-shadow: inset 0 0 #0000; ${BOX_SHADOW} }`,
  'ring-2': `.ring-2 { --tw-ring-shadow: 0 0 0 2px currentcolor; ${BOX_SHADOW} }`,
  'ring-0': `.ring-0 { --tw-ring-shadow: 0 0 0 0px currentcolor; ${BOX_SHADOW} }`,
  'ring-white': '.ring-white { --tw-ring-color: #fff; }',
  'animate-none': '.animate-none { animation: none; }',
  'filter-none': '.filter-none { filter: none; }',
  'backdrop-filter-none': '.backdrop-filter-none { backdrop-filter: none; }',
  'divide-red-500':
    ':where(.divide-red-500 > :not(:last-child)) { border-color: oklch(63.7% 0.237 25.331); }',
  'space-x-4':
    ':where(.space-x-4 > :not(:last-child)) { --tw-space-x-reverse: 0; margin-inline-start: calc(16px * var(--tw-space-x-reverse)); margin-inline-end: calc(16px * calc(1 - var(--tw-space-x-reverse))); }',
  'space-x-0':
    ':where(.space-x-0 > :not(:last-child)) { --tw-space-x-reverse: 0; margin-inline-start: 0; margin-inline-end: 0; }',
  'sr-only': '.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; }',
  truncate: '.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
}

const REAL_PARSE: Record<string, { root: string; value?: { value: string } | null }> = {
  shadow: { root: 'shadow', value: null },
  'shadow-lg': { root: 'shadow', value: { value: 'lg' } },
  'shadow-none': { root: 'shadow', value: { value: 'none' } },
  'shadow-blue-500': { root: 'shadow', value: { value: 'blue-500' } },
  'inset-shadow-sm': { root: 'inset-shadow', value: { value: 'sm' } },
  'inset-shadow-none': { root: 'inset-shadow', value: { value: 'none' } },
  'ring-2': { root: 'ring', value: { value: '2' } },
  'ring-0': { root: 'ring', value: { value: '0' } },
  'ring-white': { root: 'ring', value: { value: 'white' } },
  'animate-none': { root: 'animate', value: { value: 'none' } },
  'filter-none': { root: 'filter', value: { value: 'none' } },
  'backdrop-filter-none': { root: 'backdrop-filter', value: { value: 'none' } },
  'divide-red-500': { root: 'divide', value: { value: 'red-500' } },
  'space-x-4': { root: 'space-x', value: { value: '4' } },
  'space-x-0': { root: 'space-x', value: { value: '0' } },
  'sr-only': { root: 'sr-only' },
  truncate: { root: 'truncate' },
}

const realDs: DesignSystemPort = {
  candidatesToCss: (cs) => cs.map((c) => REAL_CSS[c] ?? null),
  parseCandidate: (c) => {
    const parsed = REAL_PARSE[c]
    return parsed === undefined ? [] : [{ ...parsed, variants: [] }]
  },
  printVariant: (v) => v.root ?? '',
  resolveThemeValue: () => undefined,
}

const proseOf = (text: string): string | null | undefined => {
  const groups = explainCandidates([candidate(text, 0)], realDs)
  return groups.flatMap((g) => g.classes)[0]?.prose
}

describe('overrides applied through the pipeline', () => {
  it.each(['shadow-blue-500', 'ring-white', 'space-x-0'])(
    'does not lend the positive root prose to %s',
    (text) => {
      expect(proseOf(text)).toBeNull()
    },
  )

  it.each([
    ['animate-none', 'no animation'],
    ['filter-none', 'no filters applied'],
    ['backdrop-filter-none', 'no backdrop filters applied'],
    ['shadow-none', 'no drop shadow'],
    ['inset-shadow-none', 'no inner drop shadow'],
    ['ring-0', 'no ring'],
  ])('describes %s accurately rather than lending it the positive prose', (text, expected) => {
    const prose = proseOf(text)
    expect(prose).toBe(expected)
    expect(prose).not.toContain('runs a named animation')
    expect(prose).not.toContain('applies a')
    expect(prose?.startsWith('no ')).toBe(true)
  })

  it.each([
    ['sr-only', 'visually hidden, but still announced by screen readers'],
    ['truncate', 'one line, cut off with an ellipsis'],
    ['shadow', 'drop shadow'],
    ['shadow-lg', 'drop shadow'],
    ['inset-shadow-sm', 'inner drop shadow'],
    ['ring-2', 'outline ring drawn outside the border'],
    ['space-x-4', 'horizontal gap between children, except the last'],
  ])('still explains %s', (text, expected) => {
    expect(proseOf(text)).toBe(expected)
  })

  it('leaves the honest raw CSS in place for a negating form', () => {
    const groups = explainCandidates([candidate('animate-none', 0)], realDs)
    expect(groups.flatMap((g) => g.classes)[0]?.declarations).toEqual([
      { prop: 'animation', value: 'none' },
    ])
  })
})

describe('explainCandidates variants', () => {
  it('reports an arbitrary variant as its printed text, never undefined', () => {
    expect(variantsOf('[&>*]:flex')).toEqual(['[&>*]'])
  })

  it('keeps the whole compound variant rather than only its root', () => {
    expect(variantsOf('group-hover:flex')).toEqual(['group-hover'])
  })

  it('keeps a functional variant with its arbitrary value', () => {
    expect(variantsOf('data-[state=open]:flex')).toEqual(['data-[state=open]'])
  })

  it('lists stacked variants in source order', () => {
    expect(variantsOf('md:hover:flex')).toEqual(['md', 'hover'])
  })

  it('reports no variants for a bare utility', () => {
    expect(variantsOf('flex')).toEqual([])
  })

  it('prints every variant kind as a non-empty name', () => {
    for (const text of Object.keys(VARIANT_SHAPES)) {
      const printed = variantsOf(text) ?? []
      expect(printed.length).toBeGreaterThan(0)
      for (const name of printed) expect(name).not.toBe('')
    }
  })

  it('groups a variant-bearing class by its properties, not into a separate bucket', () => {
    const groups = explainCandidates([candidate('[&>*]:flex', 0)], variantDs)
    expect(groups.map((g) => g.name)).toEqual(['layout'])
  })
})

const CONTAINER_CSS = `.container {
  width: 100%;
  @media (width >= 40rem) { max-width: 40rem; }
  @media (width >= 48rem) { max-width: 48rem; }
}`

const VARIANT_WRAPPED_CSS = `@media (hover: hover) {
  .hover\\:bg-blue-700:hover { background-color: red; }
}`

const nestedDs: DesignSystemPort = {
  candidatesToCss: (cs) =>
    cs.map((c) => {
      if (c === 'container') return CONTAINER_CSS
      if (c === 'hover:bg-blue-700') return VARIANT_WRAPPED_CSS
      return null
    }),
  parseCandidate: (c) => [{ root: c, variants: [] }],
  printVariant: (v) => v.root ?? '',
  resolveThemeValue: () => undefined,
}

const declarationsOf = (text: string) => {
  const groups = explainCandidates([candidate(text, 0)], nestedDs)
  return groups.flatMap((g) => g.classes)[0]?.declarations
}

describe('conditional declaration context', () => {
  it('records the media condition for declarations nested inside the class rule', () => {
    expect(declarationsOf('container')).toEqual([
      { prop: 'width', value: '100%' },
      { prop: 'max-width', value: '640px', context: '@media (width >= 40rem)' },
      { prop: 'max-width', value: '768px', context: '@media (width >= 48rem)' },
    ])
  })

  it('keeps derived prose when the class has a variant that explains the condition', () => {
    const ds: DesignSystemPort = {
      ...nestedDs,
      parseCandidate: () => [{ root: 'bg', variants: [{ kind: 'static', root: 'hover' }] }],
    }

    const explained = explainCandidates([candidate('hover:bg-blue-700', 0)], ds).flatMap(
      (g) => g.classes,
    )[0]

    expect(explained?.declarations[0]?.context).toBe('@media (hover: hover)')
    expect(explained?.prose).toBe('background red')
    expect(explained?.variants).toEqual(['hover'])
  })

  it('refuses prose when any declaration is conditional', () => {
    const ds: DesignSystemPort = {
      ...nestedDs,
      candidatesToCss: () => [
        '.narrowing { width: 100%; @media (width >= 40rem) { width: 50%; } }',
      ],
    }

    const groups = explainCandidates([candidate('narrowing', 0)], ds)
    const explained = groups.flatMap((g) => g.classes)[0]

    expect(explained?.declarations).toHaveLength(2)
    expect(explained?.prose).toBeNull()
  })
})

describe('numeric value for steppers', () => {
  const numericDs: DesignSystemPort = {
    ...fakeDs,
    candidatesToCss: (cs) => cs.map(() => '.x { display: flex; }'),
    parseCandidate: (c) => {
      if (c === 'px-4') return [{ root: 'px', value: { value: '4' }, variants: [] }]
      if (c === 'gap-0.5') return [{ root: 'gap', value: { value: '0.5' }, variants: [] }]
      if (c === 'bg-blue-600') return [{ root: 'bg', value: { value: 'blue-600' }, variants: [] }]
      if (c === 'p-[13px]') return [{ root: 'p', value: { value: '13px' }, variants: [] }]
      return [{ root: c, variants: [] }]
    },
  }

  const numericOf = (text: string): number | null | undefined =>
    explainCandidates([candidate(text, 0)], numericDs).flatMap((g) => g.classes)[0]?.numericValue

  it('reports the number for a numeric utility', () => {
    expect(numericOf('px-4')).toBe(4)
  })

  it('reports a fractional number', () => {
    expect(numericOf('gap-0.5')).toBe(0.5)
  })

  it('reports null for a non-numeric value', () => {
    expect(numericOf('bg-blue-600')).toBeNull()
  })

  it('reports null for an arbitrary value', () => {
    expect(numericOf('p-[13px]')).toBeNull()
  })

  it('reports null for a utility with no value at all', () => {
    expect(numericOf('flex')).toBeNull()
  })
})

describe('modifier for the opacity control', () => {
  const modifierDs: DesignSystemPort = {
    ...fakeDs,
    candidatesToCss: (cs) => cs.map(() => '.x { color: red; }'),
    parseCandidate: (c) => {
      if (c === 'bg-blue-600/50')
        return [
          { root: 'bg', value: { value: 'blue-600' }, modifier: { value: '50' }, variants: [] },
        ]
      if (c === 'bg-blue-600') return [{ root: 'bg', value: { value: 'blue-600' }, variants: [] }]
      return [{ root: c, variants: [] }]
    },
  }

  const modifierOf = (text: string): string | null | undefined =>
    explainCandidates([candidate(text, 0)], modifierDs).flatMap((g) => g.classes)[0]?.modifier

  it('reports the modifier when the class has one', () => {
    expect(modifierOf('bg-blue-600/50')).toBe('50')
  })

  it('reports null when the class has no modifier', () => {
    expect(modifierOf('bg-blue-600')).toBeNull()
  })
})

describe('arbitrary value for the text input', () => {
  const arbitraryDs: DesignSystemPort = {
    ...fakeDs,
    candidatesToCss: (cs) => cs.map(() => '.x { padding: 13px; }'),
    parseCandidate: (c) => {
      if (c === 'p-[13px]')
        return [{ root: 'p', value: { kind: 'arbitrary', value: '13px' }, variants: [] }]
      if (c === 'px-4') return [{ root: 'px', value: { kind: 'named', value: '4' }, variants: [] }]
      return [{ root: c, variants: [] }]
    },
  }

  const arbitraryOf = (text: string): string | null | undefined =>
    explainCandidates([candidate(text, 0)], arbitraryDs).flatMap((g) => g.classes)[0]
      ?.arbitraryValue

  it('reports the raw value for an arbitrary utility', () => {
    expect(arbitraryOf('p-[13px]')).toBe('13px')
  })

  it('reports null for a named value', () => {
    expect(arbitraryOf('px-4')).toBeNull()
  })

  it('reports null for a utility with no value', () => {
    expect(arbitraryOf('flex')).toBeNull()
  })
})

describe('the root an override would be keyed on', () => {
  it('reports the root Tailwind parsed the candidate to', () => {
    const groups = explainCandidates([candidate('px-4', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.root).toBe('px')
  })

  it('reports no root for a class Tailwind cannot parse', () => {
    const groups = explainCandidates([candidate('nope-999', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.root).toBeNull()
  })
})

describe('selector context', () => {
  const CSS: Record<string, string> = {
    flex: '.flex { display: flex; }',
    'divide-y': ':where(.divide-y > :not(:last-child)) { border-top-width: 1px; }',
    'dark:bg-slate-900': '.dark\\:bg-slate-900:where(.dark, .dark *) { background-color: red; }',
    'hover:bg-red-500':
      '@media (hover: hover) { .hover\\:bg-red-500:hover { background-color: red; } }',
    'divide-red-500': ':where(.divide-red-500 > :not(:last-child)) { border-color: red; }',
    'child-padded': ':where(.child-padded > *) { padding: 16px; }',
    'md:divide-y':
      '@media (width >= 48rem) { :where(.md\\:divide-y > :not(:last-child)) { border-top-width: 1px; } }',
  }

  const selectorDs: DesignSystemPort = {
    candidatesToCss: (cs) => cs.map((c) => CSS[c] ?? null),
    parseCandidate: (c) => [{ root: c, variants: [] }],
    printVariant: () => '',
    resolveThemeValue: () => undefined,
  }

  const explain = (text: string) =>
    explainCandidates([candidate(text, 0)], selectorDs).flatMap((g) => g.classes)[0]

  it('records nothing when the rule targets the element itself', () => {
    expect(explain('flex')?.declarations).toEqual([{ prop: 'display', value: 'flex' }])
  })

  it('records that a divide utility styles children rather than the element', () => {
    expect(explain('divide-y')?.declarations).toEqual([
      {
        prop: 'border-top-width',
        value: '1px',
        selector: ':where(& > :not(:last-child))',
      },
    ])
  })

  it('records the class-strategy dark scope the at-rule pass cannot see', () => {
    expect(explain('dark:bg-slate-900')?.declarations).toEqual([
      { prop: 'background-color', value: 'red', selector: '&:where(.dark, .dark *)' },
    ])
  })

  it('records the at-rule and the selector together', () => {
    expect(explain('hover:bg-red-500')?.declarations).toEqual([
      {
        prop: 'background-color',
        value: 'red',
        context: '@media (hover: hover)',
        selector: '&:hover',
      },
    ])
  })

  it('nests a selector inside an enclosing at-rule', () => {
    expect(explain('md:divide-y')?.declarations[0]?.selector).toBe(':where(& > :not(:last-child))')
  })

  it('withholds derived prose that would claim a child-scoped effect for the element', () => {
    expect(explain('child-padded')?.prose).toBeNull()
  })

  it('reports the swatch even when the colour lands on children', () => {
    expect(explain('divide-red-500')?.swatch).toBe('red')
  })
})
