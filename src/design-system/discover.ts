import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'

const IGNORED = new Set(['node_modules', '.git', 'dist', 'out', '.vscode-test'])
const ENTRY_PATTERN = /@import\s+["']tailwindcss["']/

async function findCssFiles(directory: string, found: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (IGNORED.has(entry.name)) continue
      await findCssFiles(path, found)
    } else if (entry.name.endsWith('.css')) {
      found.push(path)
    }
  }
}

function sharedPrefixLength(a: string, b: string): number {
  const left = a.split(sep)
  const right = b.split(sep)
  let i = 0
  while (i < left.length && i < right.length && left[i] === right[i]) i++
  return i
}

export async function discoverCssEntry(
  workspaceRoot: string,
  activeFile: string,
): Promise<string | null> {
  const cssFiles: string[] = []
  await findCssFiles(workspaceRoot, cssFiles)

  const entries: string[] = []
  for (const path of cssFiles) {
    try {
      if (ENTRY_PATTERN.test(await readFile(path, 'utf8'))) entries.push(path)
    } catch {
      continue
    }
  }

  if (entries.length === 0) return null

  const activeDirectory = dirname(activeFile)
  return entries.reduce((best, current) =>
    sharedPrefixLength(dirname(current), activeDirectory) >
    sharedPrefixLength(dirname(best), activeDirectory)
      ? current
      : best,
  )
}
