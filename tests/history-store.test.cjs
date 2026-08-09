'use strict';
const assert = require('node:assert/strict');
const P = require('../js/duration-precision.js');
require('../js/date-mapper.js');
const H = require('../js/history-store.js');

const hugeRows = [
  { op: null, parts: [{ kind: 'unit', unit: 'd', value: '300000000' }] },
  { op: '+', parts: [{ kind: 'unit', unit: 's', value: '0.001' }] }
];

const record = H.createRecord({
  id: 'h_test',
  createdAt: 123456,
  rows: hugeRows,
  resultMs: '1', // deliberately wrong: rows must win
  anchorDateTime: '2026-08-09'
});
assert.ok(record);
assert.equal(record.schemaVersion, H.SCHEMA_VERSION);
assert.equal(record.resultMs, '25920000000000001');
assert.equal(record.anchorDateTime, '2026-08-09T00:00');
assert.equal(record.signature, H.recordSignature(hugeRows, '2026-08-09T00:00'));
assert.equal(Object.hasOwn(record, 'resultMismatch'), false);

const serialized = H.serialize([record]);
assert.equal(/\d+n/.test(serialized), false, 'serialized history must not contain BigInt literals');
const parsed = H.parse(serialized);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].resultMs, '25920000000000001');
assert.deepEqual(parsed[0].rows, P.normalizeStoredRows(hugeRows));

// Legacy date-only field and legacy JSON number are migrated from rows, not trusted.
const legacy = H.normalizeRecord({
  createdAt: 42,
  rows: hugeRows,
  resultMs: 7,
  anchorDate: '2026-08-09'
});
assert.ok(legacy);
assert.equal(legacy.anchorDateTime, '2026-08-09T00:00');
assert.equal(legacy.resultMs, '25920000000000001');
assert.match(legacy.id, /^h_migrated_/);

// Same expression + same date deduplicates; changing date creates a distinct record.
let list = H.upsert([], record);
list = H.upsert(list, H.createRecord({ id: 'newer', createdAt: 2, rows: hugeRows, anchorDateTime: '2026-08-09T00:00' }));
assert.equal(list.length, 1);
assert.equal(list[0].id, 'newer');
list = H.upsert(list, H.createRecord({ id: 'other-date', createdAt: 3, rows: hugeRows, anchorDateTime: '2026-08-10T00:00' }));
assert.equal(list.length, 2);

const removed = H.removeAt(list, 0);
assert.equal(removed.records.length, 1);
assert.equal(removed.removed.id, 'other-date');
const restored = H.insertAt(removed.records, 0, removed.removed);
assert.equal(restored.length, 2);
assert.equal(restored[0].id, 'other-date');

const many = [];
for (let i = 0; i < 60; i += 1) {
  many.push(H.createRecord({
    id: `h_${i}`,
    createdAt: i,
    rows: [{ op: null, parts: [{ kind: 'unit', unit: 's', value: String(i + 1) }] }]
  }));
}
assert.equal(H.normalizeList(many).length, H.DEFAULT_LIMIT);
assert.deepEqual(H.parse('{broken json'), []);
assert.equal(H.normalizeRecord({ rows: [] }), null);

console.log('history-store: all tests passed');
