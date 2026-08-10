import { type ReactElement, useState } from 'react'
import { formatDeclarations } from '../explain/format'
import type { EditIntent, ExplainedClass, PaletteColor } from '../types'
import { ArbitraryValue } from './ArbitraryValue'
import { ColorPicker } from './ColorPicker'
import { Icon } from './Icon'
import { OpacityControl } from './OpacityControl'
import { VariantChips } from './VariantChips'

const ROW_HEADER =
  'flex w-full flex-1 items-baseline gap-1 border-none bg-transparent p-0 text-left [font:inherit]'
const NAME = 'font-mono break-all text-accent'
const SWATCH = 'mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-edge align-middle'
const CONTROL =
  'inline-flex min-h-[18px] min-w-[20px] cursor-pointer items-center justify-center rounded-sm border border-edge bg-transparent px-[5px] py-0.5 font-mono text-sm leading-none text-muted hover:not-disabled:border-accent hover:not-disabled:text-fg disabled:cursor-default disabled:opacity-40'

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
  const { candidate, valid, prose, condition, declarations, swatch, numericValue } = explained
  const scoped = swatch !== null && isScoped(explained)
  const title = swatchTitle(explained)
  const editable = onIntent !== undefined
  const hasDetails = editable || declarations.length > 0
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-edge/40 py-1">
      <div className="flex items-baseline gap-0.5">
        {hasDetails ? (
          <button
            type="button"
            className={`${ROW_HEADER} cursor-pointer`}
            aria-expanded={open}
            aria-label={`${open ? 'hide' : 'show'} details for ${candidate.text}`}
            title={editable ? 'details and edit' : 'details'}
            onClick={() => setOpen(!open)}
          >
            <span className={valid ? NAME : `${NAME} text-danger line-through`}>
              {candidate.text}
            </span>
            <span className="text-muted">
              <Icon name={open ? 'chevron-down' : 'chevron-right'} />
            </span>
          </button>
        ) : (
          <div className={ROW_HEADER}>
            <span className={valid ? NAME : `${NAME} text-danger line-through`}>
              {candidate.text}
            </span>
          </div>
        )}
        {onIntent !== undefined && (
          <button
            type="button"
            className="inline-flex h-[18px] w-[18px] flex-none cursor-pointer items-center justify-center rounded-[3px] border-none bg-transparent p-0 leading-none text-muted opacity-60 hover:text-danger hover:opacity-100"
            aria-label={`remove ${candidate.text}`}
            title="Remove this class"
            onClick={() => onIntent({ type: 'remove', index: candidate.index })}
          >
            <Icon name="close" />
          </button>
        )}
      </div>

      <div className={prose === null ? 'text-muted italic leading-snug' : 'text-fg leading-snug'}>
        {swatch !== null && (
          <span
            className={
              scoped
                ? `${SWATCH} [clip-path:polygon(0_0,100%_0,100%_55%,55%_100%,0_100%)] outline outline-dashed outline-offset-1 outline-muted`
                : SWATCH
            }
            style={{ background: swatch }}
            title={title ?? undefined}
          />
        )}
        {condition !== null && <span className="text-muted">{condition} — </span>}
        {description(explained)}
      </div>

      {hasDetails && open && (
        <div className="flex flex-col gap-1 pt-1 pb-0.5">
          {onIntent !== undefined && (
            <div className="flex flex-wrap gap-[3px]">
              {numericValue !== null && (
                <>
                  <button
                    type="button"
                    className={CONTROL}
                    aria-label={`decrease ${candidate.text}`}
                    disabled={numericValue <= 0}
                    onClick={() => onIntent({ type: 'step', index: candidate.index, delta: -1 })}
                  >
                    <Icon name="remove" />
                  </button>
                  <button
                    type="button"
                    className={CONTROL}
                    aria-label={`increase ${candidate.text}`}
                    onClick={() => onIntent({ type: 'step', index: candidate.index, delta: 1 })}
                  >
                    <Icon name="add" />
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
            <pre className="m-0 font-mono whitespace-pre-wrap text-muted">
              {formatDeclarations(declarations)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
