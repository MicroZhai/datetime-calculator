/*
 * Result presentation controller.
 * Clicking the result cycles display unit (d->h->m->s) without changing
 * the exact calculated duration. After =, pressing a unit key switches
 * to that unit; pressing the same key again toggles 60/10 radix.
 */
(() => {
  let fitFrame = 0;
  const resultTrigger = document.getElementById('result');
  const statusRow = document.querySelector('.status-row');
  const UNIT_ORDER = ['d','h','m','s'];
  const UNIT_LABELS = {d:'天',h:'时',m:'分',s:'秒'};
  const UNIT_FULL_LABELS = {d:'天',h:'小时',m:'分',s:'秒'};

  function syncFormatControl() {
    if (!resultTrigger) return;
    const label = UNIT_LABELS[resultUnit] || UNIT_LABELS.d;
    const radixLabel = resultRadix === 60 ? '60进制' : '10进制';
    resultTrigger.dataset.format = resultUnit;
    resultTrigger.dataset.formatLabel = label;
    resultTrigger.title = `点击切换单位，当前按${UNIT_FULL_LABELS[resultUnit]}·${radixLabel}显示`;
    resultTrigger.setAttribute('aria-label', `计算结果 ${resultTrigger.textContent || ''}，当前按${UNIT_FULL_LABELS[resultUnit]}·${radixLabel}显示，点击切换`);
  }

  // 点击结果区 = 切换单位 d->h->m->s 循环（不切换进制）
  resultTrigger?.addEventListener('click', () => {
    const idx = UNIT_ORDER.indexOf(resultUnit);
    resultUnit = UNIT_ORDER[(idx + 1) % UNIT_ORDER.length];
    render();
  });

  function isDisplayHintIdleState() {
    return !partEdit && selectedRow === null && !colonMode && numberBuffer === '' &&
      currentParts.length === 0 && currentOp === null;
  }

  // 底部小字随 resultUnit/resultRadix 显示所选单位的换算
  function syncSecondary() {
    const evaluated = evaluateRows(true);
    if (evaluated.ok) secondaryEl.textContent = secondaryText(evaluated.value);
  }

  function syncDisplayHint() {
    if (!isDisplayHintIdleState()) return;
    if (statusRow?.classList.contains('has-date')) return;
    const radixLabel = resultRadix === 60 ? '60进制' : '10进制';
    badge.textContent = `按${UNIT_FULL_LABELS[resultUnit]}显示 · ${radixLabel}`;
    badge.className = 'badge format';
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
  render = function() {
    renderBase();
    syncSecondary();
    syncDisplayHint();
    syncFormatControl();
    fitPrimaryResult();
  };

  const snapshotCalculatorBase = snapshotCalculator;
  snapshotCalculator = function() {return { ...snapshotCalculatorBase(), resultUnit, resultRadix }};
  const restoreCalculatorBase = restoreCalculator;
  restoreCalculator = function(snapshot) {
    resultUnit = snapshot.resultUnit || 'd';
    resultRadix = snapshot.resultRadix === 10 ? 10 : 60;
    restoreCalculatorBase(snapshot);
  };
  window.addEventListener('resize', fitPrimaryResult);
  render();
})();
