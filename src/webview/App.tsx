import { type ReactElement, useEffect, useState } from 'react'
import type { HostMessage, PanelState } from '../types'
import styles from './App.module.css'
import { ClassRow } from './ClassRow'

const NOTICES: Record<string, string> = {
  'no-selection': 'Put your cursor inside a className string to see it explained.',
  'no-workspace-tailwind': 'No Tailwind installed in this workspace.',
  'no-css-entry': 'No CSS file importing "tailwindcss" was found.',
}

export function App({ vscode }: { vscode: { postMessage(m: unknown): void } }): ReactElement {
  const [state, setState] = useState<PanelState>({ status: 'no-selection' })

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage>): void => {
      if (event.data.type === 'state') setState(event.data.state)
    }
    window.addEventListener('message', onMessage)
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [vscode])

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
      {state.status === 'ready' &&
        state.groups.map((group) => (
          <section className={styles.group} key={group.name}>
            <h2 className={styles.groupName}>{group.name}</h2>
            {group.classes.map((explained) => (
              <ClassRow explained={explained} key={explained.candidate.index} />
            ))}
          </section>
        ))}
    </div>
  )
}
