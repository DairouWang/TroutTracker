import fs from 'fs';
import path from 'path';
import { DEFAULT_GNIS_DATA_PATH, HYDROGRAPHY_DATA_PATH } from './constants.js';
import { normalizeName } from './normalizer.js';

let combinedRecords = null;
let cachedSignature = null;

function hydrateRecords(records = []) {
  return records.map((record) => ({
    ...record,
    normalized: normalizeName(record.official_name)
  }));
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Dataset not found at ${filePath}. Run the GNIS preprocessing script or update GNIS_DATA_PATH.`
    );
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function loadHydrographyDataset() {
  if (!HYDROGRAPHY_DATA_PATH) {
    return [];
  }
  const resolvedPath = path.resolve(HYDROGRAPHY_DATA_PATH);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(
      `[lake-matcher] Hydrography dataset missing at ${resolvedPath}, continuing with GNIS only.`
    );
    return [];
  }
  const data = readJsonFile(resolvedPath);
  return Array.isArray(data) ? data : [];
}

export function loadGNISDatabase(customPath = DEFAULT_GNIS_DATA_PATH) {
  const resolvedPath = path.resolve(customPath);
  const signature = `${resolvedPath}:${HYDROGRAPHY_DATA_PATH || 'none'}`;
  if (combinedRecords && cachedSignature === signature) {
    return combinedRecords;
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `GNIS dataset was not found at ${resolvedPath}. Run ` +
        '`npm run preprocess:gnis -- <GNIS_Lakes.csv>` from backend/lake-matcher to generate it.'
    );
  }

  const gnisRecords = readJsonFile(resolvedPath);
  const hydratedGnis = hydrateRecords(gnisRecords);
  const hydroRecords = loadHydrographyDataset();
  const hydratedHydro = hydrateRecords(hydroRecords);

  const deduped = new Map();
  for (const record of [...hydratedGnis, ...hydratedHydro]) {
    const key = `${record.official_name}:${record.latitude}:${record.longitude}`;
    if (!deduped.has(key)) {
      deduped.set(key, record);
    }
  }

  combinedRecords = Array.from(deduped.values());
  cachedSignature = signature;
  return combinedRecords;
}
