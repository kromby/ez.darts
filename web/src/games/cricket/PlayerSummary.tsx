import { useTranslation } from 'react-i18next'
import KeyNumbers from '../../components/Scoreboard/KeyNumbers'
import { useDecimal } from '../../components/Scoreboard/helpers'
import type { PlayerSummaryProps } from '../../engine/game'
import type { CricketState } from './cricket'
import { marksPerRound } from './rules'

/** A player's key numbers for the results screen. */
function PlayerSummary({ state, playerId }: PlayerSummaryProps<CricketState>) {
  const { t } = useTranslation()
  const decimal = useDecimal()
  const stats = state.stats[playerId]
  if (!stats) return null

  return (
    <KeyNumbers
      items={[
        { label: t('cricket.mpr'), value: decimal(marksPerRound(stats)) },
        { label: t('game.darts'), value: stats.darts },
        { label: t('cricket.marks'), value: stats.marks },
        ...(state.options.variant === 'noScore'
          ? []
          : [{ label: t('cricket.points'), value: stats.points }]),
      ]}
    />
  )
}

export default PlayerSummary
