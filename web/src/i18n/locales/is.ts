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
}

export default is
