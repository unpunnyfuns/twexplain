import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function readTailwindVersion(workspaceRoot: string): Promise<string | null> {
  const path = join(workspaceRoot, 'node_modules', 'tailwindcss', 'package.json')
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    const version = (parsed as { version?: unknown }).version
    return typeof version === 'string' ? version : null
  } catch {
    return null
  }
}

export function isSupportedVersion(version: string): boolean {
  return version.split('.')[0] === '4'
}
