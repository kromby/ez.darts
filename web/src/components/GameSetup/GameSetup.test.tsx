import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { parseGameConfig } from '../../engine/config'
import i18n from '../../i18n'
import GameSetup, { type GameSetupResult } from './GameSetup'

/** A made-up game using every option type, so nothing here is x01-specific. */
const config = parseGameConfig({
  id: 'test-game',
  version: 1,
  name: { is: 'Prufuleikur', en: 'Test game' },
  teams: false,
  options: [
    {
      key: 'target',
      type: 'choice',
      label: { is: 'Markmið', en: 'Target' },
      values: [100, 200],
      allowCustom: true,
      min: 10,
      max: 999,
      default: 100,
    },
    {
      key: 'mode',
      type: 'choice',
      label: { is: 'Hamur', en: 'Mode' },
      values: [
        { value: 'fast', label: { is: 'Hratt', en: 'Fast' } },
        { value: 'slow', label: { is: 'Hægt', en: 'Slow' } },
      ],
      default: 'fast',
    },
    {
      key: 'bonus',
      type: 'bool',
      label: { is: 'Bónus', en: 'Bonus' },
      default: false,
    },
  ],
  playerOptions: [
    {
      key: 'lives',
      type: 'int',
      label: { is: 'Líf', en: 'Lives' },
      min: 1,
      max: 9,
      default: 3,
    },
  ],
  presets: [
    {
      name: { is: 'Stutt', en: 'Short' },
      options: { target: 100, mode: 'fast' },
    },
    {
      name: { is: 'Langt', en: 'Long' },
      options: { target: 200, mode: 'slow', bonus: true },
    },
  ],
})

const players = [
  { id: 'anna', name: 'Anna' },
  { id: 'oli', name: 'Óli' },
]

function setup() {
  const onStart = vi.fn<(setup: GameSetupResult) => void>()
  const user = userEvent.setup()
  render(<GameSetup config={config} players={players} onStart={onStart} />)
  return { onStart, user }
}

describe('GameSetup', () => {
  it('renders every option, preset and per-player option from the config', () => {
    setup()

    expect(
      screen.getByRole('heading', { name: 'Prufuleikur' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stutt' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Langt' })).toBeInTheDocument()

    const target = screen.getByRole('group', { name: 'Markmið' })
    expect(within(target).getByRole('radio', { name: '100' })).toBeChecked()
    expect(within(target).getByRole('radio', { name: '200' })).not.toBeChecked()
    expect(within(target).getByLabelText('Annað')).toHaveValue('')

    const mode = screen.getByRole('group', { name: 'Hamur' })
    expect(within(mode).getByRole('radio', { name: 'Hratt' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Bónus' })).not.toBeChecked()

    for (const name of ['Anna', 'Óli']) {
      const player = screen.getByRole('group', { name })
      expect(within(player).getByLabelText('Líf')).toHaveValue('3')
    }
  })

  it('starts with the defaults', async () => {
    const { onStart, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))

    expect(onStart).toHaveBeenCalledWith({
      options: { target: 100, mode: 'fast', bonus: false },
      playerOptions: { anna: { lives: 3 }, oli: { lives: 3 } },
    })
  })

  it('applies a preset and shows which preset matches', async () => {
    const { onStart, user } = setup()
    const short = screen.getByRole('button', { name: 'Stutt' })
    const long = screen.getByRole('button', { name: 'Langt' })
    expect(short).toHaveAttribute('aria-pressed', 'true')

    await user.click(long)

    expect(long).toHaveAttribute('aria-pressed', 'true')
    expect(short).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('radio', { name: 'Hægt' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Bónus' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'Hratt' }))
    expect(long).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Byrja leik' }))
    expect(onStart.mock.lastCall?.[0].options).toEqual({
      target: 200,
      mode: 'fast',
      bonus: true,
    })
  })

  it('takes a custom value and blocks start when it is out of range', async () => {
    const { onStart, user } = setup()
    const target = screen.getByRole('group', { name: 'Markmið' })
    const custom = within(target).getByLabelText('Annað')
    const start = screen.getByRole('button', { name: 'Byrja leik' })

    await user.type(custom, '5')

    expect(custom).toHaveAttribute('aria-invalid', 'true')
    expect(
      within(target).getByText('Heil tala frá 10 til 999'),
    ).toBeInTheDocument()
    expect(start).toBeDisabled()

    await user.type(custom, '55')

    expect(custom).toHaveValue('555')
    expect(within(target).getByRole('radio', { name: '100' })).not.toBeChecked()
    expect(start).toBeEnabled()
    await user.click(start)
    expect(onStart.mock.lastCall?.[0].options.target).toBe(555)

    await user.click(within(target).getByRole('radio', { name: '200' }))
    expect(custom).toHaveValue('')
  })

  it('keeps per-player options apart and validates them', async () => {
    const { onStart, user } = setup()
    const oli = within(screen.getByRole('group', { name: 'Óli' }))
    const start = screen.getByRole('button', { name: 'Byrja leik' })

    await user.clear(oli.getByLabelText('Líf'))
    await user.type(oli.getByLabelText('Líf'), '12')
    expect(start).toBeDisabled()
    expect(oli.getByText('Heil tala frá 1 til 9')).toBeInTheDocument()

    await user.clear(oli.getByLabelText('Líf'))
    await user.type(oli.getByLabelText('Líf'), '5')
    await user.click(start)

    expect(onStart.mock.lastCall?.[0].playerOptions).toEqual({
      anna: { lives: 3 },
      oli: { lives: 5 },
    })
  })

  it('shows labels from the config in English', async () => {
    await i18n.changeLanguage('en')
    setup()

    expect(
      screen.getByRole('heading', { name: 'Test game' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Target' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Slow' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Long' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start game' })).toBeEnabled()
  })
})
