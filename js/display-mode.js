(() => {
  const HOUR_MODE_KEY = 'dtc-hour-display-mode';
  let hourDisplayMode = (() => {
    try {
      return localStorage.getItem(HOUR_MODE_KEY) === 'sexagesimal' ? 'sexagesimal' : 'decimal';
    } catch { return 'decimal'; }
  })();
  let fitFrame = 0;
  const formatTrigger = document.getElementById('formatTrigger');
  const formatTriggerLabel = document.getElementById('formatTriggerLabel');


  function syncFormatControl() {
    if (!formatTrigger) return;
    const labels = ['天', '时', '分'];
    const label = labels[formatIndex] || labels[0];
    if (formatTriggerLabel) {
      formatTriggerLabel.textContent = label;
      formatTriggerLabel.classList.add('active');
    }
    formatTrigger.dataset.format = String(formatIndex);
    formatTrigger.title = `切换结果显示方式，当前${label}`;
    formatTrigger.setAttribute('aria-label', `切换结果显示方式，当前${label}`);
  }

  formatTrigger?.addEventListener('click', () => {
    formatIndex = (formatIndex + 1) % 3;
    render();
  });

  function persistHourMode() {
    try { localStorage.setItem(HOUR_MODE_KEY, hourDisplayMode); } catch {}
  }

  function isHourIdleState() {
    return formatIndex === 1 && !partEdit && selectedRow === null && !colonMode &&
      numberBuffer === '' && currentParts.length === 0 && currentOp === null;
  }
  function hourModeLabel() {return hourDisplayMode === 'sexagesimal' ? '60进制' : '十进制'}

  const formatResultBase = formatResult;
  formatResult = function(totalMs) {
    if (formatIndex === 1 && hourDisplayMode === 'sexagesimal') return hms(totalMs);
    return formatResultBase(totalMs);
  };

  function syncHourMode() {
    if (formatIndex !== 1) return;
    const evaluated = evaluateRows(true);if (!evaluated.ok) return;
    if (hourDisplayMode === 'sexagesimal') {
      secondaryEl.textContent = `${DurationPrecision.roundedRatioText(evaluated.value, factorMs.h, 6)}小时`;
    } else {
      secondaryEl.textContent = hms(evaluated.value);
    }
    if (isHourIdleState()) {badge.textContent = `小时 · ${hourModeLabel()}`;badge.className = 'badge'}
  }

  function fitPrimaryResult() {
    cancelAnimationFrame(fitFrame);
    resultEl.style.fontSize = '';
    resultEl.removeAttribute('title');
    resultEl.classList.remove('result-scrollable');
    fitFrame = requestAnimationFrame(() => {
      const width = resultEl.clientWidth;if (!width) return;
      const computed = Number.parseFloat(getComputedStyle(resultEl).fontSize) || 38;
      const minSize = window.innerWidth < 360 ? 21 : 23;
      let size = computed;resultEl.style.fontSize = `${size}px`;
      while (size > minSize && resultEl.scrollWidth > resultEl.clientWidth + 1) {size -= 1;resultEl.style.fontSize = `${size}px`}
      if (resultEl.scrollWidth > resultEl.clientWidth + 1) {
        resultEl.style.fontSize = `${minSize}px`;
        resultEl.classList.add('result-scrollable');
        resultEl.title = resultEl.textContent || '';
        requestAnimationFrame(()=>{resultEl.scrollLeft=resultEl.scrollWidth});
      }
    });
  }

  const renderBase = render;
  render = function() {renderBase();syncHourMode();syncFormatControl();fitPrimaryResult()};

  const snapshotCalculatorBase = snapshotCalculator;
  snapshotCalculator = function() {return { ...snapshotCalculatorBase(), hourDisplayMode }};
  const restoreCalculatorBase = restoreCalculator;
  restoreCalculator = function(snapshot) {hourDisplayMode = snapshot?.hourDisplayMode === 'sexagesimal' ? 'sexagesimal' : 'decimal';persistHourMode();restoreCalculatorBase(snapshot)};
  const clearAllBase = clearAll;
  clearAll = function(show = true) {clearAllBase(show)};

  window.addEventListener('resize', fitPrimaryResult);
  render();
})();
