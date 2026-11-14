import { useTranslation } from 'react-i18next'
import {
  Board,
  CurrentCard,
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
} from '../../components/Scoreboard/helpers'
import type { ScoreboardProps } from '../../engine/game'
import { currentSide, currentThrower, type Side } from '../../engine/turns'
import type { AtwState } from './aroundTheWorld'
import { hitRate, neededDart, targetLabel } from './labels'

const percent = (rate: number | null) => (rate === null ? '–' : `${rate}%`)

/** A team's darts and hits added together. */
function sideTotals(state: AtwState, side: Side) {
  return side.members
    .map((id) => state.stats[id])
    .filter(Boolean)
    .reduce(
      (total, stats) => ({
        darts: total.darts + stats.darts,
        hits: total.hits + stats.hits,
      }),
      { darts: 0, hits: 0 },
    )
}

/**
 * Big Keys Around the World: the target to hit next as the largest thing on
 * screen, the turn's darts with how far each moved on, and every side's
 * target.
 */
function Scoreboard({ state, playerName }: ScoreboardProps<AtwState>) {
  const { t } = useTranslation()
  const dartName = useDartName()
  const { turns, turnDarts, turnSteps, lastTurn, options } = state
  const side = currentSide(turns)
  const thrower = currentThrower(turns)
  const progress = turns.board[side.id]
  const stats = state.stats[thrower]
  const label = (index: number) => targetLabel(options, index, t('pad.bull'))
  const needed = neededDart(options, progress)

  const slots: Slot[] = Array.from(
    { length: turns.dartsPerTurn },
    (_, index) => {
      const thrown = turnDarts.at(index)
      if (thrown) {
        const moved = turnSteps.at(index) ?? 0
        return {
          number: index + 1,
          label: dartName(thrown),
          detail: moved > 0 ? `+${moved}` : '–',
          state: 'thrown',
        }
      }
      return {
        number: index + 1,
        label: t('game.dartSlot', { number: index + 1 }),
        state: index === turnDarts.length ? 'next' : 'empty',
      }
    },
  )

  const last = turnDarts.length === 0 ? lastTurn : null
  const feedback: Feedback | null = last && {
    result: last.result,
    text: t(`atw.feedback.${last.result}`, {
      name: playerName(last.playerId),
      from: label(last.from),
      to: label(last.to),
    }),
    detail: last.darts.map(dartName).join(' '),
  }

  const sides: SideView[] = turns.sides.map((s, index) => {
    const sideProgress = turns.board[s.id]
    const place = turns.finished.indexOf(s.id)
    const totals = sideTotals(state, s)
    return {
      id: s.id,
      name: sideName(s, playerName),
      avatar: sideAvatar(s, playerName),
      color: sideColor(s, index),
      tags: !sideProgress.opened && <Tag text={t('game.notIn')} />,
      line: t('atw.playerLine', {
        rate: percent(hitRate(totals)),
        darts: t('game.dartCount', { count: totals.darts }),
      }),
      value:
        place >= 0
          ? t('game.placeLong', { place: place + 1 })
          : label(sideProgress.target),
      current: s.id === side.id,
      done: place >= 0,
    }
  })

  return (
    <Board>
      <CurrentCard
        title={t('game.throwing', { name: playerName(thrower) })}
        value={label(progress.target)}
        stats={[
          {
            label: t('atw.hitRate'),
            value: percent(stats ? hitRate(stats) : null),
          },
          { label: t('game.darts'), value: stats?.darts ?? 0 },
          {
            label: t('game.turnFrom'),
            value: label(turns.turnStart[side.id].target),
          },
        ]}
        notice={needed && t('atw.needs', { dart: needed })}
        slots={slots}
        slotsLabel={t('game.turnDarts')}
        feedback={feedback}
      />
      <SideList heading={t('game.scores')} sides={sides} />
    </Board>
  )
}

export default Scoreboard
