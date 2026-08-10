import { type CssNode, parseCss } from '../css/parse'
import type { Candidate, Declaration, ExplainGroup, ExplainedClass } from '../types'
import { derive, isConditional } from './derive'
import { flattenValue, remToPx } from './flatten'
import { groupAll, groupFor } from './group'
import { overrideFor } from './overrides'
import { resolveNesting, selectorContext } from './selector'
import { strip } from './strip'
import { describeVariants } from './variants'

export type ParsedVariant = { kind: string; root?: string }

export type DesignSystemPort = {
  candidatesToCss(candidates: string[]): (string | null)[]
  parseCandidate(candidate: string): {
    root: string
    variants: ParsedVariant[]
    value?: { kind?: string; value: string } | null
    modifier?: { value: string } | null
  }[]
  printVariant(variant: ParsedVariant): string
  resolveThemeValue(key: string): string | undefined
}

const COLOR_PROPS = new Set(['background-color', 'color', 'border-color', 'fill', 'stroke'])

type Scope = { conditions: string[]; selector: string | null; candidate: string }

function collectDeclarations(nodes: CssNode[], out: Declaration[], scope: Scope): void {
  for (const node of nodes) {
    if (node.type === 'decl') {
      out.push({
        prop: node.prop,
        value: node.value,
        ...(scope.conditions.length > 0 ? { context: scope.conditions.join(' and ') } : {}),
        ...(scope.selector !== null ? { selector: scope.selector } : {}),
      })
      continue
    }
    if (node.selector.startsWith('@')) {
      collectDeclarations(node.children, out, {
        ...scope,
        conditions: [...scope.conditions, node.selector],
      })
      continue
    }
    collectDeclarations(node.children, out, {
      ...scope,
      selector: resolveNesting(scope.selector, selectorContext(node.selector, scope.candidate)),
    })
  }
}

function numericValueOf(parsed: { value?: { value: string } | null } | undefined): number | null {
  const raw = parsed?.value?.value
  if (raw === undefined) return null
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null
  return Number.parseFloat(raw)
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
        root: null,
        declarations: [],
        prose: null,
        condition: null,
        group: 'other',
        variants: [],
        swatch: null,
        numericValue: null,
        modifier: null,
        arbitraryValue: null,
      }
    }

    const raw: Declaration[] = []
    collectDeclarations(strip(parseCss(css)), raw, {
      conditions: [],
      selector: null,
      candidate: candidate.text,
    })
    const declarations = raw.map((d) => ({
      prop: d.prop,
      value: remToPx(flattenValue(d.value, resolve)),
      ...(d.context !== undefined ? { context: d.context } : {}),
      ...(d.selector !== undefined ? { selector: d.selector } : {}),
    }))

    const parsed = ds.parseCandidate(candidate.text)[0]
    const variants = parsed
      ? parsed.variants
          .slice()
          .reverse()
          .map((v) => ds.printVariant(v))
      : []
    const condition = describeVariants(variants, declarations)
    const unexplainedCondition = variants.length === 0 && isConditional(declarations)
    const undescribedVariant = variants.length > 0 && condition === null
    const derived = unexplainedCondition ? null : derive(declarations)
    const stated = (parsed ? overrideFor(parsed, declarations) : null) ?? derived
    const prose = undescribedVariant ? null : stated

    return {
      candidate,
      valid: true,
      root: parsed?.root ?? null,
      declarations,
      prose,
      condition,
      group: groupFor(declarations, variants),
      variants,
      swatch: swatchFrom(declarations),
      numericValue: numericValueOf(parsed),
      modifier: parsed?.modifier?.value ?? null,
      arbitraryValue: parsed?.value?.kind === 'arbitrary' ? parsed.value.value : null,
    }
  })

  return groupAll(explained)
}
