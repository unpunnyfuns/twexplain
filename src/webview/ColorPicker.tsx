import type { ReactElement } from 'react'
import type { EditIntent, PaletteColor } from '../types'
import styles from './ColorPicker.module.css'

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
    <span className={styles.palette}>
      {palette.map((color) => (
        <button
          type="button"
          key={color.name}
          aria-label={color.name}
          aria-pressed={color.name === current}
          title={`${color.name} — ${color.value}`}
          className={color.name === current ? `${styles.swatch} ${styles.current}` : styles.swatch}
          style={{ background: color.value }}
          onClick={() => onIntent({ type: 'setValue', index, value: color.name })}
        />
      ))}
    </span>
  )
}
