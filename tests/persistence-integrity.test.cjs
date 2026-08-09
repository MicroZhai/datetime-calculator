'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'persistence-integrity-vectors.json'), 'utf8'));
const P = require('../js/duration-precision.js');
require('../js/date-mapper.js');
const H = require('../js/history-store.js');
const S = require('../js/calculator-state.js');

function assertSubset(actual, expected, label) {
  if (expected === null) {
    assert.equal(actual, null, label);
    return;
  }
  for (const [key, value] of Object.entries(expected || {})) {
    assert.deepEqual(actual?.[key], value, `${label}: ${key}`);
  }
}

function assertAbsent(actual, keys, label) {
  for (const key of keys || []) {
    assert.equal(Object.hasOwn(actual || {}, key), false, `${label}: ${key} must be absent`);
  }
}

for (const vector of vectors.strictRows || []) {
  const label = `strictRows/${vector.id}`;
  const actual = P.normalizeStoredRowsStrict(vector.input);
  assert.deepEqual(actual, vector.expected, label);
}

for (const vector of vectors.history || []) {
  const label = `history/${vector.id}`;
  const actual = H.normalizeRecord(vector.input);
  assertSubset(actual, vector.expected, label);
  assertAbsent(actual, vector.expectedAbsent, label);
}

for (const vector of vectors.state || []) {
  const label = `state/${vector.id}`;
  const actual = S.normalizeSnapshot(vector.input);
  assertSubset(actual, vector.expected, label);
  assertAbsent(actual, vector.expectedAbsent, label);

  const disk = S.serialize(actual);
  assert.deepEqual(S.parse(disk), S.normalizeSnapshot(actual), `${label}: JSON round-trip`);
}

const count = (vectors.strictRows?.length || 0) + (vectors.history?.length || 0) + (vectors.state?.length || 0);
console.log(`persistence-integrity: ${count} shared vectors passed`);
