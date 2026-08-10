'use strict';
const assert = require('node:assert/strict');
require('../js/duration-precision.js');
require('../js/date-mapper.js');
const S = require('../js/calculator-state.js');

const hugeMs = 25920000000000001n;
const source = {
  rows: [
    { op: null, parts: [{ kind: 'unit', unit: 'd', value: '300000000' }] },
    { op: '+', parts: [{ kind: 'unit', unit: 's', value: '0.001' }] }
  ],
  currentOp: '-',
  currentParts: [{ kind: 'unit', unit: 'h', value: '1.5' }],
  numberBuffer: '',
  colonMode: false,
  formatIndex: 1,
  lastResultMs: hugeMs,
  justEvaluated: true,
  selectedRow: 1,
  partEdit: {
    rowIndex: 1,
    partIndex: 0,
    kind: 'unit',
    unit: 's',
    buffer: '0.00',
    fresh: false
  },
  error: '测试错误',
  anchorDateTime: '2026-08-09',
  hourDisplayMode: 'sexagesimal'
};

const snapshot = S.normalizeSnapshot(source);
assert.equal(snapshot.schemaVersion, S.SCHEMA_VERSION);
assert.equal(snapshot.lastResultMs, '25920000000000001');
assert.equal(snapshot.anchorDateTime, '2026-08-09T00:00');
assert.equal(snapshot.hourDisplayMode, 'sexagesimal');
assert.equal(snapshot.formatIndex, 1);
assert.equal(snapshot.partEdit.buffer, '0.00');
assert.equal(S.hasContent(snapshot), true);

const disk = S.serialize(source);
assert.doesNotThrow(() => JSON.parse(disk));
assert.equal(disk.includes('25920000000000001n'), false, 'BigInt literal must never enter snapshot JSON');
const roundTrip = S.parse(disk);
assert.deepEqual(roundTrip, snapshot);

// Partial unit input is valid undo state and must preserve a trailing decimal point.
const decimalDraft = S.normalizeSnapshot({ numberBuffer: '123.' });
assert.equal(decimalDraft.numberBuffer, '123.');
assert.equal(S.hasContent(decimalDraft), true);

// Partial H:MM:SS input must survive undo even before it is calculable.
const colonDraft = S.normalizeSnapshot({
  colonMode: true,
  colonHours: '12345678901234567890',
  colonMinutes: '5',
  colonSeconds: '',
  colonStage: 'minute'
});
assert.equal(colonDraft.colonMode, true);
assert.equal(colonDraft.colonHours, '12345678901234567890');
assert.equal(colonDraft.colonMinutes, '5');
assert.equal(colonDraft.colonStage, 'minute');
assert.deepEqual(S.parse(S.serialize(colonDraft)), colonDraft);

// Display preference alone is not calculator content.
const displayOnly = S.normalizeSnapshot({ formatIndex: 1, hourDisplayMode: 'sexagesimal' });
assert.equal(S.hasContent(displayOnly), false);
assert.equal(S.hasContent(S.emptySnapshot()), false);

const legacyDecimalDisplay = S.normalizeSnapshot({ formatIndex: 1, hourDisplayMode: 'decimal' });
assert.equal(legacyDecimalDisplay.hourDisplayMode, 'sexagesimal', 'legacy decimal display preference migrates to sexagesimal');

// Invalid or stale row-selection/edit pointers are removed safely.
const stale = S.normalizeSnapshot({
  rows: [{ op: null, parts: [{ kind: 'unit', unit: 'm', value: '1' }] }],
  selectedRow: 9,
  partEdit: { rowIndex: 9, partIndex: 0, kind: 'unit', unit: 'm', buffer: '2' }
});
assert.equal(stale.selectedRow, null);
assert.equal(stale.partEdit, null);

console.log('calculator-state: all tests passed');
