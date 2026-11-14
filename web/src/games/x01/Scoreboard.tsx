import { useTranslation } from 'react-i18next'
import type { ScoreboardProps } from '../../engine/game'
import { currentSide } from '../../engine/turns'
import type { X01State } from './x01'

/** Plain x01 scores; the Big Keys game screen (#10) builds on this. */
function Scoreboard({ state, playerName }: ScoreboardProps<X01State>) {
  const { t } = useTranslation()
  const { sides, board } = state.turns
  const up = currentSide(state.turns).id

  return (
    <ul aria-label={t('x01.scores')}>
      {sides.map((side) => (
        <li key={side.id} aria-current={side.id === up || undefined}>
          {side.members.map(playerName).join(' & ')}: {board[side.id].remaining}
          {!board[side.id].opened && ` (${t('x01.notIn')})`}
        </li>
      ))}
    </ul>
  )
}

export default Scoreboard
