import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import {
  sideAvatar,
  sideColor,
  sideName,
} from '../../components/Scoreboard/helpers'
import { BULL } from '../../engine/dart'
import type { PlayerId } from '../../engine/game'
import { currentSide, type Side } from '../../engine/turns'
import type { CricketState } from './cricket'
import { TARGETS, isClosed, isDead, markSymbol } from './rules'
import styles from './Cricket.module.css'

type Row = {
  side: Side
  name: string
  avatar: string
  color: string
  current: boolean
}

/** A number's heading; the bull is short on screen, in full when read. */
function TargetHead({ target, dead }: { target: number; dead: boolean }) {
  const { t } = useTranslation()
  const label =
    target === BULL ? (
      <>
        <span aria-hidden="true">{t('cricket.bullShort')}</span>
        <span className="sr-only">{t('pad.bull')}</span>
      </>
    ) : (
      target
    )
  return (
    <th scope="col" data-dead={dead || undefined}>
      {label}
      {dead && <span className="sr-only">, {t('cricket.dead')}</span>}
    </th>
  )
}

function Head({ state }: { state: CricketState }) {
  const { t } = useTranslation()
  const { board } = state.turns
  return (
    <thead>
      <tr>
        <th scope="col" className={styles.who}>
          <span className="sr-only">{t('cricket.side')}</span>
        </th>
        {TARGETS.map((target) => (
          <TargetHead
            key={target}
            target={target}
            dead={isDead(board, target)}
          />
        ))}
        {state.options.variant !== 'noScore' && (
          <th scope="col" className={styles.score}>
            {t('cricket.score')}
          </th>
        )}
      </tr>
    </thead>
  )
}

function MarksCell({
  marks,
  closed,
  dead,
}: {
  marks: number
  closed: boolean
  dead: boolean
}) {
  const { t } = useTranslation()
  return (
    <td data-closed={closed || undefined} data-dead={dead || undefined}>
      <span aria-hidden="true">{markSymbol(marks)}</span>
      <span className="sr-only">
        {closed
          ? t('cricket.closed')
          : t('cricket.markCount', { count: marks })}
      </span>
    </td>
  )
}

function SideRow({ row, state }: { row: Row; state: CricketState }) {
  const { board } = state.turns
  const mine = board[row.side.id]
  const cells = TARGETS.map((target) => (
    <MarksCell
      key={target}
      marks={mine.marks[target]}
      closed={isClosed(mine, target)}
      dead={isDead(board, target)}
    />
  ))
  return (
    <tr
      data-current={row.current || undefined}
      style={{ '--avatar': row.color } as CSSProperties}
    >
      <th scope="row">
        <span className={styles.avatar} aria-hidden="true">
          {row.avatar}
        </span>
        <span className={styles.name}>{row.name}</span>
      </th>
      {cells}
      {state.options.variant !== 'noScore' && (
        <td className={styles.score}>{mine.score}</td>
      )}
    </tr>
  )
}

/**
 * The cricket scoreboard: a row per side with its marks on 20 down to the
 * bull (/, X, Ⓧ) and its score, the side throwing highlighted. A number
 * everyone has closed is greyed out.
 */
function MarksGrid({
  state,
  playerName,
  playerColor,
}: {
  state: CricketState
  playerName(id: PlayerId): string
  playerColor?(id: PlayerId): string | undefined
}) {
  const { t } = useTranslation()
  const { turns } = state
  const now = currentSide(turns).id
  const rows: Row[] = turns.sides.map((side, index) => ({
    side,
    name: sideName(side, playerName),
    avatar: sideAvatar(side, playerName),
    color: sideColor(side, index, playerColor),
    current: side.id === now && turns.finished.length === 0,
  }))
  return (
    <table className={styles.grid}>
      <caption className="sr-only">{t('cricket.marks')}</caption>
      <Head state={state} />
      <tbody>
        {rows.map((row) => (
          <SideRow key={row.side.id} row={row} state={state} />
        ))}
      </tbody>
    </table>
  )
}

export default MarksGrid
