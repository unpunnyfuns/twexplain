export type Offsets = { start: number; end: number }

export type Candidate = {
  text: string
  range: Offsets
  index: number
}

export type ClassStringLocation = {
  uri: string
  range: Offsets
  kind: 'jsx' | 'html' | 'vue' | 'svelte' | 'apply'
  candidates: Candidate[]
}

export type Declaration = { prop: string; value: string; context?: string }

export type GroupName =
  | 'layout'
  | 'spacing'
  | 'typography'
  | 'color'
  | 'border'
  | 'effects'
  | 'state'
  | 'other'

export type ExplainedClass = {
  candidate: Candidate
  valid: boolean
  declarations: Declaration[]
  prose: string | null
  group: GroupName
  variants: string[]
  swatch: string | null
  numericValue: number | null
}

export type ExplainGroup = { name: GroupName; classes: ExplainedClass[] }

export type PaletteColor = { name: string; value: string }

export type PanelState =
  | { status: 'no-workspace-tailwind' }
  | { status: 'wrong-version'; found: string }
  | { status: 'no-css-entry' }
  | { status: 'unsupported-plugin' }
  | { status: 'stale-runtime' }
  | { status: 'load-error'; message: string }
  | { status: 'loading' }
  | { status: 'no-selection' }
  | { status: 'ready'; groups: ExplainGroup[]; palette: PaletteColor[] }

export type EditIntent =
  | { type: 'step'; index: number; delta: number }
  | { type: 'setValue'; index: number; value: string }
  | { type: 'setModifier'; index: number; modifier: string | null }
  | { type: 'addVariant'; index: number; variant: string }
  | { type: 'removeVariant'; index: number; variant: string }
  | { type: 'remove'; index: number }
  | { type: 'add'; text: string }

export type HostMessage =
  | { type: 'state'; state: PanelState }
  | { type: 'suggestions'; query: string; matches: string[] }

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'edit'; intent: unknown }
  | { type: 'search'; query: string }
