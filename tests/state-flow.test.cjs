'use strict';
const assert = require('node:assert/strict');
const P = require('../js/duration-precision.js');
const D = require('../js/date-mapper.js');
const H = require('../js/history-store.js');
const S = require('../js/calculator-state.js');

function unit(value, unitName) {
  const parsed = P.parseDecimalToMs(value, unitName);
  assert.equal(parsed.ok, true, parsed.error || 'unit should parse');
  return { kind: 'unit', unit: unitName, value: parsed.normalized };
}

// Simulate: input -> calculate -> save -> JSON -> reload -> canonical state restore -> continue calculating.
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

const beforeRestore = S.normalizeSnapshot({
  resultUnit: 'h',
  resultRadix: 10,
  hourDisplayMode: 'sexagesimal',
  numberBuffer: '999'
});
const restoredState = S.fromHistoryRecord(history[0], beforeRestore);
assert.equal(restoredState.anchorDateTime, '2026-08-09T00:00');
assert.equal(restoredState.lastResultMs, '25920000000000001');
assert.equal(restoredState.numberBuffer, '');
assert.equal(restoredState.currentOp, null);
assert.equal(restoredState.justEvaluated, false);
assert.equal(restoredState.resultUnit, 'h', 'history restore preserves display choice');
assert.equal(restoredState.resultRadix, 10);
assert.equal(restoredState.hourDisplayMode, 'sexagesimal');

rows = restoredState.rows.map(row => ({ ...row, parts: row.parts.map(part => ({ ...part })) }));
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
  anchorDateTime: restoredState.anchorDateTime
}));
assert.equal(history.length, 2);
assert.equal(history[0].resultMs, '25919999996400001');

// Negative results survive persistence, canonical state restore, and can continue participating in arithmetic.
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
const negativeState = S.fromHistoryRecord(negativeReloaded);
assert.equal(negativeState.lastResultMs, '-1000');
const continuedNegative = P.evaluateRows([
  ...negativeState.rows,
  { op: '+', parts: [unit('0.001', 's')] }
]);
assert.equal(continuedNegative.ok, true);
assert.equal(continuedNegative.value, -999n);

// Undo snapshot itself is JSON-safe, including large results and date/display context.
const undoDisk = S.serialize({
  ...restoredState,
  lastResultMs: evaluated.value,
  selectedRow: 0
});
const undoRestored = S.parse(undoDisk);
assert.equal(undoRestored.lastResultMs, '25919999996400001');
assert.equal(undoRestored.anchorDateTime, '2026-08-09T00:00');
assert.equal(undoRestored.selectedRow, 0);

// Delete -> undo insertion uses the same canonical store rules.
const beforeDelete = history;
const deletion = H.removeAt(beforeDelete, 0);
assert.equal(deletion.records.length, 1);
const afterUndo = H.insertAt(deletion.records, 0, deletion.removed);
assert.equal(afterUndo.length, 2);
assert.equal(afterUndo[0].signature, beforeDelete[0].signature);

console.log('state-flow: all tests passed');
