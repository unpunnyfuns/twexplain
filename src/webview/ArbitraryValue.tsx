import { type ReactElement, useEffect, useState } from 'react'
import type { EditIntent } from '../types'

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

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <input
      aria-label="arbitrary value"
      className="w-[68px] rounded-sm border border-edge bg-field px-[3px] py-px font-mono text-sm text-fg focus:border-accent focus:outline-none"
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
