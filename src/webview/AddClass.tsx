import type { ReactElement } from 'react'
import styles from './AddClass.module.css'

export function AddClass({
  value,
  suggestions,
  onChange,
  onPick,
  onClose,
}: {
  value: string
  suggestions: string[]
  onChange: (query: string) => void
  onPick: (text: string) => void
  onClose?: () => void
}): ReactElement {
  const first = suggestions[0]

  return (
    <div className={styles.add}>
      <input
        role="combobox"
        aria-label="class to add"
        aria-expanded={suggestions.length > 0}
        aria-controls="twexplain-suggestions"
        className={styles.input}
        placeholder="add a class…"
        value={value}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose?.()
            return
          }
          if (event.key !== 'Enter' || first === undefined) return
          event.preventDefault()
          onPick(first)
        }}
      />
      {suggestions.length > 0 && (
        <ul className={styles.list} id="twexplain-suggestions" role="listbox">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                role="option"
                aria-selected={suggestion === first}
                className={styles.option}
                onClick={() => onPick(suggestion)}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
