import { describe, expect, it } from 'vitest'
import { detectClassString } from './detect/index'
import { type OrderPort, sortClassString } from './sort'

const ORDER: Record<string, number> = {
  'sr-only': 0,
  '-mt-2': 1,
  flex: 2,
  'items-center': 3,
  'bg-blue-600': 4,
  'p-4': 5,
  'text-white': 6,
  'hover:bg-blue-700': 7,
  'md:flex': 8,
}

const port: OrderPort = {
  getClassOrder: (classes) => classes.map((name) => [name, ORDER[name] ?? null]),
}

function locate(text: string, needle: string) {
  const location = detectClassString({
    text,
    offset: text.indexOf(needle) + 1,
    uri: 'file:///a.tsx',
    languageId: 'typescriptreact',
  })
  if (location === null) throw new Error(`no class string found around "${needle}"`)
  return location
}

function sorted(text: string, needle: string): string {
  const edit = sortClassString(text, locate(text, needle), port)
  if (edit === null) return text
  return text.slice(0, edit.start) + edit.newText + text.slice(edit.end)
}

describe('sortClassString', () => {
  it('puts the classes into the order Tailwind reports', () => {
    const text = '<div className="text-white p-4 flex bg-blue-600" />'

    expect(sorted(text, 'text-white')).toBe('<div className="flex bg-blue-600 p-4 text-white" />')
  })

  it('reports no edit when the classes are already in order', () => {
    const text = '<div className="flex bg-blue-600 p-4 text-white" />'

    expect(sortClassString(text, locate(text, 'flex'), port)).toBeNull()
  })

  it('keeps classes Tailwind does not know at the front, in the order they were written', () => {
    const text = '<div className="p-4 my-widget flex other-thing" />'

    expect(sorted(text, 'p-4')).toBe('<div className="my-widget other-thing flex p-4" />')
  })

  it('keeps a wrapped class string wrapped by reusing its separators', () => {
    const text = '<div\n  className="text-white\n    p-4\n    flex"\n/>'

    expect(sorted(text, 'text-white')).toBe('<div\n  className="flex\n    p-4\n    text-white"\n/>')
  })

  it('keeps duplicates rather than quietly dropping one', () => {
    const text = '<div className="p-4 flex p-4" />'

    expect(sorted(text, 'p-4')).toBe('<div className="flex p-4 p-4" />')
  })

  it('reports no edit for a single class', () => {
    const text = '<div className="flex" />'

    expect(sortClassString(text, locate(text, 'flex'), port)).toBeNull()
  })

  it('reports no edit for an empty class string', () => {
    const text = '<div className="" />'
    const location = detectClassString({
      text,
      offset: text.indexOf('""') + 1,
      uri: 'file:///a.tsx',
      languageId: 'typescriptreact',
    })

    expect(sortClassString(text, location as never, port)).toBeNull()
  })

  it('edits only the span between the first and last class', () => {
    const text = '<div className="  text-white flex  " />'
    const edit = sortClassString(text, locate(text, 'text-white'), port)

    expect(text.slice(edit?.start, edit?.end)).toBe('text-white flex')
    expect(edit?.newText).toBe('flex text-white')
  })
})
