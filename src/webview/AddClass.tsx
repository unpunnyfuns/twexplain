import type { ReactElement } from 'react'

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
    <div className="relative min-w-0 flex-1">
      <input
        role="combobox"
        aria-label="class to add"
        aria-expanded={suggestions.length > 0}
        aria-controls="twexplain-suggestions"
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
          if (event.key !== 'Enter' || first === undefined) return
          event.preventDefault()
          onPick(first)
        }}
      />
      {suggestions.length > 0 && (
        <ul
          className="absolute top-full right-0 left-0 z-10 mt-0.5 max-h-60 list-none overflow-y-auto rounded-md border border-overlay-edge bg-overlay p-0.5 shadow-lg"
          id="twexplain-suggestions"
          role="listbox"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                role="option"
                aria-selected={suggestion === first}
                className="block w-full cursor-pointer border-none bg-transparent px-[5px] py-0.5 text-left font-mono text-sm text-fg hover:bg-hover aria-selected:bg-hover"
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
