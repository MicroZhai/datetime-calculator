(function(root, factory) {
  const api = factory(root?.DurationPrecision);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DateMapper = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(DurationPrecisionRef) {
  'use strict';

  const DATE_LIMIT_MS = 8640000000000000n;

  function toBigIntMs(value) {
    if (DurationPrecisionRef?.toBigIntMs) return DurationPrecisionRef.toBigIntMs(value);
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) return BigInt(value);
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      try { return BigInt(value.trim()); } catch (_) { return null; }
    }
    return null;
  }

  function normalizeAnchorValue(value) {
    if (typeof value !== 'string' || !value) return null;
    if (/^\d{4,}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
    const match = value.match(/^(\d{4,}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[1]}T${match[2]}:${match[3]}` : null;
  }

  function localTodayStartValue(now = new Date()) {
    if (!(now instanceof Date) || Number.isNaN(now.getTime())) return null;
    return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00`;
  }

  function formatAnchorLabel(value) {
    const normalized = normalizeAnchorValue(value);
    if (!normalized) return '';
    const [date, time] = normalized.split('T');
    return `${date.replaceAll('-', '/')} ${time}`;
  }

  function parseLocalDateTimeMs(value) {
    const normalized = normalizeAnchorValue(value);
    if (!normalized) return null;
    const [datePart, timePart] = normalized.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    if (![year, month, day, hour, minute].every(Number.isInteger)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

    const probe = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(probe.getTime())) return null;
    if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day ||
        probe.getHours() !== hour || probe.getMinutes() !== minute) return null;
    return probe.getTime();
  }

  function formatLocalDateParts(target) {
    if (!(target instanceof Date) || Number.isNaN(target.getTime())) return null;
    const year = String(target.getFullYear()).padStart(4, '0');
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hour = String(target.getHours()).padStart(2, '0');
    const minute = String(target.getMinutes()).padStart(2, '0');
    const second = String(target.getSeconds()).padStart(2, '0');
    const millisecond = target.getMilliseconds();

    let time = `${hour}:${minute}`;
    if (target.getSeconds() || millisecond) time += `:${second}`;
    if (millisecond) time += `.${String(millisecond).padStart(3, '0')}`;
    return { date: `${year}/${month}/${day}`, time };
  }

  function mapDurationToLocalDate(value, durationMs) {
    const baseMs = parseLocalDateTimeMs(value);
    const duration = toBigIntMs(durationMs);
    if (baseMs === null) return { ok: false, reason: 'invalid-anchor' };
    if (duration === null) return { ok: false, reason: 'invalid-duration' };

    const targetMs = BigInt(baseMs) + duration;
    if (targetMs > DATE_LIMIT_MS || targetMs < -DATE_LIMIT_MS) {
      return { ok: false, reason: 'date-out-of-range' };
    }

    const target = new Date(Number(targetMs));
    const parts = formatLocalDateParts(target);
    if (!parts) return { ok: false, reason: 'date-out-of-range' };
    return { ok: true, targetMs: targetMs.toString(), ...parts };
  }

  return Object.freeze({
    DATE_LIMIT_MS,
    normalizeAnchorValue,
    localTodayStartValue,
    formatAnchorLabel,
    parseLocalDateTimeMs,
    formatLocalDateParts,
    mapDurationToLocalDate
  });
});
