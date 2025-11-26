import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName } from '../src/normalizer.js';

test('normalizeName expands abbreviations and detects counties', () => {
  const result = normalizeName('LEWIS CO PRK PD-S');
  assert.equal(result.countyHint, 'lewis');
  assert.deepEqual(result.tokens, ['lewis', 'county', 'park', 'pond', 'south']);
  assert.equal(result.normalized, 'lewis county park pond south');
});

test('normalizeName handles county abbreviations', () => {
  const result = normalizeName('Sunset Lk (SNOH)');
  assert.equal(result.countyHint, 'snohomish');
  assert.ok(result.tokens.includes('lake'));
  assert.ok(result.tokens.includes('sunset'));
});
