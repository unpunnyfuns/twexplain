import type { ReactElement } from 'react'
import type { ExplainedClass } from '../types'
import styles from './ClassRow.module.css'

export function ClassRow({ explained }: { explained: ExplainedClass }): ReactElement {
  const { candidate, valid, prose, declarations, swatch } = explained

  return (
    <div className={styles.row}>
      <span className={valid ? styles.name : `${styles.name} ${styles.invalid}`}>
        {candidate.text}
      </span>
      <span>
        {swatch !== null && <span className={styles.swatch} style={{ background: swatch }} />}
        {!valid && <span className={styles.unexplained}>not a known Tailwind class</span>}
        {valid && prose !== null && <span className={styles.prose}>{prose}</span>}
        {valid && prose === null && (
          <>
            <span className={styles.unexplained}>no plain-English entry yet</span>
            <pre className={styles.raw}>
              {declarations.map((d) => `${d.prop}: ${d.value}`).join('\n')}
            </pre>
          </>
        )}
      </span>
    </div>
  )
}
