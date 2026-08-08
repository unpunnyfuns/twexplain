import { type ReactElement, useState } from 'react'
import type { EditIntent } from '../types'
import styles from './ArbitraryValue.module.css'

export function ArbitraryValue({
  index,
  value,
  onIntent,
}: {
  index: number
  value: string
  onIntent: (intent: EditIntent) => void
}): ReactElement {
  const [draft, setDraft] = useState(value)

  return (
    <input
      aria-label="arbitrary value"
      className={styles.input}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        const next = draft.trim()
        if (next === '' || next === value) return
        onIntent({ type: 'setValue', index, value: `[${next}]` })
      }}
    />
  )
}
