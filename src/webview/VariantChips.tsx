import type { ReactElement } from 'react'
import type { EditIntent } from '../types'

const CHIP =
  'cursor-pointer rounded-lg border border-edge bg-transparent px-[5px] py-0.5 font-mono text-sm leading-none'

export const COMMON_VARIANTS = ['hover', 'focus', 'active', 'disabled', 'dark', 'sm', 'md', 'lg']

export function VariantChips({
  index,
  variants,
  available = [],
  onIntent,
}: {
  index: number
  variants: string[]
  available?: string[]
  onIntent: (intent: EditIntent) => void
}): ReactElement {
  const extra = [...available, ...variants].filter((v) => !COMMON_VARIANTS.includes(v))
  const offered = [...COMMON_VARIANTS, ...new Set(extra)]

  return (
    <span className="flex flex-wrap gap-0.5 py-0.5">
      {offered.map((variant) => {
        const active = variants.includes(variant)
        return (
          <button
            type="button"
            key={variant}
            aria-pressed={active}
            className={
              active
                ? `${CHIP} bg-accent border-accent text-[var(--vscode-editor-background)]`
                : `${CHIP} text-muted hover:border-accent hover:text-fg`
            }
            onClick={() =>
              onIntent(
                active
                  ? { type: 'removeVariant', index, variant }
                  : { type: 'addVariant', index, variant },
              )
            }
          >
            {variant}
          </button>
        )
      })}
    </span>
  )
}
