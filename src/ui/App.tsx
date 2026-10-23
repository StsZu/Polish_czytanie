// The app shell: navigation by hash, the theme and font size, the notices about saving and updates.
import { useEffect, useState } from 'react'
import { applyUpdate, onUpdateAvailable } from '../pwa/register.ts'
import { KeysDialog } from './Dialog.tsx'
import { Exercises } from './Exercises.tsx'
import { Listen } from './Listen.tsx'
import { route, type Route } from './router.ts'
import { useKeys } from './session/common.tsx'
import { Session } from './session/Session.tsx'
import { SettingsScreen } from './Settings.tsx'
import { StoreProvider, useStore } from './store.tsx'
import { Today } from './Today.tsx'
import { Discrimination } from './train/Discrimination.tsx'
import { HardWords } from './train/HardWords.tsx'
import { Progress } from './train/Progress.tsx'
import { Pronunciation } from './train/Pronunciation.tsx'

export const TABS: { name: Route['name']; href: string; label: string }[] = [
  { name: 'exercises', href: '#/', label: 'Підручник' },
  { name: 'discrimination', href: '#/rozroznianie', label: 'Розрізнення' },
  { name: 'hard', href: '#/trudne', label: 'Важкі слова' },
  { name: 'today', href: '#/dzis', label: 'Сьогодні' },
  { name: 'progress', href: '#/postep', label: 'Прогрес' },
  { name: 'settings', href: '#/ustawienia', label: 'Налаштування' },
]

function useRoute(): Route {
  const [current, setCurrent] = useState(() => route(location.hash))
  useEffect(() => {
    const update = () => {
      setCurrent(route(location.hash))
      window.scrollTo(0, 0)
    }
    addEventListener('hashchange', update)
    return () => removeEventListener('hashchange', update)
  }, [])
  return current
}

function Shell() {
  const store = useStore()
  const r = useRoute()
  const [update, setUpdate] = useState(false)
  const [keysHelp, setKeysHelp] = useState(false)
  useEffect(() => onUpdateAvailable(setUpdate), [])
  // Key hints are hidden on touch until a hardware keyboard is used.
  useEffect(() => {
    const seen = (event: KeyboardEvent) => {
      if (event.key !== 'Unidentified') document.documentElement.dataset.keys = ''
    }
    document.addEventListener('keydown', seen, { once: true })
    return () => document.removeEventListener('keydown', seen)
  }, [])

  useEffect(() => {
    const forced = new URLSearchParams(location.search).get('theme')
    const theme = forced === 'light' || forced === 'dark' ? forced : store.settings.theme
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    document.documentElement.style.setProperty('--read-size', `${store.settings.fontPx}px`)
  }, [store.settings.theme, store.settings.fontPx])

  const exercise = 'id' in r ? store.exercise(r.id) : undefined
  const inSession = r.name === 'session' && exercise

  const tabKeys: Record<string, () => void> = { '?': () => setKeysHelp(true), 'Shift+Slash': () => setKeysHelp(true) }
  if (!inSession) TABS.forEach((t, i) => (tabKeys[`Alt+Digit${i + 1}`] = () => (location.hash = t.href)))
  useKeys(tabKeys)

  return (
    <div className="app">
      {store.saveError && (
        <div className="banner error" role="alert" data-testid="saveError">
          <span>{store.saveError}</span>
          <button type="button" className="button" onClick={store.retrySave} data-testid="retrySave">Спробувати ще</button>
        </div>
      )}
      {update && (
        <div className="banner" role="status" data-testid="updateBanner">
          <span>Доступна нова версія.</span>
          <button type="button" className="button primary" onClick={() => void applyUpdate(store.flush)} data-testid="applyUpdate">Оновити</button>
        </div>
      )}
      {!inSession && (
        <nav className="tabs" aria-label="Розділи">
          <span className="brand">Czytanie</span>
          {TABS.map((t) => (
            <a key={t.name} href={t.href} className="tab" aria-current={r.name === t.name || (t.name === 'exercises' && r.name === 'listen') || (t.name === 'settings' && r.name === 'pronunciation') ? 'page' : undefined} data-testid={`tab-${t.name}`}>{t.label}</a>
          ))}
          <button type="button" className="button icon keys-button" onClick={() => setKeysHelp(true)} aria-label="Клавіші" data-testid="keysButton">?</button>
        </nav>
      )}
      {keysHelp && <KeysDialog onClose={() => setKeysHelp(false)} />}
      <main className={`main${inSession ? ' session-main' : ''}`}>
        {r.name === 'today' && <Today />}
        {r.name === 'exercises' && <Exercises />}
        {r.name === 'listen' && exercise && (
          <>
            <div className="screen-head">
              <a className="button icon" href="#/" aria-label="Назад до підручника">←</a>
              <h1 lang="pl">{exercise.id}. {exercise.title}</h1>
            </div>
            <p className="meta">{exercise.goal}</p>
            <Listen exercise={exercise} onRecord={(seconds) => void store.record(exercise.id, { kind: 'listen', seconds })} />
          </>
        )}
        {inSession && <Session key={`${r.id}-${r.step}`} exercise={exercise} startStep={r.step} />}
        {r.name === 'hard' && <HardWords />}
        {r.name === 'discrimination' && <Discrimination />}
        {r.name === 'progress' && <Progress />}
        {r.name === 'settings' && <SettingsScreen />}
        {r.name === 'pronunciation' && <Pronunciation />}
        {'id' in r && !exercise && <p className="notice">Такої вправи немає. <a href="#/">До підручника</a></p>}
      </main>
    </div>
  )
}

export function App() {
  return (
    <StoreProvider fallback={(error) => (
      <div className="app"><main className="main">{error ? <p className="notice" role="alert">{error}</p> : <p className="meta">Завантаження…</p>}</main></div>
    )}>
      <Shell />
    </StoreProvider>
  )
}
