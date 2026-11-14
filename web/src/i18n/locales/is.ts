// Icelandic is the source language: every other locale must match this shape.
// Wording is a draft pending review by a native speaker (issue #3).
// Icelandic labels often run 20–30% longer than English, so layouts should
// not rely on fixed widths sized for English text.
const is = {
  app: {
    name: 'ez.darts',
  },
  api: {
    status: 'Forritaskil: {{status}}',
    statuses: {
      checking: 'kanna…',
      ok: 'í lagi',
      unavailable: 'ekki tiltæk',
    },
  },
  settings: {
    language: 'Tungumál',
  },
  setup: {
    presets: 'Forstillingar',
    options: 'Stillingar',
    players: 'Leikmenn',
    custom: 'Annað',
    start: 'Byrja leik',
    wholeNumber: 'Sláðu inn heila tölu',
    wholeNumberRange: 'Heil tala frá {{min}} til {{max}}',
    // Placeholders until player selection (#8) and the game screen (#10).
    demoPlayer: 'Leikmaður {{number}}',
    comingSoon: 'Leikskjárinn kemur fljótlega.',
    back: 'Til baka',
  },
}

export default is
