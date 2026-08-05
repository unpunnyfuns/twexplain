export type CssNode =
  | { type: 'rule'; selector: string; children: CssNode[] }
  | { type: 'decl'; prop: string; value: string }

export function parseCss(css: string): CssNode[] {
  let i = 0

  const skipWhitespace = (): void => {
    while (i < css.length && /\s/.test(css[i] as string)) i++
  }

  const readHead = (): string => {
    const start = i
    let depth = 0
    while (i < css.length) {
      const c = css[i] as string
      if (depth === 0 && (c === '{' || c === ';' || c === '}')) break
      if (c === '(') depth++
      else if (c === ')') depth--
      i++
    }
    return css.slice(start, i).trim()
  }

  const parseBlock = (): CssNode[] => {
    const out: CssNode[] = []
    for (;;) {
      skipWhitespace()
      if (i >= css.length || css[i] === '}') return out
      const head = readHead()
      if (css[i] === '{') {
        i++
        const children = parseBlock()
        skipWhitespace()
        if (css[i] === '}') i++
        out.push({ type: 'rule', selector: head, children })
        continue
      }
      if (css[i] === ';') i++
      if (!head) continue
      const colon = head.indexOf(':')
      if (colon === -1) continue
      out.push({
        type: 'decl',
        prop: head.slice(0, colon).trim(),
        value: head.slice(colon + 1).trim(),
      })
    }
  }

  return parseBlock()
}
