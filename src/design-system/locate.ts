import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

function requireFrom(directoryOrFile: string): NodeJS.Require {
  return createRequire(join(directoryOrFile, 'noop.js'))
}

export function locateTailwind(activeFile: string, workspaceRoot: string): string | null {
  for (const from of [dirname(activeFile), workspaceRoot]) {
    try {
      return dirname(requireFrom(from).resolve('tailwindcss/package.json'))
    } catch {
      // keep looking
    }
  }
  return null
}

export function resolveStylesheet(id: string, base: string, tailwind: string): string {
  if (id === 'tailwindcss') return join(tailwind, 'index.css')
  if (id.startsWith('.') || id.startsWith('/')) return join(base, id)

  for (const candidate of [id, `${id}.css`, `${id}/index.css`]) {
    try {
      return requireFrom(base).resolve(candidate)
    } catch {
      // try the next shape
    }
  }

  return join(base, id)
}
