import { type ReactElement, useState } from 'react'
import { formatDeclarations } from '../explain/format'
import type { EditIntent, ExplainedClass, PaletteColor } from '../types'
import { ArbitraryValue } from './ArbitraryValue'
import styles from './ClassRow.module.css'
import { ColorPicker } from './ColorPicker'
import { OpacityControl } from './OpacityControl'
import { VariantChips } from './VariantChips'

function currentColorName(explained: ExplainedClass, palette: PaletteColor[]): string | null {
  return palette.find((color) => color.value === explained.swatch)?.name ?? null
}

function swatchTitle(explained: ExplainedClass): string | null {
  const { declarations, swatch, variants } = explained
  if (swatch === null) return null

  const source = declarations.find((d) => d.value === swatch)
  const when = source?.context ?? (variants.length > 0 ? variants.join(', ') : null)
  const where = source?.selector ?? null

  if (when !== null && where !== null) return `${swatch} — only when ${when}, on ${where}`
  if (when !== null) return `${swatch} — only when ${when}`
  if (where !== null) return `${swatch} — only on ${where}`
  return swatch
}

function isScoped(explained: ExplainedClass): boolean {
  const source = explained.declarations.find((d) => d.value === explained.swatch)
  if (source?.context !== undefined || source?.selector !== undefined) return true
  return explained.variants.length > 0
}

function description(explained: ExplainedClass): string {
  if (!explained.valid) return 'not a known Tailwind class'
  if (explained.prose !== null) return explained.prose
  if (explained.declarations.length === 0) return 'sets only Tailwind-internal variables'
  return 'no plain-English entry yet'
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
  const scoped = swatch !== null && isScoped(explained)
  const title = swatchTitle(explained)
  const editable = onIntent !== undefined
  const hasDetails = editable || declarations.length > 0
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.row}>
      <div className={styles.headerRow}>
        {hasDetails ? (
          <button
            type="button"
            className={styles.header}
            aria-expanded={open}
            aria-label={`${open ? 'hide' : 'show'} details for ${candidate.text}`}
            title={editable ? 'details and edit' : 'details'}
            onClick={() => setOpen(!open)}
          >
            <span className={valid ? styles.name : `${styles.name} ${styles.invalid}`}>
              {candidate.text}
            </span>
            <span className={styles.chevron} aria-hidden="true">
              {open ? '\u25be' : '\u25b8'}
            </span>
          </button>
        ) : (
          <div className={styles.header}>
            <span className={valid ? styles.name : `${styles.name} ${styles.invalid}`}>
              {candidate.text}
            </span>
          </div>
        )}
        {onIntent !== undefined && (
          <button
            type="button"
            className={styles.remove}
            aria-label={`remove ${candidate.text}`}
            title="Remove this class"
            onClick={() => onIntent({ type: 'remove', index: candidate.index })}
          >
            <span aria-hidden="true">{'\u00d7'}</span>
          </button>
        )}
      </div>

      <div
        className={prose === null ? `${styles.description} ${styles.muted}` : styles.description}
      >
        {swatch !== null && (
          <span
            className={scoped ? `${styles.swatch} ${styles.swatchConditional}` : styles.swatch}
            style={{ background: swatch }}
            title={title ?? undefined}
          />
        )}
        {description(explained)}
      </div>

      {hasDetails && open && (
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
            <pre className={styles.raw}>{formatDeclarations(declarations)}</pre>
          )}
        </div>
      )}
    </div>
  )
}
