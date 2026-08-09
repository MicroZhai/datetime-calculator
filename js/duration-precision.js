(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DurationPrecision = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const FACTOR_MS = Object.freeze({
    d: 86400000n,
    h: 3600000n,
    m: 60000n,
    s: 1000n
  });
  const MAX_INPUT_DIGITS = 100;

  function toBigIntMs(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
      return BigInt(value);
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      try { return BigInt(value.trim()); } catch (_) { return null; }
    }
    return null;
  }

  function normalizeDecimalString(value) {
    let raw = String(value ?? '').trim();
    if (!raw || !/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
    let sign = '';
    if (raw.startsWith('-')) { sign = '-'; raw = raw.slice(1); }
    let [whole, fraction = ''] = raw.split('.');
    whole = whole.replace(/^0+(?=\d)/, '') || '0';
    fraction = fraction.replace(/0+$/, '');
    if (whole === '0' && !fraction) sign = '';
    return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
  }

  function digitCount(value) {
    const normalized = normalizeDecimalString(value);
    if (!normalized) return 0;
    return normalized.replace('-', '').replace('.', '').length;
  }

  function parseDecimalToMs(value, unit) {
    const factor = FACTOR_MS[unit];
    if (!factor) return { ok: false, error: '未知时间单位' };
    const normalized = normalizeDecimalString(value);
    if (!normalized) return { ok: false, error: '数字格式不正确' };
    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.slice(1) : normalized;
    const [whole, fraction = ''] = unsigned.split('.');
    const scale = 10n ** BigInt(fraction.length);
    const digits = BigInt(`${whole}${fraction}` || '0');
    const numerator = digits * factor;
    if (numerator % scale !== 0n) {
      return { ok: false, error: '当前数值无法精确到 1 毫秒' };
    }
    const result = numerator / scale;
    return { ok: true, value: negative ? -result : result, normalized };
  }

  function parseColonToMs(hours, minutes, seconds = 0) {
    const h = String(hours ?? '').trim();
    const m = String(minutes ?? '').trim();
    const s = String(seconds ?? '0').trim();
    if (!/^\d+$/.test(h)) return { ok: false, error: '小时需要是整数' };
    if (!/^\d{1,2}$/.test(m) || Number(m) > 59) return { ok: false, error: '分钟必须是 00～59' };
    if (!/^\d{1,2}$/.test(s) || Number(s) > 59) return { ok: false, error: '秒必须是 00～59' };
    return {
      ok: true,
      value: BigInt(h) * FACTOR_MS.h + BigInt(m) * FACTOR_MS.m + BigInt(s) * FACTOR_MS.s
    };
  }

  function formatMillisecondsAsSeconds(ms) {
    const x = toBigIntMs(ms);
    if (x === null) return '0';
    const negative = x < 0n;
    const abs = negative ? -x : x;
    const whole = abs / 1000n;
    const rem = abs % 1000n;
    const text = rem === 0n ? whole.toString() : `${whole}.${rem.toString().padStart(3, '0').replace(/0+$/, '')}`;
    return `${negative ? '-' : ''}${text}`;
  }

  function durationText(totalMs) {
    let value = toBigIntMs(totalMs);
    if (value === null) return '—';
    if (value === 0n) return '0分';
    const sign = value < 0n ? '-' : '';
    if (value < 0n) value = -value;
    const d = value / FACTOR_MS.d; value %= FACTOR_MS.d;
    const h = value / FACTOR_MS.h; value %= FACTOR_MS.h;
    const m = value / FACTOR_MS.m; value %= FACTOR_MS.m;
    const out = [];
    if (d) out.push(`${d}天`);
    if (h) out.push(`${h}小时`);
    if (m) out.push(`${m}分`);
    if (value || !out.length) out.push(`${formatMillisecondsAsSeconds(value)}秒`);
    return sign + out.join('');
  }

  function hms(totalMs) {
    let value = toBigIntMs(totalMs);
    if (value === null) return '—';
    const sign = value < 0n ? '-' : '';
    if (value < 0n) value = -value;
    const h = value / FACTOR_MS.h; value %= FACTOR_MS.h;
    const m = value / FACTOR_MS.m; value %= FACTOR_MS.m;
    const s = value / 1000n;
    const ms = value % 1000n;
    return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}${ms ? `.${ms.toString().padStart(3, '0')}` : ''}`;
  }

  function roundedRatioText(totalMs, divisor, decimals = 6) {
    let value = toBigIntMs(totalMs);
    const den = typeof divisor === 'bigint' ? divisor : BigInt(divisor);
    if (value === null || den <= 0n) return '—';
    const negative = value < 0n;
    if (negative) value = -value;
    const whole = value / den;
    const remainder = value % den;
    if (!remainder || decimals <= 0) {
      if (whole === 0n) return '0';
      return `${negative ? '-' : ''}${whole}`;
    }
    const scale = 10n ** BigInt(decimals);
    const scaledTen = (remainder * scale * 10n) / den;
    let fraction = scaledTen / 10n;
    if (scaledTen % 10n >= 5n) fraction += 1n;
    let adjustedWhole = whole;
    if (fraction >= scale) {
      adjustedWhole += 1n;
      fraction -= scale;
    }
    const fracText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
    if (adjustedWhole === 0n && !fracText) return '0';
    return `${negative ? '-' : ''}${adjustedWhole}${fracText ? `.${fracText}` : ''}`;
  }

  function millisecondsToParts(totalMs) {
    let value = toBigIntMs(totalMs);
    if (value === null) return [];
    if (value === 0n) return [{ kind: 'unit', unit: 'm', value: '0' }];
    const negative = value < 0n;
    if (negative) value = -value;
    const raw = [];
    const d = value / FACTOR_MS.d; value %= FACTOR_MS.d;
    const h = value / FACTOR_MS.h; value %= FACTOR_MS.h;
    const m = value / FACTOR_MS.m; value %= FACTOR_MS.m;
    if (d) raw.push({ kind: 'unit', unit: 'd', value: d.toString() });
    if (h) raw.push({ kind: 'unit', unit: 'h', value: h.toString() });
    if (m) raw.push({ kind: 'unit', unit: 'm', value: m.toString() });
    if (value) raw.push({ kind: 'unit', unit: 's', value: formatMillisecondsAsSeconds(value) });
    if (!raw.length) raw.push({ kind: 'unit', unit: 'm', value: '0' });
    // A row sums its parts. For a negative composite duration every non-zero part
    // must carry the sign; negating only the first part changes the represented value.
    if (negative) {
      raw.forEach(part => { part.value = `-${part.value}`; });
    }
    return raw;
  }

  // Lenient normalization is kept for trusted in-memory UI rows. It intentionally
  // preserves the legacy behavior used while rendering/editing existing runtime data.
  function normalizeStoredPart(part) {
    if (!part || typeof part !== 'object') return null;
    if (part.kind === 'unit' && FACTOR_MS[part.unit]) {
      const normalized = normalizeDecimalString(part.value);
      return normalized === null ? null : { kind: 'unit', unit: part.unit, value: normalized };
    }
    if (part.kind === 'colon') {
      const hours = String(part.hours ?? '0').replace(/^0+(?=\d)/, '') || '0';
      const minutes = String(part.minutes ?? '0').padStart(2, '0').slice(-2);
      const seconds = part.seconds === null || part.seconds === undefined ? null : String(part.seconds).padStart(2, '0').slice(-2);
      return { kind: 'colon', hours, minutes, seconds };
    }
    return null;
  }

  function normalizeStoredRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row, index) => ({
      op: index === 0 ? null : (row?.op === '-' ? '-' : '+'),
      parts: Array.isArray(row?.parts) ? row.parts.map(normalizeStoredPart).filter(Boolean) : []
    })).filter(row => row.parts.length);
  }

  // Persistence is stricter than editing. Stored rows are committed mathematical
  // truth, so malformed fields must never be repaired by truncation or part-dropping.
  function normalizeStoredPartStrict(part) {
    if (!part || typeof part !== 'object') return null;

    if (part.kind === 'unit' && FACTOR_MS[part.unit]) {
      const normalized = normalizeDecimalString(part.value);
      if (normalized === null || digitCount(normalized) > MAX_INPUT_DIGITS) return null;
      const parsed = parseDecimalToMs(normalized, part.unit);
      if (!parsed.ok) return null;
      return { kind: 'unit', unit: part.unit, value: normalized };
    }

    if (part.kind === 'colon') {
      const rawHours = String(part.hours ?? '').trim();
      const rawMinutes = String(part.minutes ?? '').trim();
      const hasSeconds = part.seconds !== null && part.seconds !== undefined;
      const rawSeconds = hasSeconds ? String(part.seconds).trim() : null;

      if (!/^\d+$/.test(rawHours) || rawHours.length > MAX_INPUT_DIGITS) return null;
      if (!/^\d{1,2}$/.test(rawMinutes) || Number(rawMinutes) > 59) return null;
      if (hasSeconds && (!/^\d{1,2}$/.test(rawSeconds) || Number(rawSeconds) > 59)) return null;

      const hours = rawHours.replace(/^0+(?=\d)/, '') || '0';
      const minutes = rawMinutes.padStart(2, '0');
      const seconds = hasSeconds ? rawSeconds.padStart(2, '0') : null;
      const parsed = parseColonToMs(hours, minutes, seconds ?? 0);
      if (!parsed.ok) return null;
      return { kind: 'colon', hours, minutes, seconds };
    }

    return null;
  }

  function normalizeStoredRowsStrict(rows) {
    if (!Array.isArray(rows)) return null;
    const normalizedRows = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row || typeof row !== 'object' || !Array.isArray(row.parts) || row.parts.length === 0) return null;

      let op = null;
      if (index === 0) {
        // A legacy leading + is semantically identical to no operator and is safe to migrate.
        if (!(row.op === null || row.op === undefined || row.op === '+')) return null;
      } else {
        if (row.op !== '+' && row.op !== '-') return null;
        op = row.op;
      }

      const parts = [];
      for (const part of row.parts) {
        const normalizedPart = normalizeStoredPartStrict(part);
        if (!normalizedPart) return null;
        parts.push(normalizedPart);
      }
      normalizedRows.push({ op, parts });
    }

    return normalizedRows;
  }

  function partToMs(part) {
    if (!part || typeof part !== 'object') return { ok: false, error: '时间片段格式不正确' };
    if (part.kind === 'unit') return parseDecimalToMs(part.value, part.unit);
    if (part.kind === 'colon') return parseColonToMs(part.hours, part.minutes, part.seconds ?? 0);
    return { ok: false, error: '时间片段格式不正确' };
  }

  function partsToMs(parts) {
    if (!Array.isArray(parts) || parts.length === 0) return { ok: false, error: '时间片段为空' };
    let total = 0n;
    for (const part of parts) {
      const parsed = partToMs(part);
      if (!parsed.ok) return parsed;
      total += parsed.value;
    }
    return { ok: true, value: total };
  }

  function evaluateRows(rows) {
    const normalizedRows = normalizeStoredRows(rows);
    if (!normalizedRows.length) return { ok: true, value: 0n };
    const first = partsToMs(normalizedRows[0].parts);
    if (!first.ok) return first;
    let total = first.value;
    for (let i = 1; i < normalizedRows.length; i += 1) {
      const next = partsToMs(normalizedRows[i].parts);
      if (!next.ok) return next;
      total = normalizedRows[i].op === '-' ? total - next.value : total + next.value;
    }
    return { ok: true, value: total };
  }

  return Object.freeze({
    FACTOR_MS,
    MAX_INPUT_DIGITS,
    toBigIntMs,
    normalizeDecimalString,
    digitCount,
    parseDecimalToMs,
    parseColonToMs,
    durationText,
    hms,
    roundedRatioText,
    millisecondsToParts,
    normalizeStoredRows,
    normalizeStoredRowsStrict,
    partToMs,
    partsToMs,
    evaluateRows
  });
});
