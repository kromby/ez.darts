import { useId, type ReactNode } from 'react'
import styles from './StatsScreen.module.css'

/** A titled card; the title names its region for screen readers. */
export function Card({
  title,
  aside,
  children,
}: {
  title: string
  aside?: string | null
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.cardHead}>
        <h3 id={id}>{title}</h3>
        {aside && <span>{aside}</span>}
      </div>
      {children}
    </section>
  )
}

/** Column headings: a label column, then right-aligned number columns. */
export function TableHead({
  first,
  numbers,
}: {
  first: string
  numbers: string[]
}) {
  const cells = numbers.map((label) => (
    <th key={label} scope="col" className={styles.n}>
      {label}
    </th>
  ))
  return (
    <thead>
      <tr>
        <th scope="col">{first}</th>
        {cells}
      </tr>
    </thead>
  )
}
