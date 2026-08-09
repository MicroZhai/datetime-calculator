(function(root, factory) {
  const api = factory(root?.DurationPrecision, root?.DateMapper);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalculatorState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(DurationPrecisionRef, DateMapperRef) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const LEGACY_UNVERSIONED = 0;
  const FORMAT_MIN = 0;
  const FORMAT_MAX = 2;

  function schemaVersionOf(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    if (!Object.prototype.hasOwnProperty.call(snapshot, 'schemaVersion')) return LEGACY_UNVERSIONED;
    return Number.isInteger(snapshot.schemaVersion) && snapshot.schemaVersion >= 0
      ? snapshot.schemaVersion
      : null;
  }

  function migrateV0ToV1(snapshot) {
    const next = { ...snapshot, schemaVersion: 1 };
    if (!next.anchorDateTime && next.anchorDate) next.anchorDateTime = next.anchorDate;
    return next;
  }

  const MIGRATORS = Object.freeze({
    0: migrateV0ToV1
  });

  function migrateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
    let version = schemaVersionOf(snapshot);
    if (version === null || version > SCHEMA_VERSION) return null;

    let current = { ...snapshot };
    while (version < SCHEMA_VERSION) {
      const migrate = MIGRATORS[version];
      if (typeof migrate !== 'function') return null;
      current = migrate(current);
      const nextVersion = schemaVersionOf(current);
      if (nextVersion === null || nextVersion <= version || nextVersion > SCHEMA_VERSION) return null;
      version = nextVersion;
    }
    return current;
  }

  function normalizeRows(rows) {
    if (DurationPrecisionRef?.normalizeStoredRowsStrict) {
      const normalized = DurationPrecisionRef.normalizeStoredRowsStrict(rows);
      return Array.isArray(normalized) ? normalized : [];
    }
    return DurationPrecisionRef?.normalizeStoredRows
      ? DurationPrecisionRef.normalizeStoredRows(rows)
      : [];
  }

  function normalizeParts(parts) {
    if (DurationPrecisionRef?.normalizeStoredRowsStrict) {
      const normalized = DurationPrecisionRef.normalizeStoredRowsStrict([
        { op: null, parts: Array.isArray(parts) ? parts : [] }
      ]);
      return normalized?.[0]?.parts || [];
    }
    const normalized = normalizeRows([{ op: null, parts: Array.isArray(parts) ? parts : [] }]);
    return normalized[0]?.parts || [];
  }

  function normalizeOperator(value) {
    return value === '+' || value === '-' ? value : null;
  }

  function normalizeNumberBuffer(value) {
    const text = typeof value === 'string' ? value : '';
    if (!text) return '';
    if (!/^-?\d*(?:\.\d*)?$/.test(text)) return '';
    const digits = text.replace(/\D/g, '').length;
    const limit = DurationPrecisionRef?.MAX_INPUT_DIGITS || 100;
    return digits <= limit ? text : '';
  }

  function normalizeColonStage(value) {
    return value === 'second' ? 'second' : 'minute';
  }

  function normalizeColonDigits(value, maxLength = 2) {
    const text = typeof value === 'string' ? value : String(value ?? '');
    return /^\d*$/.test(text) && text.length <= maxLength ? text : '';
  }

  function normalizeColonHours(value) {
    const text = typeof value === 'string' ? value : String(value ?? '');
    const limit = DurationPrecisionRef?.MAX_INPUT_DIGITS || 100;
    return /^\d*$/.test(text) && text.length <= limit ? text : '';
  }

  function normalizeFormatIndex(value) {
    return Number.isInteger(value) && value >= FORMAT_MIN && value <= FORMAT_MAX ? value : 0;
  }

  function normalizeResultMs(value) {
    const parsed = DurationPrecisionRef?.toBigIntMs?.(value);
    return parsed === null || parsed === undefined ? '0' : parsed.toString();
  }

  function normalizeSelectedRow(value, rows) {
    return Number.isInteger(value) && value >= 0 && value < rows.length ? value : null;
  }

  function normalizePartEdit(value, rows) {
    if (!value || typeof value !== 'object') return null;
    const rowIndex = Number.isInteger(value.rowIndex) ? value.rowIndex : -1;
    const partIndex = Number.isInteger(value.partIndex) ? value.partIndex : -1;
    if (rowIndex < 0 || rowIndex >= rows.length) return null;
    if (partIndex < 0 || partIndex >= rows[rowIndex].parts.length) return null;

    if (value.kind === 'unit') {
      const unit = ['d', 'h', 'm', 's'].includes(value.unit) ? value.unit : rows[rowIndex].parts[partIndex]?.unit;
      if (!unit) return null;
      return {
        rowIndex,
        partIndex,
        kind: 'unit',
        unit,
        buffer: normalizeNumberBuffer(value.buffer),
        fresh: Boolean(value.fresh)
      };
    }

    if (value.kind === 'colon') {
      const field = ['hour', 'minute', 'second'].includes(value.field) ? value.field : 'minute';
      return {
        rowIndex,
        partIndex,
        kind: 'colon',
        hours: normalizeColonHours(value.hours),
        minutes: normalizeColonDigits(value.minutes),
        seconds: normalizeColonDigits(value.seconds),
        hasSeconds: Boolean(value.hasSeconds),
        field,
        fresh: Boolean(value.fresh)
      };
    }

    return null;
  }

  function normalizeAnchorDateTime(value) {
    if (!value) return null;
    const normalized = DateMapperRef?.normalizeAnchorValue
      ? DateMapperRef.normalizeAnchorValue(value)
      : (typeof value === 'string' ? value : null);
    if (!normalized) return null;
    if (DateMapperRef?.parseLocalDateTimeMs && DateMapperRef.parseLocalDateTimeMs(normalized) === null) {
      return null;
    }
    return normalized;
  }

  function normalizeHourDisplayMode(value) {
    return value === 'sexagesimal' ? 'sexagesimal' : 'decimal';
  }

  function normalizeCanonicalSnapshot(snapshot) {
    const rows = normalizeRows(snapshot.rows);
    const currentParts = normalizeParts(snapshot.currentParts);
    const colonMode = Boolean(snapshot.colonMode);
    const normalized = {
      schemaVersion: SCHEMA_VERSION,
      rows,
      currentOp: normalizeOperator(snapshot.currentOp),
      currentParts,
      numberBuffer: normalizeNumberBuffer(snapshot.numberBuffer),
      colonMode,
      colonHours: colonMode ? normalizeColonHours(snapshot.colonHours) : '',
      colonMinutes: colonMode ? normalizeColonDigits(snapshot.colonMinutes) : '',
      colonSeconds: colonMode ? normalizeColonDigits(snapshot.colonSeconds) : '',
      colonStage: colonMode ? normalizeColonStage(snapshot.colonStage) : 'minute',
      formatIndex: normalizeFormatIndex(snapshot.formatIndex),
      lastResultMs: normalizeResultMs(snapshot.lastResultMs),
      justEvaluated: Boolean(snapshot.justEvaluated),
      selectedRow: normalizeSelectedRow(snapshot.selectedRow, rows),
      partEdit: normalizePartEdit(snapshot.partEdit, rows),
      error: typeof snapshot.error === 'string' ? snapshot.error : '',
      anchorDateTime: normalizeAnchorDateTime(snapshot.anchorDateTime || snapshot.anchorDate || null),
      hourDisplayMode: normalizeHourDisplayMode(snapshot.hourDisplayMode)
    };

    if (!normalized.colonMode) {
      normalized.colonHours = '';
      normalized.colonMinutes = '';
      normalized.colonSeconds = '';
      normalized.colonStage = 'minute';
    }
    return normalized;
  }

  function emptySnapshot() {
    return normalizeCanonicalSnapshot({ schemaVersion: SCHEMA_VERSION });
  }

  function normalizeSnapshot(snapshot = {}) {
    const migrated = migrateSnapshot(snapshot);
    return migrated ? normalizeCanonicalSnapshot(migrated) : emptySnapshot();
  }

  function serialize(snapshot) {
    return JSON.stringify(normalizeSnapshot(snapshot));
  }

  function parse(raw) {
    try {
      if (typeof raw === 'string') return normalizeSnapshot(raw ? JSON.parse(raw) : {});
      return normalizeSnapshot(raw || {});
    } catch (_) {
      return emptySnapshot();
    }
  }

  function hasContent(snapshot) {
    const state = normalizeSnapshot(snapshot);
    return state.rows.length > 0 ||
      state.currentParts.length > 0 ||
      state.numberBuffer !== '' ||
      state.colonMode ||
      state.currentOp !== null ||
      state.justEvaluated ||
      state.selectedRow !== null ||
      state.partEdit !== null ||
      Boolean(state.anchorDateTime);
  }

  function fromHistoryRecord(record, baseSnapshot = {}) {
    const base = normalizeSnapshot(baseSnapshot);
    const rows = normalizeRows(record?.rows);
    if (!rows.length) return base;
    const evaluated = DurationPrecisionRef?.evaluateRows?.(rows);
    if (!evaluated?.ok) return base;

    return normalizeSnapshot({
      ...base,
      schemaVersion: SCHEMA_VERSION,
      rows,
      currentOp: null,
      currentParts: [],
      numberBuffer: '',
      colonMode: false,
      colonHours: '',
      colonMinutes: '',
      colonSeconds: '',
      colonStage: 'minute',
      lastResultMs: evaluated.value.toString(),
      justEvaluated: false,
      selectedRow: null,
      partEdit: null,
      error: '',
      anchorDateTime: record?.anchorDateTime || record?.anchorDate || null
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    LEGACY_UNVERSIONED,
    schemaVersionOf,
    migrateSnapshot,
    normalizeSnapshot,
    emptySnapshot,
    serialize,
    parse,
    hasContent,
    fromHistoryRecord
  });
});
