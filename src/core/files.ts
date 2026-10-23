// Giving a file to the user (the copy of the progress).

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled'

const touchDevice = () => typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0

/**
 * On iPad the share sheet («Зберегти у Файли», AirDrop…), which also works in the app installed on the Home Screen;
 * elsewhere a download. Call it right from a tap: the share sheet needs the tap.
 */
export async function saveFile(data: string, name: string, type: string): Promise<SaveOutcome> {
  const blob = new Blob([data], { type })
  const file = new File([blob], name, { type })
  if (touchDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // NotAllowedError (the tap expired) and others: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'downloaded'
}
