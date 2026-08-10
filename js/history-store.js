/*
 * History persistence boundary.
 * Records are serialized as JSON-safe values and migrated before the UI sees
 * them, so restoring history cannot corrupt exact duration or date context.
 */
(function(root, factory) {
  const api = factory(root?.DurationPrecision, root?.DateMapper);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HistoryStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(DurationPrecisionRef, DateMapperRef) {
  'use strict';

  const SCHEMA_VERSION = 2;
  const LEGACY_UNVERSIONED = 0;
  const DEFAULT_LIMIT = 50;

  function schemaVersionOf(record) {
    if (!record || typeof record !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(record, 'schemaVersion')) return LEGACY_UNVERSIONED;
    return Number.isInteger(record.schemaVersion) && record.schemaVersion >= 0
      ? record.schemaVersion
      : null;
  }

  function migrateV0ToV1(record) {
    return { ...record, schemaVersion: 1 };
  }

  function migrateV1ToV2(record) {
    const next = { ...record, schemaVersion: 2 };
    if (!next.anchorDateTime && next.anchorDate) next.anchorDateTime = next.anchorDate;
    return next;
  }

  const MIGRATORS = Object.freeze({
    0: migrateV0ToV1,
    1: migrateV1ToV2
  });

  function migrateRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    let version = schemaVersionOf(record);
    if (version === null || version > SCHEMA_VERSION) return null;

    let current = { ...record };
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
    if (!DurationPrecisionRef?.normalizeStoredRows) return [];
    return DurationPrecisionRef.normalizeStoredRows(rows);
  }

  function normalizeAnchorValue(value) {
    if (value === null || value === undefined || value === '') return null;

    let normalized = null;
    if (DateMapperRef?.normalizeAnchorValue) {
      normalized = DateMapperRef.normalizeAnchorValue(value);
    } else if (typeof value === 'string') {
      if (/^\d{4,}-\d{2}-\d{2}$/.test(value)) normalized = `${value}T00:00`;
      else {
        const match = value.match(/^(\d{4,}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
        normalized = match ? `${match[1]}T${match[2]}:${match[3]}` : null;
      }
    }

    if (!normalized) return null;
    if (DateMapperRef?.parseLocalDateTimeMs && DateMapperRef.parseLocalDateTimeMs(normalized) === null) {
      return null;
    }
    return normalized;
  }

  function normalizeLimit(limit) {
    return Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_LIMIT;
  }

  function rowsSignature(rows) {
    return JSON.stringify(normalizeRows(rows));
  }

  function recordSignature(rows, anchorDateTime = null) {
    return JSON.stringify({
      anchorDateTime: normalizeAnchorValue(anchorDateTime),
      rows: normalizeRows(rows)
    });
  }

  function simpleHash(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function normalizeCreatedAt(value) {
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  }

  function evaluateNormalizedRows(rows) {
    if (!DurationPrecisionRef?.evaluateRows) return null;
    const result = DurationPrecisionRef.evaluateRows(rows);
    return result?.ok ? result.value : null;
  }

  function normalizeRecord(record) {
    const migrated = migrateRecord(record);
    if (!migrated) return null;

    const rows = normalizeRows(migrated.rows);
    if (!rows.length) return null;

    const evaluated = evaluateNormalizedRows(rows);
    if (evaluated === null) return null;

    const anchorDateTime = normalizeAnchorValue(migrated.anchorDateTime || migrated.anchorDate || null);
    const signature = recordSignature(rows, anchorDateTime);
    const createdAt = normalizeCreatedAt(migrated.createdAt);
    const id = typeof migrated.id === 'string' && migrated.id
      ? migrated.id
      : `h_migrated_${createdAt}_${simpleHash(signature)}`;

    const normalized = {
      schemaVersion: SCHEMA_VERSION,
      id,
      createdAt,
      signature,
      rows,
      resultMs: evaluated.toString()
    };
    if (anchorDateTime) normalized.anchorDateTime = anchorDateTime;
    return normalized;
  }

  function createRecord({ rows, resultMs = null, anchorDateTime = null, id = '', createdAt = Date.now() } = {}) {
    void resultMs;
    return normalizeRecord({ schemaVersion: SCHEMA_VERSION, rows, anchorDateTime, id, createdAt });
  }

  function normalizeList(records, limit = DEFAULT_LIMIT) {
    if (!Array.isArray(records)) return [];
    const max = normalizeLimit(limit);
    const seen = new Set();
    const out = [];
    for (const candidate of records) {
      const record = normalizeRecord(candidate);
      if (!record || seen.has(record.signature)) continue;
      seen.add(record.signature);
      out.push(record);
      if (out.length >= max) break;
    }
    return out;
  }

  function parse(raw, limit = DEFAULT_LIMIT) {
    try {
      const parsed = typeof raw === 'string' ? (raw ? JSON.parse(raw) : []) : raw;
      return normalizeList(parsed, limit);
    } catch (_) {
      return [];
    }
  }

  function serialize(records, limit = DEFAULT_LIMIT) {
    return JSON.stringify(normalizeList(records, limit));
  }

  function upsert(records, candidate, limit = DEFAULT_LIMIT) {
    const record = normalizeRecord(candidate);
    if (!record) return normalizeList(records, limit);
    const max = normalizeLimit(limit);
    const current = normalizeList(records, max).filter(item => item.signature !== record.signature);
    return [record, ...current].slice(0, max);
  }

  function removeAt(records, index, limit = DEFAULT_LIMIT) {
    const current = normalizeList(records, limit);
    if (!Number.isInteger(index) || index < 0 || index >= current.length) {
      return { records: current, removed: null };
    }
    const next = current.slice();
    const [removed] = next.splice(index, 1);
    return { records: next, removed };
  }

  function insertAt(records, index, candidate, limit = DEFAULT_LIMIT) {
    const record = normalizeRecord(candidate);
    const max = normalizeLimit(limit);
    const current = normalizeList(records, max);
    if (!record) return current;
    const withoutDuplicate = current.filter(item => item.signature !== record.signature);
    const position = Number.isInteger(index)
      ? Math.max(0, Math.min(index, withoutDuplicate.length))
      : 0;
    withoutDuplicate.splice(position, 0, record);
    return withoutDuplicate.slice(0, max);
  }

  function recordAnchor(record) {
    return normalizeAnchorValue(record?.anchorDateTime || record?.anchorDate || null);
  }

  return Object.freeze({
    SCHEMA_VERSION,
    LEGACY_UNVERSIONED,
    DEFAULT_LIMIT,
    schemaVersionOf,
    migrateRecord,
    normalizeRows,
    normalizeAnchorValue,
    rowsSignature,
    recordSignature,
    normalizeRecord,
    createRecord,
    normalizeList,
    parse,
    serialize,
    upsert,
    removeAt,
    insertAt,
    recordAnchor
  });
});
