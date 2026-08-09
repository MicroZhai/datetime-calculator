(function(root, factory) {
  const api = factory(root?.DurationPrecision, root?.DateMapper);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HistoryStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(DurationPrecisionRef, DateMapperRef) {
  'use strict';

  const SCHEMA_VERSION = 2;
  const DEFAULT_LIMIT = 50;

  function normalizeRows(rows) {
    if (!DurationPrecisionRef?.normalizeStoredRows) return [];
    return DurationPrecisionRef.normalizeStoredRows(rows);
  }

  function normalizeAnchorValue(value) {
    if (value === null || value === undefined || value === '') return null;
    if (DateMapperRef?.normalizeAnchorValue) return DateMapperRef.normalizeAnchorValue(value);
    if (typeof value !== 'string') return null;
    if (/^\d{4,}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
    const match = value.match(/^(\d{4,}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[1]}T${match[2]}:${match[3]}` : null;
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
    if (!record || typeof record !== 'object') return null;
    const rows = normalizeRows(record.rows);
    if (!rows.length) return null;

    // Rows are the durable source of truth. Recompute resultMs during migration/load
    // instead of trusting a legacy JSON number that may already have lost precision.
    const evaluated = evaluateNormalizedRows(rows);
    if (evaluated === null) return null;

    const anchorDateTime = normalizeAnchorValue(record.anchorDateTime || record.anchorDate || null);
    const signature = recordSignature(rows, anchorDateTime);
    const createdAt = normalizeCreatedAt(record.createdAt);
    const id = typeof record.id === 'string' && record.id
      ? record.id
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
    // resultMs intentionally does not become the source of truth. It remains in the API
    // as a caller-side consistency hint while canonical persistence is rebuilt from rows.
    void resultMs;
    return normalizeRecord({ rows, anchorDateTime, id, createdAt });
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
    DEFAULT_LIMIT,
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
