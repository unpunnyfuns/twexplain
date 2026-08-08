import { describe, expect, it } from 'vitest'
import { detectClassString } from './index'
import { MAX_VALUE_LENGTH, looksLikeClassList } from './shared'

const at = (text: string, needle: string): number => text.indexOf(needle) + 2

const LINES = [
  'rounded-lg border border-slate-200 bg-white p-6 shadow-sm',
  'hover:border-slate-300 hover:shadow-md',
  'focus-within:border-blue-500 focus-within:ring-2',
  'dark:border-slate-700 dark:bg-slate-900',
  'dark:hover:border-slate-600',
  'sm:p-8 md:p-10 lg:p-12',
  'grid grid-cols-1 gap-4',
  'md:grid-cols-2 lg:grid-cols-3',
  'transition-colors duration-200',
  'motion-reduce:transition-none',
  'print:hidden',
  'first:mt-0 last:mb-0',
]
const CLASS_COUNT = LINES.join(' ').split(' ').length
const VALUE = LINES.join('\n    ')

const attribute = (name: string): string => `<div\n  ${name}="${VALUE}"\n>`

describe('class strings the formatter has wrapped', () => {
  it('reads a JSX attribute that spans more than eight lines', () => {
    const text = attribute('className')
    const found = detectClassString({
      text,
      offset: at(text, 'rounded-lg'),
      uri: 'file:///a.tsx',
      languageId: 'typescriptreact',
    })

    expect(found?.candidates.map((c) => c.text)).toContain('last:mb-0')
    expect(found?.candidates.length).toBe(CLASS_COUNT)
  })

  it('reads an HTML attribute that spans more than eight lines', () => {
    const text = attribute('class')
    const found = detectClassString({
      text,
      offset: at(text, 'rounded-lg'),
      uri: 'file:///a.html',
      languageId: 'html',
    })

    expect(found?.candidates.map((c) => c.text)).toContain('last:mb-0')
  })

  it('reads a Svelte attribute that spans more than eight lines', () => {
    const text = attribute('class')
    const found = detectClassString({
      text,
      offset: at(text, 'rounded-lg'),
      uri: 'file:///a.svelte',
      languageId: 'svelte',
    })

    expect(found?.candidates.map((c) => c.text)).toContain('last:mb-0')
  })

  it('reads a Vue attribute that spans more than eight lines', () => {
    const text = attribute('class')
    const found = detectClassString({
      text,
      offset: at(text, 'rounded-lg'),
      uri: 'file:///a.vue',
      languageId: 'vue',
    })

    expect(found?.candidates.map((c) => c.text)).toContain('last:mb-0')
  })

  it('reads an @apply rule that spans more than eight lines', () => {
    const text = `.card {\n  @apply ${LINES.join('\n    ')};\n}`
    const found = detectClassString({
      text,
      offset: at(text, 'rounded-lg'),
      uri: 'file:///a.css',
      languageId: 'css',
    })

    expect(found?.candidates.map((c) => c.text)).toContain('last:mb-0')
  })
})

describe('long expressions and helper calls', () => {
  it('reads a class string past a two-thousand character expression prefix', () => {
    const text = `<div className={cond ? "${'x'.repeat(3000)}" : "flex gap-2"} />`
    const found = detectClassString({
      text,
      offset: at(text, 'flex gap-2'),
      uri: 'file:///a.tsx',
      languageId: 'typescriptreact',
    })

    expect(found?.candidates.map((c) => c.text)).toEqual(['flex', 'gap-2'])
  })

  it('reads a class string past a four-thousand character helper-call prefix', () => {
    const text = `const s = cva("${'y'.repeat(5000)}", { variants: { size: { sm: "px-2 py-1" } } })`
    const found = detectClassString({
      text,
      offset: at(text, 'px-2 py-1'),
      uri: 'file:///a.tsx',
      languageId: 'typescriptreact',
    })

    expect(found?.candidates.map((c) => c.text)).toEqual(['px-2', 'py-1'])
  })
})

describe('guards against a value that is not a class list', () => {
  it('refuses a span that swallowed markup after an unterminated quote', () => {
    const text = '<div class="foo>\n<span>x</span>\nconst s = "bar";'
    const found = detectClassString({
      text,
      offset: at(text, 'foo'),
      uri: 'file:///a.html',
      languageId: 'html',
    })

    expect(found).toBeNull()
  })

  it('refuses a runaway span rather than offering thousands of candidates', () => {
    const text = `<div class="${'a '.repeat(4000)}">`
    const found = detectClassString({
      text,
      offset: at(text, 'a a'),
      uri: 'file:///a.html',
      languageId: 'html',
    })

    expect(found).toBeNull()
  })
})

describe('looksLikeClassList', () => {
  it('accepts a class list wrapped over many lines', () => {
    expect(looksLikeClassList(VALUE)).toBe(true)
  })

  it('accepts an empty value, which is a class attribute with nothing in it', () => {
    expect(looksLikeClassList('')).toBe(true)
  })

  it('accepts arbitrary values full of punctuation, since they still carry letters', () => {
    expect(looksLikeClassList("[&>*]:mt-2 content-['x'] max-[calc(100%-1px)]:flex")).toBe(true)
  })

  it('rejects a value carrying a tag, which means the quote never closed', () => {
    expect(looksLikeClassList('flex <span>x</span>')).toBe(false)
  })

  it('rejects a value carrying a bare operator, which no candidate can be', () => {
    expect(looksLikeClassList('flex const x = 1')).toBe(false)
  })

  it('rejects a value longer than any real class list', () => {
    expect(looksLikeClassList('a '.repeat(MAX_VALUE_LENGTH))).toBe(false)
  })
})
