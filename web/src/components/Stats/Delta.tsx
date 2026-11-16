import { useTranslation } from 'react-i18next'
import styles from './StatsScreen.module.css'

type Props = {
  /** Change on the previous period, already rounded for display. */
  change: number
  /** The change as shown, e.g. `5 pts` or `4,3`. */
  text: string
  /** Which way is better, e.g. `down` for misses; `null` when neither is. */
  better: 'up' | 'down' | null
}

/** ▲ or ▼ with the change on the previous period, green when better. */
function Delta({ change, text, better }: Props) {
  const { t } = useTranslation()
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : null
  const tone =
    direction === null || better === null
      ? 'neutral'
      : direction === better
        ? 'good'
        : 'bad'
  return (
    <span
      className={styles.delta}
      data-tone={tone}
      role="img"
      aria-label={
        direction ? t(`stats.${direction}`, { value: text }) : t('stats.same')
      }
    >
      {direction === 'up' ? '▲ ' : direction === 'down' ? '▼ ' : ''}
      {text}
    </span>
  )
}

export default Delta
