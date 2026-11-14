import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import type { TeamId } from '../../engine/game'
import type { Player } from '../../players/player'
import styles from './PlayerSelection.module.css'

type Props = {
  player: Player
  position: number
  /** Team choices when playing in teams. */
  teams: readonly TeamId[] | null
  team: TeamId | undefined
  onTeamChange(team: TeamId): void
  onRemove(): void
}

function SelectedPlayer({
  player,
  position,
  teams,
  team,
  onTeamChange,
  onRemove,
}: Props) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id })

  return (
    <li
      ref={setNodeRef}
      className={styles.row}
      data-dragging={isDragging || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label={t('players.move', { name: player.name })}
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="6" r="1.6" />
          <circle cx="15" cy="6" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="9" cy="18" r="1.6" />
          <circle cx="15" cy="18" r="1.6" />
        </svg>
      </button>
      <span className={styles.position}>{position}</span>
      <span className={styles.name}>{player.name}</span>
      {teams && (
        <span
          role="radiogroup"
          aria-label={t('players.teamOf', { name: player.name })}
          className={styles.teams}
        >
          {teams.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={team === id}
              aria-label={t('players.team', { team: id })}
              className={styles.team}
              data-team={id}
              onClick={() => onTeamChange(id)}
            >
              {id}
            </button>
          ))}
        </span>
      )}
      <button
        type="button"
        className={styles.remove}
        aria-label={t('players.remove', { name: player.name })}
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  )
}

export default SelectedPlayer
