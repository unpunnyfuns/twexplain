import { formatDeclarations } from './explain/format'
import type { Declaration, ExplainedClass } from './types'

const NO_ROOT = '(no root)'

type Entry = { candidate: string; root: string; declarations: Declaration[] }

export type Backlog = {
  record(classes: ExplainedClass[]): void
  report(): string
  clear(): void
  size(): number
}

function needsCuration(explained: ExplainedClass): boolean {
  if (!explained.valid) return false
  if (explained.prose !== null) return false
  return explained.declarations.length > 0
}

function byRoot(entries: Entry[]): Map<string, Entry[]> {
  const grouped = new Map<string, Entry[]>()
  for (const entry of [...entries].sort((a, b) => a.candidate.localeCompare(b.candidate))) {
    const existing = grouped.get(entry.root)
    if (existing === undefined) grouped.set(entry.root, [entry])
    else existing.push(entry)
  }
  return new Map([...grouped].sort(([a], [b]) => a.localeCompare(b)))
}

function section(root: string, entries: Entry[]): string {
  const body = entries
    .map(
      (entry) =>
        `- \`${entry.candidate}\`\n\n\`\`\`css\n${formatDeclarations(entry.declarations)}\n\`\`\``,
    )
    .join('\n\n')
  return `## ${root}\n\n${body}`
}

export function createBacklog(): Backlog {
  const seen = new Map<string, Entry>()

  return {
    record(classes) {
      for (const explained of classes) {
        if (!needsCuration(explained)) continue
        const candidate = explained.candidate.text
        if (seen.has(candidate)) continue
        seen.set(candidate, {
          candidate,
          root: explained.root ?? NO_ROOT,
          declarations: explained.declarations,
        })
      }
    },

    report() {
      if (seen.size === 0) {
        return '# twexplain curation backlog\n\nNothing to curate — every class seen so far has a plain-English entry.\n'
      }

      const grouped = byRoot([...seen.values()])
      const count = `${seen.size} ${seen.size === 1 ? 'class' : 'classes'}`
      const heading = `# twexplain curation backlog\n\n${count} with no plain-English entry, grouped by the root an override entry is keyed on.`

      return `${heading}\n\n${[...grouped].map(([root, entries]) => section(root, entries)).join('\n\n')}\n`
    },

    clear() {
      seen.clear()
    },

    size() {
      return seen.size
    },
  }
}
