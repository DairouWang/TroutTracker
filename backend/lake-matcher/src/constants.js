import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_GNIS_DATA_PATH =
  process.env.GNIS_DATA_PATH || path.resolve(__dirname, '..', 'data', 'gnis_wa_lakes.json');

export const MANUAL_OVERRIDE_PATH =
  process.env.MANUAL_OVERRIDE_PATH || path.resolve(__dirname, '..', 'manual_override.json');

export const HYDROGRAPHY_DATA_PATH = process.env.HYDROGRAPHY_DATA_PATH || '';

export const CACHE_TABLE_NAME = process.env.LAKE_MATCH_CACHE_TABLE || 'LakeMatchCache';

export const MIN_TOKEN_SCORE = Number(process.env.MIN_TOKEN_SCORE || 3);

export const DISABLE_DYNAMO_CACHE = process.env.DISABLE_DYNAMO_CACHE === '1';
