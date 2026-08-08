import type { ReactElement } from 'react'
import type { EditIntent } from '../types'
import styles from './VariantChips.module.css'

export const COMMON_VARIANTS = ['hover', 'focus', 'active', 'disabled', 'dark', 'sm', 'md', 'lg']

export function VariantChips({
  index,
  variants,
  onIntent,
}: {
  index: number
  variants: string[]
  onIntent: (intent: EditIntent) => void
}): ReactElement {
  const offered = [...COMMON_VARIANTS, ...variants.filter((v) => !COMMON_VARIANTS.includes(v))]

  return (
    <span className={styles.chips}>
      {offered.map((variant) => {
        const active = variants.includes(variant)
        return (
          <button
            type="button"
            key={variant}
            aria-pressed={active}
            className={active ? `${styles.chip} ${styles.active}` : styles.chip}
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
