import type { ReactElement } from 'react'
import type { EditIntent } from '../types'
import styles from './OpacityControl.module.css'

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
    <span className={styles.opacity}>
      {steps.map((step) => {
        const active = step === modifier
        return (
          <button
            type="button"
            key={step ?? 'full'}
            aria-pressed={active}
            aria-label={step === null ? 'full opacity' : `${step}% opacity`}
            className={active ? `${styles.step} ${styles.active}` : styles.step}
            onClick={() => onIntent({ type: 'setModifier', index, modifier: step })}
          >
            {step === null ? '100' : step}
          </button>
        )
      })}
    </span>
  )
}
