'use strict';
const assert = require('node:assert/strict');
const P = require('../js/duration-precision.js');
const D = require('../js/date-mapper.js');
const H = require('../js/history-store.js');

function unit(value, unitName) {
  const parsed = P.parseDecimalToMs(value, unitName);
  assert.equal(parsed.ok, true, parsed.error || 'unit should parse');
  return { kind: 'unit', unit: unitName, value: parsed.normalized };
}

// Simulate: input -> calculate -> save -> JSON -> reload -> restore -> continue calculating.
let rows = [
  { op: null, parts: [unit('300000000', 'd')] },
  { op: '+', parts: [unit('0.001', 's')] }
];
let evaluated = P.evaluateRows(rows);
assert.equal(evaluated.ok, true);
assert.equal(evaluated.value, 25920000000000001n);

let history = H.upsert([], H.createRecord({
  id: 'flow_1',
  createdAt: 1,
  rows,
  resultMs: evaluated.value,
  anchorDateTime: '2026-08-09T00:00'
}));
const disk = H.serialize(history);
history = H.parse(disk);
assert.equal(history.length, 1);
assert.equal(history[0].resultMs, '25920000000000001');

const dateMapping = D.mapDurationToLocalDate(history[0].anchorDateTime, history[0].resultMs);
assert.equal(dateMapping.ok, false);
assert.equal(dateMapping.reason, 'date-out-of-range');

rows = history[0].rows.map(row => ({ ...row, parts: row.parts.map(part => ({ ...part })) }));
rows.push({ op: '-', parts: [{ kind: 'colon', hours: '1', minutes: '00', seconds: '00' }] });
evaluated = P.evaluateRows(rows);
assert.equal(evaluated.ok, true);
assert.equal(evaluated.value, 25919999996400001n);

// Save the continued expression; the original history remains a separate state.
history = H.upsert(history, H.createRecord({
  id: 'flow_2',
  createdAt: 2,
  rows,
  resultMs: evaluated.value,
  anchorDateTime: history[0].anchorDateTime
}));
assert.equal(history.length, 2);
assert.equal(history[0].resultMs, '25919999996400001');

// Negative results survive persistence and can continue participating in arithmetic.
const negativeRows = [
  { op: null, parts: [unit('1', 's')] },
  { op: '-', parts: [unit('2', 's')] }
];
const negative = P.evaluateRows(negativeRows);
assert.equal(negative.ok, true);
assert.equal(negative.value, -1000n);
const negativeRecord = H.createRecord({ id: 'negative', createdAt: 3, rows: negativeRows, resultMs: negative.value });
const negativeReloaded = H.parse(H.serialize([negativeRecord]))[0];
assert.equal(negativeReloaded.resultMs, '-1000');
const continuedNegative = P.evaluateRows([
  ...negativeReloaded.rows,
  { op: '+', parts: [unit('0.001', 's')] }
]);
assert.equal(continuedNegative.ok, true);
assert.equal(continuedNegative.value, -999n);

// Delete -> undo insertion uses the same canonical store rules.
const beforeDelete = history;
const deletion = H.removeAt(beforeDelete, 0);
assert.equal(deletion.records.length, 1);
const afterUndo = H.insertAt(deletion.records, 0, deletion.removed);
assert.equal(afterUndo.length, 2);
assert.equal(afterUndo[0].signature, beforeDelete[0].signature);

console.log('state-flow: all tests passed');
