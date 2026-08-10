import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache, loadDesignSystem } from '../design-system/load'
import type { Candidate, ExplainedClass } from '../types'
import { explainCandidates } from './index'

let explain: (text: string) => ExplainedClass | undefined

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'twexplain-honesty-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(
    join(process.cwd(), 'node_modules', 'tailwindcss'),
    join(root, 'node_modules', 'tailwindcss'),
    'dir',
  )
  await writeFile(
    join(root, 'src', 'app.css'),
    '@import "tailwindcss";\n@custom-variant hocus (&:hover, &:focus);\n',
  )
  clearDesignSystemCache()

  const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
  if (!loaded.ok) throw new Error('design system did not load')

  explain = (text: string) => {
    const candidate: Candidate = { text, range: { start: 0, end: text.length }, index: 0 }
    return explainCandidates([candidate], loaded.ds).flatMap((g) => g.classes)[0]
  }
})

describe('a class never states its effect without the condition that limits it', () => {
  it.each([
    '*:p-4',
    '**:mt-2',
    '[&>svg]:mt-1',
    'first:[&>p]:mt-2',
    'aria-disabled:opacity-50',
    'data-open:bg-red-500',
    'has-[:checked]:p-4',
    'open:p-4',
    'nth-3:p-4',
    'first-of-type:p-4',
    'in-[.foo]:p-4',
    'supports-grid:p-4',
    'group-hover/item:opacity-100',
    'hocus:mt-2',
  ])('%s either names its condition or withholds the prose', (text) => {
    const explained = explain(text)

    expect(explained?.valid).toBe(true)
    if (explained?.prose !== null) {
      expect(explained?.condition).not.toBeNull()
    }
  })

  it('still describes a class whose variants are all understood', () => {
    const explained = explain('md:hover:w-1/2')

    expect(explained?.prose).toBe('width 50%')
    expect(explained?.condition).toBe('from 768px up, while hovered')
  })

  it('keeps describing an unconditional class', () => {
    expect(explain('w-1/2')?.prose).toBe('width 50%')
    expect(explain('w-1/2')?.condition).toBeNull()
  })
})

describe('a stacked breakpoint range states both ends', () => {
  it('names the upper bound as well as the lower', () => {
    const condition = explain('md:max-lg:flex')?.condition

    expect(condition).toContain('768px')
    expect(condition).toContain('1024px')
  })

  it('names both ends of an arbitrary range', () => {
    const condition = explain('min-[600px]:max-[900px]:flex')?.condition

    expect(condition).toContain('600px')
    expect(condition).toContain('900px')
  })
})

describe('structural variants describe the element, not a child', () => {
  it.each([
    ['first:mt-0', 'when it is the first child'],
    ['last:mt-0', 'when it is the last child'],
    ['odd:bg-red-500', 'when it is an odd-numbered child'],
    ['even:bg-red-500', 'when it is an even-numbered child'],
  ])('%s reads as a condition on the element', (text, expected) => {
    expect(explain(text)?.condition).toBe(expected)
  })
})

describe('utilities whose root carries more than one meaning', () => {
  it.each(['from-10%', 'via-50%', 'to-90%'])('%s is not called a colour', (text) => {
    expect(explain(text)?.prose ?? '').not.toContain('colour')
  })

  it('still calls a gradient colour a colour', () => {
    expect(explain('from-blue-500')?.prose).toBe('the colour a gradient starts from')
  })

  it.each(['transition-opacity', 'transition-colors', 'transition-shadow'])(
    '%s does not claim to animate most properties',
    (text) => {
      expect(explain(text)?.prose ?? '').not.toContain('most properties')
    },
  )

  it('still describes a bare transition', () => {
    expect(explain('transition')?.prose).toBe('animates changes to most properties')
  })

  it('calls an arbitrary inset shadow inset', () => {
    expect(explain('shadow-[inset_0_1px_0_white]')?.prose).toBe('inset drop shadow')
  })
})

describe('alignment utilities say what they actually do', () => {
  it.each([
    ['items-start', 'centred'],
    ['items-end', 'centred'],
    ['items-stretch', 'centred'],
    ['justify-start', 'distributed'],
    ['justify-end', 'distributed'],
  ])('%s does not say %s', (text, forbidden) => {
    expect(explain(text)?.prose ?? '').not.toContain(forbidden)
  })

  it('still describes centring as centring', () => {
    expect(explain('items-center')?.prose).toContain('centred')
  })
})

describe('the CSS parser survives escaped syntax characters', () => {
  it('does not claim a content utility sets only internal variables', () => {
    const explained = explain("content-['}']")

    expect(explained?.declarations.length).toBeGreaterThan(0)
  })

  it('does not fabricate a declaration from an escaped semicolon', () => {
    const explained = explain("before:content-['a;b']")

    for (const declaration of explained?.declarations ?? []) {
      expect(declaration.prop).not.toContain('\\')
    }
  })
})

describe('rem is converted only where it is a length', () => {
  it('leaves rem inside a quoted string alone', () => {
    const values = explain("font-['1rem_serif']")?.declarations.map((d) => d.value) ?? []

    expect(values.join(' ')).not.toContain('16px')
  })

  it('still converts a real length', () => {
    expect(explain('p-4')?.declarations[0]?.value).toBe('16px')
  })
})
