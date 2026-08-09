'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema-migration-vectors.json'), 'utf8'));
require('../js/duration-precision.js');
require('../js/date-mapper.js');
const H = require('../js/history-store.js');
const S = require('../js/calculator-state.js');

function assertSubset(actual, expected, label) {
  for (const [key, value] of Object.entries(expected || {})) {
    if (key === 'accepted') continue;
    assert.deepEqual(actual?.[key], value, `${label}: ${key}`);
  }
}

for (const vector of vectors.history) {
  const label = `history/${vector.id}`;
  const actual = H.normalizeRecord(vector.input);
  if (vector.expected.accepted) {
    assert.ok(actual, `${label}: should be accepted`);
    assertSubset(actual, vector.expected, label);
  } else {
    assert.equal(actual, null, `${label}: unknown or malformed schema must be rejected`);
  }
}

for (const vector of vectors.state) {
  const label = `state/${vector.id}`;
  const actual = S.normalizeSnapshot(vector.input);
  if (vector.expected.accepted) {
    assertSubset(actual, vector.expected, label);
  } else {
    assert.deepEqual(actual, S.emptySnapshot(), `${label}: unknown or malformed schema must degrade to empty state`);
  }
}

console.log(`schema-migration: ${vectors.history.length + vectors.state.length} vectors passed`);
