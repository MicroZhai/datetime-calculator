'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'cross-platform-conformance-vectors.json'), 'utf8'));
process.env.TZ = vectors.dateTimezone || 'UTC';

require('../js/duration-precision.js');
const D = require('../js/date-mapper.js');
const H = require('../js/history-store.js');
const S = require('../js/calculator-state.js');

function assertSubset(actual, expected, message) {
  if (expected === null) {
    assert.equal(actual, null, message);
    return;
  }
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(actual?.[key], value, `${message}: ${key}`);
  }
}

for (const vector of vectors.date) {
  const label = `date/${vector.id}`;
  if (vector.operation === 'normalizeAnchor') {
    assert.equal(D.normalizeAnchorValue(vector.input), vector.expected, label);
  } else if (vector.operation === 'parseValid') {
    assert.equal(D.parseLocalDateTimeMs(vector.input) !== null, vector.expected, label);
  } else if (vector.operation === 'mapDuration') {
    const actual = D.mapDurationToLocalDate(vector.anchor, vector.durationMs);
    assertSubset(actual, vector.expected, label);
  } else {
    assert.fail(`${label}: unknown operation ${vector.operation}`);
  }
}

for (const vector of vectors.history) {
  const label = `history/${vector.id}`;
  if (vector.operation === 'normalizeRecord') {
    const actual = H.normalizeRecord(vector.input);
    assertSubset(actual, vector.expected, label);
  } else {
    assert.fail(`${label}: unknown operation ${vector.operation}`);
  }
}

for (const vector of vectors.state) {
  const label = `state/${vector.id}`;
  let actual;
  if (vector.operation === 'normalizeSnapshot') {
    actual = S.normalizeSnapshot(vector.input);
  } else if (vector.operation === 'fromHistoryRecord') {
    actual = S.fromHistoryRecord(vector.record, vector.base || {});
  } else {
    assert.fail(`${label}: unknown operation ${vector.operation}`);
  }

  const expected = { ...vector.expected };
  const expectedHasContent = Object.prototype.hasOwnProperty.call(expected, 'hasContent')
    ? expected.hasContent
    : undefined;
  delete expected.hasContent;
  assertSubset(actual, expected, label);
  if (expectedHasContent !== undefined) {
    assert.equal(S.hasContent(actual), expectedHasContent, `${label}: hasContent`);
  }

  const disk = S.serialize(actual);
  const roundTrip = S.parse(disk);
  assert.deepEqual(roundTrip, S.normalizeSnapshot(actual), `${label}: JSON round-trip`);
}

console.log(`cross-platform-conformance: ${vectors.date.length + vectors.history.length + vectors.state.length} vectors passed`);
