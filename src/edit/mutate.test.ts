import { describe, expect, it } from 'vitest'
import {
  type EditPort,
  addVariant,
  removeVariant,
  setModifier,
  setValue,
  stepValue,
} from './mutate'

type Candidate = {
  kind: string
  root: string
  value?: { kind: string; value: string } | null
  modifier?: { kind: string; value: string } | null
  variants: { kind: string; root?: string }[]
  important?: boolean
}

const named = (value: string) => ({ kind: 'named', value })
const hover = { kind: 'static', root: 'hover' }

const SHAPES: Record<string, Candidate> = {
  flex: { kind: 'static', root: 'flex', value: null, modifier: null, variants: [] },
  'hover:flex': { kind: 'static', root: 'flex', value: null, modifier: null, variants: [hover] },
  'px-4': { kind: 'functional', root: 'px', value: named('4'), modifier: null, variants: [] },
  'px-0': { kind: 'functional', root: 'px', value: named('0'), modifier: null, variants: [] },
  'bg-blue-600': {
    kind: 'functional',
    root: 'bg',
    value: named('blue-600'),
    modifier: null,
    variants: [],
  },
  'bg-blue-600/50': {
    kind: 'functional',
    root: 'bg',
    value: named('blue-600'),
    modifier: named('50'),
    variants: [],
  },
  'hover:bg-blue-600/50!': {
    kind: 'functional',
    root: 'bg',
    value: named('blue-600'),
    modifier: named('50'),
    variants: [hover],
    important: true,
  },
}

function parse(text: string): Candidate | null {
  return SHAPES[text] ?? null
}

function print(candidate: Candidate): string {
  const prefix = candidate.variants
    .map((v) => v.root)
    .reverse()
    .map((r) => `${r}:`)
    .join('')
  const modifier = candidate.modifier ? `/${candidate.modifier.value}` : ''
  const body =
    candidate.value === undefined || candidate.value === null
      ? candidate.root
      : `${candidate.root}-${candidate.value.value}`
  return `${prefix}${body}${modifier}${candidate.important ? '!' : ''}`
}

const shared = new Map<string, Candidate>()

const port: EditPort = {
  parseCandidate: (text) => {
    if (!shared.has(text)) {
      const parsed = parse(text)
      if (parsed === null) return []
      shared.set(text, parsed)
    }
    return [shared.get(text) as never]
  },
  printCandidate: (candidate) => print(candidate as Candidate),
  parseVariant: (text) => ({ kind: 'static', root: text }) as never,
}

describe('setValue', () => {
  it('replaces a functional value', () => {
    expect(setValue('bg-blue-600', 'blue-700', port)).toBe('bg-blue-700')
  })

  it('preserves variants, modifier and importance', () => {
    expect(setValue('hover:bg-blue-600/50!', 'red-500', port)).toBe('hover:bg-red-500/50!')
  })

  it('returns null for a candidate with no value to set', () => {
    expect(setValue('flex', 'x', port)).toBeNull()
  })
})

describe('stepValue', () => {
  it('increments a numeric value', () => {
    expect(stepValue('px-4', 1, port)).toBe('px-5')
  })

  it('decrements a numeric value', () => {
    expect(stepValue('px-4', -1, port)).toBe('px-3')
  })

  it('does not step below zero', () => {
    expect(stepValue('px-0', -1, port)).toBeNull()
  })

  it('refuses to step a non-numeric value', () => {
    expect(stepValue('bg-blue-600', 1, port)).toBeNull()
  })
})

describe('setModifier', () => {
  it('adds a modifier', () => {
    expect(setModifier('bg-blue-600', '50', port)).toBe('bg-blue-600/50')
  })

  it('removes a modifier when given null', () => {
    expect(setModifier('bg-blue-600/50', null, port)).toBe('bg-blue-600')
  })
})

describe('addVariant', () => {
  it('adds a variant', () => {
    expect(addVariant('flex', 'hover', port)).toBe('hover:flex')
  })

  it('adds a second variant in source order', () => {
    expect(addVariant('hover:flex', 'md', port)).toBe('md:hover:flex')
  })

  it('does not add a variant that is already present', () => {
    expect(addVariant('hover:flex', 'hover', port)).toBeNull()
  })
})

describe('removeVariant', () => {
  it('removes a variant', () => {
    expect(removeVariant('hover:flex', 'hover', port)).toBe('flex')
  })

  it('returns null when the variant is not present', () => {
    expect(removeVariant('flex', 'hover', port)).toBeNull()
  })
})

describe('mutation isolation', () => {
  it('never mutates the object the design system handed back', () => {
    const before = port.printCandidate(port.parseCandidate('bg-blue-600')[0])

    setValue('bg-blue-600', 'red-500', port)
    setModifier('bg-blue-600', '25', port)
    addVariant('bg-blue-600', 'focus', port)
    stepValue('px-4', 3, port)

    expect(port.printCandidate(port.parseCandidate('bg-blue-600')[0])).toBe(before)
    expect(port.printCandidate(port.parseCandidate('px-4')[0])).toBe('px-4')
  })
})
