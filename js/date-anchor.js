(() => {
  let anchorDateTime = null;
  const DATE_LIMIT_MS = 8640000000000000n;

  let dateKey = document.querySelector('[data-action="date-toggle"], [data-action="date-now"]');
  const dayKey = document.querySelector('.k-day');
  if (!dateKey && dayKey) {
    dateKey = document.createElement('button');
    dateKey.type = 'button';
    dateKey.className = 'key date-key k-date';
    dateKey.dataset.action = 'date-toggle';
    dateKey.textContent = '日期';
    dateKey.setAttribute('aria-label', '添加今天零点作为日期起点');
    dateKey.setAttribute('aria-pressed', 'false');
    dayKey.insertAdjacentElement('beforebegin', dateKey);
  }

  const statusRow = document.querySelector('.status-row');
  const anchorButton = document.createElement('button');
  anchorButton.type = 'button';
  anchorButton.className = 'date-anchor';
  anchorButton.dataset.anchorDate = 'true';
  anchorButton.hidden = true;
  statusRow.insertBefore(anchorButton, badge);

  const anchorLabel = document.createElement('span');
  anchorLabel.className = 'date-anchor-label';
  anchorLabel.textContent = '日期';
  const anchorValue = document.createElement('span');
  anchorValue.className = 'date-anchor-value';
  anchorButton.append(anchorLabel, anchorValue);

  const resultGroup = document.querySelector('.result-group');
  const dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  dateInput.step = '60';
  dateInput.className = 'anchor-date-input';
  dateInput.tabIndex = -1;
  dateInput.setAttribute('aria-hidden', 'true');
  document.body.appendChild(dateInput);

  const resultMainRow = document.createElement('div');
  resultMainRow.className = 'result-main-row';
  const calendarResult = document.createElement('div');
  calendarResult.className = 'calendar-result';
  calendarResult.hidden = true;
  resultGroup.insertBefore(resultMainRow, resultEl);
  resultMainRow.append(calendarResult, resultEl);

  function localTodayStartValue() {
    const now = new Date();
    return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00`;
  }

  function normalizeAnchorValue(value) {
    if (typeof value !== 'string' || !value) return null;
    if (/^\d{4,}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
    const match = value.match(/^(\d{4,}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    return match ? `${match[1]}T${match[2]}:${match[3]}` : null;
  }

  function formatAnchorLabel(value) {
    const normalized = normalizeAnchorValue(value);
    if (!normalized) return '';
    const [date, time] = normalized.split('T');
    return `${date.replaceAll('-', '/')} ${time}`;
  }

  function parseAnchorDateTime(value) {
    const normalized = normalizeAnchorValue(value);
    if (!normalized) return null;
    const [datePart, timePart] = normalized.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const probe = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(probe.getTime())) return null;
    if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day || probe.getHours() !== hour || probe.getMinutes() !== minute) return null;
    return probe.getTime();
  }

  function targetDateParts(value, durationMs) {
    const baseMs = parseAnchorDateTime(value);
    const duration = DurationPrecision.toBigIntMs(durationMs);
    if (baseMs === null || duration === null) return null;
    const targetMs = BigInt(baseMs) + duration;
    if (targetMs > DATE_LIMIT_MS || targetMs < -DATE_LIMIT_MS) return null;
    const target = new Date(Number(targetMs));
    if (Number.isNaN(target.getTime())) return null;

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

  function currentRecordAnchor(record) {
    if (!record) return null;
    return normalizeAnchorValue(record.anchorDateTime || record.anchorDate || null);
  }

  function renderDateAnchor() {
    const active = Boolean(anchorDateTime);
    if (dateKey) {
      dateKey.classList.toggle('active', active);
      dateKey.setAttribute('aria-pressed', String(active));
      dateKey.title = active ? '取消日期' : '添加今天 00:00';
      dateKey.setAttribute('aria-label', active ? '取消日期' : '添加今天零点作为日期起点');
    }
    anchorButton.hidden = !active;
    anchorButton.classList.toggle('has-date', active);
    if (!active) { anchorValue.textContent = ''; return; }
    const labelText = formatAnchorLabel(anchorDateTime);
    anchorValue.textContent = labelText;
    anchorButton.title = '修改日期时间';
    anchorButton.setAttribute('aria-label', `日期 ${labelText}，点击修改`);
  }

  function renderDateResult() {
    if (!anchorDateTime) {
      calendarResult.hidden = true;calendarResult.textContent = '';resultMainRow.classList.remove('has-calendar-result');return;
    }
    const evaluated = evaluateRows(true);
    if (!evaluated.ok) {
      calendarResult.hidden = true;calendarResult.textContent = '';resultMainRow.classList.remove('has-calendar-result');return;
    }
    const target = targetDateParts(anchorDateTime, evaluated.value);
    calendarResult.hidden = false;
    resultMainRow.classList.add('has-calendar-result');
    if (!target) {
      calendarResult.textContent = '结束日期超出范围';
      calendarResult.title = '时长仍可精确计算，但结束日期超出浏览器可表示范围';
      calendarResult.setAttribute('aria-label','时长仍可精确计算，但结束日期超出浏览器可表示范围');
      return;
    }
    calendarResult.textContent = `${target.date} ${target.time}`;
    calendarResult.title = '';
    calendarResult.setAttribute('aria-label', `结束时间 ${target.date} ${target.time}`);
  }

  function syncDateHint() {
    if (!anchorDateTime) return;
    if (partEdit || selectedRow !== null || colonMode || numberBuffer || currentParts.length || currentOp !== null) return;
    badge.textContent = '点击左侧可修改';badge.className = 'badge';
  }
  function setAnchorToTodayStart() {anchorDateTime = localTodayStartValue();setError('');render()}
  function toggleAnchorDate() {
    if (anchorDateTime) {anchorDateTime = null;setError('');render();return}
    setAnchorToTodayStart();
  }
  function openDatePicker() {
    if (!anchorDateTime) return;
    dateInput.value = anchorDateTime;
    requestAnimationFrame(() => {
      try {if (typeof dateInput.showPicker === 'function') dateInput.showPicker();else dateInput.click()}
      catch (_) {dateInput.focus({ preventScroll: true });dateInput.click()}
    });
  }

  function expressionSignatureWithDate(snapshot) {
    return JSON.stringify({anchorDateTime: anchorDateTime || null,rows: JSON.parse(rowsSignature(snapshot))});
  }

  const renderBase = render;
  render = function() {renderBase();renderDateAnchor();renderDateResult();syncDateHint()};

  saveHistoryRecord = function(resultMs) {
    if (!rows.length) return;
    const snapshot = clone(rows);
    const sig = expressionSignatureWithDate(snapshot);
    historyRecords = historyRecords.filter(record => record.signature !== sig);
    historyRecords.unshift({
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),signature: sig,rows: snapshot,
      resultMs: DurationPrecision.toBigIntMs(resultMs)?.toString() || '0',
      anchorDateTime: anchorDateTime || null
    });
    if (historyRecords.length > HISTORY_LIMIT) historyRecords.length = HISTORY_LIMIT;
    persistHistory();
  };

  const restoreHistoryBase = restoreHistory;
  restoreHistory = function(index) {const record = historyRecords[index];anchorDateTime = currentRecordAnchor(record);restoreHistoryBase(index)};

  const renderHistoryBase = renderHistory;
  renderHistory = function() {
    renderHistoryBase();
    historyRecords.forEach((record, index) => {
      const recordAnchor = currentRecordAnchor(record);if (!recordAnchor) return;
      const item = historyList.querySelector(`[data-history-index="${index}"]`);
      const firstRow = item?.querySelector('.history-row');if (!item || !firstRow) return;
      firstRow.classList.add('has-anchor');
      const anchor = document.createElement('span');anchor.className = 'history-anchor';anchor.textContent = formatAnchorLabel(recordAnchor);anchor.title = formatAnchorLabel(recordAnchor);firstRow.insertBefore(anchor, firstRow.firstChild);
      const target = targetDateParts(recordAnchor, record.resultMs);
      if (target) {const result = item.querySelector('.history-result');if (result) result.title = `结束时间 ${target.date} ${target.time}`}
      const existingLabel = item.getAttribute('aria-label') || '历史记录';
      item.setAttribute('aria-label', `日期 ${formatAnchorLabel(recordAnchor)}，${existingLabel}`);
    });
  };

  const clearAllBase = clearAll;
  clearAll = function(show = true) {anchorDateTime = null;clearAllBase(show)};
  const snapshotCalculatorBase = snapshotCalculator;
  snapshotCalculator = function() {return { ...snapshotCalculatorBase(), anchorDateTime }};
  const restoreCalculatorBase = restoreCalculator;
  restoreCalculator = function(snapshot) {anchorDateTime = normalizeAnchorValue(snapshot?.anchorDateTime || snapshot?.anchorDate || null);restoreCalculatorBase(snapshot)};
  const hasCalculatorContentBase = hasCalculatorContent;
  hasCalculatorContent = function() {return Boolean(anchorDateTime) || hasCalculatorContentBase()};

  if (dateKey) dateKey.addEventListener('click', toggleAnchorDate);
  anchorButton.addEventListener('click', openDatePicker);
  dateInput.addEventListener('change', () => {anchorDateTime = normalizeAnchorValue(dateInput.value);setError('');render()});
  render();
})();
