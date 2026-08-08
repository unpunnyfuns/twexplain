import { loadDesignSystem } from './design-system/load'
import { detectClassString } from './detect/index'
import type { TextEdit } from './edit/writeback'
import type { Candidate, ClassStringLocation } from './types'

export type OrderPort = {
  getClassOrder(classes: string[]): [string, bigint | number | null][]
}

function ranked(candidates: Candidate[], port: OrderPort): Candidate[] {
  const order = new Map<string, bigint | number>()
  for (const [name, position] of port.getClassOrder(candidates.map((c) => c.text))) {
    if (position !== null && !order.has(name)) order.set(name, position)
  }

  const unknown = candidates.filter((c) => !order.has(c.text))
  const known = candidates
    .filter((c) => order.has(c.text))
    .sort((a, b) => {
      const left = order.get(a.text) as bigint | number
      const right = order.get(b.text) as bigint | number
      if (left === right) return 0
      return left < right ? -1 : 1
    })

  return [...unknown, ...known]
}

export function sortClassString(
  text: string,
  location: ClassStringLocation | null,
  port: OrderPort,
): TextEdit | null {
  if (location === null) return null

  const candidates = location.candidates
  const first = candidates[0]
  const last = candidates.at(-1)
  if (first === undefined || last === undefined || candidates.length < 2) return null

  const separators = candidates
    .slice(0, -1)
    .map((candidate, index) =>
      text.slice(candidate.range.end, (candidates[index + 1] as Candidate).range.start),
    )

  const order = ranked(candidates, port)
  const newText = order
    .map((candidate, index) => `${candidate.text}${separators[index] ?? ''}`)
    .join('')

  const start = first.range.start
  const end = last.range.end
  if (newText === text.slice(start, end)) return null

  return { start, end, newText }
}

export type SortInput = {
  text: string
  offset: number
  uri: string
  workspaceRoot: string | null
  fsPath: string
  languageId: string
}

export async function resolveSort(input: SortInput): Promise<TextEdit | null> {
  if (input.workspaceRoot === null) return null

  const location = detectClassString(input)
  if (location === null) return null

  const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
  if (!loaded.ok) return null

  return sortClassString(input.text, location, loaded.ds)
}
