import { useTranslation } from 'react-i18next'
import type { PlayerSummaryProps } from '../../engine/game'
import { formatDecimal } from '../../i18n/format'
import { average } from './stats'
import type { X01State } from './x01'
import styles from './PlayerSummary.module.css'

/** A player's key numbers for the results screen. */
function PlayerSummary({ state, playerId }: PlayerSummaryProps<X01State>) {
  const { t, i18n } = useTranslation()
  const stats = state.stats[playerId]
  if (!stats) return null
  const avg = average(stats)

  const items = [
    {
      label: t('x01.average'),
      value: avg === null ? '–' : formatDecimal(avg, i18n.language),
    },
    { label: t('x01.darts'), value: stats.darts },
    { label: t('x01.bestTurn'), value: stats.bestTurn },
    ...(stats.checkout === null
      ? []
      : [{ label: t('x01.checkout'), value: stats.checkout }]),
  ]

  return (
    <dl className={styles.summary}>
      {items.map((item) => (
        <div key={item.label} className={styles.item}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default PlayerSummary
