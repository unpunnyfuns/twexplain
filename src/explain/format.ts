import type { Declaration } from '../types'

type ScopedGroup = { context?: string; selector?: string; declarations: Declaration[] }

function groupByScope(declarations: Declaration[]): ScopedGroup[] {
  const groups: ScopedGroup[] = []
  for (const declaration of declarations) {
    const last = groups.at(-1)
    if (
      last !== undefined &&
      last.context === declaration.context &&
      last.selector === declaration.selector
    ) {
      last.declarations.push(declaration)
      continue
    }
    groups.push({
      context: declaration.context,
      selector: declaration.selector,
      declarations: [declaration],
    })
  }
  return groups
}

export function formatDeclarations(declarations: Declaration[]): string {
  return groupByScope(declarations)
    .map((group) => {
      const wrappers = [group.context, group.selector].filter((part) => part !== undefined)
      const body = group.declarations.map((d) => `${d.prop}: ${d.value}`)
      return wrappers
        .reduceRight<string[]>(
          (inner, wrapper) => [`${wrapper} {`, ...inner.map((line) => `  ${line}`), '}'],
          body,
        )
        .join('\n')
    })
    .join('\n')
}
