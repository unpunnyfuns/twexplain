import type { ReactElement } from 'react'
import type { EditIntent, PaletteColor } from '../types'

const SWATCH =
  'h-3 w-3 cursor-pointer rounded-sm border border-edge p-0 hover:scale-125 hover:border-accent'

export function ColorPicker({
  index,
  current,
  palette,
  onIntent,
}: {
  index: number
  current: string | null
  palette: PaletteColor[]
  onIntent: (intent: EditIntent) => void
}): ReactElement {
  return (
    <span className="flex max-h-[76px] flex-wrap gap-0.5 overflow-y-auto py-0.5">
      {palette.map((color) => (
        <button
          type="button"
          key={color.name}
          aria-label={color.name}
          aria-pressed={color.name === current}
          title={`${color.name} — ${color.value}`}
          className={
            color.name === current ? `${SWATCH} outline outline-offset-1 outline-accent` : SWATCH
          }
          style={{ background: color.value }}
          onClick={() => onIntent({ type: 'setValue', index, value: color.name })}
        />
      ))}
    </span>
  )
}
