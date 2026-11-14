import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createAuthSource, guest } from '../../auth/auth'
import { fakeAccountApi } from '../../test/fakeAccountApi'
import AccountMenu from './AccountMenu'

function setup(signedIn = false) {
  const auth = createAuthSource(
    signedIn
      ? { status: 'signedIn', householdId: 'home-1', email: 'anna@example.com' }
      : guest,
  )
  const fake = fakeAccountApi()
  render(<AccountMenu auth={auth} api={fake.api} />)
  return { auth, ...fake, user: userEvent.setup() }
}

describe('AccountMenu', () => {
  it('signs up and signs the household in', async () => {
    const { auth, api, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Skrá inn' }))
    await user.click(screen.getByRole('button', { name: 'Nýskráning' }))
    const form = screen.getByRole('form', { name: 'Nýskráning' })
    expect(within(form).getByText('Minnst 8 stafir.')).toBeVisible()
    await user.type(within(form).getByLabelText('Netfang'), 'anna@example.com')
    await user.type(within(form).getByLabelText('Lykilorð'), 'correct horse')
    await user.click(
      within(form).getByRole('button', { name: 'Stofna aðgang' }),
    )

    expect(api.register).toHaveBeenCalledWith(
      'anna@example.com',
      'correct horse',
    )
    expect(auth.get()).toEqual({
      status: 'signedIn',
      householdId: 'home-1',
      email: 'anna@example.com',
    })
    expect(screen.getByRole('button', { name: 'Aðgangur' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('signs in, and shows the one error for a wrong email or password', async () => {
    const { auth, api, accounts, user } = setup()
    accounts.set('anna@example.com', {
      password: 'correct horse',
      account: { email: 'anna@example.com', householdId: 'home-1' },
    })

    await user.click(screen.getByRole('button', { name: 'Skrá inn' }))
    const form = screen.getByRole('form', { name: 'Innskráning' })
    await user.type(within(form).getByLabelText('Netfang'), 'anna@example.com')
    await user.type(within(form).getByLabelText('Lykilorð'), 'wrong horse')
    await user.click(within(form).getByRole('button', { name: 'Skrá inn' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Rangt netfang eða lykilorð.',
    )
    expect(auth.get()).toBe(guest)

    await user.clear(within(form).getByLabelText('Lykilorð'))
    await user.type(within(form).getByLabelText('Lykilorð'), 'correct horse')
    await user.click(within(form).getByRole('button', { name: 'Skrá inn' }))
    expect(api.login).toHaveBeenLastCalledWith(
      'anna@example.com',
      'correct horse',
    )
    expect(auth.get()).toMatchObject({
      status: 'signedIn',
      householdId: 'home-1',
    })
  })

  it('uses the right password autocomplete for each form', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'Skrá inn' }))
    expect(screen.getByLabelText('Lykilorð')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    await user.click(screen.getByRole('button', { name: 'Nýskráning' }))
    expect(screen.getByLabelText('Lykilorð')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })

  it('signs out here or everywhere', async () => {
    const { auth, api, user } = setup(true)

    await user.click(screen.getByRole('button', { name: 'Aðgangur' }))
    expect(screen.getByText('Skráð inn sem anna@example.com')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Skrá út' }))
    expect(api.logout).toHaveBeenCalledOnce()
    expect(auth.get()).toBe(guest)

    act(() => auth.set({ status: 'signedIn', householdId: 'home-1' }))
    await user.click(screen.getByRole('button', { name: 'Aðgangur' }))
    await user.click(
      screen.getByRole('button', { name: 'Skrá út á öllum tækjum' }),
    )
    expect(api.logoutEverywhere).toHaveBeenCalledOnce()
    expect(auth.get()).toBe(guest)
  })

  it('changes the password', async () => {
    const { api, accounts, user } = setup()
    // An account the fake knows, then signed in through the form.
    await api.register('anna@example.com', 'correct horse')

    await user.click(screen.getByRole('button', { name: 'Skrá inn' }))
    await user.type(screen.getByLabelText('Netfang'), 'anna@example.com')
    await user.type(screen.getByLabelText('Lykilorð'), 'correct horse')
    await user.click(
      within(screen.getByRole('form', { name: 'Innskráning' })).getByRole(
        'button',
        { name: 'Skrá inn' },
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Aðgangur' }))
    const form = screen.getByRole('form', { name: 'Breyta lykilorði' })

    await user.type(
      within(form).getByLabelText('Núverandi lykilorð'),
      'nope nope',
    )
    await user.type(
      within(form).getByLabelText('Nýtt lykilorð'),
      'battery staple',
    )
    await user.click(within(form).getByRole('button', { name: 'Vista' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Núverandi lykilorð er rangt.',
    )

    await user.clear(within(form).getByLabelText('Núverandi lykilorð'))
    await user.type(
      within(form).getByLabelText('Núverandi lykilorð'),
      'correct horse',
    )
    await user.click(within(form).getByRole('button', { name: 'Vista' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Lykilorði breytt. Önnur tæki voru skráð út.',
    )
    expect(accounts.get('anna@example.com')?.password).toBe('battery staple')
  })

  it('closes with Escape', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'Skrá inn' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })
})
