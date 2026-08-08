export type ThemePort = {
  theme: { namespace(prefix: string): Iterable<[string, string]> }
}

export type EditPort = {
  parseCandidate(candidate: string): unknown[]
  printCandidate(candidate: unknown): string
  parseVariant(variant: string): unknown
}

type MutableCandidate = {
  root: string
  value?: { kind: string; value: string } | null
  modifier?: { kind: string; value: string } | null
  variants: { kind: string; root?: string }[]
}

function detach(candidate: string, port: EditPort): MutableCandidate | null {
  const parsed = port.parseCandidate(candidate)[0]
  if (parsed === undefined) return null
  return structuredClone(parsed) as MutableCandidate
}

function apply(
  candidate: string,
  port: EditPort,
  mutate: (draft: MutableCandidate) => boolean,
): string | null {
  const draft = detach(candidate, port)
  if (draft === null) return null
  if (!mutate(draft)) return null
  return port.printCandidate(draft)
}

export function setValue(candidate: string, value: string, port: EditPort): string | null {
  return apply(candidate, port, (draft) => {
    if (draft.value === undefined || draft.value === null) return false
    draft.value = { ...draft.value, value }
    return true
  })
}

export function stepValue(candidate: string, delta: number, port: EditPort): string | null {
  return apply(candidate, port, (draft) => {
    if (draft.value === undefined || draft.value === null) return false
    if (!/^\d+(?:\.\d+)?$/.test(draft.value.value)) return false
    const next = Number.parseFloat(draft.value.value) + delta
    if (next < 0) return false
    draft.value = { ...draft.value, value: String(Number.parseFloat(next.toFixed(4))) }
    return true
  })
}

export function setModifier(
  candidate: string,
  modifier: string | null,
  port: EditPort,
): string | null {
  return apply(candidate, port, (draft) => {
    draft.modifier = modifier === null ? null : { kind: 'named', value: modifier }
    return true
  })
}

export function addVariant(candidate: string, variant: string, port: EditPort): string | null {
  return apply(candidate, port, (draft) => {
    const printed = port.parseVariant(variant)
    if (printed === undefined || printed === null) return false
    if (draft.variants.some((existing) => existing.root === variant)) return false
    draft.variants.push(printed as MutableCandidate['variants'][number])
    return true
  })
}

export function removeVariant(candidate: string, variant: string, port: EditPort): string | null {
  return apply(candidate, port, (draft) => {
    const index = draft.variants.findIndex((existing) => existing.root === variant)
    if (index === -1) return false
    draft.variants.splice(index, 1)
    return true
  })
}
