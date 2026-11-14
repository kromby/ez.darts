import { useId, type CSSProperties, type ReactNode } from 'react'
import styles from './Scoreboard.module.css'

/*
 * Building blocks for a game's Big Keys scoreboard. A game maps its state
 * onto these; the layout (chips on a phone, a list on a tablet) and the
 * no-jump rules for the area above the pad live here.
 */

export function Board({ children }: { children: ReactNode }) {
  return <div className={styles.board}>{children}</div>
}

export type Stat = { label: string; value: ReactNode }

export type Slot = {
  /** Which dart of the turn: 1, 2 or 3. */
  number: number
  /** `T20`, or "Dart 2" for one not thrown yet. */
  label: string
  /** Shown small under a thrown dart, e.g. its points. */
  detail?: ReactNode
  state: 'thrown' | 'next' | 'empty'
}

export type Feedback = {
  /** Styles the card: `bust` red, `finished` green, anything else plain. */
  result: string
  text: string
  /** The turn's darts. */
  detail: string
}

function Stats({ stats }: { stats: Stat[] }) {
  return (
    <dl className={styles.stats}>
      {stats.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Slots({
  slots,
  label,
  hidden,
}: {
  slots: Slot[]
  label: string
  hidden: boolean
}) {
  return (
    <ol className={styles.slots} aria-label={label} hidden={hidden}>
      {slots.map((slot) => (
        <li
          key={slot.number}
          className={styles.slot}
          data-state={slot.state}
          aria-current={slot.state === 'next' ? 'step' : undefined}
        >
          {slot.state === 'thrown' ? <strong>{slot.label}</strong> : slot.label}
          {slot.state === 'thrown' && <small>{slot.detail}</small>}
        </li>
      ))}
    </ol>
  )
}

/** A live region, so it is always rendered. */
function TurnFeedback({ feedback }: { feedback: Feedback | null }) {
  return (
    <div
      role="status"
      className={styles.feedback}
      data-result={feedback?.result}
    >
      {feedback && <strong>{feedback.text}</strong>}
      {feedback && <small>{feedback.detail}</small>}
    </div>
  )
}

type CurrentCardProps = {
  /** "Throwing: Anna" */
  title: string
  /** The largest thing on screen: what is left, or the next target. */
  value: ReactNode
  stats: Stat[]
  /** A tag under the value, e.g. "not in". */
  notice?: string | null
  slots: Slot[]
  slotsLabel: string
  /** How the last turn went; replaces the slots until the next dart. */
  feedback: Feedback | null
}

/** The thrower's card: the big value, stats, and the turn's dart slots. */
export function CurrentCard({
  title,
  value,
  stats,
  notice,
  slots,
  slotsLabel,
  feedback,
}: CurrentCardProps) {
  const id = useId()
  return (
    <section
      className={styles.current}
      aria-labelledby={id}
      data-result={feedback?.result}
    >
      <p id={id} className={styles.throwing}>
        {title}
      </p>
      <div className={styles.score}>
        <p
          className={styles.remaining}
          data-testid="remaining"
          data-long={
            (typeof value === 'string' && value.length > 3) || undefined
          }
        >
          {value}
        </p>
        <Stats stats={stats} />
      </div>
      {notice && <p className={styles.notice}>{notice}</p>}
      <div className={styles.turn}>
        <Slots slots={slots} label={slotsLabel} hidden={feedback !== null} />
        <TurnFeedback feedback={feedback} />
      </div>
    </section>
  )
}

/** Keeps its height while empty, so the pad below never moves. */
export function HintBar({
  label,
  hint,
  alternative,
}: {
  label: string
  hint: string | null
  alternative?: string | null
}) {
  return (
    <p className={styles.hint} data-empty={hint === null}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
      <span>{label}</span>
      <strong>{hint}</strong>
      {alternative && <small>{alternative}</small>}
    </p>
  )
}

/** A short tag after a side's name, with fuller words for screen readers. */
export function Tag({ text, spoken }: { text: string; spoken?: string }) {
  if (!spoken) return <span className={styles.tag}>{text}</span>
  return (
    <span className={styles.tag}>
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  )
}

export type SideView = {
  id: string
  name: string
  avatar: string
  color: string
  tags?: ReactNode
  /** Under the name on a tablet, e.g. "avg 62.7 · 19 darts". */
  line: string
  /** What is left, the target, or a place once done. */
  value: ReactNode
  current: boolean
  done: boolean
}

function SideRow({ side }: { side: SideView }) {
  return (
    <li
      className={styles.side}
      aria-current={side.current || undefined}
      data-done={side.done || undefined}
      style={{ '--avatar': side.color } as CSSProperties}
    >
      <span className={styles.avatar} aria-hidden="true">
        {side.avatar}
      </span>
      <span className={styles.who}>
        <span className={styles.name}>
          {side.name}
          {side.tags}
        </span>
        <span className={styles.line}>{side.line}</span>
      </span>
      <span className={styles.points}>{side.value}</span>
    </li>
  )
}

/** Every side: chips above the card on a phone, a list on a tablet. */
export function SideList({
  heading,
  sides,
}: {
  heading: string
  sides: SideView[]
}) {
  const id = useId()
  return (
    <div className={styles.players}>
      <h3 id={id} className={styles.heading}>
        {heading}
      </h3>
      <ol className={styles.sides} aria-labelledby={id}>
        {sides.map((side) => (
          <SideRow key={side.id} side={side} />
        ))}
      </ol>
    </div>
  )
}
