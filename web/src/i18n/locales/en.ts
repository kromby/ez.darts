import type is from './is'

const en: typeof is = {
  app: {
    name: 'ez.darts',
  },
  api: {
    status: 'API: {{status}}',
    statuses: {
      checking: 'checking…',
      ok: 'ok',
      unavailable: 'unavailable',
    },
  },
  settings: {
    language: 'Language',
  },
  setup: {
    presets: 'Presets',
    options: 'Options',
    players: 'Players',
    custom: 'Other',
    start: 'Start game',
    wholeNumber: 'Enter a whole number',
    wholeNumberRange: 'A whole number from {{min}} to {{max}}',
    demoPlayer: 'Player {{number}}',
    comingSoon: 'The game screen is coming soon.',
    back: 'Back',
  },
}

export default en
