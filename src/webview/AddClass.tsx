import { type ReactElement, useEffect, useState } from 'react'

const LIST_ID = 'twexplain-suggestions'
const optionId = (index: number): string => `twexplain-option-${index}`

const OPTION =
  'cursor-pointer rounded-sm px-[5px] py-0.5 font-mono text-sm text-fg hover:bg-hover aria-selected:bg-hover'

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
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
  }, [suggestions])

  const step = (delta: number): void => {
    if (suggestions.length === 0) return
    setActive((current) => (current + delta + suggestions.length) % suggestions.length)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        role="combobox"
        aria-label="class to add"
        aria-expanded={suggestions.length > 0}
        aria-controls={LIST_ID}
        aria-autocomplete="list"
        aria-activedescendant={suggestions.length > 0 ? optionId(active) : undefined}
        className="w-full rounded-sm border border-edge bg-field px-[5px] py-[3px] font-mono text-sm text-fg focus:border-accent focus:outline-none"
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
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            step(1)
            return
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            step(-1)
            return
          }
          if (event.key !== 'Enter') return
          const chosen = suggestions[active]
          if (chosen === undefined) return
          event.preventDefault()
          onPick(chosen)
        }}
      />
      {suggestions.length > 0 && (
        <ul
          className="absolute top-full right-0 left-0 z-10 mt-0.5 max-h-60 list-none overflow-y-auto rounded-md border border-overlay-edge bg-overlay p-0.5 shadow-lg"
          id={LIST_ID}
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              className={OPTION}
              onClick={() => onPick(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
