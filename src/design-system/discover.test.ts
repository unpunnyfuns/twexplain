import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { discoverCssEntry } from './discover'

const fixture = (name: string): string => join(__dirname, '__fixtures__', name)

describe('discoverCssEntry', () => {
  it('finds the single entry', async () => {
    const root = fixture('standard')
    const found = await discoverCssEntry(root, join(root, 'src', 'App.tsx'))
    expect(found).toBe(join(root, 'src', 'app.css'))
  })

  it('picks the entry nearest the active file in a monorepo', async () => {
    const root = fixture('monorepo')
    const found = await discoverCssEntry(root, join(root, 'apps', 'docs', 'src', 'Page.tsx'))
    expect(found).toBe(join(root, 'apps', 'docs', 'src', 'docs.css'))
  })

  it('returns null when no entry exists', async () => {
    const root = fixture('none')
    expect(await discoverCssEntry(root, join(root, 'src', 'App.tsx'))).toBeNull()
  })
})
