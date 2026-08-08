import { loadDesignSystem } from './design-system/load'
import { detectJsx } from './detect/jsx'
import { addVariant, removeVariant, setModifier, setValue, stepValue } from './edit/mutate'
import type { TextEdit } from './edit/writeback'
import { addCandidate, removeCandidate, replaceCandidate } from './edit/writeback'
import type { ClassStringLocation, EditIntent } from './types'

export type { EditIntent }

export type IntentInput = {
  text: string
  offset: number
  uri: string
  workspaceRoot: string | null
  fsPath: string
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
      return addVariant(text, intent.variant, port)
    case 'removeVariant':
      return removeVariant(text, intent.variant, port)
    default:
      return null
  }
}

function candidateText(location: ClassStringLocation, index: number): string | null {
  return location.candidates.find((c) => c.index === index)?.text ?? null
}

export async function resolveIntent(input: IntentInput): Promise<TextEdit | null> {
  const location = detectJsx(input.text, input.offset, input.uri)
  if (location === null) return null

  const { intent } = input
  if (intent.type === 'remove') return removeCandidate(input.text, location, intent.index)
  if (intent.type === 'add') return addCandidate(location, intent.text)

  const current = candidateText(location, intent.index)
  if (current === null) return null
  if (input.workspaceRoot === null) return null

  const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
  if (!loaded.ok) return null

  const next = mutateText(current, intent, loaded.ds)
  if (next === null) return null

  return replaceCandidate(location, intent.index, next)
}
