import { loadGNISDatabase } from './gnisLoader.js';
import { normalizeName } from './normalizer.js';
import { MIN_TOKEN_SCORE } from './constants.js';

function tokensPartiallyMatch(queryToken, candidateToken) {
  if (queryToken === candidateToken) {
    return false;
  }
  if (queryToken.length < 3 || candidateToken.length < 3) {
    return false;
  }
  return queryToken.includes(candidateToken) || candidateToken.includes(queryToken);
}

function levenshtein(a, b) {
  if (a === b) {
    return 0;
  }
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function computeTokenScore(queryTokens, queryString, candidateTokens) {
  if (!candidateTokens.length || !queryTokens.length) {
    return { score: -Infinity, exactMatches: 0, partialMatches: 0 };
  }

  let exactMatches = 0;
  let partialMatches = 0;
  const usedIndices = new Set();

  queryTokens.forEach((token) => {
    candidateTokens.forEach((candidateToken, idx) => {
      if (!usedIndices.has(idx) && candidateToken === token) {
        exactMatches += 1;
        usedIndices.add(idx);
      }
    });
  });

  queryTokens.forEach((token) => {
    candidateTokens.forEach((candidateToken, idx) => {
      if (usedIndices.has(idx)) {
        return;
      }
      if (tokensPartiallyMatch(token, candidateToken)) {
        partialMatches += 1;
        usedIndices.add(idx);
      }
    });
  });

  const candidateString = candidateTokens.join(' ');
  const penalty = Math.min(levenshtein(queryString, candidateString), 10);
  const score = exactMatches * 3 + partialMatches - penalty;
  return { score, exactMatches, partialMatches };
}

function buildTokenSets(record) {
  const alternatives = Array.isArray(record.alternative_names)
    ? record.alternative_names
    : record.alternate_names || [];
  const sets = [
    {
      tokens: record.normalized?.tokens || normalizeName(record.official_name).tokens,
      label: record.official_name
    }
  ];
  for (const alt of alternatives) {
    if (!alt) {
      continue;
    }
    const normalizedAlt = normalizeName(alt);
    if (normalizedAlt.tokens.length) {
      sets.push({
        tokens: normalizedAlt.tokens,
        label: alt
      });
    }
  }
  return sets;
}

function countyBoost(inputCounty, candidateCounty) {
  if (!inputCounty || !candidateCounty) {
    return 0;
  }
  return candidateCounty.toLowerCase().includes(inputCounty.toLowerCase()) ? 2 : 0;
}

function fuzzyFallback(records, queryString) {
  if (!queryString) {
    return null;
  }

  let best = null;
  for (const record of records) {
    const candidateString =
      record.normalized?.normalized || normalizeName(record.official_name).normalized;
    if (!candidateString) {
      continue;
    }
    const distance = levenshtein(queryString, candidateString);
    const score = Math.max(1, 20 - distance);
    if (!best || score > best.score) {
      best = {
        record,
        score
      };
    }
  }
  if (!best) {
    return null;
  }
  return {
    officialName: best.record.official_name,
    lat: best.record.latitude,
    lng: best.record.longitude,
    matched_score: best.score,
    source: 'algorithm',
    strategy: 'fuzzy'
  };
}

export function findMatchingLake(normalizedInput) {
  const records = loadGNISDatabase();
  const countyHint = normalizedInput.countyHint;
  const queryTokens = normalizedInput.tokens;
  const queryString = normalizedInput.normalized;

  let candidates = records;
  if (countyHint) {
    const filtered = records.filter((record) => {
      if (!record.county_name) {
        return false;
      }
      return record.county_name.toLowerCase().includes(countyHint.toLowerCase());
    });
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  let bestMatch = null;

  for (const record of candidates) {
    const tokenSets = buildTokenSets(record);
    for (const tokenSet of tokenSets) {
      const { score } = computeTokenScore(queryTokens, queryString, tokenSet.tokens);
      if (score === -Infinity) {
        continue;
      }
      const adjustedScore = score + countyBoost(countyHint, record.county_name);
      if (!bestMatch || adjustedScore > bestMatch.matched_score) {
        bestMatch = {
          officialName: record.official_name,
          lat: record.latitude,
          lng: record.longitude,
          matched_score: adjustedScore,
          source: 'algorithm',
          strategy: 'token',
          feature_type: record.feature_type,
          county_name: record.county_name
        };
      }
    }
  }

  if (bestMatch && bestMatch.matched_score >= MIN_TOKEN_SCORE) {
    return bestMatch;
  }

  return fuzzyFallback(records, queryString);
}

export { levenshtein, computeTokenScore };
