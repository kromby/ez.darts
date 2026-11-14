import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  choiceValue,
  isValidValue,
  type GameOption,
  type OptionValue,
} from '../../engine/config'
import { localize } from '../../i18n/languages'
import NumberInput from './NumberInput'
import styles from './GameSetup.module.css'

type Props = {
  option: GameOption
  value: OptionValue
  onChange(value: OptionValue): void
}

/** One option from a game config, rendered by its type. */
function OptionField({ option, value, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const id = useId()
  const language = i18n.resolvedLanguage ?? ''
  const label = localize(option.label, language)
  const invalid = !isValidValue(option, value)
  const hasRange =
    'min' in option && option.min !== undefined && option.max !== undefined
  const error = invalid ? (
    <p id={`${id}-error`} className={styles.error}>
      {hasRange
        ? t('setup.wholeNumberRange', { min: option.min, max: option.max })
        : t('setup.wholeNumber')}
    </p>
  ) : null

  switch (option.type) {
    case 'choice': {
      const isChoice = option.values.some(
        (choice) => choiceValue(choice) === value,
      )
      return (
        <fieldset className={styles.field}>
          <legend className={styles.label}>{label}</legend>
          <div className={styles.segments}>
            {option.values.map((choice) => {
              const choiceVal = choiceValue(choice)
              return (
                <label key={String(choiceVal)} className={styles.segment}>
                  <input
                    type="radio"
                    name={id}
                    checked={value === choiceVal}
                    onChange={() => onChange(choiceVal)}
                  />
                  <span>
                    {typeof choice === 'object'
                      ? localize(choice.label, language)
                      : choiceVal}
                  </span>
                </label>
              )
            })}
          </div>
          {option.allowCustom && (
            <div className={styles.custom}>
              <label htmlFor={`${id}-custom`}>{t('setup.custom')}</label>
              <NumberInput
                id={`${id}-custom`}
                className={styles.number}
                value={isChoice || typeof value !== 'number' ? null : value}
                invalid={invalid}
                describedBy={invalid ? `${id}-error` : undefined}
                onChange={(custom) => onChange(custom ?? option.default)}
              />
            </div>
          )}
          {error}
        </fieldset>
      )
    }
    case 'int':
      return (
        <div className={styles.field}>
          <label htmlFor={id} className={styles.label}>
            {label}
          </label>
          <NumberInput
            id={id}
            className={styles.number}
            value={typeof value === 'number' ? value : null}
            invalid={invalid}
            describedBy={invalid ? `${id}-error` : undefined}
            onChange={onChange}
          />
          {error}
        </div>
      )
    case 'bool':
      return (
        <div className={styles.field}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              role="switch"
              checked={value === true}
              onChange={(event) => onChange(event.target.checked)}
            />
            <span className={styles.label}>{label}</span>
          </label>
        </div>
      )
  }
}

export default OptionField
