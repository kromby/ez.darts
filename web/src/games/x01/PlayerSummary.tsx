import { useTranslation } from 'react-i18next'
import KeyNumbers from '../../components/Scoreboard/KeyNumbers'
import { useDecimal } from '../../components/Scoreboard/helpers'
import type { PlayerSummaryProps } from '../../engine/game'
import { average } from './stats'
import type { X01State } from './x01'

/** A player's key numbers for the results screen. */
function PlayerSummary({ state, playerId }: PlayerSummaryProps<X01State>) {
  const { t } = useTranslation()
  const decimal = useDecimal()
  const stats = state.stats[playerId]
  if (!stats) return null

  return (
    <KeyNumbers
      items={[
        { label: t('x01.average'), value: decimal(average(stats)) },
        { label: t('game.darts'), value: stats.darts },
        { label: t('x01.bestTurn'), value: stats.bestTurn },
        ...(stats.checkout === null
          ? []
          : [{ label: t('x01.checkout'), value: stats.checkout }]),
      ]}
    />
  )
}

export default PlayerSummary
