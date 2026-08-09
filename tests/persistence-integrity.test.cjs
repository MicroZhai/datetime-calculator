'use strict';
const assert = require('node:assert/strict');
const P = require('../js/duration-precision.js');
require('../js/date-mapper.js');
const H = require('../js/history-store.js');
const S = require('../js/calculator-state.js');

const goodSecond = { kind: 'unit', unit: 's', value: '1' };

// Persisted rows are committed calculator truth. A malformed sibling part must not
// be silently dropped, otherwise the restored calculation changes meaning.
assert.equal(H.normalizeRecord({
  rows: [{ op: null, parts: [goodSecond, { kind: 'unknown', value: '999' }] }]
}), null, 'history must reject a row containing an unknown part');

// H:MM legacy compatibility may pad 5 -> 05, but it must never truncate 005 -> 05.
assert.equal(H.normalizeRecord({
  rows: [{ op: null, parts: [{ kind: 'colon', hours: '1', minutes: '005', seconds: null }] }]
}), null, 'history must reject overlong colon minutes instead of slicing them');

// Unknown row operators must not be rewritten to +.
assert.equal(H.normalizeRecord({
  rows: [
    { op: null, parts: [goodSecond] },
    { op: '*', parts: [goodSecond] }
  ]
}), null, 'history must reject unknown persisted operators');

// Persisted parts originate from the same UI input contract and may not bypass its
// resource guard simply because they came from localStorage.
assert.equal(H.normalizeRecord({
  rows: [{ op: null, parts: [{ kind: 'unit', unit: 'd', value: '9'.repeat(P.MAX_INPUT_DIGITS + 1) }] }]
}), null, 'history must reject over-limit persisted unit values');

// Invalid optional date metadata must not poison an otherwise exact duration record.
const invalidDateRecord = H.normalizeRecord({
  rows: [{ op: null, parts: [goodSecond] }],
  anchorDateTime: '2026-02-29T00:00'
});
assert.ok(invalidDateRecord, 'duration history remains recoverable when optional date metadata is bad');
assert.equal(Object.hasOwn(invalidDateRecord, 'anchorDateTime'), false, 'invalid calendar anchor is dropped');

// CalculatorState committed rows follow the same integrity policy: do not partially
// salvage a damaged expression into a different expression.
const damagedState = S.normalizeSnapshot({
  rows: [{ op: null, parts: [goodSecond, { kind: 'unknown', value: '999' }] }],
  lastResultMs: '1000'
});
assert.deepEqual(damagedState.rows, [], 'damaged committed rows are discarded as a whole');

const invalidDateState = S.normalizeSnapshot({
  rows: [{ op: null, parts: [goodSecond] }],
  anchorDateTime: '2026-02-29T00:00'
});
assert.equal(invalidDateState.anchorDateTime, null, 'state drops invalid calendar metadata');

// Editing drafts remain intentionally permissive because they are not committed rows.
const draft = S.normalizeSnapshot({
  colonMode: true,
  colonHours: '12',
  colonMinutes: '5',
  colonSeconds: '',
  colonStage: 'minute',
  numberBuffer: '123.'
});
assert.equal(draft.colonMinutes, '5');
assert.equal(draft.numberBuffer, '123.');

console.log('persistence-integrity: all tests passed');
