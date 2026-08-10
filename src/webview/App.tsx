import { type ReactElement, useEffect, useRef, useState } from 'react'
import type { EditIntent, HostMessage, PaletteColor, PanelState } from '../types'
import { AddClass } from './AddClass'
import { ClassRow } from './ClassRow'
import { Icon } from './Icon'

const ICON_BUTTON =
  'inline-flex h-[1.75em] w-[1.75em] cursor-pointer items-center justify-center rounded-[3px] border border-transparent bg-transparent p-0 font-sans text-[1.15em] leading-none text-muted hover:bg-toolbar-hover hover:text-fg aria-expanded:border-accent aria-expanded:text-accent'

export const NOTICES: Record<string, string> = {
  loading: 'Reading your project\u2019s Tailwind setup\u2026',
  'no-selection': 'Put your cursor inside a className string to see it explained.',
  'no-workspace-tailwind':
    'No Tailwind in this workspace. Install tailwindcss v4 and reopen this panel to explain classes here.',
  'no-css-entry':
    'No entry stylesheet found. Add @import "tailwindcss"; to the CSS file your app loads, so twexplain can read your theme.',
  'unsupported-plugin':
    'This project uses a Tailwind @plugin, which twexplain does not support yet.',
  'stale-runtime':
    'Tailwind changed version since this window loaded it. Reload the window to explain classes against the new version.',
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

export function App({ vscode }: { vscode: { postMessage(m: unknown): void } }): ReactElement {
  const [state, setState] = useState<PanelState>({ status: 'no-selection' })
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [palette, setPalette] = useState<PaletteColor[]>([])
  const [variants, setVariants] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const queryRef = useRef('')

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage>): void => {
      if (event.data.type === 'state') {
        const next = event.data.state
        setState(next)
        if (next.status === 'ready') {
          if (next.palette.length > 0) setPalette(next.palette)
          if (next.variants.length > 0) setVariants(next.variants)
        }
      } else if (event.data.type === 'suggestions' && event.data.query === queryRef.current) {
        setSuggestions(event.data.matches)
      }
    }
    window.addEventListener('message', onMessage)
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [vscode])

  const isReady = state.status === 'ready'

  useEffect(() => {
    if (!isReady) return undefined

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'z' && event.key !== 'Z') return
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return
      if (isTextEntry(event.target)) return
      event.preventDefault()
      vscode.postMessage({ type: 'undo' })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [vscode, isReady])

  const sendIntent = (intent: EditIntent): void => {
    vscode.postMessage({ type: 'edit', intent })
  }

  const search = (next: string): void => {
    queryRef.current = next
    setQuery(next)
    setSuggestions([])
    vscode.postMessage({ type: 'search', query: next })
  }

  const pick = (text: string): void => {
    sendIntent({ type: 'add', text })
    queryRef.current = ''
    setQuery('')
    setSuggestions([])
  }

  const closeAdding = (): void => {
    setAdding(false)
    queryRef.current = ''
    setQuery('')
    setSuggestions([])
  }

  const toggleAdding = (): void => {
    if (adding) closeAdding()
    else setAdding(true)
  }

  return (
    <div className="p-2 font-sans text-base text-fg [&_*]:box-border">
      {state.status === 'ready' && (
        <header className="sticky top-0 z-[2] -mx-2 -mt-2 mb-2 flex items-center justify-end gap-1 border-b border-edge bg-[var(--vscode-sideBar-background,var(--vscode-editor-background))] px-2 py-[5px]">
          {adding && (
            <AddClass
              value={query}
              suggestions={suggestions}
              onChange={search}
              onPick={pick}
              onClose={closeAdding}
            />
          )}
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label="add a class"
            aria-expanded={adding}
            title="Add a class"
            onClick={toggleAdding}
          >
            <Icon name="add" />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            aria-label="undo last edit"
            title="Runs the editor’s own undo, the same as ⌘Z"
            onClick={() => vscode.postMessage({ type: 'undo' })}
          >
            <Icon name="discard" />
          </button>
        </header>
      )}
      {state.status === 'wrong-version' && (
        <p className="px-1 py-3 leading-relaxed text-muted">
          twexplain supports Tailwind v4 only. This workspace has {state.found}.
        </p>
      )}
      {state.status === 'load-error' && (
        <p className="px-1 py-3 leading-relaxed text-muted">
          Could not load the design system: {state.message}
        </p>
      )}
      {state.status in NOTICES && (
        <p className="px-1 py-3 leading-relaxed text-muted">{NOTICES[state.status]}</p>
      )}
      {state.status === 'ready' && state.groups.length === 0 && (
        <p className="px-1 py-3 leading-relaxed text-muted">This class string is empty.</p>
      )}
      {state.status === 'ready' &&
        state.groups.length > 0 &&
        state.groups.map((group) => (
          <section className="mb-3" key={group.name}>
            <h2 className="mb-1 border-b border-edge pb-0.5 text-xs tracking-[0.06em] text-muted uppercase">
              {group.name}
            </h2>
            {group.classes.map((explained) => (
              <ClassRow
                explained={explained}
                key={`${explained.candidate.index}:${explained.candidate.text}`}
                onIntent={sendIntent}
                palette={palette}
                availableVariants={variants}
              />
            ))}
          </section>
        ))}
    </div>
  )
}
