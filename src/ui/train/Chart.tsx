// A small line chart of the cold pace by day, with the target as a dashed line.

export interface Point { day: string; value: number }

const W = 640
const H = 220
const PAD = { left: 40, right: 12, top: 12, bottom: 28 }

export function Chart({ series, target, label }: { series: { name: string; points: Point[]; className: string }[]; target: number; label: string }) {
  const days = [...new Set(series.flatMap((s) => s.points.map((p) => p.day)))].sort()
  const values = series.flatMap((s) => s.points.map((p) => p.value))
  if (!days.length) return <p className="meta" data-testid="chartEmpty">Ще немає холодних читань.</p>
  const max = Math.max(target + 20, ...values) * 1.05
  const x = (day: string) => PAD.left + (days.length === 1 ? (W - PAD.left - PAD.right) / 2 : (days.indexOf(day) / (days.length - 1)) * (W - PAD.left - PAD.right))
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
  const ticks = [0, Math.round(max / 2), Math.round(target)].sort((a, b) => a - b)
  const short = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`
  return (
    <figure className="chart" data-testid="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} className="target" data-testid="targetLine" />
        {series.map((s) => (
          <g key={s.name} className={s.className}>
            <polyline points={s.points.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} fill="none" />
            {s.points.map((p) => <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r={4} data-testid={`point-${s.className}`}><title>{`${short(p.day)}: ${p.value} сл/хв`}</title></circle>)}
          </g>
        ))}
        {[days[0], days[days.length - 1]].filter((d, i, a) => a.indexOf(d) === i).map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="axis">{short(d)}</text>
        ))}
      </svg>
      <figcaption className="legend">
        {series.map((s) => <span key={s.name} className={`key ${s.className}`}>{s.name}</span>)}
        <span className="key target">ціль {target} сл/хв</span>
      </figcaption>
    </figure>
  )
}
