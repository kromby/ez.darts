import { describe, expect, it } from 'vitest'
import { gameConfigs } from '../games'
import x01Json from '../games/x01/config.json'
import {
  GameConfigError,
  areValidValues,
  defaultValues,
  isValidValue,
  matchingPreset,
  parseGameConfig,
  presetValues,
  type ChoiceOption,
  type IntOption,
} from './config'

const x01 = parseGameConfig(x01Json)
const label = { is: 'Merki', en: 'Label' }

function withChanges(changes: Record<string, unknown>) {
  return { ...structuredClone(x01Json), ...changes }
}

describe('game configs', () => {
  it('parses every game config', () => {
    expect(gameConfigs.map((config) => config.id)).toContain('x01')
  })

  it('reads the x01 config', () => {
    expect(x01.version).toBe(1)
    expect(x01.teams).toBe(true)
    expect(x01.options.map((option) => option.key)).toEqual([
      'startScore',
      'in',
      'out',
    ])
    expect(x01.playerOptions.map((option) => option.key)).toEqual([
      'startScore',
    ])
    expect(x01.presets[1].name).toEqual({
      is: '501 tvöfalt út',
      en: '501 double out',
    })
  })
})

describe('parseGameConfig', () => {
  it.each([
    ['a missing id', withChanges({ id: '' }), 'config.id'],
    ['a bad version', withChanges({ version: 0 }), 'config.version'],
    [
      'a label missing a language',
      withChanges({ name: { is: 'x01' } }),
      'config.name.en',
    ],
    [
      'an unsupported language',
      withChanges({ name: { is: 'x01', en: 'x01', de: 'x01' } }),
      'config.name.de',
    ],
    [
      'an unknown option type',
      withChanges({ options: [{ key: 'k', type: 'text', label }] }),
      'config.options[0].type',
    ],
    [
      'a default that is not a choice',
      withChanges({
        options: [
          { key: 'k', type: 'choice', label, values: [1, 2], default: 3 },
        ],
      }),
      'config.options[0].default',
    ],
    [
      'custom values on text choices',
      withChanges({
        options: [
          {
            key: 'k',
            type: 'choice',
            label,
            values: ['a'],
            allowCustom: true,
            default: 'a',
          },
        ],
      }),
      'config.options[0].allowCustom',
    ],
    [
      'a duplicate option key',
      withChanges({
        options: [
          { key: 'k', type: 'bool', label, default: true },
          { key: 'k', type: 'bool', label, default: false },
        ],
        presets: [],
      }),
      'duplicate key "k"',
    ],
    [
      'a preset with an unknown option',
      withChanges({ presets: [{ name: label, options: { legs: 3 } }] }),
      'config.presets[0].options.legs',
    ],
    [
      'a preset with an invalid value',
      withChanges({ presets: [{ name: label, options: { out: 'triple' } }] }),
      'config.presets[0].options.out',
    ],
  ])('rejects %s', (_, json, message) => {
    expect(() => parseGameConfig(json)).toThrow(GameConfigError)
    expect(() => parseGameConfig(json)).toThrow(message)
  })

  it('defaults to no teams, options or presets', () => {
    const config = parseGameConfig({ id: 'g', version: 1, name: label })

    expect(config).toEqual({
      id: 'g',
      version: 1,
      name: label,
      teams: false,
      options: [],
      playerOptions: [],
      presets: [],
    })
  })
})

describe('isValidValue', () => {
  const startScore = x01.options[0] as ChoiceOption
  const handicap = x01.playerOptions[0] as IntOption

  it('accepts listed choices and custom numbers within range', () => {
    expect(isValidValue(startScore, 501)).toBe(true)
    expect(isValidValue(startScore, 450)).toBe(true)
    expect(isValidValue(startScore, 1)).toBe(false)
    expect(isValidValue(startScore, 10000)).toBe(false)
    expect(isValidValue(startScore, 450.5)).toBe(false)
    expect(isValidValue(startScore, Number.NaN)).toBe(false)
    expect(isValidValue(startScore, null)).toBe(false)
  })

  it('accepts only listed values when custom is not allowed', () => {
    const out = x01.options[2]

    expect(isValidValue(out, 'double')).toBe(true)
    expect(isValidValue(out, 'triple')).toBe(false)
  })

  it('accepts unset or whole numbers in range for int options', () => {
    expect(isValidValue(handicap, null)).toBe(true)
    expect(isValidValue(handicap, 301)).toBe(true)
    expect(isValidValue(handicap, 1)).toBe(false)
    expect(isValidValue(handicap, Number.NaN)).toBe(false)
  })

  it('accepts only booleans for bool options', () => {
    const bool = { key: 'b', type: 'bool', label, default: false } as const

    expect(isValidValue(bool, true)).toBe(true)
    expect(isValidValue(bool, 'yes')).toBe(false)
  })
})

describe('defaults and presets', () => {
  it('starts from the defaults', () => {
    const values = defaultValues(x01.options)

    expect(values).toEqual({ startScore: 501, in: 'single', out: 'double' })
    expect(areValidValues(x01.options, values)).toBe(true)
    expect(defaultValues(x01.playerOptions)).toEqual({ startScore: null })
  })

  it('applies a preset and recognises it', () => {
    const values = presetValues(x01, x01.presets[0])

    expect(values).toEqual({ startScore: 301, in: 'single', out: 'single' })
    expect(matchingPreset(x01, values)).toBe(x01.presets[0])
  })

  it('matches no preset once an option differs', () => {
    const values = { ...presetValues(x01, x01.presets[1]), in: 'double' }

    expect(matchingPreset(x01, values)).toBeUndefined()
  })
})
