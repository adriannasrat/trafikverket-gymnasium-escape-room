import { describe, expect, it } from 'vitest'
import { formatElapsed, timerTone } from './time'

describe('event timing', () => {
  it('formats total time with tenths of a second', () => {
    expect(formatElapsed(125_678)).toBe('02:05.6')
  })

  it('never displays a negative total time', () => {
    expect(formatElapsed(-1)).toBe('00:00.0')
  })

  it('moves the challenge timer from green through yellow to red', () => {
    expect(timerTone(25, 30)).toBe('safe')
    expect(timerTone(12, 30)).toBe('warning')
    expect(timerTone(5, 30)).toBe('danger')
  })
})
