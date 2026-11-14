import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../LanguageSwitcher'
import styles from './GameMenu.module.css'

type Props = {
  /** Leaves the game; asked for twice so a stray tap can't end it. */
  onQuit(): void
}

/** The ≡ menu on the game screen: language and quitting the game. */
function GameMenu({ onQuit }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function close() {
    setOpen(false)
    setConfirming(false)
  }

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        setConfirming(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className={styles.menu}>
      <button
        type="button"
        className={styles.toggle}
        aria-label={t('game.menu')}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14M5 12h14M5 17h14" />
        </svg>
      </button>
      {open && (
        <div
          id={id}
          className={styles.panel}
          role="group"
          aria-label={t('game.menu')}
        >
          <LanguageSwitcher />
          {confirming && (
            <p className={styles.confirm}>{t('game.quitConfirm')}</p>
          )}
          <div className={styles.actions}>
            {confirming ? (
              <button type="button" data-kind="danger" onClick={onQuit}>
                {t('game.quitYes')}
              </button>
            ) : (
              <button type="button" onClick={() => setConfirming(true)}>
                {t('game.quit')}
              </button>
            )}
            <button type="button" data-kind="primary" onClick={close}>
              {t('game.resume')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameMenu
