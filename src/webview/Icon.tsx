import type { ReactElement } from 'react'

export const ICON_NAMES = [
  'add',
  'remove',
  'close',
  'discard',
  'chevron-right',
  'chevron-down',
] as const

export type IconName = (typeof ICON_NAMES)[number]

export function Icon({ name }: { name: IconName }): ReactElement {
  return (
    <span
      className={`codicon codicon-${name}`}
      aria-hidden="true"
      style={{ fontSize: 'inherit' }}
    />
  )
}
