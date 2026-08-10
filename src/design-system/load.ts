import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { EditPort, SearchPort, ThemePort, VariantPort } from '../edit/mutate'
import type { DesignSystemPort } from '../explain/index'
import type { OrderPort } from '../sort'
import { clearEntryCache, discoverCssEntry } from './discover'
import { isSupportedVersion, readTailwindVersion } from './version'

export type LoadResult =
  | {
      ok: true
      ds: DesignSystemPort & EditPort & ThemePort & SearchPort & VariantPort & OrderPort
      entry: string
    }
  | {
      ok: false
      reason:
        | 'no-tailwind'
        | 'wrong-version'
        | 'no-entry'
        | 'unsupported-plugin'
        | 'unsupported-config'
        | 'stale-runtime'
        | 'error'
      detail?: string
    }

const PLUGIN_DIRECTIVE = /@plugin\s+['"]/
const CONFIG_DIRECTIVE = /@config\s+['"]/

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, ' ')
}

export function hasPluginDirective(css: string): boolean {
  return PLUGIN_DIRECTIVE.test(stripComments(css))
}

export function hasConfigDirective(css: string): boolean {
  return CONFIG_DIRECTIVE.test(stripComments(css))
}

const cache = new Map<string, LoadResult>()
const importedVersions = new Map<string, string>()

export function clearDesignSystemCache(): void {
  cache.clear()
  clearEntryCache()
}

async function importTailwind(workspaceRoot: string): Promise<{
  __unstable__loadDesignSystem: (
    css: string,
    options: {
      base: string
      loadStylesheet: (id: string, base: string) => Promise<{ base: string; content: string }>
      loadModule: () => Promise<{ module: unknown; base: string }>
    },
  ) => Promise<DesignSystemPort & EditPort & ThemePort & SearchPort & VariantPort & OrderPort>
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

  const imported = importedVersions.get(workspaceRoot)
  if (imported !== undefined && imported !== version) {
    return {
      ok: false,
      reason: 'stale-runtime',
      detail: `loaded ${imported}, now ${version}`,
    }
  }

  const entry = await discoverCssEntry(workspaceRoot, activeFile)
  if (entry === null) return { ok: false, reason: 'no-entry' }

  const key = `${entry}\0${version}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const result = await buildDesignSystem(workspaceRoot, entry)
  if (result.ok) importedVersions.set(workspaceRoot, version)
  if (result.ok || result.reason !== 'error') cache.set(key, result)
  return result
}

async function buildDesignSystem(workspaceRoot: string, entry: string): Promise<LoadResult> {
  let sawPlugin = false
  let sawConfig = false

  try {
    const { __unstable__loadDesignSystem } = await importTailwind(workspaceRoot)
    const css = await readFile(entry, 'utf8')
    if (hasPluginDirective(css)) return { ok: false, reason: 'unsupported-plugin' }
    if (hasConfigDirective(css)) return { ok: false, reason: 'unsupported-config' }

    const ds = await __unstable__loadDesignSystem(css, {
      base: dirname(entry),
      loadStylesheet: async (id, base) => {
        const path =
          id === 'tailwindcss'
            ? join(workspaceRoot, 'node_modules', 'tailwindcss', 'index.css')
            : id.startsWith('tailwindcss/')
              ? join(workspaceRoot, 'node_modules', id.endsWith('.css') ? id : `${id}.css`)
              : isAbsolute(id)
                ? id
                : resolvePath(base, id)
        const content = await readFile(path, 'utf8')
        if (hasPluginDirective(content)) sawPlugin = true
        if (hasConfigDirective(content)) sawConfig = true
        return { base: dirname(path), content }
      },
      loadModule: async () => ({ module: {}, base: dirname(entry) }),
    })

    if (sawPlugin) return { ok: false, reason: 'unsupported-plugin' }
    if (sawConfig) return { ok: false, reason: 'unsupported-config' }

    return { ok: true, ds, entry }
  } catch (error) {
    if (sawPlugin) return { ok: false, reason: 'unsupported-plugin' }
    return {
      ok: false,
      reason: 'error',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
