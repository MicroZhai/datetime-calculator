(() => {
  let anchorDate = null;

  const resultGroup = document.querySelector('.result-group');
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
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

  function localTodayIso() {
    const now = new Date();
    return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function formatAnchorLabel(iso) {
    return iso ? iso.replaceAll('-', '/') : '';
  }

  function parseAnchorDate(iso) {
    if (!/^\d{4,}-\d{2}-\d{2}$/.test(iso || '')) return null;
    const [year, month, day] = iso.split('-').map(Number);
    const baseMs = Date.UTC(year, month - 1, day);
    const probe = new Date(baseMs);
    if (Number.isNaN(probe.getTime())) return null;
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
    return baseMs;
  }

  function targetDateParts(iso, durationMs) {
    const baseMs = parseAnchorDate(iso);
    if (baseMs === null || !Number.isFinite(durationMs)) return null;
    const target = new Date(baseMs + durationMs);
    if (Number.isNaN(target.getTime())) return null;

    const year = String(target.getUTCFullYear()).padStart(4, '0');
    const month = String(target.getUTCMonth() + 1).padStart(2, '0');
    const day = String(target.getUTCDate()).padStart(2, '0');
    const hour = String(target.getUTCHours()).padStart(2, '0');
    const minute = String(target.getUTCMinutes()).padStart(2, '0');
    const second = String(target.getUTCSeconds()).padStart(2, '0');
    const millisecond = target.getUTCMilliseconds();

    let time = `${hour}:${minute}`;
    if (target.getUTCSeconds() || millisecond) time += `:${second}`;
    if (millisecond) time += `.${String(millisecond).padStart(3, '0')}`;

    return { date: `${year}/${month}/${day}`, time };
  }

  function renderDateAnchor() {
    const firstLine = expressionEl.querySelector('.expr-line');
    if (!firstLine) return;
    const lineValue = firstLine.querySelector('.line-value');
    if (!lineValue) return;

    lineValue.classList.add('has-date-anchor');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `date-anchor${anchorDate ? ' has-date' : ' add-date'}`;
    button.dataset.anchorDate = 'true';
    button.textContent = anchorDate ? formatAnchorLabel(anchorDate) : '+ 日期';
    button.setAttribute('aria-label', anchorDate ? `基准日期 ${formatAnchorLabel(anchorDate)}，点击修改` : '添加基准日期，默认今天');
    lineValue.insertBefore(button, lineValue.firstChild);
  }

  function renderDateResult() {
    if (!anchorDate) {
      calendarResult.hidden = true;
      calendarResult.replaceChildren();
      resultMainRow.classList.remove('has-calendar-result');
      return;
    }

    const evaluated = evaluateRows(true);
    if (!evaluated.ok) {
      calendarResult.hidden = true;
      calendarResult.replaceChildren();
      resultMainRow.classList.remove('has-calendar-result');
      return;
    }

    const target = targetDateParts(anchorDate, evaluated.value);
    calendarResult.hidden = false;
    resultMainRow.classList.add('has-calendar-result');

    if (!target) {
      calendarResult.textContent = '日期超出范围';
      return;
    }

    const dateLine = document.createElement('span');
    dateLine.textContent = target.date;
    const timeLine = document.createElement('span');
    timeLine.textContent = target.time;
    calendarResult.replaceChildren(dateLine, timeLine);
    calendarResult.setAttribute('aria-label', `落点时间 ${target.date} ${target.time}`);
  }

  function syncDateRowAction() {
    removeDateBtn.hidden = !(anchorDate && selectedRow === 0);
  }

  function openDatePicker() {
    if (!anchorDate) {
      anchorDate = localTodayIso();
      justEvaluated = false;
      render();
    }

    dateInput.value = anchorDate;
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
    if (!anchorDate) return;
    const previous = anchorDate;
    anchorDate = null;
    justEvaluated = false;
    selectedRow = null;
    render();
    showUndo('已移除基准日期', () => {
      anchorDate = previous;
      render();
    });
  }

  function expressionSignatureWithDate(snapshot) {
    return JSON.stringify({
      anchorDate: anchorDate || null,
      rows: JSON.parse(rowsSignature(snapshot))
    });
  }

  const renderBase = render;
  render = function() {
    renderBase();
    renderDateAnchor();
    renderDateResult();
    syncDateRowAction();
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
      anchorDate: anchorDate || null
    });
    if (historyRecords.length > HISTORY_LIMIT) historyRecords.length = HISTORY_LIMIT;
    persistHistory();
  };

  const restoreHistoryBase = restoreHistory;
  restoreHistory = function(index) {
    const record = historyRecords[index];
    anchorDate = record && typeof record.anchorDate === 'string' ? record.anchorDate : null;
    restoreHistoryBase(index);
  };

  const renderHistoryBase = renderHistory;
  renderHistory = function() {
    renderHistoryBase();
    historyRecords.forEach((record, index) => {
      if (!record.anchorDate) return;
      const item = historyList.querySelector(`[data-history-index="${index}"]`);
      const firstRow = item?.querySelector('.history-row');
      if (!item || !firstRow) return;

      firstRow.classList.add('has-anchor');
      const anchor = document.createElement('span');
      anchor.className = 'history-anchor';
      anchor.textContent = formatAnchorLabel(record.anchorDate);
      firstRow.insertBefore(anchor, firstRow.firstChild);

      const target = targetDateParts(record.anchorDate, Number(record.resultMs));
      if (target) {
        const result = item.querySelector('.history-result');
        if (result) result.title = `落点 ${target.date} ${target.time}`;
      }

      const existingLabel = item.getAttribute('aria-label') || '历史记录';
      item.setAttribute('aria-label', `基准日期 ${formatAnchorLabel(record.anchorDate)}，${existingLabel}`);
    });
  };

  const clearAllBase = clearAll;
  clearAll = function(show = true) {
    anchorDate = null;
    clearAllBase(show);
  };

  const snapshotCalculatorBase = snapshotCalculator;
  snapshotCalculator = function() {
    return { ...snapshotCalculatorBase(), anchorDate };
  };

  const restoreCalculatorBase = restoreCalculator;
  restoreCalculator = function(snapshot) {
    anchorDate = snapshot?.anchorDate || null;
    restoreCalculatorBase(snapshot);
  };

  const hasCalculatorContentBase = hasCalculatorContent;
  hasCalculatorContent = function() {
    return Boolean(anchorDate) || hasCalculatorContentBase();
  };

  expressionEl.addEventListener('click', event => {
    const button = event.target.closest('[data-anchor-date]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openDatePicker();
  }, true);

  dateInput.addEventListener('change', () => {
    anchorDate = dateInput.value || null;
    justEvaluated = false;
    setError('');
    render();
  });

  removeDateBtn.addEventListener('click', removeAnchorDateWithUndo);

  render();
})();
