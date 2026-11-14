import { isValidDart, type Dart } from './dart'
import type { GameModule, GameRecord, GameResult, PlayerSlot } from './game'

export type NewGame<TOptions> = {
  options: TOptions
  slots: PlayerSlot[]
  configVersion: number
  /** Defaults to a random UUID. */
  id?: string
  /** Defaults to now. */
  startedAt?: Date
}

export function createGameRecord<TOptions, TState>(
  module: GameModule<TOptions, TState>,
  game: NewGame<TOptions>,
): GameRecord<TOptions> {
  return {
    id: game.id ?? crypto.randomUUID(),
    game: module.id,
    configVersion: game.configVersion,
    options: game.options,
    slots: game.slots,
    darts: [],
    startedAt: (game.startedAt ?? new Date()).toISOString(),
    result: null,
  }
}

/** Rebuilds game state by replaying the dart log from the start. */
export function replay<TOptions, TState>(
  module: GameModule<TOptions, TState>,
  record: GameRecord<TOptions>,
): TState {
  return record.darts.reduce(
    (state, thrown) => module.applyDart(state, thrown.dart),
    module.init(record.options, record.slots),
  )
}

export type GameSnapshot<TOptions, TState> = {
  record: GameRecord<TOptions>
  state: TState
}

export type GameRunner<TOptions, TState> = {
  getSnapshot(): GameSnapshot<TOptions, TState>
  /** Calls `listener` after every change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** Logs a dart for whoever is up. Throws if the dart or move is invalid. */
  throwDart(dart: Dart): void
  /** Drops the last dart and replays. Returns false when there is none. */
  undo(): boolean
}

export type RunnerOptions = {
  /** Called once each time the game becomes finished. */
  onFinish?(result: GameResult): void
  /** Clock for `finishedAt`; defaults to `new Date()`. */
  now?(): Date
}

/**
 * Runs a game: keeps the record and current state together, appends darts
 * to the log and replays it on undo. Snapshots are immutable, so they work
 * with React's `useSyncExternalStore`.
 */
export function createGameRunner<TOptions, TState>(
  module: GameModule<TOptions, TState>,
  record: GameRecord<TOptions>,
  { onFinish, now = () => new Date() }: RunnerOptions = {},
): GameRunner<TOptions, TState> {
  let snapshot: GameSnapshot<TOptions, TState> = {
    record,
    state: replay(module, record),
  }
  const listeners = new Set<() => void>()

  function commit(next: GameSnapshot<TOptions, TState>) {
    snapshot = next
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    throwDart(dart) {
      if (!isValidDart(dart)) {
        throw new RangeError(
          `Invalid dart: segment ${dart.segment} × ${dart.multiplier}`,
        )
      }
      const { record, state } = snapshot
      if (module.isOver(state)) throw new Error('The game is already over')

      const playerId = module.currentThrower(state)
      const nextState = module.applyDart(state, dart)
      const result: GameResult | null = module.isOver(nextState)
        ? {
            standings: module.standings(nextState),
            finishedAt: now().toISOString(),
          }
        : null

      commit({
        record: {
          ...record,
          darts: [...record.darts, { playerId, dart }],
          result,
        },
        state: nextState,
      })
      if (result) onFinish?.(result)
    },

    undo() {
      const { record } = snapshot
      if (record.darts.length === 0) return false

      const nextRecord: GameRecord<TOptions> = {
        ...record,
        darts: record.darts.slice(0, -1),
        result: null,
      }
      commit({ record: nextRecord, state: replay(module, nextRecord) })
      return true
    },
  }
}
