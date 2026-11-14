import { useTranslation } from 'react-i18next'
import KeyNumbers from '../../components/Scoreboard/KeyNumbers'
import type { PlayerSummaryProps } from '../../engine/game'
import type { AtwState } from './aroundTheWorld'
import { hitRate } from './labels'

/** A player's key numbers for the results screen. */
function PlayerSummary({ state, playerId }: PlayerSummaryProps<AtwState>) {
  const { t } = useTranslation()
  const stats = state.stats[playerId]
  if (!stats) return null
  const rate = hitRate(stats)

  return (
    <KeyNumbers
      items={[
        { label: t('game.darts'), value: stats.darts },
        { label: t('atw.hits'), value: stats.hits },
        { label: t('atw.hitRate'), value: rate === null ? '–' : `${rate}%` },
      ]}
    />
  )
}

export default PlayerSummary
