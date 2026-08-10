import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FUNCTIONS } from './detect/names'

const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8')
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  contributes: {
    commands: { title: string }[]
    configuration: { properties: Record<string, unknown> }
  }
  engines: { vscode: string }
}

describe('the listing names the commands that exist', () => {
  it.each(manifest.contributes.commands.map((c) => c.title))('documents %s', (title) => {
    expect(readme).toContain(title)
  })

  it('claims no command the manifest does not contribute', () => {
    const titles = manifest.contributes.commands.map((c) => c.title)
    const table = readme.slice(readme.indexOf('## Commands'), readme.indexOf('## Languages'))
    const claimed = [...table.matchAll(/^\| (?!Command)([A-Z][^|]*?) \|/gm)].map((m) =>
      (m[1] as string).trim(),
    )

    expect(claimed.sort()).toEqual(titles.sort())
  })
})

describe('the listing names the helper calls that are detected', () => {
  it.each(DEFAULT_FUNCTIONS)('documents %s', (name) => {
    expect(readme).toContain(`\`${name}\``)
  })

  it('claims no helper that is not detected', () => {
    const sentence = /Class strings inside (.+?) are detected/s.exec(readme)?.[1] ?? ''
    const claimed = [...sentence.matchAll(/`([^`]+)`/g)].map((m) => m[1] as string)

    expect(claimed.sort()).toEqual([...DEFAULT_FUNCTIONS].sort())
  })
})

describe('the listing names the settings that are read', () => {
  it.each(['rootFontSize', 'showPixelEquivalents', 'classAttributes', 'classFunctions'])(
    'documents tailwindCSS.%s',
    (key) => {
      expect(readme).toContain(`tailwindCSS.${key}`)
    },
  )

  it.each(Object.keys(manifest.contributes.configuration.properties))(
    'documents the contributed setting %s',
    (key) => {
      expect(readme).toContain(key)
    },
  )
})

describe('the listing quotes the panel accurately', () => {
  const classRow = readFileSync(join(process.cwd(), 'src', 'webview', 'ClassRow.tsx'), 'utf8')

  it.each(['no plain-English entry yet', 'sets only Tailwind-internal variables'])(
    'quotes %s as the panel writes it',
    (text) => {
      expect(classRow).toContain(text)
      expect(readme).toContain(text)
    },
  )
})

describe('the listing states the right requirements', () => {
  it('says Tailwind v4, which is what the loader accepts', async () => {
    const { isSupportedVersion } = await import('./design-system/version')

    expect(readme).toContain('Tailwind v4')
    expect(isSupportedVersion('4.3.3')).toBe(true)
    expect(isSupportedVersion('3.4.1')).toBe(false)
  })

  it('says virtual and untrusted workspaces are unsupported, matching the manifest', () => {
    const capabilities = (
      JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
        capabilities: Record<string, { supported: boolean }>
      }
    ).capabilities

    expect(capabilities.virtualWorkspaces?.supported).toBe(false)
    expect(capabilities.untrustedWorkspaces?.supported).toBe(false)
    expect(readme).toMatch(/[Vv]irtual and untrusted workspaces are not supported/)
  })
})

describe('the changelog keeps up with the version', () => {
  const changelog = readFileSync(join(process.cwd(), 'CHANGELOG.md'), 'utf8')
  const version = (
    JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version: string }
  ).version

  it('has an entry for the version about to be released', () => {
    expect(changelog).toContain(`## [${version}]`)
  })

  it('has that entry at the top, so the newest release is the one you read first', () => {
    const headings = [...changelog.matchAll(/^## \[([^\]]+)\]/gm)].map((m) => m[1] as string)

    expect(headings[0]).toBe(version)
  })

  it('dates every entry', () => {
    const entries = [...changelog.matchAll(/^## \[[^\]]+\](.*)$/gm)].map((m) => m[1] as string)

    for (const entry of entries) expect(entry).toMatch(/\d{4}-\d{2}-\d{2}/)
  })
})
