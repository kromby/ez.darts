import { useTranslation } from 'react-i18next'
import { notation, type Dart } from '../../engine/dart'
import type { Side } from '../../engine/turns'
import { formatDecimal } from '../../i18n/format'

const avatarColors = ['var(--team-a)', 'var(--team-b)', 'var(--team-c)']
const teamColors: Record<string, string> = {
  A: 'var(--team-a)',
  B: 'var(--team-b)',
  C: 'var(--team-c)',
}

/** Whether a side is a team rather than one player. */
export function isTeam(side: Side): boolean {
  return side.id !== side.members[0]
}

/** A team's own colour, or one by position for a player. */
export function sideColor(side: Side, index: number): string {
  return (isTeam(side) && teamColors[side.id]) || avatarColors[index % 3]
}

/** The team letter, or the player's initial. */
export function sideAvatar(side: Side, playerName: (id: string) => string) {
  return isTeam(side)
    ? side.id
    : playerName(side.members[0]).charAt(0).toLocaleUpperCase()
}

export function sideName(side: Side, playerName: (id: string) => string) {
  return side.members.map(playerName).join(' & ')
}

/** A number with one decimal, or a dash when there is none yet. */
export function useDecimal() {
  const { i18n } = useTranslation()
  return (value: number | null) =>
    value === null ? '–' : formatDecimal(value, i18n.language)
}

/** `T20`, or "Miss" in the current language. */
export function useDartName() {
  const { t } = useTranslation()
  return (dart: Dart) => notation(dart) ?? t('pad.miss')
}
