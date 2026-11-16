import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './StatsScreen.module.css'

export type ChartPoint = {
  /** The week's start, e.g. `17 Aug`. */
  label: string
  value: number | null
}

type Props = {
  title: string
  points: ChartPoint[]
  format(value: number): string
  formatTick(value: number): string
  /** A CSS colour, e.g. `var(--double)`. */
  color: string
  /** Ticks fall on multiples of this, e.g. 10 for averages. */
  step: number
  /** Start the scale at 0, as for percentages. */
  fromZero?: boolean
}

const W = 330
const H = 118
const LEFT = 34
const RIGHT = 46
const TOP = 8
const BOTTOM = 20

/**
 * A small weekly line chart. Tap, drag or use the arrow keys to read a
 * week; weeks without darts leave a gap.
 */
function TrendChart({
  title,
  points,
  format,
  formatTick,
  color,
  step,
  fromZero = false,
}: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [active, setActive] = useState<number | null>(null)
  const known = points.flatMap((point, index) =>
    point.value === null ? [] : [{ index, value: point.value }],
  )

  if (known.length === 0) {
    return (
      <figure className={styles.mini}>
        <figcaption className={styles.miniTitle}>{title}</figcaption>
        <p className={styles.muted}>{t('stats.trends.empty')}</p>
      </figure>
    )
  }

  const values = known.map((point) => point.value)
  const low = fromZero ? 0 : Math.floor(Math.min(...values) / step) * step
  // Three equal gaps of whole steps, so every tick is a round number.
  const gap =
    Math.max(1, Math.ceil((Math.max(...values) - low) / (3 * step))) * step
  const high = low + 3 * gap
  const ticks = [0, 1, 2, 3].map((i) => low + gap * i)
  const n = points.length
  const x = (i: number) =>
    n === 1 ? (LEFT + W - RIGHT) / 2 : LEFT + (i * (W - LEFT - RIGHT)) / (n - 1)
  const y = (v: number) =>
    TOP + (1 - (v - low) / (high - low)) * (H - TOP - BOTTOM)

  // Lines between weeks next to each other; a week without darts breaks it.
  const segments: string[] = []
  let run: string[] = []
  points.forEach((point, i) => {
    if (point.value === null) {
      if (run.length > 1) segments.push(run.join(' '))
      run = []
      return
    }
    run.push(`${x(i)},${y(point.value)}`)
  })
  if (run.length > 1) segments.push(run.join(' '))

  const first = known[0]
  const last = known[known.length - 1]
  const labelled = [
    ...new Set([
      0,
      Math.round((n - 1) / 3),
      Math.round((2 * (n - 1)) / 3),
      n - 1,
    ]),
  ]
  const shown = active === null ? null : points[active]

  function nearest(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const vx = ((event.clientX - box.left) * W) / (box.width || W)
    const i =
      n === 1 ? 0 : Math.round(((vx - LEFT) * (n - 1)) / (W - LEFT - RIGHT))
    setActive(Math.max(0, Math.min(n - 1, i)))
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const from = active ?? last.index
    setActive(
      event.key === 'ArrowLeft'
        ? Math.max(0, from - 1)
        : Math.min(n - 1, from + 1),
    )
  }

  return (
    <figure className={styles.mini}>
      <figcaption id={id} className={styles.miniTitle}>
        {title}
      </figcaption>
      <div className={styles.chart}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-describedby={`${id}-read`}
          aria-label={t('stats.trends.chart', {
            label: title,
            from: format(first.value),
            to: format(last.value),
          })}
          onPointerDown={nearest}
          onPointerMove={(event) => {
            if (event.pointerType === 'mouse' || event.buttons > 0)
              nearest(event)
          }}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(last.index)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={styles.grid}
                x1={LEFT}
                x2={W - RIGHT}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                className={styles.axis}
                x={LEFT - 6}
                y={y(tick) + 3.5}
                textAnchor="end"
              >
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {labelled.map((i) => (
            <text
              key={i}
              className={styles.axis}
              x={x(i)}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            >
              {points[i].label}
            </text>
          ))}
          {segments.map((segment) => (
            <polyline
              key={segment}
              points={segment}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {known.map((point) => (
            <circle
              key={point.index}
              cx={x(point.index)}
              cy={y(point.value)}
              r={point.index === last.index ? 4 : 2}
              fill={color}
            />
          ))}
          <text
            className={styles.endValue}
            x={x(last.index) + 8}
            y={y(last.value) + 4}
          >
            {format(last.value)}
          </text>
          {active !== null && (
            <line
              className={styles.cursor}
              x1={x(active)}
              x2={x(active)}
              y1={TOP}
              y2={H - BOTTOM}
            />
          )}
        </svg>
        <p id={`${id}-read`} className={styles.reading} aria-live="polite">
          {shown && (
            <>
              <b>{shown.value === null ? '—' : format(shown.value)}</b>{' '}
              {t('stats.trends.weekOf', { date: shown.label })}
            </>
          )}
        </p>
      </div>
    </figure>
  )
}

export default TrendChart
