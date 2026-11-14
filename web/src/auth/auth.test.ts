import { describe, expect, it, vi } from 'vitest'
import { createAuthSource, devAuthState, guest } from './auth'

describe('auth source', () => {
  it('starts as a guest and tells listeners about sign-in and sign-out', () => {
    const auth = createAuthSource()
    const listener = vi.fn<() => void>()
    const unsubscribe = auth.subscribe(listener)

    expect(auth.get()).toBe(guest)
    auth.set({ status: 'signedIn', householdId: 'home' })
    expect(auth.get()).toEqual({ status: 'signedIn', householdId: 'home' })
    unsubscribe()
    auth.set(guest)

    expect(listener).toHaveBeenCalledOnce()
    expect(auth.get()).toBe(guest)
  })
})

describe('devAuthState', () => {
  it('signs in with ?household= and remembers it', () => {
    expect(devAuthState('?household=test', localStorage)).toEqual({
      status: 'signedIn',
      householdId: 'test',
      devHeader: true,
    })
    expect(devAuthState('', localStorage)).toEqual({
      status: 'signedIn',
      householdId: 'test',
      devHeader: true,
    })
  })

  it('goes back to guest with an empty or unsafe household', () => {
    devAuthState('?household=test', localStorage)

    expect(devAuthState('?household=', localStorage)).toBe(guest)
    expect(devAuthState('', localStorage)).toBe(guest)
    expect(devAuthState('?household=a%2Fb', localStorage)).toBe(guest)
  })

  it('stays a guest when storage is blocked', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
    } as unknown as Storage

    expect(devAuthState('', blocked)).toBe(guest)
  })
})
