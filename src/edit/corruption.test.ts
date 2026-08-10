import { describe, expect, it } from 'vitest'
import { detectClassString } from '../detect/index'
import { removeCandidate, replaceCandidate } from './writeback'

function apply(text: string, edit: { start: number; end: number; newText: string } | null): string {
  if (edit === null) return text
  return text.slice(0, edit.start) + edit.newText + text.slice(edit.end)
}

function locate(text: string, needle: string, languageId = 'typescriptreact') {
  const location = detectClassString({
    text,
    offset: text.indexOf(needle) + 1,
    uri: 'file:///a.tsx',
    languageId,
  })
  if (location === null) throw new Error(`nothing detected around "${needle}"`)
  return location
}

describe('removing a class never deletes anything else', () => {
  it('leaves a template-literal interpolation in place', () => {
    const text = '<div className={`flex ${gap} p-4`} />'
    const edit = removeCandidate(text, locate(text, 'p-4'), 1)

    expect(apply(text, edit)).toBe('<div className={`flex ${gap}`} />')
  })

  it('leaves the interpolation in place when removing the first class', () => {
    const text = '<div className={`flex ${gap} p-4`} />'
    const edit = removeCandidate(text, locate(text, 'flex'), 0)

    expect(apply(text, edit)).toBe('<div className={`${gap} p-4`} />')
  })

  it('leaves an interpolation inside a helper call in place', () => {
    const text = 'const c = cn(`flex ${size} p-4`)'
    const edit = removeCandidate(text, locate(text, 'flex'), 0)

    expect(apply(text, edit)).toBe('const c = cn(`${size} p-4`)')
  })

  it('still collapses ordinary spacing between two classes', () => {
    const text = '<div className="flex gap-2 p-4" />'
    const edit = removeCandidate(text, locate(text, 'gap-2'), 1)

    expect(apply(text, edit)).toBe('<div className="flex p-4" />')
  })

  it('still keeps a wrapped class string wrapped', () => {
    const text = '<div className="flex\n  gap-2\n  p-4" />'
    const edit = removeCandidate(text, locate(text, 'gap-2'), 1)

    expect(apply(text, edit)).toBe('<div className="flex\n  p-4" />')
  })
})

describe('an escaped quote does not shift the string boundary', () => {
  it('reads the whole class when the value contains an escaped quote', () => {
    const text = "const c = clsx('flex', 'before:content-[\\'x\\']')"
    const location = locate(text, 'before')

    expect(location.candidates.map((c) => c.text)).toEqual(["before:content-[\\'x\\']"])
  })

  it('never offers source code as a class', () => {
    const text = "const c = cn('a\\'b',x,'flex p-4')"
    const found = detectClassString({
      text,
      offset: text.indexOf(',x,') + 1,
      uri: 'file:///a.tsx',
      languageId: 'typescriptreact',
    })

    expect(found?.candidates.map((c) => c.text) ?? []).not.toContain(',x,')
  })

  it('still finds a later string once an earlier one contains an escape', () => {
    const text = "const c = cn('a\\'b', 'flex p-4')"
    const location = locate(text, 'p-4')

    expect(location.candidates.map((c) => c.text)).toEqual(['flex', 'p-4'])
  })

  it('does not corrupt the source when replacing a class beside an escaped quote', () => {
    const text = '<div className={"before:content-[\\"x\\"]"} />'
    const location = locate(text, 'before')
    const edit = replaceCandidate(location, 0, 'flex')

    expect(apply(text, edit)).toBe('<div className={"flex"} />')
  })
})

describe('a Svelte class directive stops at the directive name', () => {
  it('does not swallow a self-closing slash', () => {
    const text = '<div class:active/>'
    const location = locate(text, 'active', 'svelte')

    expect(location.candidates.map((c) => c.text)).toEqual(['active'])
  })

  it('does not fire inside an unrelated attribute value', () => {
    const text = '<div title="class:foo"></div>'
    const found = detectClassString({
      text,
      offset: text.indexOf('foo') + 1,
      uri: 'file:///a.svelte',
      languageId: 'svelte',
    })

    expect(found).toBeNull()
  })

  it('still reads a normal directive', () => {
    const text = '<div class:active={isActive}>x</div>'
    const location = locate(text, 'active', 'svelte')

    expect(location.candidates.map((c) => c.text)).toEqual(['active'])
  })

  it('still reads a directive with a dash in the name', () => {
    const text = '<div class:bg-red-500={isOn}>x</div>'
    const location = locate(text, 'bg-red', 'svelte')

    expect(location.candidates.map((c) => c.text)).toEqual(['bg-red-500'])
  })
})
