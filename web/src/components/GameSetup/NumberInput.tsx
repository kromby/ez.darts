import { useState } from 'react'

type Props = {
  id: string
  value: number | null
  onChange(value: number | null): void
  invalid?: boolean
  describedBy?: string
  className?: string
}

/** Empty gives `null`; anything but a whole number gives `NaN`. */
function parse(text: string): number | null {
  if (text === '') return null
  return /^\d+$/.test(text) ? Number(text) : NaN
}

/**
 * A whole-number field that keeps what is typed, even when it is not valid
 * yet, and shows the new value when it changes from outside.
 */
function NumberInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  className,
}: Props) {
  const [text, setText] = useState(value === null ? '' : String(value))
  const shown = Object.is(parse(text), value)
    ? text
    : value === null || Number.isNaN(value)
      ? ''
      : String(value)

  return (
    <input
      id={id}
      className={className}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={shown}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onChange={(event) => {
        const next = event.target.value.trim()
        setText(next)
        onChange(parse(next))
      }}
    />
  )
}

export default NumberInput
