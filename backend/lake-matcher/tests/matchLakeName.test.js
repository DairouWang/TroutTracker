import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GNIS_DATA_PATH = new URL('../data/sample_gnis.json', import.meta.url).pathname;
process.env.DISABLE_DYNAMO_CACHE = '1';

const { matchLakeName, normalizeName } = await import('../src/index.js');
const { MIN_TOKEN_SCORE } = await import('../src/constants.js');

test('matchLakeName returns manual override when present', async () => {
  const result = await matchLakeName('LEWIS CO PRK PD-S');
  assert.equal(result.officialName, 'South Lewis County Regional Park Pond');
  assert.equal(result.source, 'manual_override');
});

test('matchLakeName uses algorithm when not cached or overridden', async () => {
  const result = await matchLakeName('Battle Ground Lk');
  assert.equal(result.officialName, 'Battle Ground Lake');
  assert.equal(result.source, 'algorithm');
  assert.ok(result.matched_score >= MIN_TOKEN_SCORE);
});

test('matchLakeName respects county hints for similar names', async () => {
  const normalized = normalizeName('Pine Lk (KING)');
  assert.equal(normalized.countyHint, 'king');
  const result = await matchLakeName('Pine Lk (KING)');
  assert.equal(result.officialName, 'Pine Lake');
});
