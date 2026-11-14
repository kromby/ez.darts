import { useId, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { notation, points, type Dart } from '../../engine/dart'
import type { PlayerId, ScoreboardProps } from '../../engine/game'
import { currentSide, currentThrower, type Side } from '../../engine/turns'
import { formatDecimal } from '../../i18n/format'
import { average, type X01Stats } from './stats'
import type { X01State, X01Turn } from './x01'
import styles from './Scoreboard.module.css'

const avatarColors = ['var(--team-a)', 'var(--team-b)', 'var(--team-c)']
const teamColors: Record<string, string> = {
  A: 'var(--team-a)',
  B: 'var(--team-b)',
  C: 'var(--team-c)',
}

/** A team's numbers are its members' added together. */
function sideStats(state: X01State, side: Side): X01Stats {
  return side.members
    .map((id) => state.stats[id])
    .filter(Boolean)
    .reduce(
      (total, stats) => ({
        darts: total.darts + stats.darts,
        scored: total.scored + stats.scored,
        bestTurn: Math.max(total.bestTurn, stats.bestTurn),
        checkout: total.checkout ?? stats.checkout,
      }),
      { darts: 0, scored: 0, bestTurn: 0, checkout: null },
    )
}

/** An average with one decimal, or a dash before the first dart. */
function useDecimal() {
  const { i18n } = useTranslation()
  return (value: number | null) =>
    value === null ? '–' : formatDecimal(value, i18n.language)
}

function useDartName() {
  const { t } = useTranslation()
  return (dart: Dart) => notation(dart) ?? t('pad.miss')
}

type Names = { playerName(id: PlayerId): string }

function ThrowerStats({ state }: { state: X01State }) {
  const { t } = useTranslation()
  const decimal = useDecimal()
  const { turns } = state
  const stats = state.stats[currentThrower(turns)]
  const turnFrom = turns.turnStart[currentSide(turns).id].remaining

  const items = [
    { label: t('x01.average'), value: decimal(stats ? average(stats) : null) },
    { label: t('x01.darts'), value: stats?.darts ?? 0 },
    { label: t('x01.turnFrom'), value: turnFrom },
  ]
  return (
    <dl className={styles.stats}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function DartSlots({ state, hidden }: { state: X01State; hidden: boolean }) {
  const { t } = useTranslation()
  const dartName = useDartName()
  const { turnDarts } = state

  return (
    <ol
      className={styles.slots}
      aria-label={t('x01.turnDarts')}
      hidden={hidden}
    >
      {Array.from({ length: state.turns.dartsPerTurn }, (_, index) => {
        const thrown = turnDarts.at(index)
        if (thrown) {
          return (
            <li key={index} className={styles.slot} data-state="thrown">
              <strong>{dartName(thrown)}</strong>
              <small>{points(thrown)}</small>
            </li>
          )
        }
        const next = index === turnDarts.length
        return (
          <li
            key={index}
            className={styles.slot}
            data-state={next ? 'next' : 'empty'}
            aria-current={next ? 'step' : undefined}
          >
            {t('x01.dartSlot', { number: index + 1 })}
          </li>
        )
      })}
    </ol>
  )
}

/** How the last turn went; a live region, so it is always rendered. */
function TurnFeedback({
  state,
  turn,
  playerName,
}: Names & { state: X01State; turn: X01Turn | null }) {
  const { t } = useTranslation()
  const dartName = useDartName()

  function text(last: X01Turn): string {
    const name = playerName(last.playerId)
    if (last.result === 'scored') {
      const left = state.turns.board[last.sideId].remaining
      return t('x01.feedback.scored', { name, score: last.from - left })
    }
    return t(`x01.feedback.${last.result}`, { name, score: last.from })
  }

  return (
    <div role="status" className={styles.feedback} data-result={turn?.result}>
      {turn && <strong>{text(turn)}</strong>}
      {turn && <small>{turn.darts.map(dartName).join(' ')}</small>}
    </div>
  )
}

function CurrentThrower({ state, playerName }: Names & { state: X01State }) {
  const { t } = useTranslation()
  const id = useId()
  const { turns, turnDarts, lastTurn } = state
  const score = turns.board[currentSide(turns).id]
  const feedback = turnDarts.length === 0 ? lastTurn : null

  return (
    <section
      className={styles.current}
      aria-labelledby={id}
      data-result={feedback?.result}
    >
      <p id={id} className={styles.throwing}>
        {t('x01.throwing', { name: playerName(currentThrower(turns)) })}
      </p>
      <div className={styles.score}>
        <p className={styles.remaining} data-testid="remaining">
          {score.remaining}
        </p>
        <ThrowerStats state={state} />
      </div>
      {!score.opened && <p className={styles.notIn}>{t('x01.notIn')}</p>}
      <div className={styles.turn}>
        <DartSlots state={state} hidden={feedback !== null} />
        <TurnFeedback state={state} turn={feedback} playerName={playerName} />
      </div>
    </section>
  )
}

/** Keeps its height while empty, so the pad below never moves. */
function HintBar({ hint }: { hint: string | null }) {
  const { t } = useTranslation()
  return (
    <p className={styles.hint} data-empty={hint === null}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
      <span>{t('x01.checkout')}</span>
      <strong>{hint}</strong>
    </p>
  )
}

function HandicapTag({ score }: { score: number }) {
  const { t } = useTranslation()
  return (
    <span className={styles.tag}>
      <span aria-hidden="true">{t('x01.handicapTag', { score })}</span>
      <span className="sr-only">{t('x01.handicap', { score })}</span>
    </span>
  )
}

function SideRow({
  state,
  side,
  index,
  playerName,
}: Names & { state: X01State; side: Side; index: number }) {
  const { t } = useTranslation()
  const decimal = useDecimal()
  const { turns, options } = state
  const score = turns.board[side.id]
  const place = turns.finished.indexOf(side.id)
  const isTeam = side.id !== side.members[0]
  const stats = sideStats(state, side)
  const color = (isTeam && teamColors[side.id]) || avatarColors[index % 3]
  const initial = playerName(side.members[0]).charAt(0).toLocaleUpperCase()

  return (
    <li
      className={styles.side}
      aria-current={side.id === currentSide(turns).id || undefined}
      data-done={place >= 0 || undefined}
      style={{ '--avatar': color } as CSSProperties}
    >
      <span className={styles.avatar} aria-hidden="true">
        {isTeam ? side.id : initial}
      </span>
      <span className={styles.who}>
        <span className={styles.name}>
          {side.members.map(playerName).join(' & ')}
          {score.start !== options.startScore && (
            <HandicapTag score={score.start} />
          )}
          {!score.opened && (
            <span className={styles.tag}>{t('x01.notIn')}</span>
          )}
        </span>
        <span className={styles.line}>
          {t('x01.playerLine', {
            average: decimal(average(stats)),
            darts: t('game.dartCount', { count: stats.darts }),
          })}
        </span>
      </span>
      <span className={styles.points}>
        {place >= 0 ? t('x01.place', { place: place + 1 }) : score.remaining}
      </span>
    </li>
  )
}

function SideList({ state, playerName }: Names & { state: X01State }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className={styles.players}>
      <h3 id={id} className={styles.heading}>
        {t('x01.scores')}
      </h3>
      <ol className={styles.sides} aria-labelledby={id}>
        {state.turns.sides.map((side, index) => (
          <SideRow
            key={side.id}
            state={state}
            side={side}
            index={index}
            playerName={playerName}
          />
        ))}
      </ol>
    </div>
  )
}

/**
 * Big Keys game state: the thrower's remaining score as the largest thing on
 * screen, the turn's dart slots, the checkout hint slot and every side as a
 * chip (phone) or a row (tablet). After a turn ends the dart slots show how
 * it went (scored, bust or checkout) until the next dart.
 */
function Scoreboard({ state, playerName, hint }: ScoreboardProps<X01State>) {
  return (
    <div className={styles.board}>
      <CurrentThrower state={state} playerName={playerName} />
      {hint !== undefined && <HintBar hint={hint} />}
      <SideList state={state} playerName={playerName} />
    </div>
  )
}

export default Scoreboard
