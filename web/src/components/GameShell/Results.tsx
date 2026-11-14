import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  GameModule,
  GameRecord,
  GameResult,
  PlayerId,
} from '../../engine/game'
import { groupStandings } from './standings'
import styles from './Results.module.css'

type Props<TOptions, TState> = {
  module: GameModule<TOptions, TState>
  state: TState
  record: GameRecord<TOptions>
  result: GameResult
  playerName(id: PlayerId): string
  onPlayAgain(): void
  /** Takes back the last dart and returns to the game. */
  onUndo(): void
  onExit(): void
}

/** End of a game: who won, the standings with key numbers, and what next. */
function Results<TOptions, TState>({
  module,
  state,
  record,
  result,
  playerName,
  onPlayAgain,
  onUndo,
  onExit,
}: Props<TOptions, TState>) {
  const { t } = useTranslation()
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  const places = groupStandings(result.standings, record.slots)
  const names = (ids: PlayerId[]) => ids.map(playerName).join(' & ')
  const minutes = Math.max(
    1,
    Math.round(
      (Date.parse(result.finishedAt) - Date.parse(record.startedAt)) / 60_000,
    ),
  )
  const { PlayerSummary } = module

  // Move focus here from the pad, which is gone.
  useEffect(() => heading.current?.focus(), [])

  return (
    <div className={styles.results}>
      <header className={styles.header}>
        <p className={styles.over}>{t('game.over')}</p>
        <h2 ref={heading} tabIndex={-1} className={styles.winner}>
          {t('game.winner', { name: names(places[0] ?? []) })}
        </h2>
        <p className={styles.meta}>
          {t('game.dartCount', { count: record.darts.length })} ·{' '}
          {t('game.minutes', { count: minutes })}
        </p>
      </header>

      <section>
        <h3 id={`${id}-standings`} className={styles.heading}>
          {t('game.standings')}
        </h3>
        <ol className={styles.standings} aria-labelledby={`${id}-standings`}>
          {places.map((ids, index) => (
            <li
              key={ids.join()}
              className={styles.place}
              data-first={index === 0 || undefined}
            >
              <span className={styles.number}>
                {t('game.place', { place: index + 1 })}
              </span>
              <div className={styles.players}>
                {ids.map((id) => (
                  <div key={id} className={styles.player}>
                    <p className={styles.name}>{playerName(id)}</p>
                    {PlayerSummary && (
                      <PlayerSummary state={state} playerId={id} />
                    )}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className={styles.actions}>
        <button type="button" data-kind="primary" onClick={onPlayAgain}>
          {t('game.playAgain')}
        </button>
        <button type="button" onClick={onUndo}>
          {t('game.undoLast')}
        </button>
        <button type="button" onClick={onExit}>
          {t('game.newGame')}
        </button>
      </div>
    </div>
  )
}

export default Results
