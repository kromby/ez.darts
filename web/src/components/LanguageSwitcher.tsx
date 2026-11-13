import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import {
  isLanguage,
  languageNames,
  supportedLanguages,
} from '../i18n/languages'

function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const id = useId()

  return (
    <div>
      <label htmlFor={id}>{t('settings.language')}</label>{' '}
      <select
        id={id}
        value={i18n.resolvedLanguage}
        onChange={(event) => {
          const language = event.target.value
          if (isLanguage(language)) void i18n.changeLanguage(language)
        }}
      >
        {supportedLanguages.map((language) => (
          <option key={language} value={language} lang={language}>
            {languageNames[language]}
          </option>
        ))}
      </select>
    </div>
  )
}

export default LanguageSwitcher
