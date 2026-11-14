import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlayerId } from '../../engine/game'
import {
  createPlayer,
  isActive,
  nextColor,
  type Player,
} from '../../players/player'
import { byName } from '../../storage/store'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import PlayerForm from './PlayerForm'
import styles from './ManagePlayers.module.css'

type Props = {
  /** Every player, removed ones too. */
  players: readonly Player[]
  /** A new or changed player, to keep. */
  onSave(player: Player): void
  onDone(): void
  /** Defaults to now; for tests. */
  now?: () => Date
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
      <path d="m13 7 4 4" />
    </svg>
  )
}

type PlayerRowProps = {
  player: Player
  confirming: boolean
  onEdit(): void
  onRemove(): void
  onConfirm(): void
  onCancel(): void
}

/** One player, with edit and remove, and the remove confirmation. */
function PlayerRow({
  player,
  confirming,
  onEdit,
  onRemove,
  onConfirm,
  onCancel,
}: PlayerRowProps) {
  const { t } = useTranslation()
  if (confirming) {
    return (
      <li className={styles.confirm} role="group" aria-label={player.name}>
        <p>{t('manage.removeConfirm', { name: player.name })}</p>
        <div className={styles.formActions}>
          <button type="button" className={styles.tool} onClick={onCancel}>
            {t('manage.cancel')}
          </button>
          <button type="button" className={styles.danger} onClick={onConfirm}>
            {t('manage.removeYes')}
          </button>
        </div>
      </li>
    )
  }
  return (
    <li className={styles.row}>
      <PlayerAvatar player={player} />
      <span className={styles.name}>{player.name}</span>
      <button
        type="button"
        className={styles.icon}
        aria-label={t('manage.edit', { name: player.name })}
        onClick={onEdit}
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className={styles.icon}
        aria-label={t('manage.remove', { name: player.name })}
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  )
}

/**
 * The household's (or guest's) players: add, rename, recolour, remove and
 * restore. Removing archives a player, so past games keep their name.
 */
function ManagePlayers({
  players,
  onSave,
  onDone,
  now = () => new Date(),
}: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [editing, setEditing] = useState<PlayerId | 'new' | null>(null)
  const [removing, setRemoving] = useState<PlayerId | null>(null)
  const active = players.filter(isActive).sort(byName)
  const removed = players.filter((player) => !isActive(player)).sort(byName)

  return (
    <div className={styles.manage}>
      <h2 className={styles.title}>{t('manage.title')}</h2>

      <section className={styles.section}>
        {active.length === 0 && editing !== 'new' && (
          <p className={styles.empty}>{t('manage.none')}</p>
        )}
        <ul className={styles.list} aria-label={t('manage.title')}>
          {active.map((player) =>
            editing === player.id ? (
              <li key={player.id}>
                <PlayerForm
                  players={players}
                  editing={player}
                  color={player.color ?? nextColor(players)}
                  onCancel={() => setEditing(null)}
                  onSubmit={(name, color) => {
                    onSave({ ...player, name, color })
                    setEditing(null)
                  }}
                />
              </li>
            ) : (
              <PlayerRow
                key={player.id}
                player={player}
                confirming={removing === player.id}
                onEdit={() => {
                  setRemoving(null)
                  setEditing(player.id)
                }}
                onRemove={() => {
                  setEditing(null)
                  setRemoving(player.id)
                }}
                onCancel={() => setRemoving(null)}
                onConfirm={() => {
                  onSave({ ...player, archivedAt: now().toISOString() })
                  setRemoving(null)
                }}
              />
            ),
          )}
        </ul>
        {editing === 'new' ? (
          <PlayerForm
            players={players}
            color={nextColor(players)}
            onCancel={() => setEditing(null)}
            onSubmit={(name, color) => {
              onSave(createPlayer(name, players, color))
              setEditing(null)
            }}
          />
        ) : (
          <button
            type="button"
            className={styles.tool}
            onClick={() => {
              setRemoving(null)
              setEditing('new')
            }}
          >
            + {t('manage.add')}
          </button>
        )}
      </section>

      {removed.length > 0 && (
        <section className={styles.section} aria-labelledby={`${id}-removed`}>
          <h3 id={`${id}-removed`} className={styles.heading}>
            {t('manage.removed')}
          </h3>
          <ul className={styles.list}>
            {removed.map((player) => (
              <li key={player.id} className={styles.row} data-removed>
                <PlayerAvatar player={player} />
                <span className={styles.name}>{player.name}</span>
                <button
                  type="button"
                  className={styles.tool}
                  aria-label={t('manage.restore', { name: player.name })}
                  onClick={() => {
                    // Restored as they were, without the removal date.
                    const { archivedAt: _removed, ...restored } = player
                    onSave(restored)
                  }}
                >
                  {t('manage.restoreShort')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" className={styles.done} onClick={onDone}>
        {t('manage.done')}
      </button>
    </div>
  )
}

export default ManagePlayers
