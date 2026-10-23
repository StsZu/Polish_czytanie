// «Запис себе»: the reader's voice while reading, kept only in memory for «Я / Диктор» (FR-19).

export class SelfRecorder {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private url: string | null = null

  static supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  }

  async start(): Promise<void> {
    this.discard()
    this.stream ??= await navigator.mediaDevices.getUserMedia({ audio: true })
    const type = ['audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
    this.recorder = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined)
    this.chunks = []
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data)
    }
    this.recorder.start()
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
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
  }
}
