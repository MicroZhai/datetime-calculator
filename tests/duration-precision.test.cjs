'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/duration-precision.js');
const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'duration-core-vectors.json'), 'utf8'));

function ok(result) {
  assert.equal(result.ok, true, result.error || 'expected ok');
  return result.value;
}

for (const [unit, expected] of Object.entries(vectors.unitFactorsMs)) {
  assert.equal(P.FACTOR_MS[unit].toString(), expected, `factor ${unit}`);
}

for (const test of vectors.parseCases) {
  const result = P.parseDecimalToMs(test.value, test.unit);
  if (test.expectedError) {
    assert.equal(result.ok, false, test.name);
    assert.equal(result.error, test.expectedError, test.name);
  } else {
    assert.equal(ok(result).toString(), test.expectedMs, test.name);
  }
}

for (const test of vectors.expressionCases) {
  assert.equal(ok(P.evaluateRows(test.rows)).toString(), test.expectedMs, test.name);
}

assert.equal(P.MAX_INPUT_DIGITS, 100);
assert.equal(P.normalizeDecimalString('0001.5000'), '1.5');
assert.equal(P.normalizeDecimalString('-0000.000'), '0');
assert.equal(P.digitCount('123.45'), 5);

assert.equal(ok(P.parseColonToMs('12345678901234567890', '59', '59')),
  12345678901234567890n * P.FACTOR_MS.h + 59n * P.FACTOR_MS.m + 59n * P.FACTOR_MS.s);
assert.equal(P.parseColonToMs('1', '60', '00').ok, false);
assert.equal(P.parseColonToMs('1', '00', '60').ok, false);

assert.equal(P.durationText(25920000000000001n), '300000000天0.001秒');
assert.equal(P.hms(28851000n), '08:00:51');
assert.equal(P.roundedRatioText(28851000n, P.FACTOR_MS.h, 6), '8.014167');
assert.equal(P.roundedRatioText(-28851000n, P.FACTOR_MS.h, 6), '-8.014167');
assert.deepEqual(P.millisecondsToParts(-5400001n), [
  { kind: 'unit', unit: 'h', value: '-1' },
  { kind: 'unit', unit: 'm', value: '-30' },
  { kind: 'unit', unit: 's', value: '-0.001' }
]);
assert.equal(ok(P.partsToMs(P.millisecondsToParts(-5400001n))), -5400001n,
  'negative normalized parts must rebuild the original duration exactly');

assert.deepEqual(P.normalizeStoredRows([
  { op: '+', parts: [{ kind: 'unit', unit: 'd', value: 12 }, { kind: 'unit', unit: 's', value: '0.0010' }] },
  { op: '-', parts: [{ kind: 'colon', hours: '0002', minutes: '03', seconds: null }] }
]), [
  { op: null, parts: [{ kind: 'unit', unit: 'd', value: '12' }, { kind: 'unit', unit: 's', value: '0.001' }] },
  { op: '-', parts: [{ kind: 'colon', hours: '2', minutes: '03', seconds: null }] }
]);

console.log(`duration-precision: ${vectors.parseCases.length} parse vectors + ${vectors.expressionCases.length} expression vectors passed`);
