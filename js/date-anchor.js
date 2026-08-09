(() => {
  let anchorDateTime = null;

  let dateKey = document.querySelector('[data-action="date-now"]');
  const dayKey = document.querySelector('.k-day');
  if (!dateKey && dayKey) {
    dateKey = document.createElement('button');
    dateKey.type = 'button';
    dateKey.className = 'key date-key k-date';
    dateKey.dataset.action = 'date-now';
    dateKey.textContent = '日期';
    dateKey.setAttribute('aria-label', '使用当前时间作为基准');
    dateKey.setAttribute('aria-pressed', 'false');
    dayKey.insertAdjacentElement('beforebegin', dateKey);
  }

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

  const removeDateBtn = document.createElement('button');
  removeDateBtn.type = 'button';
  removeDateBtn.className = 'small-btn danger date-remove-btn';
  removeDateBtn.textContent = '移除日期';
  removeDateBtn.hidden = true;
  const doneRowBtn = document.getElementById('doneRowBtn');
  rowActions.insertBefore(removeDateBtn, doneRowBtn);

  function localNowValue() {
    const now = new Date();
    return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
    if (baseMs === null || !Number.isFinite(durationMs)) return null;
    const target = new Date(baseMs + durationMs);
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
    if (dateKey) {
      dateKey.classList.toggle('active', Boolean(anchorDateTime));
      dateKey.setAttribute('aria-pressed', String(Boolean(anchorDateTime)));
      dateKey.title = anchorDateTime ? '重新设为当前时间' : '使用当前时间作为基准';
    }

    if (!anchorDateTime) return;
    const firstLine = expressionEl.querySelector('.expr-line');
    if (!firstLine) return;
    const lineValue = firstLine.querySelector('.line-value');
    if (!lineValue) return;

    lineValue.classList.add('has-date-anchor');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'date-anchor has-date';
    button.dataset.anchorDate = 'true';
    button.textContent = formatAnchorLabel(anchorDateTime);
    button.title = '修改基准时间';
    button.setAttribute('aria-label', `基准时间 ${formatAnchorLabel(anchorDateTime)}，点击修改`);
    lineValue.insertBefore(button, lineValue.firstChild);
  }

  function renderDateResult() {
    if (!anchorDateTime) {
      calendarResult.hidden = true;
      calendarResult.textContent = '';
      resultMainRow.classList.remove('has-calendar-result');
      return;
    }

    const evaluated = evaluateRows(true);
    if (!evaluated.ok) {
      calendarResult.hidden = true;
      calendarResult.textContent = '';
      resultMainRow.classList.remove('has-calendar-result');
      return;
    }

    const target = targetDateParts(anchorDateTime, evaluated.value);
    calendarResult.hidden = false;
    resultMainRow.classList.add('has-calendar-result');

    if (!target) {
      calendarResult.textContent = '日期超出范围';
      return;
    }

    calendarResult.textContent = `${target.date} ${target.time}`;
    calendarResult.setAttribute('aria-label', `结束时间 ${target.date} ${target.time}`);
  }

  function syncDateRowAction() {
    removeDateBtn.hidden = !(anchorDateTime && selectedRow === 0);
  }

  function syncDateHint() {
    if (!anchorDateTime) return;
    if (partEdit || selectedRow !== null || colonMode || numberBuffer || currentOp !== null) return;
    badge.textContent = '基准时间 · 点击左侧时间可修改';
    badge.className = 'badge';
  }

  function setAnchorToNow() {
    anchorDateTime = localNowValue();
    setError('');
    render();
  }

  function openDatePicker() {
    if (!anchorDateTime) return;
    dateInput.value = anchorDateTime;
    requestAnimationFrame(() => {
      try {
        if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
        else dateInput.click();
      } catch (_) {
        dateInput.focus({ preventScroll: true });
        dateInput.click();
      }
    });
  }

  function removeAnchorDateWithUndo() {
    if (!anchorDateTime) return;
    const previous = anchorDateTime;
    anchorDateTime = null;
    selectedRow = null;
    render();
    showUndo('已移除基准时间', () => {
      anchorDateTime = previous;
      render();
    });
  }

  function expressionSignatureWithDate(snapshot) {
    return JSON.stringify({
      anchorDateTime: anchorDateTime || null,
      rows: JSON.parse(rowsSignature(snapshot))
    });
  }

  const renderBase = render;
  render = function() {
    renderBase();
    renderDateAnchor();
    renderDateResult();
    syncDateRowAction();
    syncDateHint();
  };

  saveHistoryRecord = function(resultMs) {
    if (!rows.length) return;
    const snapshot = clone(rows);
    const sig = expressionSignatureWithDate(snapshot);

    historyRecords = historyRecords.filter(record => record.signature !== sig);
    historyRecords.unshift({
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      signature: sig,
      rows: snapshot,
      resultMs,
      anchorDateTime: anchorDateTime || null
    });
    if (historyRecords.length > HISTORY_LIMIT) historyRecords.length = HISTORY_LIMIT;
    persistHistory();
  };

  const restoreHistoryBase = restoreHistory;
  restoreHistory = function(index) {
    const record = historyRecords[index];
    anchorDateTime = currentRecordAnchor(record);
    restoreHistoryBase(index);
  };

  const renderHistoryBase = renderHistory;
  renderHistory = function() {
    renderHistoryBase();
    historyRecords.forEach((record, index) => {
      const recordAnchor = currentRecordAnchor(record);
      if (!recordAnchor) return;
      const item = historyList.querySelector(`[data-history-index="${index}"]`);
      const firstRow = item?.querySelector('.history-row');
      if (!item || !firstRow) return;

      firstRow.classList.add('has-anchor');
      const anchor = document.createElement('span');
      anchor.className = 'history-anchor';
      anchor.textContent = formatAnchorLabel(recordAnchor);
      anchor.title = formatAnchorLabel(recordAnchor);
      firstRow.insertBefore(anchor, firstRow.firstChild);

      const target = targetDateParts(recordAnchor, Number(record.resultMs));
      if (target) {
        const result = item.querySelector('.history-result');
        if (result) result.title = `结束时间 ${target.date} ${target.time}`;
      }

      const existingLabel = item.getAttribute('aria-label') || '历史记录';
      item.setAttribute('aria-label', `基准时间 ${formatAnchorLabel(recordAnchor)}，${existingLabel}`);
    });
  };

  const clearAllBase = clearAll;
  clearAll = function(show = true) {
    anchorDateTime = null;
    clearAllBase(show);
  };

  const snapshotCalculatorBase = snapshotCalculator;
  snapshotCalculator = function() {
    return { ...snapshotCalculatorBase(), anchorDateTime };
  };

  const restoreCalculatorBase = restoreCalculator;
  restoreCalculator = function(snapshot) {
    anchorDateTime = normalizeAnchorValue(snapshot?.anchorDateTime || snapshot?.anchorDate || null);
    restoreCalculatorBase(snapshot);
  };

  const hasCalculatorContentBase = hasCalculatorContent;
  hasCalculatorContent = function() {
    return Boolean(anchorDateTime) || hasCalculatorContentBase();
  };

  if (dateKey) dateKey.addEventListener('click', setAnchorToNow);

  expressionEl.addEventListener('click', event => {
    const button = event.target.closest('[data-anchor-date]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openDatePicker();
  }, true);

  dateInput.addEventListener('change', () => {
    anchorDateTime = normalizeAnchorValue(dateInput.value);
    setError('');
    render();
  });

  removeDateBtn.addEventListener('click', removeAnchorDateWithUndo);

  render();
})();