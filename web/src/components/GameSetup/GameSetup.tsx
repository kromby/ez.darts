import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  areValidValues,
  defaultValues,
  matchingPreset,
  presetValues,
  type GameConfig,
  type OptionValues,
} from '../../engine/config'
import type { PlayerId } from '../../engine/game'
import { localize } from '../../i18n/languages'
import OptionField from './OptionField'
import styles from './GameSetup.module.css'

export type SetupPlayer = { id: PlayerId; name: string }

export type GameSetupResult = {
  options: OptionValues
  playerOptions: Record<PlayerId, OptionValues>
}

type Props = {
  config: GameConfig
  players: SetupPlayer[]
  onStart(setup: GameSetupResult): void
}

/**
 * Setup screen generated from a game config: presets, game options and
 * per-player options. Games add no setup-screen code of their own.
 */
function GameSetup({ config, players, onStart }: Props) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? ''
  const id = useId()
  const [options, setOptions] = useState(() => defaultValues(config.options))
  const [playerOptions, setPlayerOptions] = useState<
    Record<PlayerId, OptionValues>
  >(() =>
    Object.fromEntries(
      players.map((player) => [player.id, defaultValues(config.playerOptions)]),
    ),
  )

  const activePreset = matchingPreset(config, options)
  const valid =
    areValidValues(config.options, options) &&
    players.every((player) =>
      areValidValues(config.playerOptions, playerOptions[player.id] ?? {}),
    )

  return (
    <form
      className={styles.setup}
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onStart({ options, playerOptions })
      }}
    >
      <h2 className={styles.title}>{localize(config.name, language)}</h2>

      {config.presets.length > 0 && (
        <section className={styles.section} aria-labelledby={`${id}-presets`}>
          <h3 id={`${id}-presets`} className={styles.heading}>
            {t('setup.presets')}
          </h3>
          <div className={styles.presets}>
            {config.presets.map((preset) => (
              <button
                key={preset.name.en}
                type="button"
                className={styles.preset}
                aria-pressed={preset === activePreset}
                onClick={() => setOptions(presetValues(config, preset))}
              >
                {localize(preset.name, language)}
              </button>
            ))}
          </div>
        </section>
      )}

      {config.options.length > 0 && (
        <section className={styles.section} aria-labelledby={`${id}-options`}>
          <h3 id={`${id}-options`} className={styles.heading}>
            {t('setup.options')}
          </h3>
          {config.options.map((option) => (
            <OptionField
              key={option.key}
              option={option}
              value={options[option.key]}
              onChange={(value) =>
                setOptions((current) => ({ ...current, [option.key]: value }))
              }
            />
          ))}
        </section>
      )}

      {config.playerOptions.length > 0 && players.length > 0 && (
        <section className={styles.section} aria-labelledby={`${id}-players`}>
          <h3 id={`${id}-players`} className={styles.heading}>
            {t('setup.players')}
          </h3>
          {players.map((player) => (
            <fieldset key={player.id} className={styles.player}>
              <legend className={styles.playerName}>{player.name}</legend>
              {config.playerOptions.map((option) => (
                <OptionField
                  key={option.key}
                  option={option}
                  value={playerOptions[player.id]?.[option.key] ?? null}
                  onChange={(value) =>
                    setPlayerOptions((current) => ({
                      ...current,
                      [player.id]: {
                        ...current[player.id],
                        [option.key]: value,
                      },
                    }))
                  }
                />
              ))}
            </fieldset>
          ))}
        </section>
      )}

      <button type="submit" className={styles.start} disabled={!valid}>
        {t('setup.start')}
      </button>
    </form>
  )
}

export default GameSetup
