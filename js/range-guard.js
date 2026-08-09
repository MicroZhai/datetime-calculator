(() => {
  const unitLimitText = {
    d: '104,249,991 天',
    h: '2,501,999,792 小时',
    m: '150,119,987,579 分',
    s: '9,007,199,254,740 秒'
  };

  function unitRangeMessage(unit) {
    return `超出精确范围：最多约 ${unitLimitText[unit] || '当前安全上限'}`;
  }

  function resultRangeMessage() {
    return '计算结果超出精确范围（约 ±1.04 亿天）';
  }

  function valueFitsUnit(value, unit) {
    if (!Object.prototype.hasOwnProperty.call(factorMs, unit)) return true;
    const ms = Math.round(Number(value) * factorMs[unit]);
    return Number.isFinite(ms) && Number.isSafeInteger(ms) && Math.abs(ms) <= MAX_SAFE_MS;
  }

  function colonValueIsSafe(hours, minutes, seconds = 0) {
    const h = Number(hours);
    const m = Number(minutes);
    const s = Number(seconds || 0);
    if (![h, m, s].every(Number.isFinite)) return true;
    const ms = h * factorMs.h + m * factorMs.m + s * factorMs.s;
    return Number.isSafeInteger(ms) && Math.abs(ms) <= MAX_SAFE_MS;
  }

  const notifyBase = notify;
  notify = function(message) {
    if (message === '该时间值过大' || message === '当前时间过大') {
      return notifyBase('时长超出精确计算范围');
    }
    return notifyBase(message);
  };

  const setErrorBase = setError;
  setError = function(message = '') {
    if (message === '时间数值过大' || message === '当前时间过大' || message === '当前输入超出安全范围') {
      return setErrorBase('时长超出精确计算范围');
    }
    if (message === '计算结果超出安全范围') {
      return setErrorBase(resultRangeMessage());
    }
    return setErrorBase(message);
  };

  function showUnitRangeError(unit) {
    const message = unitRangeMessage(unit);
    setError(message);
    notify(message);
  }

  const evaluateRowsBase = evaluateRows;
  evaluateRows = function(includeCurrent = true) {
    const result = evaluateRowsBase(includeCurrent);
    if (result.ok) return result;
    if (result.error === '时间数值过大') {
      return { ...result, error: '时长超出精确计算范围' };
    }
    if (result.error === '计算结果超出安全范围') {
      return { ...result, error: resultRangeMessage() };
    }
    return result;
  };

  const commitUnitBase = commitUnit;
  commitUnit = function(unit) {
    let raw = null;
    if (partEdit?.kind === 'unit') {
      raw = partEdit.buffer;
    } else if (!colonMode && numberBuffer) {
      raw = numberBuffer.endsWith('.') ? numberBuffer.slice(0, -1) : numberBuffer;
    }

    if (raw !== null && raw !== '' && raw !== '.' && raw !== '-.') {
      const value = Number(raw);
      if (Number.isFinite(value) && !valueFitsUnit(value, unit)) {
        showUnitRangeError(unit);
        return;
      }
    }

    return commitUnitBase(unit);
  };

  const commitPartEditBase = commitPartEdit;
  commitPartEdit = function() {
    if (partEdit?.kind === 'unit') {
      const value = Number(partEdit.buffer);
      if (Number.isFinite(value) && !valueFitsUnit(value, partEdit.unit)) {
        showUnitRangeError(partEdit.unit);
        return false;
      }
    }

    if (partEdit?.kind === 'colon') {
      const minutesValid = /^\d{2}$/.test(partEdit.minutes) && Number(partEdit.minutes) <= 59;
      const secondsValid = !partEdit.hasSeconds ||
        (/^\d{2}$/.test(partEdit.seconds) && Number(partEdit.seconds) <= 59);
      if (/^\d+$/.test(partEdit.hours) && minutesValid && secondsValid &&
          !colonValueIsSafe(partEdit.hours, partEdit.minutes, partEdit.hasSeconds ? partEdit.seconds : 0)) {
        showUnitRangeError('h');
        return false;
      }
    }

    return commitPartEditBase();
  };

  const finishColonBase = finishColon;
  finishColon = function() {
    if (colonMode && colonComplete() &&
        !colonValueIsSafe(colonHours, colonMinutes, colonStage === 'second' ? colonSeconds : 0)) {
      showUnitRangeError('h');
      return false;
    }
    return finishColonBase();
  };

  const renderNormalizedBase = renderNormalized;
  renderNormalized = function() {
    renderNormalizedBase();
    if (normalizedEl.textContent.trim() === '当前输入超出安全范围') {
      normalizedEl.innerHTML = '<strong>当前时长超出精确计算范围</strong>';
    }
  };

  const renderBase = render;
  render = function() {
    renderBase();

    if (secondaryEl.textContent.trim() === '超出安全范围') {
      secondaryEl.textContent = '超出精确范围';
    }

    const calendarResult = document.querySelector('.calendar-result');
    if (calendarResult && !calendarResult.hidden && calendarResult.textContent.trim() === '日期超出范围') {
      calendarResult.textContent = '结束日期超出范围';
      calendarResult.title = '时长仍可计算，但具体结束日期超出浏览器可表示范围';
      calendarResult.setAttribute(
        'aria-label',
        '时长仍可计算，但具体结束日期超出浏览器可表示范围'
      );
    }
  };

  render();
})();
