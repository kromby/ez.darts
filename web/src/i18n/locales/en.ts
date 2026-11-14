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
  players: {
    title: 'Players',
    inGame: 'In the game',
    order: 'Throwing order',
    none: 'No players picked yet.',
    available: 'Add to the game',
    add: 'Add {{name}} to the game',
    newPlayer: 'New player',
    create: 'Add',
    nameTaken: 'That name is already taken',
    remove: 'Take {{name}} out of the game',
    move: 'Move {{name}}',
    random: 'Random order',
    teams: 'Play in teams',
    team: 'Team {{team}}',
    teamOf: 'Team for {{name}}',
    needTwoTeams: 'Put players in at least two teams',
    continue: 'Continue',
    dnd: {
      instructions:
        'Press Space or Enter to pick up a player. Move them with the arrow keys and press Space or Enter again to drop, or Escape to cancel.',
      picked: 'Picked up {{name}}',
      over: '{{name}} over position {{position}}',
      dropped: '{{name}} dropped in position {{position}}',
      cancelled: 'Stopped moving {{name}}',
    },
  },
  setup: {
    presets: 'Presets',
    options: 'Options',
    players: 'Players',
    custom: 'Other',
    start: 'Start game',
    wholeNumber: 'Enter a whole number',
    wholeNumberRange: 'A whole number from {{min}} to {{max}}',
    comingSoon: 'The game screen is coming soon.',
    back: 'Back',
  },
}

export default en
