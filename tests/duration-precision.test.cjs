'use strict';
const assert = require('node:assert/strict');
const P = require('../js/duration-precision.js');

function ok(result) {
  assert.equal(result.ok, true, result.error || 'expected ok');
  return result.value;
}

assert.equal(P.FACTOR_MS.d, 86400000n);
assert.equal(P.MAX_INPUT_DIGITS, 100);
assert.equal(P.normalizeDecimalString('0001.5000'), '1.5');
assert.equal(P.normalizeDecimalString('-0000.000'), '0');
assert.equal(P.digitCount('123.45'), 5);

assert.equal(ok(P.parseDecimalToMs('0.001', 's')), 1n);
assert.equal(ok(P.parseDecimalToMs('0.0001', 'm')), 6n);
assert.equal(ok(P.parseDecimalToMs('1.5', 'h')), 5400000n);
assert.equal(P.parseDecimalToMs('0.0001', 's').ok, false);
assert.equal(P.parseDecimalToMs('0.0000001', 'd').ok, false);

const threeHundredMillionDays = ok(P.parseDecimalToMs('300000000', 'd'));
assert.equal(threeHundredMillionDays, 25920000000000000n);
assert.equal(threeHundredMillionDays + ok(P.parseDecimalToMs('0.001', 's')), 25920000000000001n);

const hundredDigits = '9'.repeat(100);
const hugeDays = ok(P.parseDecimalToMs(hundredDigits, 'd'));
assert.equal((hugeDays / P.FACTOR_MS.d).toString(), hundredDigits);
assert.equal((hugeDays + 1n) - hugeDays, 1n);

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
  { kind: 'unit', unit: 'm', value: '30' },
  { kind: 'unit', unit: 's', value: '0.001' }
]);

const expression = [
  { op: null, parts: [{ kind: 'unit', unit: 'd', value: '300000000' }] },
  { op: '+', parts: [{ kind: 'unit', unit: 's', value: '0.001' }] },
  { op: '-', parts: [{ kind: 'colon', hours: '1', minutes: '00', seconds: '00' }] }
];
assert.equal(ok(P.evaluateRows(expression)), 25919999996400001n);

assert.deepEqual(P.normalizeStoredRows([
  { op: '+', parts: [{ kind: 'unit', unit: 'd', value: 12 }, { kind: 'unit', unit: 's', value: '0.0010' }] },
  { op: '-', parts: [{ kind: 'colon', hours: '0002', minutes: '03', seconds: null }] }
]), [
  { op: null, parts: [{ kind: 'unit', unit: 'd', value: '12' }, { kind: 'unit', unit: 's', value: '0.001' }] },
  { op: '-', parts: [{ kind: 'colon', hours: '2', minutes: '03', seconds: null }] }
]);

const hugeExpression = [
  { op: null, parts: [{ kind: 'unit', unit: 'd', value: hundredDigits }] },
  { op: '+', parts: [{ kind: 'unit', unit: 'd', value: hundredDigits }] },
  { op: '+', parts: [{ kind: 'unit', unit: 's', value: '0.001' }] }
];
const hugeExpressionResult = ok(P.evaluateRows(hugeExpression));
assert.equal(hugeExpressionResult - ok(P.evaluateRows(hugeExpression.slice(0, 2))), 1n);
assert.ok((hugeExpressionResult / P.FACTOR_MS.d).toString().length >= 100);

console.log('duration-precision: all tests passed');
