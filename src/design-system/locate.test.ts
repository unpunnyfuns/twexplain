import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { locateTailwind, resolveStylesheet } from './locate'

const repo = process.cwd()

describe('locateTailwind', () => {
  it('finds the install above the file, the way node resolution does', () => {
    const found = locateTailwind(join(repo, 'src', 'panel.ts'), repo)

    expect(found).toBe(join(repo, 'node_modules', 'tailwindcss'))
  })

  it('returns null when there is nothing to find', () => {
    expect(locateTailwind('/nowhere/at/all/App.tsx', '/nowhere/at/all')).toBeNull()
  })

  it('falls back to the workspace root when the file sits outside it', () => {
    expect(locateTailwind('/nowhere/App.tsx', repo)).toBe(join(repo, 'node_modules', 'tailwindcss'))
  })
})

describe('resolveStylesheet', () => {
  const tailwind = join(repo, 'node_modules', 'tailwindcss')

  it('maps the bare tailwindcss import to its stylesheet, not its JavaScript', () => {
    expect(resolveStylesheet('tailwindcss', repo, tailwind)).toBe(join(tailwind, 'index.css'))
  })

  it('resolves a subpath of a package', () => {
    expect(resolveStylesheet('tailwindcss/theme.css', repo, tailwind)).toBe(
      join(tailwind, 'theme.css'),
    )
  })

  it('leaves a relative import relative to the importing file', () => {
    expect(resolveStylesheet('./local.css', join(repo, 'src'), tailwind)).toBe(
      join(repo, 'src', 'local.css'),
    )
  })

  it('returns a path for something unresolvable, so the read reports it', () => {
    const path = resolveStylesheet('@nope/missing.css', repo, tailwind)

    expect(path).toContain('@nope/missing.css')
  })
})
