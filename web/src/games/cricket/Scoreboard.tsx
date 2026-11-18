import { useTranslation } from 'react-i18next'
import {
  Board,
  CurrentCard,
  type Feedback,
  type Slot,
} from '../../components/Scoreboard/Scoreboard'
import { useDartName, useDecimal } from '../../components/Scoreboard/helpers'
import type { ScoreboardProps } from '../../engine/game'
import { currentSide, currentThrower } from '../../engine/turns'
import type { CricketState } from './cricket'
import MarksGrid from './MarksGrid'
import {
  TARGETS,
  isClosed,
  markSymbol,
  marksPerRound,
  turnResult,
  turnTotals,
  type CricketHit,
  type CricketTurn,
} from './rules'

/** Under a thrown dart: the points it scored, or the marks it made. */
function hitDetail(hit: CricketHit): string {
  if (hit.points > 0) return `+${hit.points}`
  return hit.marks > 0 ? markSymbol(hit.marks) : '–'
}

function useFeedback(
  state: CricketState,
  playerName: (id: string) => string,
): Feedback | null {
  const { t } = useTranslation()
  const dartName = useDartName()
  const last: CricketTurn | null = state.turn === null ? state.lastTurn : null
  if (!last) return null
  const result = turnResult(last)
  const { marks, points } = turnTotals(last)
  const given = state.options.variant === 'cutThroat'
  return {
    result: result === 'won' ? 'finished' : result,
    text: t(
      `cricket.feedback.${result === 'scored' && given ? 'given' : result}`,
      {
        name: playerName(last.playerId),
        marks: t('cricket.markCount', { count: marks }),
        points,
      },
    ),
    detail: last.hits.map((hit) => dartName(hit.dart)).join(' '),
  }
}

/**
 * Big Keys Cricket: the thrower's score (or numbers closed, with no score)
 * as the largest thing on screen, the turn's darts with what each did, and
 * the marks grid for every side.
 */
function Scoreboard({
  state,
  playerName,
  playerColor,
}: ScoreboardProps<CricketState>) {
  const { t } = useTranslation()
  const decimal = useDecimal()
  const dartName = useDartName()
  const { turns, turn, options } = state
  const side = currentSide(turns)
  const thrower = currentThrower(turns)
  const mine = turns.board[side.id]
  const stats = state.stats[thrower]
  const hits = turn?.hits ?? []
  const closed = TARGETS.filter((target) => isClosed(mine, target)).length
  const closedCount = `${closed}/${TARGETS.length}`
  const feedback = useFeedback(state, playerName)

  const slots: Slot[] = Array.from(
    { length: turns.dartsPerTurn },
    (_, index) => {
      const hit = hits.at(index)
      if (hit) {
        return {
          number: index + 1,
          label: dartName(hit.dart),
          detail: hitDetail(hit),
          state: 'thrown',
        }
      }
      return {
        number: index + 1,
        label: t('game.dartSlot', { number: index + 1 }),
        state: index === hits.length ? 'next' : 'empty',
      }
    },
  )

  return (
    <Board>
      <CurrentCard
        title={t('game.throwing', { name: playerName(thrower) })}
        value={options.variant === 'noScore' ? closedCount : mine.score}
        stats={[
          {
            label: t('cricket.mpr'),
            value: decimal(stats ? marksPerRound(stats) : null),
          },
          { label: t('game.darts'), value: stats?.darts ?? 0 },
          ...(options.variant === 'noScore'
            ? []
            : [{ label: t('cricket.closedLabel'), value: closedCount }]),
        ]}
        slots={slots}
        slotsLabel={t('game.turnDarts')}
        feedback={feedback}
      />
      <MarksGrid
        state={state}
        playerName={playerName}
        playerColor={playerColor}
      />
    </Board>
  )
}

export default Scoreboard
