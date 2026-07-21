import { describe, it, expect } from 'vitest'
import { createAssignmentSound } from './assignmentSound.js'

describe('createAssignmentSound', () => {
  it('exposes the sound methods', () => {
    const sound = createAssignmentSound()
    expect(typeof sound.ensureAudio).toBe('function')
    expect(typeof sound.tick).toBe('function')
    expect(typeof sound.ding).toBe('function')
    expect(typeof sound.stamp).toBe('function')
    expect(typeof sound.setEnabled).toBe('function')
  })

  it('is a no-op and never throws when disabled', () => {
    const sound = createAssignmentSound()
    sound.setEnabled(false)
    expect(() => {
      sound.ensureAudio()
      sound.tick()
      sound.ding()
      sound.stamp()
    }).not.toThrow()
  })

  it('does not throw in an environment without AudioContext', () => {
    const sound = createAssignmentSound()
    expect(() => {
      sound.ensureAudio()
      sound.tick()
      sound.stamp()
    }).not.toThrow()
  })
})
