import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache, loadDesignSystem } from '../design-system/load'
import type { Candidate } from '../types'
import { CORPUS } from './corpus'
import { explainCandidates } from './index'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'twexplain-golden-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(
    join(process.cwd(), 'node_modules', 'tailwindcss'),
    join(root, 'node_modules', 'tailwindcss'),
    'dir',
  )
  await writeFile(
    join(root, 'src', 'app.css'),
    '@import "tailwindcss";\n@theme { --color-brand-600: #4f46e5; }\n',
  )
  clearDesignSystemCache()
})

describe('explain pipeline golden corpus', () => {
  it('matches the recorded output for the whole corpus', async () => {
    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const candidates: Candidate[] = CORPUS.map((text, index) => ({
      text,
      range: { start: 0, end: text.length },
      index,
    }))

    const groups = explainCandidates(candidates, loaded.ds)
    const byIndex = new Map(groups.flatMap((g) => g.classes).map((c) => [c.candidate.index, c]))

    const report = CORPUS.map((text, index) => {
      const explained = byIndex.get(index)
      if (explained === undefined) return `${text}\n  MISSING`
      if (!explained.valid) return `${text}\n  [invalid]`
      const fallback =
        explained.declarations.length === 0
          ? '[no prose — internal variables only]'
          : '[no prose — raw CSS shown]'
      const prose = explained.prose ?? fallback
      const declarations = explained.declarations
        .map((d) => `    ${d.prop}: ${d.value}`)
        .join('\n')
      return `${text}\n  group: ${explained.group}\n  prose: ${prose}\n${declarations}`
    }).join('\n\n')

    await expect(report).toMatchFileSnapshot('./__golden__/corpus.txt')
  })
})
