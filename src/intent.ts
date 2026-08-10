import { loadDesignSystem } from './design-system/load'
import { detectClassString } from './detect/index'
import { addVariant, removeVariant, setModifier, setValue, stepValue } from './edit/mutate'
import type { TextEdit } from './edit/writeback'
import { addCandidate, removeCandidate, replaceCandidate } from './edit/writeback'
import { conflictingVariants } from './exclusive'
import type { ClassStringLocation, EditIntent } from './types'

export type { EditIntent }

export type IntentInput = {
  text: string
  offset: number
  uri: string
  workspaceRoot: string | null
  fsPath: string
  languageId: string
  intent: EditIntent
}

function mutateText(
  text: string,
  intent: EditIntent,
  port: Parameters<typeof stepValue>[2],
): string | null {
  switch (intent.type) {
    case 'step':
      return stepValue(text, intent.delta, port)
    case 'setValue':
      return setValue(text, intent.value, port)
    case 'setModifier':
      return setModifier(text, intent.modifier, port)
    case 'addVariant':
      return addVariant(text, intent.variant, port, intent.position ?? 'outer')
    case 'removeVariant':
      return removeVariant(text, intent.variant, port)
    default:
      return null
  }
}

function candidateText(location: ClassStringLocation, index: number): string | null {
  return location.candidates.find((c) => c.index === index)?.text ?? null
}

function assertCompiles(
  ds: { candidatesToCss(candidates: string[]): (string | null)[] },
  candidate: string,
): void {
  if (ds.candidatesToCss([candidate])[0] !== null) return
  throw new Error(`Tailwind cannot compile "${candidate}", so it was not written`)
}

type VariantReader = {
  parseCandidate(candidate: string): { variants: unknown[] }[]
  printVariant(variant: never): string
}

function variantNamesOf(candidate: string, ds: VariantReader): string[] {
  const parsed = ds.parseCandidate(candidate)[0]
  if (parsed === undefined) return []
  return parsed.variants.map((variant) => ds.printVariant(variant as never))
}

function withoutConflicts(
  candidate: string,
  variant: string,
  ds: Parameters<typeof addVariant>[2] & VariantReader & Parameters<typeof conflictingVariants>[2],
): string {
  const present = variantNamesOf(candidate, ds)
  let current = candidate
  for (const clash of conflictingVariants(present, variant, ds)) {
    current = removeVariant(current, clash, ds) ?? current
  }
  return current
}

export async function resolveIntent(input: IntentInput): Promise<TextEdit | null> {
  const location = detectClassString(input)
  if (location === null) return null

  const { intent } = input
  if (intent.type === 'remove') return removeCandidate(input.text, location, intent.index)

  if (intent.type === 'add') {
    const edit = addCandidate(location, intent.text)
    if (edit === null || input.workspaceRoot === null) return edit
    const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
    if (loaded.ok) assertCompiles(loaded.ds, intent.text)
    return edit
  }

  const current = candidateText(location, intent.index)
  if (current === null) return null
  if (input.workspaceRoot === null) return null

  const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
  if (!loaded.ok) return null

  const base =
    intent.type === 'addVariant' ? withoutConflicts(current, intent.variant, loaded.ds) : current

  const next = mutateText(base, intent, loaded.ds)
  if (next === null) return null
  assertCompiles(loaded.ds, next)

  return replaceCandidate(location, intent.index, next)
}
