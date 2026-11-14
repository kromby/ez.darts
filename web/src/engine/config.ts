import {
  isLanguage,
  supportedLanguages,
  type LocalizedLabel,
} from '../i18n/languages'

export type OptionValue = string | number | boolean | null
export type OptionValues = Record<string, OptionValue>

/** A choice shown as-is (e.g. 501) or with its own label (e.g. "double"). */
export type ChoiceValue =
  number | string | { value: number | string; label: LocalizedLabel }

export type ChoiceOption = {
  key: string
  type: 'choice'
  label: LocalizedLabel
  values: ChoiceValue[]
  /** Allows a number not in `values`, within `min`/`max`. */
  allowCustom?: boolean
  min?: number
  max?: number
  default: number | string
}

export type IntOption = {
  key: string
  type: 'int'
  label: LocalizedLabel
  min?: number
  max?: number
  /** `null` leaves it unset, e.g. no handicap. */
  default: number | null
}

export type BoolOption = {
  key: string
  type: 'bool'
  label: LocalizedLabel
  default: boolean
}

export type GameOption = ChoiceOption | IntOption | BoolOption

export type Preset = {
  name: LocalizedLabel
  options: OptionValues
}

/** A game's setup, loaded from its JSON config. */
export type GameConfig = {
  id: string
  /** Stored with each game record; bump when options change meaning. */
  version: number
  name: LocalizedLabel
  /** Whether the game can be played in teams. */
  teams: boolean
  options: GameOption[]
  /** Options set per player, e.g. a handicap start score. */
  playerOptions: GameOption[]
  presets: Preset[]
}

export class GameConfigError extends Error {
  name = 'GameConfigError'
}

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(path: string, message: string): never {
  throw new GameConfigError(`${path}: ${message}`)
}

function readString(json: Json, key: string, path: string): string {
  const value = json[key]
  if (typeof value !== 'string' || value === '') {
    fail(`${path}.${key}`, 'expected a non-empty string')
  }
  return value
}

function readOptionalNumber(json: Json, key: string, path: string) {
  const value = json[key]
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${path}.${key}`, 'expected a number')
  }
  return value
}

function readLabel(value: unknown, path: string): LocalizedLabel {
  if (!isObject(value)) fail(path, 'expected a label like { "is": …, "en": … }')
  for (const language of supportedLanguages) {
    if (typeof value[language] !== 'string' || value[language] === '') {
      fail(`${path}.${language}`, 'expected a non-empty string')
    }
  }
  for (const key of Object.keys(value)) {
    if (!isLanguage(key)) fail(`${path}.${key}`, 'unsupported language')
  }
  return value as LocalizedLabel
}

function readChoiceValue(value: unknown, path: string): ChoiceValue {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (
    isObject(value) &&
    (typeof value.value === 'number' || typeof value.value === 'string')
  ) {
    return {
      value: value.value,
      label: readLabel(value.label, `${path}.label`),
    }
  }
  fail(path, 'expected a number, a string or { "value", "label" }')
}

export function choiceValue(choice: ChoiceValue): number | string {
  return typeof choice === 'object' ? choice.value : choice
}

function readOption(json: unknown, path: string): GameOption {
  if (!isObject(json)) fail(path, 'expected an option object')
  const key = readString(json, 'key', path)
  const label = readLabel(json.label, `${path}.label`)
  const min = readOptionalNumber(json, 'min', path)
  const max = readOptionalNumber(json, 'max', path)

  switch (json.type) {
    case 'choice': {
      if (!Array.isArray(json.values) || json.values.length === 0) {
        fail(`${path}.values`, 'expected at least one value')
      }
      const values = json.values.map((value, index) =>
        readChoiceValue(value, `${path}.values[${index}]`),
      )
      const allowCustom = json.allowCustom === true
      if (allowCustom && !values.every((v) => typeof v === 'number')) {
        fail(`${path}.allowCustom`, 'only numeric choices can allow custom')
      }
      const option: ChoiceOption = {
        key,
        type: 'choice',
        label,
        values,
        allowCustom,
        min,
        max,
        default: json.default as number | string,
      }
      if (!isValidValue(option, option.default)) {
        fail(`${path}.default`, 'must be one of the values')
      }
      return option
    }
    case 'int': {
      const option: IntOption = {
        key,
        type: 'int',
        label,
        min,
        max,
        default: (json.default ?? null) as number | null,
      }
      if (!isValidValue(option, option.default)) {
        fail(
          `${path}.default`,
          'expected a whole number within min/max or null',
        )
      }
      return option
    }
    case 'bool': {
      if (typeof json.default !== 'boolean') {
        fail(`${path}.default`, 'expected true or false')
      }
      return { key, type: 'bool', label, default: json.default }
    }
    default:
      fail(`${path}.type`, 'expected "choice", "int" or "bool"')
  }
}

function readOptions(value: unknown, path: string): GameOption[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) fail(path, 'expected a list of options')
  const options = value.map((option, index) =>
    readOption(option, `${path}[${index}]`),
  )
  const keys = new Set<string>()
  for (const option of options) {
    if (keys.has(option.key)) fail(path, `duplicate key "${option.key}"`)
    keys.add(option.key)
  }
  return options
}

/**
 * Checks a game's JSON config and returns it typed. Throws a
 * `GameConfigError` naming the bad field, so a broken config fails its
 * game's tests rather than the setup screen.
 */
export function parseGameConfig(json: unknown): GameConfig {
  const path = 'config'
  if (!isObject(json)) fail(path, 'expected an object')
  const id = readString(json, 'id', path)
  const version = json.version
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    fail(`${path}.version`, 'expected a whole number from 1')
  }
  const options = readOptions(json.options, `${path}.options`)
  const playerOptions = readOptions(json.playerOptions, `${path}.playerOptions`)

  const rawPresets = json.presets ?? []
  if (!Array.isArray(rawPresets)) fail(`${path}.presets`, 'expected a list')
  const presets = rawPresets.map((preset: unknown, index): Preset => {
    const presetPath = `${path}.presets[${index}]`
    if (!isObject(preset) || !isObject(preset.options)) {
      fail(presetPath, 'expected { "name", "options" }')
    }
    for (const [key, value] of Object.entries(preset.options)) {
      const option = options.find((o) => o.key === key)
      if (!option) fail(`${presetPath}.options.${key}`, 'unknown option')
      if (!isValidValue(option, value)) {
        fail(`${presetPath}.options.${key}`, 'invalid value')
      }
    }
    return {
      name: readLabel(preset.name, `${presetPath}.name`),
      options: preset.options as OptionValues,
    }
  })

  return {
    id,
    version,
    name: readLabel(json.name, `${path}.name`),
    teams: json.teams === true,
    options,
    playerOptions,
    presets,
  }
}

function inRange(value: number, option: { min?: number; max?: number }) {
  return (
    Number.isInteger(value) &&
    (option.min === undefined || value >= option.min) &&
    (option.max === undefined || value <= option.max)
  )
}

/** Whether `value` is allowed for `option`. */
export function isValidValue(option: GameOption, value: unknown): boolean {
  switch (option.type) {
    case 'choice':
      if (option.values.some((choice) => choiceValue(choice) === value)) {
        return true
      }
      return (
        option.allowCustom === true &&
        typeof value === 'number' &&
        inRange(value, option)
      )
    case 'int':
      return (
        value === null || (typeof value === 'number' && inRange(value, option))
      )
    case 'bool':
      return typeof value === 'boolean'
  }
}

export function defaultValues(options: readonly GameOption[]): OptionValues {
  return Object.fromEntries(
    options.map((option) => [option.key, option.default]),
  )
}

export function areValidValues(
  options: readonly GameOption[],
  values: OptionValues,
): boolean {
  return options.every((option) => isValidValue(option, values[option.key]))
}

/**
 * Applies a preset to the current values. Options the preset does not list
 * (e.g. x01's play-on) keep their current value.
 */
export function presetValues(
  preset: Preset,
  current: OptionValues,
): OptionValues {
  return { ...current, ...preset.options }
}

/** The preset whose listed options all match `values`, if any. */
export function matchingPreset(
  config: GameConfig,
  values: OptionValues,
): Preset | undefined {
  return config.presets.find((preset) =>
    Object.entries(preset.options).every(
      ([key, value]) => values[key] === value,
    ),
  )
}
