import type { ReactElement } from 'react'
import type { EditIntent, ExplainedClass, PaletteColor } from '../types'
import styles from './ClassRow.module.css'
import { ColorPicker } from './ColorPicker'
import { VariantChips } from './VariantChips'

function currentColorName(explained: ExplainedClass, palette: PaletteColor[]): string | null {
  return palette.find((color) => color.value === explained.swatch)?.name ?? null
}

function swatchCondition(explained: ExplainedClass): string | null {
  const { declarations, swatch, variants } = explained
  const source = declarations.find((d) => d.value === swatch)
  if (source?.context !== undefined) return source.context
  if (variants.length > 0) return variants.join(', ')
  return null
}

export function ClassRow({
  explained,
  onIntent,
  palette = [],
}: {
  explained: ExplainedClass
  onIntent?: (intent: EditIntent) => void
  palette?: PaletteColor[]
}): ReactElement {
  const { candidate, valid, prose, declarations, swatch, numericValue } = explained
  const condition = swatch === null ? null : swatchCondition(explained)
  const swatchTitle = condition === null ? swatch : `${swatch} — only when ${condition}`

  return (
    <div className={styles.row}>
      <span className={valid ? styles.name : `${styles.name} ${styles.invalid}`}>
        {candidate.text}
      </span>
      {onIntent !== undefined && (
        <span className={styles.controls}>
          {numericValue !== null && (
            <>
              <button
                type="button"
                className={styles.control}
                aria-label={`decrease ${candidate.text}`}
                disabled={numericValue <= 0}
                onClick={() => onIntent({ type: 'step', index: candidate.index, delta: -1 })}
              >
                −
              </button>
              <button
                type="button"
                className={styles.control}
                aria-label={`increase ${candidate.text}`}
                onClick={() => onIntent({ type: 'step', index: candidate.index, delta: 1 })}
              >
                +
              </button>
            </>
          )}
          <button
            type="button"
            className={styles.control}
            aria-label={`remove ${candidate.text}`}
            onClick={() => onIntent({ type: 'remove', index: candidate.index })}
          >
            ×
          </button>
          <VariantChips index={candidate.index} variants={explained.variants} onIntent={onIntent} />
          {swatch !== null && (
            <ColorPicker
              index={candidate.index}
              current={currentColorName(explained, palette)}
              palette={palette}
              onIntent={onIntent}
            />
          )}
        </span>
      )}
      <span>
        {swatch !== null && (
          <span
            className={
              condition === null ? styles.swatch : `${styles.swatch} ${styles.swatchConditional}`
            }
            style={{ background: swatch }}
            title={swatchTitle ?? undefined}
          />
        )}
        {!valid && <span className={styles.unexplained}>not a known Tailwind class</span>}
        {valid && prose !== null && <span className={styles.prose}>{prose}</span>}
        {valid && prose === null && declarations.length === 0 && (
          <span className={styles.unexplained}>sets only Tailwind-internal variables</span>
        )}
        {valid && prose === null && declarations.length > 0 && (
          <>
            <span className={styles.unexplained}>no plain-English entry yet</span>
            <pre className={styles.raw}>
              {declarations
                .map((d) =>
                  d.context === undefined
                    ? `${d.prop}: ${d.value}`
                    : `${d.context} {\n  ${d.prop}: ${d.value}\n}`,
                )
                .join('\n')}
            </pre>
          </>
        )}
      </span>
    </div>
  )
}
