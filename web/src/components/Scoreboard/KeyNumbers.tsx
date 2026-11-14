import type { ReactNode } from 'react'
import styles from './KeyNumbers.module.css'

/** A player's key numbers for the results screen, label then value. */
function KeyNumbers({
  items,
}: {
  items: { label: string; value: ReactNode }[]
}) {
  return (
    <dl className={styles.summary}>
      {items.map((item) => (
        <div key={item.label} className={styles.item}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default KeyNumbers
