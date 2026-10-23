// «Налаштування»: reading, audio for offline use, the copy of the progress, clearing everything (FR-41, FR-43, FR-45).
import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../contracts.ts'
import { cachedExercises, clearAudio, downloadAll, exerciseBytes, type DownloadProgress } from '../core/audio/cache.ts'
import { saveFile } from '../core/files.ts'
import { BackupError, createBackup, mergeBackup, parseBackup, replaceWith, type ParsedBackup } from '../core/progress/backup.ts'
import * as db from '../core/progress/db.ts'
import { dayOf } from '../core/progress/days.ts'
import { ChoiceDialog, MessageDialog, TypedConfirmDialog } from './Dialog.tsx'
import { useStore } from './store.tsx'

const MB = (bytes: number) => `${(bytes / 1048576).toFixed(1).replace('.', ',')} МБ`

export function SettingsScreen() {
  const store = useStore()
  const { settings } = store
  const fileInput = useRef<HTMLInputElement>(null)
  const [cached, setCached] = useState<Set<string>>(new Set())
  const [download, setDownload] = useState<DownloadProgress | null>(null)
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const [problems, setProblems] = useState<string[] | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refreshCached = () => void cachedExercises(store.content.exercises).then(setCached)
  useEffect(refreshCached, [store.content])

  const set = (patch: Partial<Settings>) => void store.updateSettings(patch)
  const totalBytes = store.content.exercises.reduce((n, e) => n + exerciseBytes(e), 0)
  const cachedBytes = store.content.exercises.filter((e) => cached.has(e.id)).reduce((n, e) => n + exerciseBytes(e), 0)

  const startDownload = async () => {
    const result = await downloadAll(store.content.exercises, setDownload)
    setDownload(result)
    refreshCached()
  }

  const exportCopy = async () => {
    await store.flush()
    const data = createBackup({ attempts: store.attempts, hard: store.hard, sessions: store.sessions, settings })
    const outcome = await saveFile(JSON.stringify(data, null, 1), `czytanie-kopiya-${dayOf()}.json`, 'application/json')
    if (outcome !== 'cancelled') setMessage('Копію збережено. Зберігайте її у «Файлах» або iCloud — це єдина страховка, якщо Safari очистить дані.')
  }

  const openCopy = async (file: File) => {
    try {
      setPending(parseBackup(await file.text()))
    } catch (e) {
      setProblems(e instanceof BackupError ? e.problems : ['Не вдалося прочитати файл.'])
    }
  }

  const apply = async (mode: 'merge' | 'replace') => {
    const parsed = pending
    setPending(null)
    if (!parsed) return
    const device = { attempts: store.attempts, hard: store.hard, sessions: store.sessions, settings }
    const next = parsed.kind === 'legacy'
      ? mergeBackup(device, { attempts: parsed.attempts })
      : mode === 'replace' ? replaceWith(parsed.data) : mergeBackup(device, parsed.data)
    try {
      await store.flush()
      await db.replaceAll(next)
      await store.reload()
      setMessage(parsed.kind === 'legacy' ? 'Спроби старого тренажера додано в історію.' : 'Копію відновлено.')
    } catch (e) {
      setProblems([db.storageError(e).message, 'Дані на пристрої не змінено.'])
    }
  }

  const clearEverything = async () => {
    setConfirmClear(false)
    try {
      await db.clearAll()
      await clearAudio()
      await store.reload()
      refreshCached()
      setMessage('Усі дані й завантажене аудіо видалено.')
    } catch (e) {
      setProblems([db.storageError(e).message])
    }
  }

  const fileCount = (p: ParsedBackup) => (p.kind === 'legacy' ? p.attempts.length : p.data.attempts.length)

  return (
    <section data-testid="settings">
      <h1>Налаштування</h1>
      {message && <p className="notice" role="status" data-testid="settingsMessage">{message}</p>}

      <h2>Читання</h2>
      <label className="field">
        <span>Розмір тексту: {settings.fontPx} px</span>
        <input type="range" min={22} max={30} step={1} value={settings.fontPx} onChange={(e) => set({ fontPx: Number(e.currentTarget.value) })} data-testid="fontSize" />
      </label>
      <p className="reading sample" lang="pl">Kasia przy kasie płaci za kaszę.</p>
      <div className="field">
        <span>Тема</span>
        <div className="segmented" role="group" aria-label="Тема">
          {([['system', 'Як у системі'], ['light', 'Світла'], ['dark', 'Темна']] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={settings.theme === value} onClick={() => set({ theme: value })} data-testid={`theme-${value}`}>{label}</button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>Швидкість диктора</span>
        <select value={settings.rate} onChange={(e) => set({ rate: Number(e.currentTarget.value) })} data-testid="settingsRate">
          {[0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2].map((r) => <option key={r} value={r}>{r.toFixed(1).replace('.', ',')}×</option>)}
        </select>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.pacer} onChange={(e) => set({ pacer: e.currentTarget.checked })} data-testid="settingsPacer" />
        <span>Ведучий у читанні на темп</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={settings.recordSelf} onChange={(e) => set({ recordSelf: e.currentTarget.checked })} data-testid="settingsRecord" />
        <span>Запис себе: порівнювати «Я / Диктор» (запис лише в пам'яті, нікуди не надсилається)</span>
      </label>

      <h2>Аудіо без інтернету</h2>
      <p className="meta" data-testid="audioState">На пристрої: {cached.size} з 21 вправ ({MB(cachedBytes)} з {MB(totalBytes)}). Аудіо вправи завантажується, коли ви її відкриваєте.</p>
      {download && download.doneBytes < download.totalBytes && (
        <progress max={download.totalBytes} value={download.doneBytes} aria-label="Завантаження аудіо" data-testid="downloadProgress" />
      )}
      {download && download.doneBytes >= download.totalBytes && (
        <p className="meta" data-testid="downloadDone">{download.failed.length ? `Не завантажено: ${download.failed.length} записів. Перевірте інтернет і спробуйте ще.` : 'Усе аудіо на пристрої.'}</p>
      )}
      <button type="button" className="button primary" onClick={() => void startDownload()} disabled={cached.size === 21 || (download !== null && download.doneBytes < download.totalBytes)} data-testid="downloadAll">Завантажити все аудіо</button>

      <h2>Копія прогресу</h2>
      <p className="meta">Прогрес живе лише на цьому пристрої. Зберігайте копію раз на тиждень; аудіо в копію не входить.</p>
      <div className="row-actions">
        <button type="button" className="button" onClick={() => void exportCopy()} data-testid="exportCopy">Зберегти копію</button>
        <button type="button" className="button" onClick={() => fileInput.current?.click()} data-testid="importCopy">Відновити з копії</button>
        <input ref={fileInput} type="file" hidden accept=".json,application/json" onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void openCopy(file)
        }} data-testid="importInput" />
      </div>

      <h2>Очищення</h2>
      <button type="button" className="button destructive" onClick={() => setConfirmClear(true)} data-testid="clearAll">Очистити всі дані</button>

      <p className="meta version">Версія {__APP_VERSION__}</p>

      {pending && pending.kind === 'backup' && (
        <ChoiceDialog
          title="Відновити з копії?"
          text={`У файлі: ${fileCount(pending)} спроб і ${pending.data.hard.length} важких слів. На пристрої: ${store.attempts.length} спроб і ${store.hard.length} важких слів. «Об'єднати» додає те, чого немає на пристрої; «Замінити» ставить копію замість усього.`}
          choices={[
            { label: 'Замінити', testId: 'replace', onChoose: () => void apply('replace') },
            { label: "Об'єднати", primary: true, testId: 'merge', onChoose: () => void apply('merge') },
          ]}
          onCancel={() => setPending(null)}
        />
      )}
      {pending && pending.kind === 'legacy' && (
        <ChoiceDialog
          title="Файл старого тренажера"
          text={`У файлі ${fileCount(pending)} спроб старого тренажера czytanie/. Вони додадуться в історію (час практики), але не як холодне читання.`}
          choices={[{ label: 'Додати в історію', primary: true, testId: 'merge', onChoose: () => void apply('merge') }]}
          onCancel={() => setPending(null)}
        />
      )}
      {problems && <MessageDialog title="Файл не підходить" lines={problems} onClose={() => setProblems(null)} />}
      {confirmClear && (
        <TypedConfirmDialog
          title="Очистити всі дані?"
          text="Буде видалено всі спроби, важкі слова, налаштування й завантажене аудіо. Тексти вправ лишаться. Скасувати це неможливо: спершу збережіть копію."
          word="видалити"
          confirmLabel="Очистити"
          onConfirm={() => void clearEverything()}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </section>
  )
}
