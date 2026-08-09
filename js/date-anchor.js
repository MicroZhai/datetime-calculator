(() => {
  let anchorDateTime = null;

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

  function currentRecordAnchor(record) {
    return HistoryStore.recordAnchor(record);
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
    if (!active) {
      anchorValue.textContent = '';
      return;
    }

    const labelText = DateMapper.formatAnchorLabel(anchorDateTime);
    anchorValue.textContent = labelText;
    anchorButton.title = '修改日期时间';
    anchorButton.setAttribute('aria-label', `日期 ${labelText}，点击修改`);
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

    const mapped = DateMapper.mapDurationToLocalDate(anchorDateTime, evaluated.value);
    calendarResult.hidden = false;
    resultMainRow.classList.add('has-calendar-result');

    if (!mapped.ok) {
      calendarResult.textContent = mapped.reason === 'date-out-of-range' ? '结束日期超出范围' : '日期不可用';
      calendarResult.title = mapped.reason === 'date-out-of-range'
        ? '时长仍可精确计算，但结束日期超出浏览器可表示范围'
        : '日期输入无法映射为有效结束时间';
      calendarResult.setAttribute('aria-label', calendarResult.title);
      return;
    }

    calendarResult.textContent = `${mapped.date} ${mapped.time}`;
    calendarResult.title = '';
    calendarResult.setAttribute('aria-label', `结束时间 ${mapped.date} ${mapped.time}`);
  }

  function syncDateHint() {
    if (!anchorDateTime) return;
    if (partEdit || selectedRow !== null || colonMode || numberBuffer || currentParts.length || currentOp !== null) return;
    badge.textContent = '点击左侧可修改';
    badge.className = 'badge';
  }

  function setAnchorToTodayStart() {
    anchorDateTime = DateMapper.localTodayStartValue();
    setError('');
    render();
  }

  function toggleAnchorDate() {
    if (anchorDateTime) {
      anchorDateTime = null;
      setError('');
      render();
      return;
    }
    setAnchorToTodayStart();
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

  // Date is history context, not a second history implementation.
  historyContextProvider = () => ({ anchorDateTime: anchorDateTime || null });

  const renderBase = render;
  render = function() {
    renderBase();
    renderDateAnchor();
    renderDateResult();
    syncDateHint();
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
      anchor.textContent = DateMapper.formatAnchorLabel(recordAnchor);
      anchor.title = DateMapper.formatAnchorLabel(recordAnchor);
      firstRow.insertBefore(anchor, firstRow.firstChild);

      const mapped = DateMapper.mapDurationToLocalDate(recordAnchor, record.resultMs);
      if (mapped.ok) {
        const result = item.querySelector('.history-result');
        if (result) result.title = `结束时间 ${mapped.date} ${mapped.time}`;
      }

      const existingLabel = item.getAttribute('aria-label') || '历史记录';
      item.setAttribute('aria-label', `日期 ${DateMapper.formatAnchorLabel(recordAnchor)}，${existingLabel}`);
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
    anchorDateTime = DateMapper.normalizeAnchorValue(snapshot?.anchorDateTime || snapshot?.anchorDate || null);
    restoreCalculatorBase(snapshot);
  };

  const hasCalculatorContentBase = hasCalculatorContent;
  hasCalculatorContent = function() {
    return Boolean(anchorDateTime) || hasCalculatorContentBase();
  };

  if (dateKey) dateKey.addEventListener('click', toggleAnchorDate);
  anchorButton.addEventListener('click', openDatePicker);

  dateInput.addEventListener('change', () => {
    anchorDateTime = DateMapper.normalizeAnchorValue(dateInput.value);
    setError('');
    render();
  });

  render();
})();