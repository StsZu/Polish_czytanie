import { useEffect, useRef, useState, type ReactNode } from 'react'

/** A modal sheet: focus moves inside and stays there, Esc closes, focus returns to where it was. */
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
      } else if (event.key === 'Tab' && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea')]
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      before?.focus?.()
    }
  }, [])
  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-testid="dialog">
        <h2 id="dialog-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, text, confirmLabel, destructive = false, onConfirm, onCancel }: {
  title: string
  text: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{text}</p>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onCancel} data-autofocus data-testid="dialogCancel">Скасувати</button>
        <button type="button" className={destructive ? 'button destructive-fill' : 'button primary'} onClick={onConfirm} data-testid="dialogConfirm">{confirmLabel}</button>
      </div>
    </Modal>
  )
}

export function MessageDialog({ title, lines, onClose }: { title: string; lines: string[]; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <ul className="problems" data-testid="problems">
        {lines.slice(0, 30).map((line, i) => <li key={i}>{line}</li>)}
        {lines.length > 30 && <li>…і ще {lines.length - 30}</li>}
      </ul>
      <div className="dialog-actions">
        <button type="button" className="button primary" onClick={onClose} data-autofocus data-testid="dialogClose">Зрозуміло</button>
      </div>
    </Modal>
  )
}

export function ChoiceDialog({ title, text, choices, onCancel }: {
  title: string
  text: string
  choices: { label: string; primary?: boolean; testId: string; onChoose: () => void }[]
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{text}</p>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onCancel} data-testid="dialogCancel">Скасувати</button>
        {choices.map((c) => (
          <button key={c.testId} type="button" className={c.primary ? 'button primary' : 'button'} onClick={c.onChoose} data-testid={c.testId} {...(c.primary ? { 'data-autofocus': true } : {})}>{c.label}</button>
        ))}
      </div>
    </Modal>
  )
}

/** A destructive action confirmed by typing a word, so it cannot happen by a stray tap. */
export function TypedConfirmDialog({ title, text, word, confirmLabel, onConfirm, onCancel }: {
  title: string
  text: string
  word: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [value, setValue] = useState('')
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{text}</p>
      <label className="field">
        <span>Введіть «{word}»</span>
        <input value={value} onChange={(e) => setValue(e.currentTarget.value)} autoComplete="off" autoCapitalize="off" data-autofocus data-testid="confirmWord" />
      </label>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onCancel} data-testid="dialogCancel">Скасувати</button>
        <button type="button" className="button destructive-fill" disabled={value.trim().toLowerCase() !== word} onClick={onConfirm} data-testid="dialogConfirm">{confirmLabel}</button>
      </div>
    </Modal>
  )
}

export const KEYS: [string[], string][] = [
  [['Alt', '1…6'], 'розділи меню: Підручник, Розрізнення, Важкі слова, Сьогодні, Прогрес, Налаштування'],
  [['пробіл'], '«Перевір», «Показати», «Почати / Готово», «Слухати ще»'],
  [['Enter'], '«Далі»'],
  [['1', '2', '3'], '«Так / Ні», варіанти відповіді, самооцінка'],
  [['⇧', '←'], 'попередній крок вправи'],
  [['⇧', '→'], 'наступний крок вправи'],
  [['←', '→'], 'у гамі після «Перевір» — вибрати слово'],
  [['X'], 'позначити вибране слово як помилку'],
  [['R'], '«Запис» / «Стоп»'],
  [['M'], '«Я» — ваш запис'],
  [['D'], '«Диктор»'],
  [['B'], '«Я → Диктор»'],
  [['V'], 'інший голос у «Що прозвучало?»'],
  [['Esc'], 'зупинити звук; якщо тихо — вийти з вправи'],
  [['?'], 'цей список'],
]

export function KeysDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Клавіші" onClose={onClose}>
      <dl className="keys-help" data-testid="keysHelp">
        {KEYS.map(([keys, what]) => (
          <div key={what} style={{ display: 'contents' }}>
            <dt>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <p className="meta">Літери працюють і з українською розкладкою.</p>
      <div className="dialog-actions">
        <button type="button" className="button primary" onClick={onClose} data-autofocus data-testid="dialogClose">Зрозуміло</button>
      </div>
    </Modal>
  )
}
