'use strict';
const assert = require('node:assert/strict');
const P = require('../js/duration-precision.js');

function assertPartsRoundTrip(value, label = value.toString()) {
  const parts = P.millisecondsToParts(value);
  const rebuilt = P.partsToMs(parts);
  assert.equal(rebuilt.ok, true, `${label}: normalized parts must remain calculable`);
  assert.equal(rebuilt.value, value, `${label}: milliseconds -> parts -> milliseconds must be lossless`);
}

const edgeValues = [
  0n,
  1n,
  -1n,
  999n,
  -999n,
  1000n,
  -1000n,
  3661001n,
  -3661001n,
  90061001n,
  -90061001n,
  93600000n,
  -93600000n,
  25920000000000001n,
  -25920000000000001n,
  10n ** 50n + 123456789n,
  -(10n ** 50n + 123456789n)
];
for (const value of edgeValues) assertPartsRoundTrip(value);

// Deterministic pseudo-random invariant sweep. No external fuzzing dependency and no flaky seed.
let seed = 0x9e3779b97f4a7c15n;
const mask = (1n << 160n) - 1n;
for (let i = 0; i < 256; i += 1) {
  seed = (seed * 6364136223846793005n + 1442695040888963407n) & mask;
  let value = seed;
  if (i % 2) value = -value;
  assertPartsRoundTrip(value, `deterministic-${i}`);
}

// Converting a result to a continuation row must not change it.
for (const value of [
  -93600000n,
  -90061001n,
  25920000000000001n,
  -25920000000000001n
]) {
  const row = [{ op: null, parts: P.millisecondsToParts(value) }];
  const evaluated = P.evaluateRows(row);
  assert.equal(evaluated.ok, true);
  assert.equal(evaluated.value, value, `${value}: continuation row must preserve last result`);
}

// Display rounding must never expose a negative zero.
assert.equal(P.roundedRatioText(-1n, P.FACTOR_MS.h, 6), '0', 'tiny negative hour must round to 0, not -0');
assert.equal(P.roundedRatioText(-1n, P.FACTOR_MS.m, 6), '-0.000017');

// Normalizing stored rows is idempotent.
const storedRows = [
  { op: '+', parts: [{ kind: 'unit', unit: 'h', value: '001.5000' }] },
  { op: '-', parts: [{ kind: 'colon', hours: '00047', minutes: '05', seconds: '09' }] }
];
const normalizedOnce = P.normalizeStoredRows(storedRows);
const normalizedTwice = P.normalizeStoredRows(normalizedOnce);
assert.deepEqual(normalizedTwice, normalizedOnce, 'row normalization must be idempotent');

console.log('duration-invariants: all invariants passed');
