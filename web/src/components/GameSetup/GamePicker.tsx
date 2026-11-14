import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { GameConfig } from '../../engine/config'
import { localize } from '../../i18n/languages'
import styles from './GamePicker.module.css'

type Props = {
  configs: GameConfig[]
  value: string
  onChange(id: string): void
}

/** Which game to play, above the chosen game's setup. */
function GamePicker({ configs, value, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const id = useId()
  return (
    <section className={styles.picker} aria-labelledby={id}>
      <h2 id={id} className={styles.heading}>
        {t('setup.game')}
      </h2>
      <div className={styles.games} role="group" aria-labelledby={id}>
        {configs.map((config) => (
          <button
            key={config.id}
            type="button"
            className={styles.game}
            aria-pressed={config.id === value}
            onClick={() => onChange(config.id)}
          >
            {localize(config.name, i18n.resolvedLanguage ?? '')}
          </button>
        ))}
      </div>
    </section>
  )
}

export default GamePicker
