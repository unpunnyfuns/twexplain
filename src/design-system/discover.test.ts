import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearDesignSystemCache } from './load'
import {
  clearEntryCache,
  discoverCssEntry,
  findEntryCandidates,
  pickNearestEntry,
} from './discover'

const fixture = (name: string): string => join(__dirname, '__fixtures__', name)

async function makeWorkspace(entries: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'twexplain-discover-'))
  for (const relative of entries) {
    const path = join(root, relative)
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, '@import "tailwindcss";\n')
  }
  return root
}

beforeEach(() => {
  clearEntryCache()
})

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

describe('findEntryCandidates', () => {
  it('walks the workspace once and reuses the result', async () => {
    const root = await makeWorkspace(['src/app.css'])
    expect(await findEntryCandidates(root)).toEqual([join(root, 'src', 'app.css')])

    await writeFile(join(root, 'src', 'later.css'), '@import "tailwindcss";\n')

    expect(await findEntryCandidates(root)).toEqual([join(root, 'src', 'app.css')])
  })

  it('re-walks after the cache is cleared', async () => {
    const root = await makeWorkspace(['src/app.css'])
    await findEntryCandidates(root)

    await writeFile(join(root, 'src', 'later.css'), '@import "tailwindcss";\n')
    clearEntryCache()

    expect(await findEntryCandidates(root)).toHaveLength(2)
  })

  it('caches per workspace rather than globally', async () => {
    const first = await makeWorkspace(['a.css'])
    const second = await makeWorkspace(['b.css'])

    expect(await findEntryCandidates(first)).toEqual([join(first, 'a.css')])
    expect(await findEntryCandidates(second)).toEqual([join(second, 'b.css')])
  })

  it('caches a negative result without re-walking', async () => {
    const root = await makeWorkspace([])
    expect(await findEntryCandidates(root)).toEqual([])

    await writeFile(join(root, 'late.css'), '@import "tailwindcss";\n')

    expect(await findEntryCandidates(root)).toEqual([])
  })
})

describe('pickNearestEntry', () => {
  it('returns null when there are no candidates', () => {
    expect(pickNearestEntry([], '/ws/src/App.tsx')).toBeNull()
  })

  it('returns the only candidate', () => {
    expect(pickNearestEntry(['/ws/src/app.css'], '/ws/src/App.tsx')).toBe('/ws/src/app.css')
  })

  it('prefers the candidate sharing the longest path-segment prefix', () => {
    const candidates = ['/ws/apps/web/src/web.css', '/ws/apps/docs/src/docs.css']
    expect(pickNearestEntry(candidates, '/ws/apps/docs/src/Page.tsx')).toBe(
      '/ws/apps/docs/src/docs.css',
    )
  })

  it('compares whole path segments, not raw characters', () => {
    const candidates = ['/ws/apps/web/app.css', '/ws/apps/website/app.css']
    expect(pickNearestEntry(candidates, '/ws/apps/website/Page.tsx')).toBe(
      '/ws/apps/website/app.css',
    )
  })
})

describe('clearDesignSystemCache', () => {
  it('also clears the entry-candidate cache so the CSS watcher invalidates both', async () => {
    const root = await makeWorkspace(['src/app.css'])
    await findEntryCandidates(root)

    await writeFile(join(root, 'src', 'later.css'), '@import "tailwindcss";\n')
    clearDesignSystemCache()

    expect(await findEntryCandidates(root)).toHaveLength(2)
  })
})

describe('discoverCssEntry with individual imports', () => {
  it("recognises Tailwind's documented per-layer import setup as an entry", async () => {
    const root = fixture('individual')
    const found = await discoverCssEntry(root, join(root, 'src', 'App.tsx'))
    expect(found).toBe(join(root, 'src', 'app.css'))
  })

  it('does not treat an unrelated css import as a Tailwind entry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'twexplain-unrelated-'))
    await writeFile(join(root, 'a.css'), '@import "normalize.css";\n')
    expect(await discoverCssEntry(root, join(root, 'App.tsx'))).toBeNull()
  })
})

describe('findEntryCandidates pruning', () => {
  it('does not walk into node_modules, dist, out, .git or .vscode-test', async () => {
    const root = await mkdtemp(join(tmpdir(), 'twexplain-pruned-'))
    for (const dir of ['node_modules', 'dist', 'out', '.git', '.vscode-test']) {
      await mkdir(join(root, dir), { recursive: true })
      await writeFile(join(root, dir, 'buried.css'), '@import "tailwindcss";\n')
    }

    expect(await findEntryCandidates(root)).toEqual([])
  })

  it('still finds an entry beside the pruned directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'twexplain-pruned-sibling-'))
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'buried.css'), '@import "tailwindcss";\n')
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src', 'app.css'), '@import "tailwindcss";\n')

    expect(await findEntryCandidates(root)).toEqual([join(root, 'src', 'app.css')])
  })
})
