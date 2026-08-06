import { describe, expect, it } from 'vitest'
import { detectJsx } from '../detect/jsx'
import type { ClassStringLocation } from '../types'
import { addCandidate, removeCandidate, replaceCandidate } from './writeback'

type TextEdit = { start: number; end: number; newText: string }

function applyEdit(text: string, edit: TextEdit | null): string {
  if (edit === null) return text
  return text.slice(0, edit.start) + edit.newText + text.slice(edit.end)
}

function locate(source: string, needle: string): ClassStringLocation {
  const found = detectJsx(source, source.indexOf(needle), 'file:///a.tsx')
  if (found === null) throw new Error(`no class string around ${needle}`)
  return found
}

function indexOfCandidate(location: ClassStringLocation, text: string): number {
  const candidate = location.candidates.find((c) => c.text === text)
  if (candidate === undefined) throw new Error(`no candidate ${text}`)
  return candidate.index
}

describe('replaceCandidate', () => {
  it('rewrites only the targeted candidate', () => {
    const source = '<div className="flex gap-2 px-4">x</div>'
    const location = locate(source, 'gap-2')
    const edit = replaceCandidate(location, indexOfCandidate(location, 'gap-2'), 'gap-4')

    expect(applyEdit(source, edit)).toBe('<div className="flex gap-4 px-4">x</div>')
  })

  it('targets the right occurrence when the same class appears twice', () => {
    const source = '<div className="flex gap-2 flex">x</div>'
    const location = locate(source, 'flex')
    const last = location.candidates[location.candidates.length - 1]

    const edit = replaceCandidate(location, last?.index ?? -1, 'block')
    expect(applyEdit(source, edit)).toBe('<div className="flex gap-2 block">x</div>')
  })

  it('leaves surrounding expression code untouched', () => {
    const source = '<div className={cn("px-4 py-2", active && "bg-blue-600")}>x</div>'
    const location = locate(source, 'py-2')
    const edit = replaceCandidate(location, indexOfCandidate(location, 'py-2'), 'py-4')

    expect(applyEdit(source, edit)).toBe(
      '<div className={cn("px-4 py-4", active && "bg-blue-600")}>x</div>',
    )
  })

  it('returns null for an unknown index', () => {
    const source = '<div className="flex">x</div>'
    expect(replaceCandidate(locate(source, 'flex'), 99, 'block')).toBeNull()
  })
})

describe('removeCandidate', () => {
  it('removes a middle candidate and collapses exactly one space', () => {
    const source = '<div className="flex gap-2 px-4">x</div>'
    const location = locate(source, 'gap-2')
    const edit = removeCandidate(source, location, indexOfCandidate(location, 'gap-2'))

    expect(applyEdit(source, edit)).toBe('<div className="flex px-4">x</div>')
  })

  it('removes the first candidate without leaving a leading space', () => {
    const source = '<div className="flex gap-2">x</div>'
    const location = locate(source, 'flex')
    const edit = removeCandidate(source, location, indexOfCandidate(location, 'flex'))

    expect(applyEdit(source, edit)).toBe('<div className="gap-2">x</div>')
  })

  it('removes the last candidate without leaving a trailing space', () => {
    const source = '<div className="flex gap-2">x</div>'
    const location = locate(source, 'gap-2')
    const edit = removeCandidate(source, location, indexOfCandidate(location, 'gap-2'))

    expect(applyEdit(source, edit)).toBe('<div className="flex">x</div>')
  })

  it('leaves an empty string when removing the only candidate', () => {
    const source = '<div className="flex">x</div>'
    const location = locate(source, 'flex')
    const edit = removeCandidate(source, location, indexOfCandidate(location, 'flex'))

    expect(applyEdit(source, edit)).toBe('<div className="">x</div>')
  })

  it('does not disturb the conditional around it inside a helper call', () => {
    const source = '<div className={cn("px-4 py-2", active && "bg-blue-600")}>x</div>'
    const location = locate(source, 'px-4')
    const edit = removeCandidate(source, location, indexOfCandidate(location, 'px-4'))

    expect(applyEdit(source, edit)).toBe(
      '<div className={cn("py-2", active && "bg-blue-600")}>x</div>',
    )
  })
})

describe('addCandidate', () => {
  it('appends to an existing class string', () => {
    const source = '<div className="flex gap-2">x</div>'
    const edit = addCandidate(locate(source, 'flex'), 'px-4')

    expect(applyEdit(source, edit)).toBe('<div className="flex gap-2 px-4">x</div>')
  })

  it('does not add a leading space to an empty class string', () => {
    const source = '<div className="">x</div>'
    const found = detectJsx(source, source.indexOf('""') + 1, 'file:///a.tsx')
    if (found === null) throw new Error('expected an empty class string location')

    expect(applyEdit(source, addCandidate(found, 'px-4'))).toBe('<div className="px-4">x</div>')
  })

  it('refuses to add a class that is already present', () => {
    const source = '<div className="flex gap-2">x</div>'
    expect(addCandidate(locate(source, 'flex'), 'gap-2')).toBeNull()
  })
})

const SOURCES = [
  '<div className="flex gap-2 px-4">x</div>',
  "<div className='flex gap-2'>x</div>",
  '<div className={cn("px-4 py-2", active && "bg-blue-600")}>x</div>',
  '<div className={isLight ? "bg-white text-black" : "bg-black"}>x</div>',
  '<div\n  className="flex items-center\n    gap-2 px-4"\n>x</div>',
  '<a className="p-1"/><b className="m-2"/>',
]

describe('edits stay surgical', () => {
  it('changes nothing outside the candidate it targets', () => {
    for (const source of SOURCES) {
      for (const anchor of source.matchAll(/[\w-]+(?=[\s"'])/g)) {
        const location = detectJsx(source, anchor.index ?? 0, 'file:///a.tsx')
        if (location === null) continue
        const target = location.candidates.find((c) => c.range.start === anchor.index)
        if (target === undefined) continue

        const result = applyEdit(source, replaceCandidate(location, target.index, 'ZZZ'))
        const expected =
          source.slice(0, target.range.start) + 'ZZZ' + source.slice(target.range.end)

        expect(result, `${source} :: ${target.text}`).toBe(expected)
      }
    }
  })
})

describe('removal in a multi-line class string', () => {
  const multiline = '<div\n  className="flex items-center\n    gap-2 px-4"\n>x</div>'

  it('keeps the remaining classes on their original lines', () => {
    const location = locate(multiline, 'gap-2')
    const edit = removeCandidate(multiline, location, indexOfCandidate(location, 'gap-2'))

    expect(applyEdit(multiline, edit)).toBe(
      '<div\n  className="flex items-center\n    px-4"\n>x</div>',
    )
  })

  it('does not join two lines when removing the first class on a line', () => {
    const location = locate(multiline, 'items-center')
    const edit = removeCandidate(multiline, location, indexOfCandidate(location, 'items-center'))

    expect(applyEdit(multiline, edit)).toBe('<div\n  className="flex\n    gap-2 px-4"\n>x</div>')
  })
})
