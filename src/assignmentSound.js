export function createAssignmentSound() {
  let ctx = null
  let enabled = true

  function setEnabled(value) {
    enabled = value !== false
  }

  function ensureAudio() {
    if (!enabled) return
    if (!ctx) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext
        ctx = new Ctor()
      } catch {
        ctx = null
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }

  function blip(freq, dur, type, vol) {
    if (!enabled || !ctx) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(vol, t + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  function tick() {
    blip(1250, 0.028, 'square', 0.035)
  }

  function ding() {
    blip(680, 0.16, 'triangle', 0.09)
    setTimeout(() => blip(1020, 0.34, 'triangle', 0.075), 115)
  }

  function stamp() {
    if (!enabled || !ctx) return
    blip(150, 0.15, 'sine', 0.16)
    const len = Math.floor(ctx.sampleRate * 0.12)
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = 0.13
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start(ctx.currentTime)
  }

  return { ensureAudio, tick, ding, stamp, setEnabled }
}
