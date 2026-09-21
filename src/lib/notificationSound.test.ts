import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  installAudioUnlock, isSoundEnabled, playNotificationSound, resetAudioForTests, setSoundEnabled, unlockAudio,
} from './notificationSound'

// A stand-in for the browser's audio: starts "suspended" like a real one before a
// click, becomes "running" when resumed, and records the notes that get played.
const played: number[] = []
let contextsCreated = 0
let resumeWorks = true

class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended'
  currentTime = 0
  destination = {}
  constructor() {
    contextsCreated++
  }
  resume() {
    if (resumeWorks) this.state = 'running'
    return Promise.resolve()
  }
  createOscillator() {
    const osc = {
      type: 'sine',
      frequency: { value: 0 },
      connect: () => {},
      start: () => played.push(osc.frequency.value),
      stop: () => {},
    }
    return osc
  }
  createGain() {
    return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }
  }
}

function withFakeAudio() {
  Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true, writable: true })
}
function withoutAudio() {
  Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true, writable: true })
}

beforeEach(() => {
  played.length = 0
  contextsCreated = 0
  resumeWorks = true
  resetAudioForTests()
  window.localStorage.clear()
  withFakeAudio()
})
afterEach(() => withoutAudio())

describe('notification sound', () => {
  it('is on by default and remembers being switched off and on again', () => {
    expect(isSoundEnabled()).toBe(true)
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
    expect(window.localStorage.getItem('afms_notification_sound')).toBe('off')
    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })

  it('stays silent until the browser has allowed audio (no click yet)', () => {
    expect(playNotificationSound()).toBe(false)
    expect(played).toEqual([])
  })

  it('plays a two-note chime once audio is unlocked', () => {
    expect(unlockAudio()).toBe(true)
    expect(playNotificationSound()).toBe(true)
    expect(played).toEqual([880, 1318.5])
  })

  it('does not play when the person has muted it', () => {
    unlockAudio()
    setSoundEnabled(false)
    expect(playNotificationSound()).toBe(false)
    expect(played).toEqual([])
  })

  it('stays silent if the browser refuses to start audio', () => {
    resumeWorks = false
    expect(unlockAudio()).toBe(false)
    expect(playNotificationSound()).toBe(false)
  })

  it('does nothing, and does not throw, in a browser with no audio support', () => {
    withoutAudio()
    expect(unlockAudio()).toBe(false)
    expect(playNotificationSound()).toBe(false)
  })

  it('unlocks on the first click and then stops listening', () => {
    const remove = installAudioUnlock()
    expect(contextsCreated).toBe(0)
    window.dispatchEvent(new Event('pointerdown'))
    expect(contextsCreated).toBe(1)
    expect(playNotificationSound()).toBe(true)

    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('keydown'))
    expect(contextsCreated).toBe(1)
    remove()
  })
})
