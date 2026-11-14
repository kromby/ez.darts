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
  /** Same players and options, a fresh game. */
  onPlayAgain(): void
  /** Back to the setup screen, from the menu or the results. */
  onExit(): void
}

/**
 * The in-game screen shared by every game: the module's scoreboard with the
 * Big Keys pad below it on a phone and beside it on a tablet, then the
 * results once the game is over. Give it a new `key` for each game.
 */
function GameShell<TOptions, TState>({
  module,
  record: initial,
  playerName,
  onPlayAgain,
  onExit,
}: Props<TOptions, TState>) {
  const { runner, record, state } = useGameRunner(module, initial)
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
        onUndo={() => runner.undo()}
        onExit={onExit}
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
          <GameMenu onQuit={onExit} />
        </header>
        <Scoreboard
          state={state}
          playerName={playerName}
          hint={module.hint ? module.hint(state) : undefined}
        />
      </div>
      <div className={styles.pad}>
        <DartPad
          onDart={(dart) => runner.throwDart(dart)}
          onUndo={() => runner.undo()}
          canUndo={record.darts.length > 0}
        />
      </div>
    </div>
  )
}

export default GameShell
