import type { ReactElement } from 'react'
import type { ExplainedClass } from '../types'
import styles from './ClassRow.module.css'

function swatchCondition(explained: ExplainedClass): string | null {
  const { declarations, swatch, variants } = explained
  const source = declarations.find((d) => d.value === swatch)
  if (source?.context !== undefined) return source.context
  if (variants.length > 0) return variants.join(', ')
  return null
}

export function ClassRow({ explained }: { explained: ExplainedClass }): ReactElement {
  const { candidate, valid, prose, declarations, swatch } = explained
  const condition = swatch === null ? null : swatchCondition(explained)
  const swatchTitle = condition === null ? swatch : `${swatch} — only when ${condition}`

  return (
    <div className={styles.row}>
      <span className={valid ? styles.name : `${styles.name} ${styles.invalid}`}>
        {candidate.text}
      </span>
      <span>
        {swatch !== null && (
          <span
            className={
              condition === null ? styles.swatch : `${styles.swatch} ${styles.swatchConditional}`
            }
            style={{ background: swatch }}
            title={swatchTitle ?? undefined}
          />
        )}
        {!valid && <span className={styles.unexplained}>not a known Tailwind class</span>}
        {valid && prose !== null && <span className={styles.prose}>{prose}</span>}
        {valid && prose === null && declarations.length === 0 && (
          <span className={styles.unexplained}>sets only Tailwind-internal variables</span>
        )}
        {valid && prose === null && declarations.length > 0 && (
          <>
            <span className={styles.unexplained}>no plain-English entry yet</span>
            <pre className={styles.raw}>
              {declarations
                .map((d) =>
                  d.context === undefined
                    ? `${d.prop}: ${d.value}`
                    : `${d.context} {\n  ${d.prop}: ${d.value}\n}`,
                )
                .join('\n')}
            </pre>
          </>
        )}
      </span>
    </div>
  )
}
