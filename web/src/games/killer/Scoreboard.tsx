import { useTranslation } from 'react-i18next'
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
} from '../../components/Scoreboard/helpers'
import type { ScoreboardProps } from '../../engine/game'
import { currentThrower, isActive } from '../../engine/turns'
import type { KillerState } from './killer'
import {
  claiming,
  isKiller,
  turnResult,
  type KillerClaim,
  type KillerPlayer,
  type KillerTurn,
} from './rules'

const effectLabel = (effect: number) => {
  if (effect > 0) return `+${effect}`
  if (effect < 0) return `−${-effect}`
  return '–'
}

/**
 * Big Keys Killer: the thrower's number as the largest thing on screen,
 * their lives and hits, the numbers to aim for, and every player. Before
 * the game, the same card asks each player in turn to pick or throw for a
 * number.
 */
function Scoreboard({ state, playerName, hint }: ScoreboardProps<KillerState>) {
  const { t } = useTranslation()
  const dartName = useDartName()
  const { turns, options, stats } = state
  const claimer = claiming(state.turns)
  const thrower = claimer ?? currentThrower(turns)
  const me = turns.board[thrower]
  const killer = isKiller(options, me)
  const turnDarts = state.turn?.darts ?? []
  const progress = (player: KillerPlayer) =>
    t('killer.progress', { hits: player.hits, needed: options.hitsToKiller })

  const slots: Slot[] = Array.from(
    { length: turns.dartsPerTurn },
    (_, index) => {
      const thrown = turnDarts.at(index)
      if (thrown) {
        return {
          number: index + 1,
          label: dartName(thrown),
          detail: effectLabel(state.turn?.effects.at(index) ?? 0),
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

  const turnFeedback = (last: KillerTurn): Feedback => {
    const result = turnResult(last)
    return {
      result,
      text: t(`killer.feedback.${result}`, {
        name: playerName(last.playerId),
        names: last.knockouts.map(playerName).join(', '),
        numbers: last.attacked.join(', '),
        hits: turns.board[last.playerId].hits,
        needed: options.hitsToKiller,
      }),
      detail: last.darts.map(dartName).join(' '),
    }
  }
  const claimFeedback = (last: KillerClaim): Feedback => ({
    result: last.result,
    text: t(`killer.claim.${last.result}`, {
      name: playerName(last.playerId),
      number: last.dart.segment,
    }),
    detail: dartName(last.dart),
  })

  const feedback =
    state.turn === null && state.lastTurn ? turnFeedback(state.lastTurn) : null

  const sides: SideView[] = turns.sides.map((side, index) => {
    const player = turns.board[side.id]
    const active = isActive(turns, side.id)
    const playerStats = stats[side.id]
    return {
      id: side.id,
      name: sideName(side, playerName),
      avatar: sideAvatar(side, playerName),
      color: sideColor(side, index),
      // One tag that never comes or goes, so the chips keep their height.
      tags: active && (
        <>
          {options.mode === 'lives' ? (
            <Tag
              text={t('killer.livesTag', { count: player.lives })}
              spoken={t('killer.livesCount', { count: player.lives })}
            />
          ) : (
            <Tag text={progress(player)} />
          )}
        </>
      ),
      line: t('killer.playerLine', {
        hits: progress(player),
        darts: t('game.dartCount', { count: playerStats?.darts ?? 0 }),
      }),
      value: active ? (
        <>
          {isKiller(options, player) && <Tag text={t('killer.killer')} />}{' '}
          {player.number ?? '–'}
        </>
      ) : (
        t('killer.out')
      ),
      current: side.id === thrower,
      done: !active,
    }
  })

  if (claimer !== null) {
    // Random numbers are drawn before the game, so nobody claims one.
    const assign = options.assign === 'throw' ? 'throw' : 'choose'
    // Each player throws one dart at a time, so the turn row shows how the
    // last one went rather than three dart slots.
    const claimRow: Feedback = state.lastClaim
      ? claimFeedback(state.lastClaim)
      : { result: 'claim', text: t('killer.claimStart'), detail: '' }
    return (
      <Board>
        <CurrentCard
          title={t(`killer.claimTitle.${assign}`, {
            name: playerName(claimer),
          })}
          value="?"
          stats={[]}
          slots={slots}
          slotsLabel={t('game.turnDarts')}
          feedback={claimRow}
        />
        <HintBar label={t(`killer.claimHelp.${assign}`)} hint="" />
        <SideList heading={t('game.scores')} sides={sides} />
      </Board>
    )
  }

  const stat =
    options.mode === 'lives'
      ? [{ label: t('killer.lives'), value: me.lives }]
      : []

  return (
    <Board>
      <CurrentCard
        title={t('game.throwing', { name: playerName(thrower) })}
        value={me.number ?? '–'}
        stats={[
          ...stat,
          {
            label: t('killer.hits'),
            value: killer ? t('killer.killer') : progress(me),
          },
          { label: t('game.darts'), value: stats[thrower]?.darts ?? 0 },
        ]}
        slots={slots}
        slotsLabel={t('game.turnDarts')}
        feedback={feedback}
      />
      <HintBar
        label={killer ? t('killer.targets') : t('killer.target')}
        hint={hint ?? null}
      />
      <SideList heading={t('game.scores')} sides={sides} />
    </Board>
  )
}

export default Scoreboard
