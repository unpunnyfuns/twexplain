import { loadDesignSystem } from './design-system/load'
import { detectJsx } from './detect/jsx'
import { explainCandidates } from './explain/index'
import type { PaletteColor, PanelState } from './types'

export type StateInput = {
  text: string
  offset: number
  uri: string
  workspaceRoot: string | null
  fsPath: string
}

function paletteFrom(ds: {
  theme: { namespace(prefix: string): Iterable<[string, string]> }
}): PaletteColor[] {
  return Array.from(ds.theme.namespace('--color'), ([name, value]) => ({ name, value }))
}

export async function computeState(input: StateInput): Promise<PanelState> {
  const location = detectJsx(input.text, input.offset, input.uri)
  if (location === null) return { status: 'no-selection' }
  if (input.workspaceRoot === null) return { status: 'no-workspace-tailwind' }

  const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
  if (!loaded.ok) {
    if (loaded.reason === 'no-tailwind') return { status: 'no-workspace-tailwind' }
    if (loaded.reason === 'wrong-version') {
      return { status: 'wrong-version', found: loaded.detail ?? 'unknown' }
    }
    if (loaded.reason === 'no-entry') return { status: 'no-css-entry' }
    if (loaded.reason === 'unsupported-plugin') return { status: 'unsupported-plugin' }
    if (loaded.reason === 'stale-runtime') return { status: 'stale-runtime' }
    return { status: 'load-error', message: loaded.detail ?? 'unknown error' }
  }

  return {
    status: 'ready',
    groups: explainCandidates(location.candidates, loaded.ds),
    palette: paletteFrom(loaded.ds),
  }
}
