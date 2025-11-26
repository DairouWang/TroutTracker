const TOKEN_EXPANSIONS = {
  lk: ['lake'],
  lks: ['lakes'],
  pd: ['pond'],
  pnd: ['pond'],
  prk: ['park'],
  pk: ['park'],
  res: ['reservoir'],
  co: ['county'],
  cnty: ['county'],
  st: ['saint'],
  mt: ['mount'],
  mtn: ['mountain'],
  ctr: ['center'],
  ctrs: ['centers'],
  no: ['number'],
  n: ['north'],
  s: ['south'],
  e: ['east'],
  w: ['west'],
  ne: ['northeast'],
  nw: ['northwest'],
  se: ['southeast'],
  sw: ['southwest'],
  rd: ['road'],
  hwy: ['highway'],
  ct: ['court'],
  blvd: ['boulevard']
};

const COUNTY_ABBREVIATIONS = {
  ADAM: 'adams',
  ASOT: 'asotin',
  BENT: 'benton',
  CHEL: 'chelan',
  CLAL: 'clallam',
  CLAR: 'clark',
  COWL: 'cowlitz',
  DOUG: 'douglas',
  FERR: 'ferry',
  FRAN: 'franklin',
  GARF: 'garfield',
  GRAN: 'grant',
  GRAY: 'grays harbor',
  ISLA: 'island',
  JEFF: 'jefferson',
  KING: 'king',
  KITS: 'kitsap',
  KITT: 'kittitas',
  KLIC: 'klickitat',
  LEWI: 'lewis',
  LINC: 'lincoln',
  MASO: 'mason',
  OKAN: 'okanogan',
  PACI: 'pacific',
  PEND: 'pend oreille',
  PIER: 'pierce',
  SANJ: 'san juan',
  SKAG: 'skagit',
  SKAM: 'skamania',
  SNOH: 'snohomish',
  SPOK: 'spokane',
  STEV: 'stevens',
  THUR: 'thurston',
  WAHK: 'wahkiakum',
  WALL: 'walla walla',
  WHAT: 'whatcom',
  WHIT: 'whitman',
  YAKI: 'yakima'
};

const COUNTY_FULL_NAMES = Object.values(COUNTY_ABBREVIATIONS);

function detectCountyHint(rawName = '') {
  const uppercase = rawName.toUpperCase();
  const codeMatches = [...uppercase.matchAll(/\(([A-Z]{3,5})\)/g)];
  for (const [, code] of codeMatches) {
    if (COUNTY_ABBREVIATIONS[code]) {
      return COUNTY_ABBREVIATIONS[code];
    }
  }

  for (const [code, county] of Object.entries(COUNTY_ABBREVIATIONS)) {
    if (uppercase.includes(`${code} CO`) || uppercase.includes(`${code} COUNTY`)) {
      return county;
    }
  }

  for (const county of COUNTY_FULL_NAMES) {
    if (uppercase.includes(county.toUpperCase())) {
      return county;
    }
  }

  return null;
}

function normalizeToken(token) {
  if (!token) {
    return [];
  }
  const lower = token.toLowerCase();
  if (TOKEN_EXPANSIONS[lower]) {
    return TOKEN_EXPANSIONS[lower];
  }
  if (COUNTY_ABBREVIATIONS[lower.toUpperCase()]) {
    return COUNTY_ABBREVIATIONS[lower.toUpperCase()].split(' ');
  }
  return [lower];
}

export function normalizeName(rawName = '') {
  if (typeof rawName !== 'string') {
    return {
      normalized: '',
      tokens: [],
      countyHint: null
    };
  }

  const countyHint = detectCountyHint(rawName);

  let working = rawName
    .replace(/&/g, ' and ')
    .replace(/[-_/]/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/[^0-9a-zA-Z\s]/g, ' ')
    .toLowerCase();

  let tokens = working
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const expanded = [];
  for (const token of tokens) {
    const normalizedTokens = normalizeToken(token);
    for (const normalized of normalizedTokens) {
      if (normalized) {
        expanded.push(normalized);
      }
    }
  }

  const dedupedTokens = [];
  const seen = new Set();
  for (const token of expanded) {
    if (!seen.has(token)) {
      seen.add(token);
      dedupedTokens.push(token);
    }
  }

  return {
    normalized: dedupedTokens.join(' '),
    tokens: dedupedTokens,
    countyHint
  };
}
