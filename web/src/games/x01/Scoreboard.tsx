import { useTranslation } from 'react-i18next'
import { points } from '../../engine/dart'
import type { ScoreboardProps } from '../../engine/game'
import { currentSide, currentThrower, type Side } from '../../engine/turns'
import {
  Board,
  CurrentCard,
  HintBar,
  SideList,
  Tag,
  type Feedback,
  type SideView,
  type Slot,
} from '../../components/Scoreboard/Scoreboard'
import {
  sideAvatar,
  sideColor,
  sideName,
  useDartName,
  useDecimal,
} from '../../components/Scoreboard/helpers'
import { formatRoute, x01Checkout } from './checkout'
import { average, type X01Stats } from './stats'
import type { X01State } from './x01'

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
 * Big Keys x01: the thrower's remaining score as the largest thing on
 * screen, the turn's dart slots, the checkout hint and every side. After a
 * turn ends the dart slots show how it went (scored, bust or checkout)
 * until the next dart.
 */
function Scoreboard({ state, playerName, hint }: ScoreboardProps<X01State>) {
  const { t } = useTranslation()
  const decimal = useDecimal()
  const dartName = useDartName()
  const { turns, turnDarts, lastTurn, options } = state
  const side = currentSide(turns)
  const thrower = currentThrower(turns)
  const score = turns.board[side.id]
  const stats = state.stats[thrower]

  const slots: Slot[] = Array.from(
    { length: turns.dartsPerTurn },
    (_, index) => {
      const thrown = turnDarts.at(index)
      if (thrown) {
        return {
          label: dartName(thrown),
          detail: points(thrown),
          state: 'thrown',
        }
      }
      return {
        label: t('game.dartSlot', { number: index + 1 }),
        state: index === turnDarts.length ? 'next' : 'empty',
      }
    },
  )

  const last = turnDarts.length === 0 ? lastTurn : null
  let feedback: Feedback | null = null
  if (last) {
    const name = playerName(last.playerId)
    const scored = last.from - turns.board[last.sideId].remaining
    feedback = {
      result: last.result,
      text:
        last.result === 'scored'
          ? t('x01.feedback.scored', { name, score: scored })
          : t(`x01.feedback.${last.result}`, { name, score: last.from }),
      detail: last.darts.map(dartName).join(' '),
    }
  }

  const alternative = hint ? x01Checkout(state)?.alternative : null

  const sides: SideView[] = turns.sides.map((s, index) => {
    const sideScore = turns.board[s.id]
    const place = turns.finished.indexOf(s.id)
    const sideTotals = sideStats(state, s)
    return {
      id: s.id,
      name: sideName(s, playerName),
      avatar: sideAvatar(s, playerName),
      color: sideColor(s, index),
      tags: (
        <>
          {sideScore.start !== options.startScore && (
            <Tag
              text={t('x01.handicapTag', { score: sideScore.start })}
              spoken={t('x01.handicap', { score: sideScore.start })}
            />
          )}
          {!sideScore.opened && <Tag text={t('game.notIn')} />}
        </>
      ),
      line: t('x01.playerLine', {
        average: decimal(average(sideTotals)),
        darts: t('game.dartCount', { count: sideTotals.darts }),
      }),
      value:
        place >= 0
          ? t('game.placeLong', { place: place + 1 })
          : sideScore.remaining,
      current: s.id === side.id,
      done: place >= 0,
    }
  })

  return (
    <Board>
      <CurrentCard
        title={t('game.throwing', { name: playerName(thrower) })}
        value={score.remaining}
        stats={[
          {
            label: t('x01.average'),
            value: decimal(stats ? average(stats) : null),
          },
          { label: t('game.darts'), value: stats?.darts ?? 0 },
          {
            label: t('game.turnFrom'),
            value: turns.turnStart[side.id].remaining,
          },
        ]}
        notice={score.opened ? null : t('game.notIn')}
        slots={slots}
        slotsLabel={t('game.turnDarts')}
        feedback={feedback}
      />
      {hint !== undefined && (
        <HintBar
          label={t('x01.checkout')}
          hint={hint}
          alternative={
            alternative &&
            t('x01.checkoutOr', { route: formatRoute(alternative) })
          }
        />
      )}
      <SideList heading={t('game.scores')} sides={sides} />
    </Board>
  )
}

export default Scoreboard
