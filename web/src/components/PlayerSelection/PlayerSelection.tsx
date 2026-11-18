import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  computerLevels,
  nextComputerId,
  type ComputerLevel,
} from '../../engine/computer'
import type { PlayerId, PlayerSlot, TeamId } from '../../engine/game'
import { computerPlayer } from '../../players/computer'
import {
  isActive,
  normalizeName,
  playerNamed,
  type Player,
} from '../../players/player'
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar'
import SelectedPlayer from './SelectedPlayer'
import styles from './PlayerSelection.module.css'
import {
  alternateTeams,
  hasTwoTeams,
  shuffle,
  teamCount,
  teamIds,
  toSlots,
} from './selection'

type Props = {
  /**
   * The household's or the guest's players. Removed ones are not offered,
   * but their names stay taken.
   */
  players: Player[]
  /**
   * Opens the screen to add, edit and remove players, with the line-up so
   * far so it is there on the way back.
   */
  onManage?(slots: PlayerSlot[]): void
  onAddPlayer(name: string): Player | Promise<Player>
  /** Whether the game can be played in teams. */
  teamsSupported: boolean
  /** A previous choice to start from, e.g. when coming back from setup. */
  initial?: PlayerSlot[]
  onContinue(slots: PlayerSlot[]): void
  random?: () => number
}

/** One chip per level, to add a computer player at that level. */
function ComputerChips({ onAdd }: { onAdd(level: ComputerLevel): void }) {
  const { t } = useTranslation()
  return (
    <div
      className={styles.computers}
      role="group"
      aria-label={t('computer.add')}
    >
      <span className={styles.computersLabel}>{t('computer.add')}</span>
      <ul className={styles.chips}>
        {computerLevels.map((level) => {
          const name = t(`computer.levels.${level}`)
          return (
            <li key={level}>
              <button
                type="button"
                className={styles.chip}
                data-computer={level}
                aria-label={t('computer.addLevel', { level: name })}
                onClick={() => onAdd(level)}
              >
                <ComputerIcon />
                {name}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** A small screen with a face, for computer players. */
function ComputerIcon() {
  return (
    <svg
      className={styles.computerIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="6" width="16" height="12" rx="3" />
      <path d="M12 6V3M9 11v1M15 11v1M9.5 15h5" />
    </svg>
  )
}

/** Pre-game step shared by every game: who plays, in what order, in which team. */
function PlayerSelection({
  players,
  onAddPlayer,
  teamsSupported,
  initial = [],
  onContinue,
  onManage,
  random,
}: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [selected, setSelected] = useState<PlayerId[]>(() =>
    initial.map((slot) => slot.playerId),
  )
  const [teamsOn, setTeamsOn] = useState(
    () => teamsSupported && initial.some((slot) => slot.teamId),
  )
  const [teamOf, setTeamOf] = useState<Record<PlayerId, TeamId>>(() =>
    Object.fromEntries(
      initial.flatMap((slot) =>
        slot.teamId ? [[slot.playerId, slot.teamId]] : [],
      ),
    ),
  )
  const [newName, setNewName] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const byId = new Map(players.map((player) => [player.id, player]))
  // Computers are not saved players; their ids say who they are.
  const chosen = selected.flatMap(
    (playerId) => byId.get(playerId) ?? computerPlayer(playerId, t) ?? [],
  )
  const available = players.filter(
    (player) => isActive(player) && !selected.includes(player.id),
  )
  const teams = teamsOn ? teamIds.slice(0, teamCount(chosen.length)) : null
  // A team dropped when players leave (e.g. C with two players) falls back to A.
  const assigned: Record<PlayerId, TeamId> = Object.fromEntries(
    selected.map((playerId) => [
      playerId,
      teams?.includes(teamOf[playerId]) ? teamOf[playerId] : teamIds[0],
    ]),
  )
  const namesake = playerNamed(players, newName)
  const nameTaken = namesake !== undefined
  const canAdd = normalizeName(newName) !== '' && !nameTaken
  const teamsValid = !teamsOn || hasTwoTeams(selected, assigned)
  const valid = chosen.length > 0 && teamsValid

  const nameOf = (playerId: UniqueIdentifier) =>
    chosen.find((player) => player.id === String(playerId))?.name ?? ''
  const positionOf = (playerId: UniqueIdentifier | undefined) =>
    selected.indexOf(String(playerId)) + 1
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('players.dnd.picked', { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? t('players.dnd.over', {
            name: nameOf(active.id),
            position: positionOf(over.id),
          })
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('players.dnd.dropped', {
            name: nameOf(active.id),
            position: positionOf(over.id),
          })
        : undefined,
    onDragCancel: ({ active }) =>
      t('players.dnd.cancelled', { name: nameOf(active.id) }),
  }

  function select(playerId: PlayerId) {
    setSelected((current) => [...current, playerId])
    setTeamOf((current) => {
      if (current[playerId]) return current
      // Join the team with the fewest players.
      const counts = teamIds.map(
        (team) => selected.filter((p) => current[p] === team).length,
      )
      return { ...current, [playerId]: teamIds[counts[0] <= counts[1] ? 0 : 1] }
    })
  }

  function addComputer(level: ComputerLevel) {
    select(nextComputerId(level, selected))
  }

  async function addPlayer() {
    if (!canAdd) return
    const player = await onAddPlayer(normalizeName(newName))
    setNewName('')
    select(player.id)
  }

  return (
    <div className={styles.selection}>
      <h2 className={styles.title}>{t('players.title')}</h2>

      <section className={styles.section} aria-labelledby={`${id}-in-game`}>
        <h3 id={`${id}-in-game`} className={styles.heading}>
          {t('players.inGame')}
        </h3>
        {chosen.length === 0 ? (
          <p className={styles.empty}>{t('players.none')}</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{
              announcements,
              screenReaderInstructions: {
                draggable: t('players.dnd.instructions'),
              },
            }}
            onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return
              setSelected((current) =>
                arrayMove(
                  current,
                  current.indexOf(String(active.id)),
                  current.indexOf(String(over.id)),
                ),
              )
            }}
          >
            <SortableContext
              items={selected}
              strategy={verticalListSortingStrategy}
            >
              <ol className={styles.list} aria-label={t('players.order')}>
                {chosen.map((player, index) => (
                  <SelectedPlayer
                    key={player.id}
                    player={player}
                    position={index + 1}
                    teams={teams}
                    team={assigned[player.id]}
                    onTeamChange={(team) =>
                      setTeamOf((current) => ({
                        ...current,
                        [player.id]: team,
                      }))
                    }
                    onRemove={() =>
                      setSelected((current) =>
                        current.filter((p) => p !== player.id),
                      )
                    }
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <div className={styles.tools}>
          <button
            type="button"
            className={styles.tool}
            disabled={chosen.length < 2}
            onClick={() => setSelected((current) => shuffle(current, random))}
          >
            {t('players.random')}
          </button>
          {teamsSupported && (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                role="switch"
                checked={teamsOn}
                onChange={(event) => {
                  const on = event.target.checked
                  setTeamsOn(on)
                  if (on && !hasTwoTeams(selected, teamOf)) {
                    setTeamOf(alternateTeams(selected))
                  }
                }}
              />
              {t('players.teams')}
            </label>
          )}
        </div>
        {!teamsValid && chosen.length > 0 && (
          <p className={styles.error}>{t('players.needTwoTeams')}</p>
        )}
      </section>

      <section className={styles.section} aria-labelledby={`${id}-available`}>
        <h3 id={`${id}-available`} className={styles.heading}>
          {t('players.available')}
        </h3>
        {available.length > 0 && (
          <ul className={styles.chips}>
            {available.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  className={styles.chip}
                  aria-label={t('players.add', { name: player.name })}
                  onClick={() => select(player.id)}
                >
                  <PlayerAvatar player={player} size={28} />
                  {player.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <ComputerChips onAdd={addComputer} />
        <form
          className={styles.newPlayer}
          onSubmit={(event) => {
            event.preventDefault()
            void addPlayer()
          }}
        >
          <label htmlFor={`${id}-new`} className={styles.srOnly}>
            {t('players.newPlayer')}
          </label>
          <input
            id={`${id}-new`}
            className={styles.input}
            placeholder={t('players.newPlayer')}
            autoComplete="off"
            maxLength={40}
            value={newName}
            aria-invalid={nameTaken || undefined}
            aria-describedby={nameTaken ? `${id}-taken` : undefined}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button type="submit" className={styles.tool} disabled={!canAdd}>
            {t('players.create')}
          </button>
        </form>
        {nameTaken && (
          <p id={`${id}-taken`} className={styles.error}>
            {namesake?.archivedAt
              ? t('players.nameArchived')
              : t('players.nameTaken')}
          </p>
        )}
        {onManage && (
          <button
            type="button"
            className={styles.manage}
            onClick={() =>
              onManage(toSlots(selected, teamsOn ? assigned : null))
            }
          >
            {t('players.manage')}
          </button>
        )}
      </section>

      <button
        type="button"
        className={styles.continue}
        disabled={!valid}
        onClick={() => onContinue(toSlots(selected, teamsOn ? assigned : null))}
      >
        {t('players.continue')}
      </button>
    </div>
  )
}

export default PlayerSelection
