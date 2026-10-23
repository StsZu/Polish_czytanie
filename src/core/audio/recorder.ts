// «Запис себе»: the reader's voice while reading, kept only in memory for «Я / Диктор» (FR-19).
// A count-in of three metronome clicks and a silent beat comes before it; the level of the microphone is shown
// while it records.

let shared: AudioContext | null = null

/** One AudioContext for the clicks and the level meter, created on the first tap (Safari needs a gesture). */
function context(): AudioContext {
  shared ??= new AudioContext()
  if (shared.state === 'suspended') void shared.resume()
  return shared
}

export const BEAT_SECONDS = 0.6

/**
 * Three clicks one beat apart (the first higher), then a silent beat on which the reader starts. `onBeat` gets
 * 1, 2, 3 with the clicks and 4 on the silent beat. Resolves true then, or false when aborted.
 */
export function countIn(onBeat: (beat: number) => void, signal: AbortSignal, beat = BEAT_SECONDS): Promise<boolean> {
  const ctx = context()
  const start = ctx.currentTime + 0.1
  const nodes: OscillatorNode[] = []
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const at = start + i * beat
    osc.frequency.value = i === 0 ? 1500 : 1000
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.5, at + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.06)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.08)
    nodes.push(osc)
  }
  return new Promise((resolve) => {
    const timers = [1, 2, 3, 4].map((n) => setTimeout(() => {
      onBeat(n)
      if (n === 4) resolve(true)
    }, (0.1 + (n - 1) * beat) * 1000))
    signal.addEventListener('abort', () => {
      timers.forEach(clearTimeout)
      for (const osc of nodes) {
        try {
          osc.stop()
        } catch {
          // Already stopped.
        }
      }
      resolve(false)
    }, { once: true })
  })
}

export class SelfRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private analyser: AnalyserNode | null = null
  private samples: Float32Array<ArrayBuffer> | null = null
  private chunks: Blob[] = []
  private url: string | null = null

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }

  /** Asks for the microphone (once); throws when it is refused. */
  async open(): Promise<void> {
    this.stream ??= await navigator.mediaDevices.getUserMedia({ audio: true })
  }

  start(): void {
    if (!this.stream) throw new Error('Мікрофон не відкрито.')
    this.discard()
    const type = ['audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
    this.recorder = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined)
    this.chunks = []
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data)
    }
    this.recorder.start()
  }

  /** The loudness of the microphone now, 0–1. */
  level(): number {
    if (!this.stream) return 0
    if (!this.analyser) {
      const ctx = context()
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 1024
      ctx.createMediaStreamSource(this.stream).connect(this.analyser)
      this.samples = new Float32Array(this.analyser.fftSize)
    }
    this.analyser.getFloatTimeDomainData(this.samples!)
    let sum = 0
    for (const x of this.samples!) sum += x * x
    return Math.min(1, Math.sqrt(sum / this.samples!.length) * 5)
  }

  /** Stops and returns a Blob URL of what was said, or null when nothing was recorded. */
  stop(): Promise<string | null> {
    const recorder = this.recorder
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(this.url)
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/mp4' })
        this.url = blob.size ? URL.createObjectURL(blob) : null
        resolve(this.url)
      }
      recorder.stop()
    })
  }

  discard() {
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = null
    this.chunks = []
  }

  /** Releases the microphone (the indicator in the status bar goes off). */
  release() {
    this.discard()
    if (this.recorder?.state === 'recording') this.recorder.stop()
    this.recorder = null
    this.analyser?.disconnect()
    this.analyser = null
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
  }
}
