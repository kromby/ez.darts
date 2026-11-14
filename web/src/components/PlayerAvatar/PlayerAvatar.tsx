import type { CSSProperties } from 'react'
import { colorValue, initial, type Player } from '../../players/player'
import styles from './PlayerAvatar.module.css'

/** The player's initial on their colour. Decorative: the name is beside it. */
function PlayerAvatar({
  player,
  size = 36,
}: {
  player: Pick<Player, 'name' | 'color'>
  size?: number
}) {
  return (
    <span
      className={styles.avatar}
      aria-hidden="true"
      style={
        {
          '--avatar': colorValue(player),
          '--size': `${size}px`,
        } as CSSProperties
      }
    >
      {initial(player.name)}
    </span>
  )
}

export default PlayerAvatar
