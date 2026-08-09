'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'date-edge-vectors.json'), 'utf8'));
const D = require('../js/date-mapper.js');

function assertSubset(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(actual?.[key], value, `${label}: ${key}`);
  }
}

for (const vector of vectors.cases || []) {
  process.env.TZ = vector.timezone;
  const label = `${vector.timezone}/${vector.id}`;
  if (vector.operation === 'parseValid') {
    assert.equal(D.parseLocalDateTimeMs(vector.input) !== null, vector.expected, label);
  } else if (vector.operation === 'mapDuration') {
    const actual = D.mapDurationToLocalDate(vector.anchor, vector.durationMs);
    assertSubset(actual, vector.expected, label);
  } else {
    assert.fail(`${label}: unknown operation ${vector.operation}`);
  }
}

console.log(`date-edge: ${(vectors.cases || []).length} vectors passed`);
