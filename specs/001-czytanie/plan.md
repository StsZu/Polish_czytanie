# 6. План реалізації

Джерела: `spec.md` (FR / SC), `.specify/memory/constitution.md`, `idea.md`. Перевірена основа PWA — `/Users/szubar/Projects/Drafts/extractor_mp3_suno` (MP3 Lyrics: плагін manifest + SW, `register.ts`, смуга оновлення, `scripts/check.sh`, `wrangler.jsonc`, `public/_headers`) і `Polish_Reader_Books_PWA` (плеєр через Blob URL з `preservesPitch`, запис `MediaRecorder`).

## Підхід

Уся підготовка тексту й звуку робиться під час збірки, а програма лише показує й програє готові дані. Межі слів, виділення фокусу, склади, наголос і варіанти для «Що прозвучало?» обчислюються в `npm run data` і перевіряються там само. Логіка навчання (`src/core`) — чисті функції з модульними тестами; інтерфейс (`src/ui`) — React.

```
content/teksty/*.md ─┐
content/audio/*.mp3 ─┼─ scripts/data.ts ──> public/data/cwiczenia.json  (слова, час, фокус, склади, варіанти)
content/audio/*.align.json ┘          └──> public/audio/NN-sekcja.<md5-8>.mp3  (копія з хешем у назві)
                                      └──> build/report.md  (SC-01, 06, 07)

cwiczenia.json ──> ui/session (кроки 0–7) ──> core/audio/player (Blob URL, діапазон od..do, rAF-зупинка)
                        │
                        └──> core/progress (спроби, холодне читання, опанування, інтервали) ──> IndexedDB
Service worker: shell-<версія> (precache) + audio-v1 (за запитом / «Завантажити все»), без мережі поза origin
```

## Технології

| Шар | Вибір | Чому |
|---|---|---|
| Збірка | Vite 7, TypeScript 5.9 `strict`, React 19 | як у MP3 Lyrics; вимога користувача |
| Сховище | IndexedDB через `idb` 8 | вимога; перевірено в Safari |
| Звук | один `HTMLAudioElement`, `src` = Blob URL з Cache Storage, `preservesPitch = true`, зупинка за `requestAnimationFrame` | Safari не перемотує `<audio>`, якщо SW віддає повну відповідь на Range-запит; Blob URL це обходить і вже працює в Polish Reader |
| Запис себе | `getUserMedia` + `MediaRecorder` (`audio/mp4`), Blob лише в пам'яті | FR-19 |
| Графік | власний SVG (лінія + ціль) | без залежності; один тип графіка |
| Дані збірки | `scripts/data.ts` через `node --experimental-strip-types` (Node 24+) | без нових залежностей; той самий TS-код розбору тестується Vitest |
| Тести | Vitest + `fake-indexeddb`; Playwright: WebKit «iPad Pro 11» у портретній і альбомній орієнтаціях + Chromium для офлайну й оновлення | як у MP3 Lyrics |
| Хостинг | Cloudflare Workers (статичні assets), `wrangler.jsonc`; GitHub Pages — `dist-pages` | рішення користувача |

Runtime-залежності: `react`, `react-dom`, `idb`. Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `fake-indexeddb`, `@playwright/test`, `@types/*`.

## Структура файлів

| Шлях | Роль | Власник |
|---|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, `index.html`, `.gitignore` | каркас; скрипти `dev / data / build / build:pages / preview / test / test:e2e / check / deploy / icons / audio` | T01 |
| `src/pwa/sw-template.js`, `src/pwa/register.ts`, `public/_headers`, `wrangler.jsonc`, `scripts/icons.mjs`, `public/icons/*` | PWA, заголовки, хостинг, піктограми | T01 (основа), T11 (аудіокеш) |
| `scripts/sync-content.mjs`, `content/teksty/*.md`, `content/audio/*`, `content/SOURCE.md5` | разове копіювання з `Krok_po_kroku_2/czytanie/` + md5 | T02 |
| `src/core/content/parse.ts` | розбір md (YAML, 4 секції, `**`, склади) | T02 |
| `src/core/content/focus.ts` | правила фокусу вправ (графеми, «перед голосною») і таблиця замін для «Що прозвучало?» | T02 |
| `scripts/data.ts` | md + align → `public/data/cwiczenia.json`, хешовані MP3, перевірки, `--report` | T02 |
| `src/contracts.ts` | спільні типи (розділ «Спільні контракти») | T03 |
| `src/core/progress/db.ts` | схема IndexedDB, `StorageError`, `persist()` | T04 |
| `src/core/progress/attempts.ts` | запис спроб, «холодне чи розминка», серія днів, хвилини | T04 |
| `src/core/progress/mastery.ts` | рівні 0–3 (FR-36) | T04 |
| `src/core/progress/srs.ts` | інтервали важких слів (FR-32) | T04 |
| `src/core/progress/backup.ts` | копія JSON, перевірка, об'єднання, імпорт старого `czyt.*` | T04 |
| `src/core/progress/today.ts` | план «Сьогодні» (FR-30) | T04 |
| `src/core/audio/player.ts` | плеєр: завантаження, `playRange`, `onWord`, швидкість, зупинка | T05 |
| `src/core/audio/cache.ts` | стан кешу аудіо, «Завантажити все» з прогресом | T05 |
| `src/core/audio/recorder.ts` | запис себе в пам'яті | T05 |
| `src/core/flash.ts`, `src/core/pacer.ts` | час показу фраз (FR-15), темп ведучого (FR-17), темп спроби | T05 |
| `src/ui/text/ReadingText.tsx`, `Word.tsx` | рендер слів: фокус (повний / блідий / немає), склади, наголос, караоке, ведучий, довге натискання | T06 |
| `src/ui/App.tsx`, `src/ui/router.ts`, `src/ui/Today.tsx`, `src/ui/Exercises.tsx`, `src/ui/Settings.tsx`, `src/ui/Banner.tsx`, `src/ui/Dialog.tsx`, `src/styles.css` | оболонка, хеш-навігація, екрани, теми, смуги | T07 |
| `src/ui/session/Session.tsx`, `StepCold.tsx`, `StepRule.tsx`, `StepGama.tsx` | рамка сесії, кроки 0–2 | T08 |
| `src/ui/session/StepQuiz.tsx`, `StepFlash.tsx`, `StepShadow.tsx`, `StepTempo.tsx`, `StepSummary.tsx` | кроки 3–7 | T09 |
| `src/ui/train/HardWords.tsx`, `Discrimination.tsx`, `Progress.tsx`, `Chart.tsx` | тренування поза сесією, прогрес | T10 |
| `tests/unit/*.test.ts` | модульні тести свого модуля | власник модуля |
| `tests/e2e/session.spec.ts`, `tests/e2e/offline.spec.ts`, `tests/e2e/layout.spec.ts`, `scripts/check.sh` | e2e, знімки `build/visual/`, перевірки збірки | T12 |
| `README.md` | інструкція, Safari, iPad, авто / на пристрої | T13 |
| `specs/001-czytanie/alignment.md` | узгодження | T14 |
| `content/nieznane/*.md`, `content/pary.md` | незнайомі тексти, мінімальні пари (P2) | T16, T17 |
| `scripts/audio.py` | генерація ElevenLabs (порт `tts_czytanie.py` на нові шляхи) | T16 |

## Спільні контракти

### Дані програми (`public/data/cwiczenia.json`)

```ts
type Level = 1 | 2 | 3
type SectionKey = 'gama' | 'pasaze' | 'utwor'

interface Word {
  t: string                    // слово без розмітки: "przedstawiciel"
  od: number; do: number       // секунди в audio секції
  line: number                 // рядок md (гама) / номер одиниці
  focus: [number, number][]    // діапазони фокусних графем у t (FR-03)
  stress: [number, number] | null  // наголошений склад у t
  syl: string[] | null         // склади
}
interface Unit { text: string; words: [number, number]; od: number; do: number }
interface Section { audio: string | null; bytes: number; duration: number; words: Word[]; units: Unit[] }
interface QuizItem { word: number; answer: string; options: string[] }  // word — індекс у gama.words; options містять answer
interface Exercise {
  id: string; slug: string; title: string; level: Level
  focus: string[]; goal: string; rule: string[]; minutes: number; targetWpm: 60 | 80 | 100
  sections: Record<SectionKey, Section>
  quiz: QuizItem[]             // порожній для 03, 09–21
  quizSkip: string | null      // пояснення, чому кроку 3 немає
  ruleExamples: number[]       // ≤ 4 індекси в gama.words
}
interface ContentFile { version: 1; built: string; textsMd5: string; exercises: Exercise[] }
```

Одиниці: гама — рядок md; пасажі — рядок; твір — речення (`.`, `?`, `!` + пробіл) або репліка `— …` цілком. Тексти й час — з наявного `build_czytanie.py` / `SCHEMA.md`, перевіряються на збіг.

### IndexedDB `polish-czytanie`, версія 1

| Сховище | Ключ | Значення | Індекси |
|---|---|---|---|
| `attempts` | autoIncrement | `Attempt` | `exercise`, `day` |
| `hard` | `${exercise}:${section}:${unit}:${word ?? '-'}` | `HardItem` | `due` |
| `sessions` | `id` (uuid) | `{ id, exercise, day, started, finished?, stepsDone: number[] }` | `exercise` |
| `settings` | рядок | значення | — |

```ts
type AttemptKind = 'cold' | 'warmup' | 'tempo' | 'gama' | 'flash' | 'quiz' | 'hard' | 'shadow' | 'listen' | 'rating' | 'unseen' | 'legacy'
interface Attempt {
  id?: number; exercise: string; day: string /* YYYY-MM-DD, локальний */; at: string /* ISO */
  kind: AttemptKind; seconds: number
  wpm?: number; correct?: number; total?: number; flashMs?: number; rating?: 1 | 2 | 3
  pair?: string                // для quiz: "s/ś/sz"
}
interface HardItem {
  key: string; exercise: string; section: SectionKey; unit: number; word: number | null
  text: string; box: 0 | 1 | 2 | 3 | 4   // інтервал 1/1/3/7/14 днів
  due: string; streak14: number; learned: boolean; added: string
}
```

«Холодне» (FR-11): спроба `cold` дозволена, якщо за цей `day` у вправи немає жодної спроби з `kind` ∈ {`shadow`, `listen`, `tempo`, `gama`, `flash`, `quiz`, `cold`, `warmup`}. Інакше крок 0 записує `warmup`.

### Копія JSON

`{ app: 'polish-czytanie', version: 1, exportedAt, attempts: Attempt[], hard: HardItem[], sessions: [], settings: {} }`. Старий формат розпізнається за `wersja: 1` + `postep`; спроби → `kind: 'legacy'`.

### Плеєр (`core/audio/player.ts`)

```ts
interface Player {
  load(section: Section): Promise<void>           // кеш → Blob URL; помилка → AudioUnavailable
  playRange(od: number, do_: number, opts?: { margin?: number /*0.08*/, onWord?: (i: number) => void }): Promise<void>
  playSection(opts?: { from?: number; onWord?: (i: number) => void }): Promise<void>
  stop(): void
  rate: number                                    // 0.6–1.2, preservesPitch
}
```

### Крок сесії

```ts
interface StepProps {
  exercise: Exercise; player: Player
  record(a: Omit<Attempt, 'id' | 'exercise' | 'day' | 'at'>): Promise<void>
  addHard(section: SectionKey, unit: number, word: number | null): Promise<void>
  done(): void                                    // «Далі»
}
```

### Клавіші

| Клавіша | Дія |
|---|---|
| Пробіл | «Перевір» / «Почати» / «Готово» / пуск-пауза |
| Enter | «Далі» |
| 1 / 2 / 3 | «Усе правильно» / «Ні» / (самооцінка 1–3; варіанти відповіді 1–3 у кроці 3) |
| ← → | попередня / наступна одиниця |
| Esc | зупинити звук; якщо тихо — вийти з сесії зі збереженням |

### Фокус і варіанти (`core/content/focus.ts`)

Таблиця на кожну вправу 01–09: графеми фокусу (з урахуванням «`si / ci / zi / ni / dzi` перед голосною») і заміни для варіантів. Заміни між омофонами (`rz ↔ ż`, `ó ↔ u`, `h ↔ ch`, оглушення) заборонені — це перевіряє тест. Варіанти, що збігаються з іншим справжнім словом тієї ж вправи, дозволені (це й є мінімальна пара). Порядок варіантів — детермінований від `id` слова.

## Хвилі

```
Хвиля 0  T01 каркас ─┬─ T02 [P] вміст і дані
Хвиля 1  T03 контракти ─> T04 [P] прогрес · T05 [P] звук · T06 [P] текст
Хвиля 2  T07 оболонка ─> T08 [P] кроки 0–2 · T09 [P] кроки 3–7 · T10 [P] тренування й прогрес
Хвиля 3  T11 офлайн і оновлення ─> T12 e2e і перевірки ─> T13 README
Хвиля 4  T14 узгодження ─> T15 репозиторій і деплой (ok push / ok deploy)
Хвиля 5  (P2) T16 незнайомі тексти · T17 мінімальні пари — після погодження автором і ok audio
```

## Ризики

| Ризик | Що робимо |
|---|---|
| Фрагмент слова з потоку обрізаний | поле 0,08 с; T05 перевіряє на гамі 07 знімком часу; запасний варіант — T17 (окремі слова) |
| Safari зупиняє звук пізно | rAF-контроль + `timeupdate`; допуск 0,05 с у SC-03 |
| 41 МБ аудіо в Cache Storage | `persist()`; лише хешовані назви, старі записи видаляються під час `activate` |
| Повна сесія довша за 8 хв | попередня оцінка: вправи 20–21 (155–212 слів) ≈ 8–9 хв — холодне читання + темп + диктор ≈ 2 хв кожне. Звіт SC-06 після T02; якщо перевищує — у рівні III крок 5 (з диктором) типово пропускається, коли холодний темп ≥ цілі |
| Мікрофон у встановленій програмі | запис — перемикач, типово вимкнений; без дозволу — тихе повідомлення |
| Cloudflare Workers Builds не підключений до нового репозиторію | `npm run deploy` локально через wrangler (як MP3 Lyrics); підключення в панелі — дія користувача |

## Як перевіряємо (SC → чим)

| SC | Чим |
|---|---|
| SC-01, SC-06, SC-07 | `npm run data -- --report` → `build/report.md`; `tests/unit/data.test.ts`, `focus.test.ts` |
| SC-02, SC-13 | `scripts/check.sh` (md5 проти `content/SOURCE.md5` і, якщо є, проти `Krok_po_kroku_2/czytanie/teksty`; секрети; зовнішні адреси; розмір) |
| SC-03 | `tests/unit/player.test.ts` (планувальник меж), `session.spec.ts` (`currentTime` після зупинки) |
| SC-04 | `session.spec.ts`: `addInitScript` рахує виклики `HTMLMediaElement.prototype.play` |
| SC-05, SC-08 | `mastery.test.ts`, `srs.test.ts` |
| SC-09, SC-10 | `offline.spec.ts` (Chromium, `dist-pages` під `/Polish_czytanie/`) |
| SC-11 | `backup.test.ts`, `session.spec.ts` |
| SC-12, SC-14 | `layout.spec.ts`, `session.spec.ts`: WebKit iPad Pro 11, обидві орієнтації, лише клавіатура / лише дотик; знімки `build/visual/` |
| SC-15 | після деплою: `curl` + md5 проти `dist`, заголовки; iPad — за README |
