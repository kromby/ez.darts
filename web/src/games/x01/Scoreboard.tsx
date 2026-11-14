import { useId, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { notation, points } from '../../engine/dart'
import type { ScoreboardProps } from '../../engine/game'
import { currentSide, currentThrower, type Side } from '../../engine/turns'
import { formatDecimal } from '../../i18n/format'
import { average, type X01Stats } from './stats'
import type { X01State } from './x01'
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

/**
 * Big Keys game state: the thrower's remaining score as the largest thing on
 * screen, the turn's dart slots, the checkout hint slot and every side as a
 * chip (phone) or a row (tablet). After a turn ends the dart slots show how
 * it went (scored, bust or checkout) until the next dart.
 */
function Scoreboard({ state, playerName, hint }: ScoreboardProps<X01State>) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const { turns, turnDarts, lastTurn, options } = state
  const side = currentSide(turns)
  const thrower = currentThrower(turns)
  const score = turns.board[side.id]
  const throwerStats = state.stats[thrower]
  const throwerAverage = throwerStats ? average(throwerStats) : null
  const feedback = turnDarts.length === 0 ? lastTurn : null
  const decimal = (value: number | null) =>
    value === null ? '–' : formatDecimal(value, i18n.language)
  const sideName = (s: Side) => s.members.map(playerName).join(' & ')

  function feedbackText() {
    if (!feedback) return ''
    const name = playerName(feedback.playerId)
    switch (feedback.result) {
      case 'bust':
        return t('x01.feedback.bust', { name, score: feedback.from })
      case 'finished':
        return t('x01.feedback.finished', { name, score: feedback.from })
      case 'scored':
        return t('x01.feedback.scored', {
          name,
          score: feedback.from - turns.board[feedback.sideId].remaining,
        })
    }
  }

  return (
    <div className={styles.board}>
      <section
        className={styles.current}
        aria-labelledby={`${id}-throwing`}
        data-result={feedback?.result}
      >
        <p id={`${id}-throwing`} className={styles.throwing}>
          {t('x01.throwing', { name: playerName(thrower) })}
        </p>
        <div className={styles.score}>
          <p className={styles.remaining} data-testid="remaining">
            {score.remaining}
          </p>
          <dl className={styles.stats}>
            <div>
              <dt>{t('x01.average')}</dt>
              <dd>{decimal(throwerAverage)}</dd>
            </div>
            <div>
              <dt>{t('x01.darts')}</dt>
              <dd>{throwerStats?.darts ?? 0}</dd>
            </div>
            <div>
              <dt>{t('x01.turnFrom')}</dt>
              <dd>{turns.turnStart[side.id].remaining}</dd>
            </div>
          </dl>
        </div>
        {!score.opened && <p className={styles.notIn}>{t('x01.notIn')}</p>}

        <div className={styles.turn}>
          <ol
            className={styles.slots}
            aria-label={t('x01.turnDarts')}
            hidden={feedback !== null}
          >
            {Array.from({ length: turns.dartsPerTurn }, (_, index) => {
              const thrown = turnDarts[index]
              if (thrown) {
                return (
                  <li key={index} className={styles.slot} data-state="thrown">
                    <strong>{notation(thrown) ?? t('pad.miss')}</strong>
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
          <div
            role="status"
            className={styles.feedback}
            data-result={feedback?.result}
          >
            {feedback && (
              <>
                <strong>{feedbackText()}</strong>
                <small>
                  {feedback.darts
                    .map((thrown) => notation(thrown) ?? t('pad.miss'))
                    .join(' ')}
                </small>
              </>
            )}
          </div>
        </div>
      </section>

      {hint !== undefined && (
        <p className={styles.hint} data-empty={hint === null}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="1.5" />
          </svg>
          <span>{t('x01.checkout')}</span>
          <strong>{hint}</strong>
        </p>
      )}

      <div className={styles.players}>
        <h3 id={`${id}-scores`} className={styles.heading}>
          {t('x01.scores')}
        </h3>
        <ol className={styles.sides} aria-labelledby={`${id}-scores`}>
          {turns.sides.map((s, index) => {
            const sideScore = turns.board[s.id]
            const place = turns.finished.indexOf(s.id)
            const isTeam = s.id !== s.members[0]
            const stats = sideStats(state, s)
            const color =
              (isTeam && teamColors[s.id]) || avatarColors[index % 3]
            return (
              <li
                key={s.id}
                className={styles.side}
                aria-current={s.id === side.id || undefined}
                data-done={place >= 0 || undefined}
                style={{ '--avatar': color } as CSSProperties}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {isTeam
                    ? s.id
                    : playerName(s.members[0]).charAt(0).toLocaleUpperCase()}
                </span>
                <span className={styles.who}>
                  <span className={styles.name}>
                    {sideName(s)}
                    {sideScore.start !== options.startScore && (
                      <span className={styles.tag}>
                        <span aria-hidden="true">
                          {t('x01.handicapTag', { score: sideScore.start })}
                        </span>
                        <span className="sr-only">
                          {t('x01.handicap', { score: sideScore.start })}
                        </span>
                      </span>
                    )}
                    {!sideScore.opened && (
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
                  {place >= 0
                    ? t('x01.place', { place: place + 1 })
                    : sideScore.remaining}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

export default Scoreboard
