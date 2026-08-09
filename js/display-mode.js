(() => {
  let hourDisplayMode = 'decimal';
  const formatButtons = [...document.querySelectorAll('.format-option')];
  const hourButton = document.querySelector('.format-option[data-format="1"]');

  function isHourIdleState() {
    return formatIndex === 1 && !partEdit && selectedRow === null && !colonMode &&
      numberBuffer === '' && currentParts.length === 0 && currentOp === null;
  }

  function hourModeLabel() {
    return hourDisplayMode === 'sexagesimal' ? '60进制' : '十进制';
  }

  const formatResultBase = formatResult;
  formatResult = function(totalMs) {
    if (formatIndex === 1 && hourDisplayMode === 'sexagesimal') return hms(totalMs);
    return formatResultBase(totalMs);
  };

  function syncHourMode() {
    if (hourButton) {
      hourButton.dataset.hourMode = hourDisplayMode;
      if (formatIndex === 1) {
        hourButton.title = `小时 · ${hourModeLabel()}，再次点击切换`;
        hourButton.setAttribute('aria-label', `小时显示，当前${hourModeLabel()}，再次点击切换`);
      } else {
        hourButton.title = '小时 · 默认十进制';
        hourButton.setAttribute('aria-label', '切换到小时显示，默认十进制');
      }
    }

    if (formatIndex !== 1) return;
    const evaluated = evaluateRows(true);
    if (!evaluated.ok) return;

    if (hourDisplayMode === 'sexagesimal') {
      secondaryEl.textContent = `${trim(evaluated.value / factorMs.h, 6)}小时`;
    } else {
      secondaryEl.textContent = hms(evaluated.value);
    }

    if (isHourIdleState()) {
      badge.textContent = `小时 · ${hourModeLabel()}`;
      badge.className = 'badge';
    }
  }

  const renderBase = render;
  render = function() {
    renderBase();
    syncHourMode();
  };

  formatButtons.forEach((button, index) => {
    button.onclick = () => {
      if (index === 1) {
        if (formatIndex === 1) {
          hourDisplayMode = hourDisplayMode === 'decimal' ? 'sexagesimal' : 'decimal';
        } else {
          formatIndex = 1;
          hourDisplayMode = 'decimal';
        }
      } else {
        formatIndex = index;
      }
      render();
    };
  });

  const snapshotCalculatorBase = snapshotCalculator;
  snapshotCalculator = function() {
    return { ...snapshotCalculatorBase(), hourDisplayMode };
  };

  const restoreCalculatorBase = restoreCalculator;
  restoreCalculator = function(snapshot) {
    hourDisplayMode = snapshot?.hourDisplayMode === 'sexagesimal' ? 'sexagesimal' : 'decimal';
    restoreCalculatorBase(snapshot);
  };

  const clearAllBase = clearAll;
  clearAll = function(show = true) {
    hourDisplayMode = 'decimal';
    clearAllBase(show);
  };

  render();
})();
