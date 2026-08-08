import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache, loadDesignSystem } from '../design-system/load'
import type { Candidate } from '../types'
import { explainCandidates } from './index'

let proseOf: (text: string) => string | null | undefined

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'twexplain-curation-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(
    join(process.cwd(), 'node_modules', 'tailwindcss'),
    join(root, 'node_modules', 'tailwindcss'),
    'dir',
  )
  await writeFile(join(root, 'src', 'app.css'), '@import "tailwindcss";\n')
  clearDesignSystemCache()

  const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
  if (!loaded.ok) throw new Error('design system did not load')

  proseOf = (text: string) => {
    const candidate: Candidate = { text, range: { start: 0, end: text.length }, index: 0 }
    return explainCandidates([candidate], loaded.ds).flatMap((g) => g.classes)[0]?.prose
  }
})

describe('curated prose against the real design system', () => {
  it.each([
    ['container', 'full width, but never wider than the current breakpoint'],
    ['from-blue-500', 'the colour a gradient starts from'],
    ['via-purple-500', 'the colour a gradient passes through'],
    ['to-pink-500', 'the colour a gradient ends at'],
    ['ring-inset', 'draws the ring inside the edge rather than outside it'],
    ['space-x-reverse', 'reverses which side the horizontal gap is added to'],
    ['divide-red-500', 'the colour of the dividing lines between children'],
  ])('describes %s', (text, expected) => {
    expect(proseOf(text)).toBe(expected)
  })
})

describe('roots that carry two different meanings', () => {
  it('keeps divide-y describing the lines rather than their colour', () => {
    expect(proseOf('divide-y')).toBe('horizontal dividing lines between children, except the last')
  })

  it('keeps divide-x describing the lines rather than their colour', () => {
    expect(proseOf('divide-x')).toBe('vertical dividing lines between children, except the last')
  })

  it('keeps font-bold describing weight, since it shares the font root', () => {
    expect(proseOf('font-bold')).toBe('font weight 700')
  })

  it('names the font stack rather than reciting every family', () => {
    expect(proseOf('font-mono')).toMatch(/font stack$/)
  })

  it('says nothing about a ring offset, since the root also sets its colour', () => {
    expect(proseOf('ring-offset-2')).toBeNull()
    expect(proseOf('ring-offset-white')).toBeNull()
  })
})

describe('utilities that switch an effect off', () => {
  it.each([
    ['blur-none', 'no blur'],
    ['transition-none', 'no transition'],
    ['shadow-none', 'no drop shadow'],
    ['ring-0', 'no ring'],
    ['backdrop-filter-none', 'no backdrop filters applied'],
  ])('describes %s as the removal it is', (text, expected) => {
    expect(proseOf(text)).toBe(expected)
  })
})

describe('utilities whose value the override can read', () => {
  it('states the amount a scale utility scales by', () => {
    expect(proseOf('scale-95')).toBe('scaled to 95%')
  })

  it('states the width a border utility sets', () => {
    expect(proseOf('border-2')).toBe('2px border on all sides')
  })
})
