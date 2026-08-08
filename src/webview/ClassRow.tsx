import type { ReactElement } from 'react'
import type { EditIntent, ExplainedClass, PaletteColor } from '../types'
import { ArbitraryValue } from './ArbitraryValue'
import styles from './ClassRow.module.css'
import { ColorPicker } from './ColorPicker'
import { OpacityControl } from './OpacityControl'
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

function description(explained: ExplainedClass): string {
  if (!explained.valid) return 'not a known Tailwind class'
  if (explained.prose !== null) return explained.prose
  if (explained.declarations.length === 0) return 'sets only Tailwind-internal variables'
  return 'no plain-English entry yet'
}

function formatDeclarations(explained: ExplainedClass): string {
  return explained.declarations
    .map((d) =>
      d.context === undefined
        ? `${d.prop}: ${d.value}`
        : `${d.context} {\n  ${d.prop}: ${d.value}\n}`,
    )
    .join('\n')
}

export function ClassRow({
  explained,
  onIntent,
  palette = [],
  availableVariants = [],
}: {
  explained: ExplainedClass
  onIntent?: (intent: EditIntent) => void
  palette?: PaletteColor[]
  availableVariants?: string[]
}): ReactElement {
  const { candidate, valid, prose, declarations, swatch, numericValue } = explained
  const condition = swatch === null ? null : swatchCondition(explained)
  const swatchTitle = condition === null ? swatch : `${swatch} — only when ${condition}`
  const editable = onIntent !== undefined
  const hasDetails = editable || declarations.length > 0

  return (
    <div className={styles.row}>
      <div className={valid ? styles.name : `${styles.name} ${styles.invalid}`}>
        {candidate.text}
      </div>

      <div
        className={prose === null ? `${styles.description} ${styles.muted}` : styles.description}
      >
        {swatch !== null && (
          <span
            className={
              condition === null ? styles.swatch : `${styles.swatch} ${styles.swatchConditional}`
            }
            style={{ background: swatch }}
            title={swatchTitle ?? undefined}
          />
        )}
        {description(explained)}
      </div>

      {hasDetails && (
        <details className={styles.details}>
          <summary className={styles.summary}>{editable ? 'details & edit' : 'details'}</summary>
          <div className={styles.body}>
            {onIntent !== undefined && (
              <div className={styles.controls}>
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
                {explained.arbitraryValue !== null && (
                  <ArbitraryValue
                    index={candidate.index}
                    value={explained.arbitraryValue}
                    onIntent={onIntent}
                  />
                )}
                <button
                  type="button"
                  className={styles.control}
                  aria-label={`remove ${candidate.text}`}
                  onClick={() => onIntent({ type: 'remove', index: candidate.index })}
                >
                  remove
                </button>
              </div>
            )}

            {onIntent !== undefined && (
              <VariantChips
                index={candidate.index}
                variants={explained.variants}
                available={availableVariants}
                onIntent={onIntent}
              />
            )}

            {onIntent !== undefined && swatch !== null && (
              <OpacityControl
                index={candidate.index}
                modifier={explained.modifier}
                onIntent={onIntent}
              />
            )}

            {onIntent !== undefined && swatch !== null && (
              <ColorPicker
                index={candidate.index}
                current={currentColorName(explained, palette)}
                palette={palette}
                onIntent={onIntent}
              />
            )}

            {declarations.length > 0 && (
              <pre className={styles.raw}>{formatDeclarations(explained)}</pre>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
