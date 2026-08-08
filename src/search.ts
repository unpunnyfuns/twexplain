import { loadDesignSystem } from './design-system/load'

export const MAX_SUGGESTIONS = 50

export type SearchInput = {
  workspaceRoot: string | null
  fsPath: string
}

export async function searchClasses(input: SearchInput, query: string): Promise<string[]> {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  if (input.workspaceRoot === null) return []

  const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
  if (!loaded.ok) return []

  const prefixed: string[] = []
  const contained: string[] = []

  for (const [name] of loaded.ds.getClassList()) {
    const lowered = name.toLowerCase()
    if (lowered.startsWith(needle)) prefixed.push(name)
    else if (lowered.includes(needle)) contained.push(name)
    if (prefixed.length >= MAX_SUGGESTIONS) break
  }

  return [...prefixed, ...contained].slice(0, MAX_SUGGESTIONS)
}
