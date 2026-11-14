import { useTranslation } from 'react-i18next'
import type { ScoreboardProps } from '../../engine/game'
import type { AtwState } from './aroundTheWorld'

/** "1–20 and bull · Double out · Round 4". */
function Status({ state }: ScoreboardProps<AtwState>) {
  const { t } = useTranslation()
  const { options, turns } = state
  const parts = [
    options.bull ? t('atw.rangeBull') : t('atw.range'),
    options.in === 'double' && t('atw.doubleIn'),
    options.out === 'double' && t('atw.doubleOut'),
    t('game.round', { round: turns.turnsTaken[turns.current] + 1 }),
  ]
  return <>{parts.filter(Boolean).join(' · ')}</>
}

export default Status
