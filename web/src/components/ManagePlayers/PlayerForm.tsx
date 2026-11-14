import { useId, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import {
  colorValue,
  normalizeName,
  playerColors,
  playerNamed,
  type Player,
  type PlayerColor,
} from '../../players/player'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import styles from './ManagePlayers.module.css'

type Props = {
  /** Every player, removed ones too, as names must stay unique. */
  players: readonly Player[]
  /** The player being edited; left out for a new one. */
  editing?: Player
  color: PlayerColor
  onSubmit(name: string, color: PlayerColor): void
  onCancel(): void
}

/** Name and avatar colour, for a new player or one being edited. */
function PlayerForm({ players, editing, color, onSubmit, onCancel }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [name, setName] = useState(editing?.name ?? '')
  const [chosen, setChosen] = useState<PlayerColor>(color)
  const other = playerNamed(players, name)
  const taken = other !== undefined && other.id !== editing?.id
  const valid = normalizeName(name) !== '' && !taken

  return (
    <form
      className={styles.form}
      aria-label={
        editing ? t('manage.edit', { name: editing.name }) : t('manage.add')
      }
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onSubmit(normalizeName(name), chosen)
      }}
    >
      <div className={styles.nameRow}>
        <PlayerAvatar player={{ name: name || '?', color: chosen }} size={44} />
        <label htmlFor={`${id}-name`} className="sr-only">
          {t('manage.name')}
        </label>
        <input
          id={`${id}-name`}
          className={styles.input}
          placeholder={t('manage.name')}
          autoComplete="off"
          maxLength={40}
          // Focus where typing starts, as the form opens on a tap.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={name}
          aria-invalid={taken || undefined}
          aria-describedby={taken ? `${id}-taken` : undefined}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      {taken && (
        <p id={`${id}-taken`} className={styles.error}>
          {other.archivedAt
            ? t('players.nameArchived')
            : t('players.nameTaken')}
        </p>
      )}
      <fieldset className={styles.colors}>
        <legend className={styles.legend}>{t('manage.color')}</legend>
        {playerColors.map((value) => (
          <label
            key={value}
            className={styles.swatch}
            style={
              { '--swatch': colorValue({ color: value }) } as CSSProperties
            }
          >
            <input
              type="radio"
              name={`${id}-color`}
              checked={chosen === value}
              onChange={() => setChosen(value)}
            />
            <span className="sr-only">{t(`manage.colors.${value}`)}</span>
          </label>
        ))}
      </fieldset>
      <div className={styles.formActions}>
        <button type="button" className={styles.tool} onClick={onCancel}>
          {t('manage.cancel')}
        </button>
        <button type="submit" className={styles.save} disabled={!valid}>
          {t('manage.save')}
        </button>
      </div>
    </form>
  )
}

export default PlayerForm
