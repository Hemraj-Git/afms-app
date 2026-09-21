'use client'

import { useSyncExternalStore } from 'react'

// A short two-note chime for new notifications. It is synthesised with the Web
// Audio API, so there is no sound file to ship or license.
//
// Browsers only allow audio after the person has interacted with the page (a click,
// tap or key press). Until then playNotificationSound() quietly does nothing, and the
// first interaction "unlocks" audio (installAudioUnlock). People can also switch the
// sound off; that choice is kept per browser.

const STORAGE_KEY = 'afms_notification_sound'
const CHANGE_EVENT = 'afms-notification-sound-change'

type AudioContextCtor = typeof AudioContext

let audioContext: AudioContext | null = null

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

// On unless the person turned it off.
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Storage blocked (private window): the choice just won't be remembered.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

// Create / resume the audio context. Must run inside a user gesture the first time.
export function unlockAudio(): boolean {
  const Ctor = getAudioContextCtor()
  if (!Ctor) return false
  try {
    if (!audioContext) audioContext = new Ctor()
    if (audioContext.state === 'suspended') void audioContext.resume()
    return audioContext.state === 'running'
  } catch {
    return false
  }
}

// Unlock audio on the first click / tap / key press, then stop listening.
export function installAudioUnlock(): () => void {
  if (typeof window === 'undefined') return () => {}
  const events = ['pointerdown', 'keydown', 'touchstart'] as const
  const remove = () => events.forEach(e => window.removeEventListener(e, onGesture, true))
  function onGesture() {
    if (unlockAudio() || audioContext?.state === 'running') remove()
  }
  events.forEach(e => window.addEventListener(e, onGesture, true))
  return remove
}

function playTone(ctx: AudioContext, frequency: number, start: number, duration: number) {
  const at = ctx.currentTime + start
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  // A quick fade in and out, so it is a soft chime rather than a click.
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.18, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(at)
  oscillator.stop(at + duration + 0.02)
}

// Plays the chime if sound is on and the browser has allowed audio. Returns whether it played.
export function playNotificationSound(): boolean {
  if (!isSoundEnabled()) return false
  const ctx = audioContext
  if (!ctx || ctx.state !== 'running') return false
  try {
    playTone(ctx, 880, 0, 0.16)
    playTone(ctx, 1318.5, 0.14, 0.3)
    return true
  } catch {
    return false
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// The on/off choice, kept in step across the header and the mobile app.
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, isSoundEnabled, () => true)
}

// Test hook: forget the audio context between tests.
export function resetAudioForTests() {
  audioContext = null
}
