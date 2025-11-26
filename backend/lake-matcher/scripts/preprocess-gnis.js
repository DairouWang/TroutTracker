#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: npm run preprocess:gnis -- <path-to-gnis-csv> [output.json]');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), args[0]);
const outputPath = args[1]
  ? path.resolve(process.cwd(), args[1])
  : path.resolve(__dirname, '..', 'data', 'gnis_wa_lakes.json');

const ALLOWED_TYPES = new Set(['lake', 'reservoir', 'pond']);

function pick(row, keys, fallback = '') {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return fallback;
}

function toNumber(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const csvBuffer = fs.readFileSync(inputPath);
const text = csvBuffer.toString('utf8').replace(/^\uFEFF/, '');
const records = parse(text, {
  columns: true,
  skip_empty_lines: true,
  delimiter: '|',
  relax_column_count: true,
  trim: true
});

const washingtonRecords = [];

for (const row of records) {
  const stateAlpha = pick(row, ['STATE_ALPHA', 'State Alpha', 'state_alpha']).trim().toUpperCase();
  if (stateAlpha !== 'WA') {
    continue;
  }
  const featureType = pick(row, ['FEATURE_CLASS', 'Feature Class', 'feature_class']).trim();
  if (!ALLOWED_TYPES.has(featureType.toLowerCase())) {
    continue;
  }

  const officialName = pick(row, ['FEATURE_NAME', 'Feature Name', 'feature_name']).trim();
  const countyName = pick(row, ['COUNTY_NAME', 'County Name', 'county_name']).trim();
  const lat = toNumber(pick(row, ['PRIM_LAT_DEC', 'Primary Latitude Dec', 'primary_lat_dec', 'LATITUDE', 'Latitude']));
  const lng = toNumber(pick(row, ['PRIM_LONG_DEC', 'Primary Longitude Dec', 'primary_long_dec', 'LONGITUDE', 'Longitude']));

  if (!officialName || lat === null || lng === null) {
    continue;
  }

  const gnisId = pick(row, ['FEATURE_ID', 'Feature ID', 'feature_id']);
  const alternativeNamesField = pick(row, ['VARIANT_NAME', 'Variant Name', 'variant_name', 'ALTERNATE_NAMES', 'Alternate Names']);
  const alternativeNames = alternativeNamesField
    ? alternativeNamesField
        .split(/[|;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  washingtonRecords.push({
    gnis_id: gnisId,
    official_name: officialName,
    feature_type: featureType,
    county_name: countyName,
    latitude: lat,
    longitude: lng,
    alternative_names: alternativeNames
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(washingtonRecords, null, 2));

console.log(`Processed ${records.length} GNIS rows`);
console.log(`Kept ${washingtonRecords.length} Washington waterbodies`);
console.log(`Output written to ${outputPath}`);
