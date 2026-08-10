import type { ReactElement } from 'react'
import type { EditIntent } from '../types'

const STEP =
  'cursor-pointer rounded-sm border border-edge bg-transparent px-[3px] py-px font-mono text-sm leading-none'

export const OPACITY_STEPS: (string | null)[] = [null, '75', '50', '25']

export function OpacityControl({
  index,
  modifier,
  onIntent,
}: {
  index: number
  modifier: string | null
  onIntent: (intent: EditIntent) => void
}): ReactElement {
  const steps =
    modifier === null || OPACITY_STEPS.includes(modifier)
      ? OPACITY_STEPS
      : [...OPACITY_STEPS, modifier]

  return (
    <span className="inline-flex gap-0.5">
      {steps.map((step) => {
        const active = step === modifier
        return (
          <button
            type="button"
            key={step ?? 'full'}
            aria-pressed={active}
            aria-label={step === null ? 'full opacity' : `${step}% opacity`}
            className={
              active
                ? `${STEP} bg-accent border-accent text-[var(--vscode-editor-background)]`
                : `${STEP} text-muted hover:border-accent hover:text-fg`
            }
            onClick={() => onIntent({ type: 'setModifier', index, modifier: step })}
          >
            {step === null ? '100' : step}
          </button>
        )
      })}
    </span>
  )
}
