import { loadDesignSystem } from './design-system/load'

export const MAX_SUGGESTIONS = 50

export type SearchInput = {
  workspaceRoot: string | null
  fsPath: string
}

type ClassSource = { getClassList(): Iterable<[string, unknown]> }

const LOWERED = new WeakMap<object, { name: string; lowered: string }[]>()

function classNames(ds: ClassSource): { name: string; lowered: string }[] {
  const cached = LOWERED.get(ds)
  if (cached !== undefined) return cached

  const names: { name: string; lowered: string }[] = []
  for (const [name] of ds.getClassList()) names.push({ name, lowered: name.toLowerCase() })
  LOWERED.set(ds, names)
  return names
}

export async function searchClasses(input: SearchInput, query: string): Promise<string[]> {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  if (input.workspaceRoot === null) return []

  const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
  if (!loaded.ok) return []

  const prefixed: string[] = []
  const contained: string[] = []

  for (const { name, lowered } of classNames(loaded.ds)) {
    if (lowered.startsWith(needle)) prefixed.push(name)
    else if (contained.length < MAX_SUGGESTIONS && lowered.includes(needle)) contained.push(name)
    if (prefixed.length >= MAX_SUGGESTIONS) break
  }

  return [...prefixed, ...contained].slice(0, MAX_SUGGESTIONS)
}
