import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { ICON_NAMES } from './Icon'

let stylesheet: string

beforeAll(async () => {
  const require = createRequire(join(process.cwd(), 'index.js'))
  const root = dirname(require.resolve('@vscode/codicons/package.json'))
  stylesheet = await readFile(join(root, 'dist', 'codicon.css'), 'utf8')
})

describe('every icon the panel asks for', () => {
  it.each(ICON_NAMES)('exists in the shipped codicon set: %s', (name) => {
    expect(stylesheet).toContain(`.codicon-${name}:before`)
  })

  it('fails loudly for a name the set does not have', () => {
    expect(stylesheet).not.toContain('.codicon-definitely-not-an-icon:before')
  })
})
