import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { DesignSystemPort } from '../explain/index'
import { discoverCssEntry } from './discover'
import { isSupportedVersion, readTailwindVersion } from './version'

export type LoadResult =
  | { ok: true; ds: DesignSystemPort; entry: string }
  | { ok: false; reason: 'no-tailwind' | 'wrong-version' | 'no-entry' | 'error'; detail?: string }

const cache = new Map<string, LoadResult>()

export function clearDesignSystemCache(): void {
  cache.clear()
}

async function importTailwind(workspaceRoot: string): Promise<{
  __unstable__loadDesignSystem: (
    css: string,
    options: {
      base: string
      loadStylesheet: (id: string, base: string) => Promise<{ base: string; content: string }>
      loadModule: () => Promise<{ module: unknown; base: string }>
    },
  ) => Promise<DesignSystemPort>
}> {
  const lib = join(workspaceRoot, 'node_modules', 'tailwindcss', 'dist', 'lib.mjs')
  return (await import(pathToFileURL(lib).href)) as never
}

export async function loadDesignSystem(
  workspaceRoot: string,
  activeFile: string,
): Promise<LoadResult> {
  const version = await readTailwindVersion(workspaceRoot)
  if (version === null) return { ok: false, reason: 'no-tailwind' }
  if (!isSupportedVersion(version)) {
    return { ok: false, reason: 'wrong-version', detail: version }
  }

  const entry = await discoverCssEntry(workspaceRoot, activeFile)
  if (entry === null) return { ok: false, reason: 'no-entry' }

  const key = `${entry}\0${version}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const result = await buildDesignSystem(workspaceRoot, entry)
  cache.set(key, result)
  return result
}

async function buildDesignSystem(workspaceRoot: string, entry: string): Promise<LoadResult> {
  try {
    const { __unstable__loadDesignSystem } = await importTailwind(workspaceRoot)
    const css = await readFile(entry, 'utf8')

    const ds = await __unstable__loadDesignSystem(css, {
      base: dirname(entry),
      loadStylesheet: async (id, base) => {
        const path =
          id === 'tailwindcss'
            ? join(workspaceRoot, 'node_modules', 'tailwindcss', 'index.css')
            : id.startsWith('tailwindcss/')
              ? join(workspaceRoot, 'node_modules', `${id}.css`)
              : isAbsolute(id)
                ? id
                : resolvePath(base, id)
        return { base: dirname(path), content: await readFile(path, 'utf8') }
      },
      loadModule: async () => ({ module: {}, base: dirname(entry) }),
    })

    return { ok: true, ds, entry }
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
