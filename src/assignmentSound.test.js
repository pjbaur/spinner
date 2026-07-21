import { describe, it, expect } from 'vitest'
import { createAssignmentSound } from './assignmentSound.js'

describe('createAssignmentSound', () => {
  it('exposes the four sound methods', () => {
    const sound = createAssignmentSound(() => true)
    expect(typeof sound.ensureAudio).toBe('function')
    expect(typeof sound.tick).toBe('function')
    expect(typeof sound.ding).toBe('function')
    expect(typeof sound.stamp).toBe('function')
  })

  it('is a no-op and never throws when sound is off', () => {
    const sound = createAssignmentSound(() => false)
    expect(() => {
      sound.ensureAudio()
      sound.tick()
      sound.ding()
      sound.stamp()
    }).not.toThrow()
  })

  it('does not throw in an environment without AudioContext', () => {
    // jsdom has no window.AudioContext; ensureAudio must swallow the failure
    const sound = createAssignmentSound(() => true)
    expect(() => {
      sound.ensureAudio()
      sound.tick()
      sound.stamp()
    }).not.toThrow()
  })
})
