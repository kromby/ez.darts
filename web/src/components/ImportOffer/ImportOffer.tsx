import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportResult } from '../../storage/importGuest'
import styles from './ImportOffer.module.css'

export type ImportOfferState =
  | { step: 'offer'; players: number; games: number }
  | { step: 'importing'; players: number; games: number }
  | { step: 'failed'; players: number; games: number }
  | { step: 'done'; result: ImportResult }

type Props = {
  state: ImportOfferState
  onImport(): void
  /** Skip the import, or close the card once it is done. */
  onClose(): void
}

/**
 * Shown once after signing in on a device that has guest data: offers to
 * copy its players and games into the household.
 */
function ImportOffer({ state, onImport, onClose }: Props) {
  const { t } = useTranslation()
  const id = useId()

  if (state.step === 'done') {
    const { added, merged, games } = state.result
    return (
      <section className={styles.offer} aria-labelledby={id}>
        <h2 id={id} className={styles.title} role="status">
          {t('importOffer.done', {
            players: t('importOffer.players', { count: added + merged }),
            games: t('importOffer.games', { count: games }),
          })}
        </h2>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('importOffer.close')}
          </button>
        </div>
      </section>
    )
  }

  const importing = state.step === 'importing'
  return (
    <section className={styles.offer} aria-labelledby={id}>
      <h2 id={id} className={styles.title}>
        {t('importOffer.title')}
      </h2>
      <p className={styles.body}>
        {t('importOffer.body', {
          players: t('importOffer.players', { count: state.players }),
          games: t('importOffer.games', { count: state.games }),
        })}
      </p>
      {state.step === 'failed' && (
        <p className={styles.error} role="alert">
          {t('importOffer.failed')}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          disabled={importing}
          onClick={onClose}
        >
          {t('importOffer.skip')}
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={importing}
          onClick={onImport}
        >
          {importing ? t('importOffer.importing') : t('importOffer.import')}
        </button>
      </div>
    </section>
  )
}

export default ImportOffer
