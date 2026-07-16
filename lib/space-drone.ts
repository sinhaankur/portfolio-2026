/* Deep Field — an original, generative ambient drone in pure Web Audio.
 *
 * Interstellar-adjacent, not Interstellar: slow organ-voiced chords crossfade
 * over a gliding sub pedal inside a long cathedral reverb, with a faint
 * starlight-noise wash underneath. Everything is synthesized on the device —
 * no samples, no streaming, no licensing — so it works offline (webOS TVs
 * included) and costs only a couple dozen audio nodes.
 *
 * No React, no R3F: consumers hold one SpaceDrone and call start() / stop().
 * start() must be called from a user gesture (AudioContext autoplay policy).
 */

const CHORD_SECONDS = 26 // how long each chord holds before the next swells in
const SWELL_SECONDS = 9 // attack/release — adjacent chords overlap by this much
const SCHEDULE_AHEAD_SECONDS = 3
const MASTER_LEVEL = 0.9
const FADE_IN_SECONDS = 5
const FADE_OUT_SECONDS = 2.5

// A-minor family, voiced low and open — reverent, never busy. Frequencies in
// Hz (equal temperament); `sub` is the pedal an octave or two below the root.
const CHORDS: { notes: number[]; sub: number }[] = [
  { notes: [110.0, 164.81, 220.0, 246.94, 329.63], sub: 55.0 }, // Am add9
  { notes: [87.31, 130.81, 174.61, 220.0, 261.63], sub: 43.65 }, // Fmaj add9
  { notes: [130.81, 196.0, 261.63, 329.63], sub: 65.41 }, // C
  { notes: [98.0, 146.83, 196.0, 246.94, 293.66], sub: 49.0 }, // G add5
]

const NOTE_LEVEL = 0.05
const PARTIAL_LEVEL = 0.014 // octave-up partial gives the organ its air
const SUB_LEVEL = 0.08
const NOISE_LEVEL = 0.012

export class SpaceDrone {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: GainNode | null = null
  private sub: OscillatorNode | null = null
  private timer: number | null = null
  private nextChordAt = 0
  private chordIndex = 0
  private stopTimeout: number | null = null

  get playing(): boolean {
    return this.ctx !== null && this.stopTimeout === null
  }

  start(): void {
    if (this.ctx) {
      // Restart requested mid-fade-out: cancel the teardown and swell back.
      if (this.stopTimeout !== null && this.master) {
        window.clearTimeout(this.stopTimeout)
        this.stopTimeout = null
        const t = this.ctx.currentTime
        this.master.gain.cancelScheduledValues(t)
        this.master.gain.linearRampToValueAtTime(MASTER_LEVEL, t + FADE_IN_SECONDS)
      }
      return
    }

    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    this.ctx = ctx
    void ctx.resume()

    const now = ctx.currentTime

    // Master fade-in so the universe never startles anyone.
    const master = ctx.createGain()
    master.gain.setValueAtTime(0, now)
    master.gain.linearRampToValueAtTime(MASTER_LEVEL, now + FADE_IN_SECONDS)
    master.connect(ctx.destination)
    this.master = master

    // Chord bus -> gentle lowpass -> dry + convolved wet. The lowpass keeps
    // the sines from ever sounding synthetic-bright on TV speakers.
    const bus = ctx.createGain()
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = "lowpass"
    lowpass.frequency.value = 1400
    lowpass.Q.value = 0.4
    bus.connect(lowpass)

    const dry = ctx.createGain()
    dry.gain.value = 0.55
    lowpass.connect(dry)
    dry.connect(master)

    // Cathedral reverb from a generated impulse — no sample file needed.
    try {
      const convolver = ctx.createConvolver()
      convolver.buffer = this.makeImpulse(ctx, 5.5, 3.2)
      const wet = ctx.createGain()
      wet.gain.value = 0.5
      lowpass.connect(convolver)
      convolver.connect(wet)
      wet.connect(master)
    } catch {
      // Constrained device: dry-only still reads as the same piece.
    }
    this.bus = bus

    // Sub pedal — one continuous sine that glides to each chord's root.
    const sub = ctx.createOscillator()
    sub.type = "sine"
    sub.frequency.setValueAtTime(CHORDS[0].sub, now)
    const subGain = ctx.createGain()
    subGain.gain.value = SUB_LEVEL
    sub.connect(subGain)
    subGain.connect(master)
    sub.start(now)
    this.sub = sub

    // Starlight wash — looped noise through a slowly wandering bandpass.
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const noiseData = noiseBuf.getChannelData(0)
    for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true
    const band = ctx.createBiquadFilter()
    band.type = "bandpass"
    band.frequency.value = 950
    band.Q.value = 0.7
    const bandLfo = ctx.createOscillator()
    bandLfo.frequency.value = 0.03
    const bandLfoGain = ctx.createGain()
    bandLfoGain.gain.value = 420
    bandLfo.connect(bandLfoGain)
    bandLfoGain.connect(band.frequency)
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = NOISE_LEVEL
    noise.connect(band)
    band.connect(noiseGain)
    noiseGain.connect(bus)
    noise.start(now)
    bandLfo.start(now)

    // Chord scheduler: keep ~one chord queued ahead of the clock.
    this.chordIndex = 0
    this.nextChordAt = now + 0.1
    const tick = () => {
      if (!this.ctx) return
      while (this.nextChordAt < this.ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
        this.scheduleChord(this.chordIndex % CHORDS.length, this.nextChordAt)
        this.chordIndex++
        this.nextChordAt += CHORD_SECONDS
      }
    }
    tick()
    this.timer = window.setInterval(tick, 1000)
  }

  stop(): void {
    const { ctx, master } = this
    if (!ctx || !master || this.stopTimeout !== null) return
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(0, t + FADE_OUT_SECONDS)
    this.stopTimeout = window.setTimeout(() => {
      void ctx.close().catch(() => undefined)
      this.ctx = null
      this.master = null
      this.bus = null
      this.sub = null
      this.stopTimeout = null
    }, (FADE_OUT_SECONDS + 0.3) * 1000)
  }

  private scheduleChord(index: number, when: number): void {
    const { ctx, bus, sub } = this
    if (!ctx || !bus) return
    const chord = CHORDS[index]
    const release = when + CHORD_SECONDS
    const end = release + SWELL_SECONDS

    // One envelope for the whole chord; overlapping envelopes crossfade.
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, when)
    env.gain.linearRampToValueAtTime(1, when + SWELL_SECONDS)
    env.gain.setValueAtTime(1, release)
    env.gain.linearRampToValueAtTime(0, end)
    env.connect(bus)

    chord.notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = "sine"
      osc.frequency.value = freq
      osc.detune.value = i % 2 === 0 ? -3 : 3 // slow-beating chorus between voices
      const g = ctx.createGain()
      g.gain.value = NOTE_LEVEL
      osc.connect(g)
      g.connect(env)
      osc.start(when)
      osc.stop(end + 0.1)

      const partial = ctx.createOscillator()
      partial.type = "sine"
      partial.frequency.value = freq * 2
      const pg = ctx.createGain()
      pg.gain.value = PARTIAL_LEVEL
      partial.connect(pg)
      pg.connect(env)
      partial.start(when)
      partial.stop(end + 0.1)
    })

    sub?.frequency.setTargetAtTime(chord.sub, when, 3)
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds)
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return buffer
  }
}
