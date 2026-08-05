import type { CssNode } from '../css/parse'

export function strip(nodes: CssNode[]): CssNode[] {
  const out: CssNode[] = []
  for (const node of nodes) {
    if (node.type === 'decl') {
      if (node.prop.startsWith('--tw-')) continue
      out.push(node)
      continue
    }
    if (node.selector.startsWith('@property')) continue
    const children = strip(node.children)
    if (children.length > 0) out.push({ ...node, children })
  }
  return out
}
