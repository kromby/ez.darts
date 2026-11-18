import { useTranslation } from 'react-i18next'
import type { ScoreboardProps } from '../../engine/game'
import type { CricketState } from './cricket'

/** "Cut-throat · Round 4". */
function Status({ state }: ScoreboardProps<CricketState>) {
  const { t } = useTranslation()
  const { options, turns } = state
  return (
    <>
      {[
        t(`cricket.variants.${options.variant}`),
        t('game.round', { round: turns.turnsTaken[turns.current] + 1 }),
      ].join(' · ')}
    </>
  )
}

export default Status
