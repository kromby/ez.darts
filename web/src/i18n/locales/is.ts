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
  players: {
    title: 'Leikmenn',
    inGame: 'Í leiknum',
    order: 'Kaströð',
    none: 'Engir leikmenn valdir enn.',
    available: 'Bæta í leikinn',
    add: 'Bæta {{name}} í leikinn',
    newPlayer: 'Nýr leikmaður',
    create: 'Bæta við',
    nameTaken: 'Þetta nafn er þegar til',
    remove: 'Taka {{name}} úr leiknum',
    move: 'Færa {{name}}',
    random: 'Handahófsröð',
    teams: 'Spila í liðum',
    team: 'Lið {{team}}',
    teamOf: 'Lið fyrir {{name}}',
    needTwoTeams: 'Settu leikmenn í að minnsta kosti tvö lið',
    continue: 'Áfram',
    dnd: {
      instructions:
        'Ýttu á bil eða Enter til að taka leikmann upp. Færðu hann með örvatökkunum og ýttu aftur á bil eða Enter til að sleppa, eða Escape til að hætta við.',
      picked: '{{name}} tekinn upp',
      over: '{{name}} yfir sæti {{position}}',
      dropped: '{{name}} settur í sæti {{position}}',
      cancelled: 'Hætt við að færa {{name}}',
    },
  },
  pad: {
    modifier: 'Margfeldi',
    single: 'Einfalt',
    double: 'Tvöfalt',
    triple: 'Þrefalt',
    number: '{{modifier}} {{number}}',
    bull: 'Miðja',
    noTriple: 'ekki þreföld',
    miss: 'Framhjá',
    undo: 'Afturkalla',
  },
  x01: {
    scores: 'Staðan',
    notIn: 'ekki inni',
  },
  setup: {
    presets: 'Forstillingar',
    options: 'Stillingar',
    players: 'Leikmenn',
    custom: 'Annað',
    start: 'Byrja leik',
    wholeNumber: 'Sláðu inn heila tölu',
    wholeNumberRange: 'Heil tala frá {{min}} til {{max}}',
    // Placeholder until the game screen (#10).
    comingSoon: 'Leikskjárinn kemur fljótlega.',
    padPreview: 'Á meðan má prófa pílutakkaborðið:',
    padDarts: 'Síðustu pílur',
    back: 'Til baka',
  },
}

export default is
