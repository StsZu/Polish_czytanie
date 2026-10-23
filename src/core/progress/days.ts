// Calendar days in local time, YYYY-MM-DD: «today», streaks and intervals all use the same calendar.

export function dayOf(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parse(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(day: string, n: number): string {
  const date = parse(day)
  date.setDate(date.getDate() + n)
  return dayOf(date)
}

/** Whole calendar days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)
}

export const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value)
