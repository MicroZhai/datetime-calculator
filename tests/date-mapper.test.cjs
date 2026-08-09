'use strict';
const assert = require('node:assert/strict');
const DateMapper = require('../js/date-mapper.js');

assert.equal(DateMapper.normalizeAnchorValue('2026-08-09'), '2026-08-09T00:00');
assert.equal(DateMapper.normalizeAnchorValue('2026-08-09T13:45:59'), '2026-08-09T13:45');
assert.equal(DateMapper.normalizeAnchorValue('not-a-date'), null);
assert.equal(DateMapper.formatAnchorLabel('2026-08-09T00:00'), '2026/08/09 00:00');

const knownNow = new Date(2026, 7, 9, 14, 34, 56, 789);
assert.equal(DateMapper.localTodayStartValue(knownNow), '2026-08-09T00:00');

assert.notEqual(DateMapper.parseLocalDateTimeMs('2028-02-29T12:30'), null);
assert.equal(DateMapper.parseLocalDateTimeMs('2026-02-29T12:30'), null);
assert.equal(DateMapper.parseLocalDateTimeMs('2026-13-01T00:00'), null);
assert.equal(DateMapper.parseLocalDateTimeMs('2026-01-01T24:00'), null);

const plusOneDay = DateMapper.mapDurationToLocalDate('2026-01-15T00:00', 86400000n);
assert.equal(plusOneDay.ok, true);
assert.equal(plusOneDay.date, '2026/01/16');
assert.equal(plusOneDay.time, '00:00');

const plusOneMs = DateMapper.mapDurationToLocalDate('2026-01-15T00:00', '1');
assert.equal(plusOneMs.ok, true);
assert.equal(plusOneMs.date, '2026/01/15');
assert.equal(plusOneMs.time, '00:00:00.001');

const minusOneMs = DateMapper.mapDurationToLocalDate('2026-01-15T00:00', -1n);
assert.equal(minusOneMs.ok, true);
assert.equal(minusOneMs.date, '2026/01/14');
assert.equal(minusOneMs.time, '23:59:59.999');

const huge = DateMapper.mapDurationToLocalDate('2026-08-09T00:00', 300000000n * 86400000n);
assert.deepEqual(huge, { ok: false, reason: 'date-out-of-range' });

assert.deepEqual(DateMapper.mapDurationToLocalDate('bad', 1n), { ok: false, reason: 'invalid-anchor' });
assert.deepEqual(DateMapper.mapDurationToLocalDate('2026-01-15T00:00', '1.5'), { ok: false, reason: 'invalid-duration' });

console.log('date-mapper: local-date mapping and range isolation passed');
