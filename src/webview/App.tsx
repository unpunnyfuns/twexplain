import { type ReactElement, useEffect, useRef, useState } from 'react'
import type { EditIntent, HostMessage, PanelState } from '../types'
import styles from './App.module.css'
import { AddClass } from './AddClass'
import { ClassRow } from './ClassRow'

export const NOTICES: Record<string, string> = {
  loading: 'Reading your project\u2019s Tailwind setup\u2026',
  'no-selection': 'Put your cursor inside a className string to see it explained.',
  'no-workspace-tailwind': 'No Tailwind installed in this workspace.',
  'no-css-entry': 'No CSS file importing "tailwindcss" was found.',
  'unsupported-plugin':
    'This project uses a Tailwind @plugin, which twexplain does not support yet.',
  'stale-runtime':
    'Tailwind changed version since this window loaded it. Reload the window to explain classes against the new version.',
}

export function App({ vscode }: { vscode: { postMessage(m: unknown): void } }): ReactElement {
  const [state, setState] = useState<PanelState>({ status: 'no-selection' })
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const queryRef = useRef('')

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage>): void => {
      if (event.data.type === 'state') setState(event.data.state)
      else if (event.data.type === 'suggestions' && event.data.query === queryRef.current) {
        setSuggestions(event.data.matches)
      }
    }
    window.addEventListener('message', onMessage)
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [vscode])

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

  return (
    <div className={styles.panel}>
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
                palette={state.palette}
              />
            ))}
          </section>
        ))}
      {state.status === 'ready' && (
        <AddClass value={query} suggestions={suggestions} onChange={search} onPick={pick} />
      )}
    </div>
  )
}
