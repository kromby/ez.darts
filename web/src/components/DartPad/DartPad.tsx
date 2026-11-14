import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BULL, MISS, dart, type Dart } from '../../engine/dart'
import styles from './DartPad.module.css'

type Modifier = 1 | 2 | 3

const modifiers: { value: Modifier; key: 'single' | 'double' | 'triple' }[] = [
  { value: 1, key: 'single' },
  { value: 2, key: 'double' },
  { value: 3, key: 'triple' },
]

const numbers = Array.from({ length: 20 }, (_, index) => index + 1)

type Props = {
  onDart(dart: Dart): void
  onUndo(): void
  /** Disables Undo, e.g. before the first dart. */
  canUndo?: boolean
  /** Disables the whole pad, e.g. once the game is over. */
  disabled?: boolean
}

/**
 * The Big Keys input pad: pick Single/Double/Triple, then a number. The
 * modifier drops back to Single after every dart.
 */
function DartPad({ onDart, onUndo, canUndo = true, disabled = false }: Props) {
  const { t } = useTranslation()
  const [modifier, setModifier] = useState<Modifier>(1)
  const modifierName = t(`pad.${modifiers[modifier - 1].key}`)

  function throwDart(thrown: Dart) {
    setModifier(1)
    onDart(thrown)
  }

  return (
    <div className={styles.pad} data-modifier={modifier}>
      <div
        className={styles.modifiers}
        role="group"
        aria-label={t('pad.modifier')}
      >
        {modifiers.map(({ value, key }) => (
          <button
            key={key}
            type="button"
            className={styles.key}
            data-kind={key}
            aria-pressed={modifier === value}
            disabled={disabled}
            // Tapping the selected modifier again goes back to Single.
            onClick={() => setModifier(modifier === value ? 1 : value)}
          >
            {t(`pad.${key}`)}
          </button>
        ))}
      </div>

      <div className={styles.numbers}>
        {numbers.map((number) => (
          <button
            key={number}
            type="button"
            className={styles.key}
            data-kind="number"
            aria-label={t('pad.number', { modifier: modifierName, number })}
            disabled={disabled}
            onClick={() => throwDart(dart(number, modifier))}
          >
            {number}
            {modifier > 1 && (
              <sup className={styles.value} aria-hidden="true">
                {number * modifier}
              </sup>
            )}
          </button>
        ))}
      </div>

      <div className={styles.extras}>
        <button
          type="button"
          className={styles.key}
          data-kind="bull"
          aria-label={
            modifier === 3
              ? `${t('pad.bull')}, ${t('pad.noTriple')}`
              : t('pad.number', {
                  modifier: modifierName,
                  number: t('pad.bull'),
                })
          }
          disabled={disabled || modifier === 3}
          onClick={() => throwDart(dart(BULL, modifier))}
        >
          <span>{t('pad.bull')}</span>
          <small aria-hidden="true">
            {modifier === 3 ? t('pad.noTriple') : BULL * modifier}
          </small>
        </button>
        <button
          type="button"
          className={styles.key}
          data-kind="miss"
          disabled={disabled}
          onClick={() => throwDart(MISS)}
        >
          {t('pad.miss')}
        </button>
        <button
          type="button"
          className={styles.key}
          data-kind="undo"
          disabled={disabled || !canUndo}
          onClick={() => {
            setModifier(1)
            onUndo()
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
          </svg>
          {t('pad.undo')}
        </button>
      </div>
    </div>
  )
}

export default DartPad
