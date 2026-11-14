import { useTranslation } from 'react-i18next'
import KeyNumbers from '../../components/Scoreboard/KeyNumbers'
import type { PlayerSummaryProps } from '../../engine/game'
import type { KillerState } from './killer'

/** A player's key numbers for the results screen. */
function PlayerSummary({ state, playerId }: PlayerSummaryProps<KillerState>) {
  const { t } = useTranslation()
  const stats = state.stats[playerId]
  if (!stats) return null

  return (
    <KeyNumbers
      items={[
        { label: t('game.darts'), value: stats.darts },
        { label: t('killer.taken'), value: stats.taken },
        { label: t('killer.knockouts'), value: stats.knockouts },
      ]}
    />
  )
}

export default PlayerSummary
