import { type CssNode, parseCss } from '../css/parse'
import type { Candidate, Declaration, ExplainGroup, ExplainedClass } from '../types'
import { derive, isConditional } from './derive'
import { flattenValue, remToPx } from './flatten'
import { groupAll, groupFor } from './group'
import { overrideFor } from './overrides'
import { strip } from './strip'

export type ParsedVariant = { kind: string; root?: string }

export type DesignSystemPort = {
  candidatesToCss(candidates: string[]): (string | null)[]
  parseCandidate(
    candidate: string,
  ): { root: string; variants: ParsedVariant[]; value?: { value: string } | null }[]
  printVariant(variant: ParsedVariant): string
  resolveThemeValue(key: string): string | undefined
}

const COLOR_PROPS = new Set(['background-color', 'color', 'border-color', 'fill', 'stroke'])

function collectDeclarations(nodes: CssNode[], out: Declaration[], conditions: string[]): void {
  for (const node of nodes) {
    if (node.type === 'decl') {
      out.push(
        conditions.length > 0
          ? { prop: node.prop, value: node.value, context: conditions.join(' and ') }
          : { prop: node.prop, value: node.value },
      )
      continue
    }
    const nested = node.selector.startsWith('@') ? [...conditions, node.selector] : conditions
    collectDeclarations(node.children, out, nested)
  }
}

function swatchFrom(declarations: Declaration[]): string | null {
  const found = declarations.find((d) => COLOR_PROPS.has(d.prop))
  if (found === undefined) return null
  if (found.value.includes('--tw-')) return null
  return found.value
}

export function explainCandidates(candidates: Candidate[], ds: DesignSystemPort): ExplainGroup[] {
  const compiled = ds.candidatesToCss(candidates.map((c) => c.text))
  const resolve = (key: string): string | null => ds.resolveThemeValue(key) ?? null

  const explained: ExplainedClass[] = candidates.map((candidate, i) => {
    const css = compiled[i]
    if (css === null || css === undefined) {
      return {
        candidate,
        valid: false,
        declarations: [],
        prose: null,
        group: 'other',
        variants: [],
        swatch: null,
      }
    }

    const raw: Declaration[] = []
    collectDeclarations(strip(parseCss(css)), raw, [])
    const declarations = raw.map((d) => ({
      prop: d.prop,
      value: remToPx(flattenValue(d.value, resolve)),
      ...(d.context !== undefined ? { context: d.context } : {}),
    }))

    const parsed = ds.parseCandidate(candidate.text)[0]
    const variants = parsed
      ? parsed.variants
          .slice()
          .reverse()
          .map((v) => ds.printVariant(v))
      : []
    const unexplainedCondition = variants.length === 0 && isConditional(declarations)
    const derived = unexplainedCondition ? null : derive(declarations)
    const prose = (parsed ? overrideFor(parsed, declarations) : null) ?? derived

    return {
      candidate,
      valid: true,
      declarations,
      prose,
      group: groupFor(declarations, variants),
      variants,
      swatch: swatchFrom(declarations),
    }
  })

  return groupAll(explained)
}
