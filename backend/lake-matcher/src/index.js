import { manualOverrideCheck } from './manualOverride.js';
import { checkCache, writeCache } from './cache.js';
import { normalizeName } from './normalizer.js';
import { findMatchingLake } from './matcher.js';

export async function matchLakeName(wdfwName) {
  if (!wdfwName || typeof wdfwName !== 'string') {
    throw new Error('wdfwName must be a non-empty string');
  }
  const trimmedName = wdfwName.trim();
  if (!trimmedName) {
    throw new Error('wdfwName must not be empty');
  }

  const manual = manualOverrideCheck(trimmedName);
  if (manual) {
    return manual;
  }

  const cached = await checkCache(trimmedName);
  if (cached) {
    return cached;
  }

  const normalized = normalizeName(trimmedName);
  const algorithmMatch = findMatchingLake(normalized);

  if (algorithmMatch) {
    await writeCache(trimmedName, algorithmMatch);
    return algorithmMatch;
  }

  return {
    officialName: null,
    lat: null,
    lng: null,
    matched_score: 0,
    source: 'algorithm'
  };
}

function extractLakeNameFromEvent(event = {}) {
  if (event.wdfwName) {
    return event.wdfwName;
  }
  if (event.name) {
    return event.name;
  }
  if (event.queryStringParameters && event.queryStringParameters.name) {
    return event.queryStringParameters.name;
  }
  if (event.body) {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      if (body && body.wdfwName) {
        return body.wdfwName;
      }
      if (body && body.name) {
        return body.name;
      }
    } catch (error) {
      console.warn(`[lake-matcher] Unable to parse request body: ${error.message}`);
    }
  }
  return null;
}

export async function handler(event) {
  try {
    const lakeName = extractLakeNameFromEvent(event);
    if (!lakeName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing wdfwName parameter' })
      };
    }
    const result = await matchLakeName(lakeName);
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error(`[lake-matcher] Match failed`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: error.message || 'Match failed' })
    };
  }
}

export { normalizeName } from './normalizer.js';
