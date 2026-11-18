import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { parseComputer, throwAt, undoCount } from '../../engine/computer'
import { dart } from '../../engine/dart'
import type { GameModule, GameRecord, PlayerId } from '../../engine/game'
import DartPad from '../DartPad/DartPad'
import GameMenu from './GameMenu'
import Results from './Results'
import { useGameRunner } from './useGameRunner'
import styles from './GameShell.module.css'

type Props<TOptions, TState> = {
  module: GameModule<TOptions, TState>
  record: GameRecord<TOptions>
  playerName(id: PlayerId): string
  playerColor?(id: PlayerId): string | undefined
  /** Same players and options, a fresh game. */
  onPlayAgain(): void
  /**
   * Back to the setup screen, from the menu or the results, with the game's
   * last record: unfinished when it was quit.
   */
  onExit(record: GameRecord<TOptions>): void
  /** Called with the record at the start and after every change, to save it. */
  onRecord?(record: GameRecord<TOptions>): void
  /** For a computer's darts; works like `Math.random`. */
  random?: () => number
  /** Milliseconds between a computer's darts. */
  computerDelay?: number
}

/** Where a computer aims in a game without its own `aim`. */
const T20 = dart(20, 3)

/**
 * The in-game screen shared by every game: the module's scoreboard with the
 * Big Keys pad below it on a phone and beside it on a tablet, then the
 * results once the game is over. Give it a new `key` for each game.
 */
function GameShell<TOptions, TState>({
  module,
  record: initial,
  playerName,
  playerColor,
  onPlayAgain,
  onExit,
  onRecord,
  random = Math.random,
  computerDelay = 900,
}: Props<TOptions, TState>) {
  const { t } = useTranslation()
  const { runner, record, state } = useGameRunner(module, initial)
  // The latest callback, so a new function from the parent doesn't save
  // the same record again.
  const onRecordRef = useRef(onRecord)
  useEffect(() => {
    onRecordRef.current = onRecord
  })
  useEffect(() => {
    onRecordRef.current?.(record)
  }, [record])

  // A computer throws its own darts, one at a time. They go into the dart
  // log like anyone's, so resuming a game picks up where it was.
  const thrower = record.result ? null : module.currentThrower(state)
  const computer = thrower === null ? null : parseComputer(thrower)
  const level = computer?.level ?? null
  useEffect(() => {
    if (level === null) return undefined
    const timer = setTimeout(() => {
      const target = module.aim?.(state, record.options) ?? T20
      runner.throwDart(throwAt(target, level, random))
    }, computerDelay)
    return () => clearTimeout(timer)
  }, [level, state, record.options, module, runner, random, computerDelay])

  // Undo goes back to the last person's dart, taking the computers' darts
  // after it too.
  const undoDarts = undoCount(record.darts)
  const undo = () => runner.undo(undoDarts)
  const { Scoreboard, Status } = module

  if (record.result) {
    return (
      <Results
        module={module}
        state={state}
        record={record}
        result={record.result}
        playerName={playerName}
        onPlayAgain={onPlayAgain}
        onUndo={undo}
        onExit={() => onExit(record)}
      />
    )
  }

  return (
    <div className={styles.shell}>
      <div className={styles.state}>
        <header className={styles.bar}>
          <h2 className={styles.status}>
            {Status ? (
              <Status state={state} playerName={playerName} />
            ) : (
              module.id
            )}
          </h2>
          <GameMenu onQuit={() => onExit(record)} />
        </header>
        <Scoreboard
          state={state}
          playerName={playerName}
          playerColor={playerColor}
          hint={module.hint ? module.hint(state) : undefined}
        />
      </div>
      <div className={styles.pad}>
        <p className={styles.computerTurn} aria-live="polite">
          {thrower !== null &&
            computer &&
            t('computer.throwing', { name: playerName(thrower) })}
        </p>
        <DartPad
          onDart={(thrown) => runner.throwDart(thrown)}
          onUndo={undo}
          canUndo={undoDarts > 0}
          locked={computer !== null}
        />
      </div>
    </div>
  )
}

export default GameShell
