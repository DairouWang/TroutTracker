import fs from 'fs';
import path from 'path';
import { MANUAL_OVERRIDE_PATH } from './constants.js';

let overrides = null;
let overridePath = null;

function loadManualOverrides(customPath = MANUAL_OVERRIDE_PATH) {
  const resolvedPath = path.resolve(customPath);
  if (overrides && overridePath === resolvedPath) {
    return overrides;
  }
  if (!fs.existsSync(resolvedPath)) {
    overrides = {};
    overridePath = resolvedPath;
    return overrides;
  }
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  overrides = JSON.parse(raw);
  overridePath = resolvedPath;
  return overrides;
}

export function manualOverrideCheck(wdfwName) {
  if (!wdfwName) {
    return null;
  }
  const data = loadManualOverrides();
  const override = data[wdfwName];
  if (!override) {
    return null;
  }
  return {
    officialName: override.official_name,
    lat: override.lat,
    lng: override.lng,
    matched_score: Number.MAX_SAFE_INTEGER,
    source: 'manual_override'
  };
}
