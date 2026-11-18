import type { TFunction } from 'i18next'
import { parseComputer, type ComputerLevel } from '../engine/computer'
import type { PlayerId } from '../engine/game'
import type { Player, PlayerColor } from './player'

/** Each level has its own colour, so two computers tell apart. */
const levelColors: Record<ComputerLevel, PlayerColor> = {
  easy: 'lime',
  medium: 'amber',
  hard: 'red',
}

/**
 * A computer in the game as a player, for names and avatars, e.g.
 * "Tölva (erfið)" or "Tölva 2 (erfið)". `undefined` for a person.
 */
export function computerPlayer(
  playerId: PlayerId,
  t: TFunction,
): Player | undefined {
  const computer = parseComputer(playerId)
  if (!computer) return undefined
  const { level, number } = computer
  const levelName = t(`computer.levels.${level}`)
  return {
    id: playerId,
    name:
      number > 1
        ? t('computer.numbered', { number, level: levelName })
        : t('computer.name', { level: levelName }),
    color: levelColors[level],
  }
}
