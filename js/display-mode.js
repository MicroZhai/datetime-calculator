/*
 * Result presentation controller.
 * Clicking the result cycles its display unit without changing the exact
 * calculated duration. Hour mode is fixed to sexagesimal so the main result
 * always uses the exact H:MM:SS representation.
 */
(() => {
  const HOUR_MODE_KEY = 'dtc-hour-display-mode';
  const FIXED_HOUR_MODE = 'sexagesimal';
  // Legacy decimal preferences are deliberately ignored and migrated below.
  let hourDisplayMode = FIXED_HOUR_MODE;
  let fitFrame = 0;
  const resultTrigger = document.getElementById('result');


  function syncFormatControl() {
    if (!resultTrigger) return;
    const labels = ['天', '时', '分'];
    const label = labels[formatIndex] || labels[0];
    resultTrigger.dataset.format = String(formatIndex);
    resultTrigger.dataset.formatLabel = label;
    resultTrigger.title = `点击切换显示方式，当前按${label}显示`;
    resultTrigger.setAttribute('aria-label', `计算结果 ${resultTrigger.textContent || ''}，当前按${label}显示，点击切换`);
  }

  // The result itself is the format switch; no extra control is needed in the
  // display area, which keeps the mobile layout compact.
  resultTrigger?.addEventListener('click', () => {
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
  const formatResultBase = formatResult;
  formatResult = function(totalMs) {
    if (formatIndex === 1) return hms(totalMs);
    return formatResultBase(totalMs);
  };

  function syncHourMode() {
    if (formatIndex !== 1) return;
    const evaluated = evaluateRows(true);
    if (!evaluated.ok) { secondaryEl.textContent = ''; return; }
    // Do not repeat a decimal approximation below the exact sexagesimal result.
    secondaryEl.textContent = '';
    if (isHourIdleState()) {badge.textContent = '小时';badge.className = 'badge'}
  }

  function fitPrimaryResult() {
    cancelAnimationFrame(fitFrame);
    resultEl.style.fontSize = '';
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
  restoreCalculator = function(snapshot) {hourDisplayMode = FIXED_HOUR_MODE;persistHourMode();restoreCalculatorBase({...snapshot, hourDisplayMode: FIXED_HOUR_MODE})};
  const clearAllBase = clearAll;
  clearAll = function(show = true) {clearAllBase(show)};

  window.addEventListener('resize', fitPrimaryResult);
  // Migrate any previously persisted decimal preference to the fixed mode.
  persistHourMode();
  render();
})();
