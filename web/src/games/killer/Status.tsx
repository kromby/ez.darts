import { useTranslation } from 'react-i18next'
import type { ScoreboardProps } from '../../engine/game'
import type { KillerState } from './killer'
import { claiming } from './rules'

/** "3 lives · 3 hits to killer · Round 4". */
function Status({ state }: ScoreboardProps<KillerState>) {
  const { t } = useTranslation()
  const { options, turns } = state
  const parts = [
    options.mode === 'lives'
      ? t('killer.livesCount', { count: options.lives })
      : t('killer.modeHits'),
    t('killer.toKiller', { count: options.hitsToKiller }),
    options.selfHit && t('killer.selfHitRule'),
    claiming(state.turns) !== null && options.assign !== 'random'
      ? t(`killer.claiming.${options.assign}`)
      : t('game.round', { round: turns.turnsTaken[turns.current] + 1 }),
  ]
  return <>{parts.filter(Boolean).join(' · ')}</>
}

export default Status
