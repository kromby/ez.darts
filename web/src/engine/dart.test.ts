import { describe, expect, it } from 'vitest'
import {
  BULL,
  MISS,
  dart,
  fits,
  isBull,
  isDouble,
  isMiss,
  isTriple,
  isValidDart,
  notation,
  points,
  type Dart,
} from './dart'

const single20: Dart = { segment: 20, multiplier: 1 }
const double20: Dart = { segment: 20, multiplier: 2 }
const triple20: Dart = { segment: 20, multiplier: 3 }
const outerBull: Dart = { segment: BULL, multiplier: 1 }
const bullseye: Dart = { segment: BULL, multiplier: 2 }

describe('points', () => {
  it('multiplies the segment by the multiplier', () => {
    expect(points(single20)).toBe(20)
    expect(points(double20)).toBe(40)
    expect(points(triple20)).toBe(60)
    expect(points({ segment: 1, multiplier: 3 })).toBe(3)
  })

  it('scores 25 for the outer bull and 50 for the bullseye', () => {
    expect(points(outerBull)).toBe(25)
    expect(points(bullseye)).toBe(50)
  })

  it('scores 0 for a miss', () => {
    expect(points(MISS)).toBe(0)
    expect(points({ segment: 20, multiplier: 0 })).toBe(0)
  })
})

describe('isDouble / isTriple / isMiss / isBull', () => {
  it('recognises doubles, including the bullseye', () => {
    expect(isDouble(double20)).toBe(true)
    expect(isDouble(bullseye)).toBe(true)
    expect(isDouble(single20)).toBe(false)
    expect(isDouble(triple20)).toBe(false)
    expect(isDouble(MISS)).toBe(false)
  })

  it('recognises triples', () => {
    expect(isTriple(triple20)).toBe(true)
    expect(isTriple(double20)).toBe(false)
    expect(isTriple(bullseye)).toBe(false)
    expect(isTriple(MISS)).toBe(false)
  })

  it('treats segment 0 or multiplier 0 as a miss', () => {
    expect(isMiss(MISS)).toBe(true)
    expect(isMiss({ segment: 0, multiplier: 0 })).toBe(true)
    expect(isMiss({ segment: 20, multiplier: 0 })).toBe(true)
    expect(isMiss(single20)).toBe(false)
    expect(isMiss(outerBull)).toBe(false)
  })

  it('recognises both bulls', () => {
    expect(isBull(outerBull)).toBe(true)
    expect(isBull(bullseye)).toBe(true)
    expect(isBull(single20)).toBe(false)
    expect(isBull({ segment: BULL, multiplier: 0 })).toBe(false)
  })
})

describe('fits', () => {
  it('single: any scoring dart fits', () => {
    expect(fits(single20, 'single')).toBe(true)
    expect(fits(double20, 'single')).toBe(true)
    expect(fits(triple20, 'single')).toBe(true)
    expect(fits(outerBull, 'single')).toBe(true)
    expect(fits(bullseye, 'single')).toBe(true)
  })

  it('double: only doubles fit, including the bullseye', () => {
    expect(fits(double20, 'double')).toBe(true)
    expect(fits(bullseye, 'double')).toBe(true)
    expect(fits(single20, 'double')).toBe(false)
    expect(fits(triple20, 'double')).toBe(false)
    expect(fits(outerBull, 'double')).toBe(false)
  })

  it('master: doubles and triples fit, including the bullseye', () => {
    expect(fits(double20, 'master')).toBe(true)
    expect(fits(triple20, 'master')).toBe(true)
    expect(fits(bullseye, 'master')).toBe(true)
    expect(fits(single20, 'master')).toBe(false)
    expect(fits(outerBull, 'master')).toBe(false)
  })

  it('a miss never fits', () => {
    expect(fits(MISS, 'single')).toBe(false)
    expect(fits(MISS, 'double')).toBe(false)
    expect(fits(MISS, 'master')).toBe(false)
  })
})

describe('isValidDart', () => {
  it('accepts segments 1–20 with any multiplier', () => {
    for (let segment = 1; segment <= 20; segment++) {
      for (const multiplier of [1, 2, 3] as const) {
        expect(isValidDart({ segment, multiplier })).toBe(true)
      }
    }
  })

  it('accepts single and double bull but not a triple bull', () => {
    expect(isValidDart(outerBull)).toBe(true)
    expect(isValidDart(bullseye)).toBe(true)
    expect(isValidDart({ segment: BULL, multiplier: 3 })).toBe(false)
  })

  it('accepts a miss only as segment 0, multiplier 0', () => {
    expect(isValidDart(MISS)).toBe(true)
    expect(isValidDart({ segment: 0, multiplier: 1 })).toBe(false)
    expect(isValidDart({ segment: 20, multiplier: 0 })).toBe(false)
  })

  it('rejects segments that are not on the board', () => {
    expect(isValidDart({ segment: 21, multiplier: 1 })).toBe(false)
    expect(isValidDart({ segment: -1, multiplier: 1 })).toBe(false)
    expect(isValidDart({ segment: 2.5, multiplier: 1 })).toBe(false)
  })
})

describe('dart', () => {
  it('builds a valid dart', () => {
    expect(dart(20, 3)).toEqual(triple20)
    expect(dart(BULL, 2)).toEqual(bullseye)
    expect(dart(0, 0)).toEqual(MISS)
  })

  it('throws for a dart that cannot be thrown', () => {
    expect(() => dart(BULL, 3)).toThrow(RangeError)
    expect(() => dart(21, 1)).toThrow(RangeError)
  })
})

describe('notation', () => {
  it('writes darts in board notation', () => {
    expect(notation(single20)).toBe('S20')
    expect(notation(double20)).toBe('D20')
    expect(notation(triple20)).toBe('T20')
    expect(notation(outerBull)).toBe('S25')
    expect(notation(bullseye)).toBe('D25')
    expect(notation(MISS)).toBeNull()
  })
})
