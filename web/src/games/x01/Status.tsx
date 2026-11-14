import { useTranslation } from 'react-i18next'
import type { ScoreboardProps } from '../../engine/game'
import type { X01State } from './x01'

/** "501 · Double out · Round 7", with the in rule when it isn't single. */
function Status({ state }: ScoreboardProps<X01State>) {
  const { t } = useTranslation()
  const { options, turns } = state
  const parts = [
    String(options.startScore),
    options.in !== 'single' && t(`x01.inRules.${options.in}`),
    t(`x01.outRules.${options.out}`),
    t('game.round', { round: turns.turnsTaken[turns.current] + 1 }),
  ]
  return <>{parts.filter(Boolean).join(' · ')}</>
}

export default Status
