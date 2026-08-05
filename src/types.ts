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

export type Declaration = { prop: string; value: string }

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
}

export type ExplainGroup = { name: GroupName; classes: ExplainedClass[] }

export type PanelState =
  | { status: 'no-workspace-tailwind' }
  | { status: 'wrong-version'; found: string }
  | { status: 'no-css-entry' }
  | { status: 'unsupported-plugin' }
  | { status: 'load-error'; message: string }
  | { status: 'no-selection' }
  | { status: 'ready'; groups: ExplainGroup[] }

export type HostMessage = { type: 'state'; state: PanelState }

export type WebviewMessage = { type: 'ready' }
