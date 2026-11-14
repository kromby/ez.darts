import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Dart } from '../../engine/dart'
import i18n from '../../i18n'
import DartPad from './DartPad'

function setup(props: { canUndo?: boolean; disabled?: boolean } = {}) {
  const onDart = vi.fn<(dart: Dart) => void>()
  const onUndo = vi.fn<() => void>()
  const user = userEvent.setup()
  render(<DartPad onDart={onDart} onUndo={onUndo} {...props} />)
  return { onDart, onUndo, user }
}

const modifier = (name: string) => screen.getByRole('button', { name })

describe('DartPad', () => {
  it('throws a single by default', async () => {
    const { onDart, user } = setup()
    expect(modifier('Einfalt')).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Einfalt 20' }))

    expect(onDart).toHaveBeenCalledWith({ segment: 20, multiplier: 1 })
  })

  it('throws doubles and triples, then drops back to single', async () => {
    const { onDart, user } = setup()

    await user.click(modifier('Þrefalt'))
    await user.click(screen.getByRole('button', { name: 'Þrefalt 18' }))
    expect(onDart).toHaveBeenLastCalledWith({ segment: 18, multiplier: 3 })
    expect(modifier('Einfalt')).toHaveAttribute('aria-pressed', 'true')

    await user.click(modifier('Tvöfalt'))
    await user.click(screen.getByRole('button', { name: 'Tvöfalt 16' }))
    expect(onDart).toHaveBeenLastCalledWith({ segment: 16, multiplier: 2 })
    expect(modifier('Einfalt')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows each key value for the selected modifier', async () => {
    const { user } = setup()
    const key18 = () => screen.getByRole('button', { name: /^\S+ 18$/ })
    expect(key18()).toHaveTextContent(/^18$/)

    await user.click(modifier('Þrefalt'))
    expect(key18()).toHaveTextContent('1854')

    await user.click(modifier('Tvöfalt'))
    expect(key18()).toHaveTextContent('1836')
  })

  it('goes back to single when the selected modifier is tapped again', async () => {
    const { user } = setup()

    await user.click(modifier('Tvöfalt'))
    await user.click(modifier('Tvöfalt'))

    expect(modifier('Einfalt')).toHaveAttribute('aria-pressed', 'true')
  })

  it('throws the outer bull and the bullseye, but no triple bull', async () => {
    const { onDart, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Einfalt Miðja' }))
    expect(onDart).toHaveBeenLastCalledWith({ segment: 25, multiplier: 1 })

    await user.click(modifier('Tvöfalt'))
    const bullseye = screen.getByRole('button', { name: 'Tvöfalt Miðja' })
    expect(bullseye).toHaveTextContent('Miðja50')
    await user.click(bullseye)
    expect(onDart).toHaveBeenLastCalledWith({ segment: 25, multiplier: 2 })

    await user.click(modifier('Þrefalt'))
    const bull = screen.getByRole('button', { name: 'Miðja, ekki þreföld' })
    expect(bull).toBeDisabled()
    expect(bull).toHaveTextContent('ekki þreföld')
  })

  it('records a miss whatever the modifier', async () => {
    const { onDart, user } = setup()

    await user.click(modifier('Þrefalt'))
    await user.click(screen.getByRole('button', { name: 'Framhjá' }))

    expect(onDart).toHaveBeenCalledWith({ segment: 0, multiplier: 0 })
    expect(modifier('Einfalt')).toHaveAttribute('aria-pressed', 'true')
  })

  it('undoes and resets the modifier', async () => {
    const { onUndo, user } = setup()

    await user.click(modifier('Tvöfalt'))
    await user.click(screen.getByRole('button', { name: 'Afturkalla' }))

    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(modifier('Einfalt')).toHaveAttribute('aria-pressed', 'true')
  })

  it('disables undo when there is nothing to undo', () => {
    setup({ canUndo: false })

    expect(screen.getByRole('button', { name: 'Afturkalla' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Framhjá' })).toBeEnabled()
  })

  it('disables every key when the pad is disabled', () => {
    setup({ disabled: true })

    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })

  it('has 20 numbers plus bull, miss and undo always on screen', async () => {
    const { user } = setup()
    await user.click(modifier('Þrefalt'))

    const numbers = screen
      .getAllByRole('button')
      .filter((button) =>
        /^Þrefalt \d+$/.test(button.getAttribute('aria-label') ?? ''),
      )
    expect(numbers).toHaveLength(20)
    expect(screen.getByRole('button', { name: /Miðja/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Framhjá' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Afturkalla' }),
    ).toBeInTheDocument()
  })

  it('labels the keys in English', async () => {
    await i18n.changeLanguage('en')
    setup()

    const group = screen.getByRole('group', { name: 'Multiplier' })
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Single', 'Double', 'Triple'])
    expect(screen.getByRole('button', { name: 'Single 7' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Miss' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })
})
