import { type ReactElement, useEffect, useRef, useState } from 'react'
import type { EditIntent, HostMessage, PaletteColor, PanelState } from '../types'
import styles from './App.module.css'
import { AddClass } from './AddClass'
import { ClassRow } from './ClassRow'

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
    <div className={styles.panel}>
      {state.status === 'ready' && (
        <header className={styles.header}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="add a class"
            aria-expanded={adding}
            title="Add a class"
            onClick={toggleAdding}
          >
            <span aria-hidden="true">+</span>
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="undo last edit"
            title="Runs the editor’s own undo, the same as ⌘Z"
            onClick={() => vscode.postMessage({ type: 'undo' })}
          >
            <span aria-hidden="true">{'↶'}</span>
          </button>
          {adding && (
            <AddClass
              value={query}
              suggestions={suggestions}
              onChange={search}
              onPick={pick}
              onClose={closeAdding}
            />
          )}
        </header>
      )}
      {state.status === 'wrong-version' && (
        <p className={styles.notice}>
          twexplain supports Tailwind v4 only. This workspace has {state.found}.
        </p>
      )}
      {state.status === 'load-error' && (
        <p className={styles.notice}>Could not load the design system: {state.message}</p>
      )}
      {state.status in NOTICES && <p className={styles.notice}>{NOTICES[state.status]}</p>}
      {state.status === 'ready' && state.groups.length === 0 && (
        <p className={styles.notice}>This class string is empty.</p>
      )}
      {state.status === 'ready' &&
        state.groups.length > 0 &&
        state.groups.map((group) => (
          <section className={styles.group} key={group.name}>
            <h2 className={styles.groupName}>{group.name}</h2>
            {group.classes.map((explained) => (
              <ClassRow
                explained={explained}
                key={explained.candidate.index}
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
