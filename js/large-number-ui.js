(() => {
  let syncFrame = 0;

  function setOverflowState(element, focusable = false) {
    if (!element) return;
    const overflowing = element.scrollWidth > element.clientWidth + 1;
    element.classList.toggle('numeric-overflow', overflowing);

    if (overflowing) {
      element.scrollLeft = element.scrollWidth;
      const text = element.textContent?.trim() || '';
      if (text) element.title = text;
      if (focusable) {
        element.tabIndex = 0;
        element.setAttribute('aria-label', `${text}，可左右滚动查看完整数值`);
      }
      return;
    }

    element.removeAttribute('title');
    if (focusable) {
      element.removeAttribute('tabindex');
      element.removeAttribute('aria-label');
    }
  }

  function syncNumericOverflow() {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(() => {
      expressionEl?.querySelectorAll('.line-value').forEach(element => setOverflowState(element, false));
      setOverflowState(resultEl, true);
      historyList?.querySelectorAll('.history-row-value,.history-result').forEach(element => setOverflowState(element, true));
    });
  }

  const renderBase = render;
  render = function() {
    renderBase();
    syncNumericOverflow();
  };

  const renderHistoryBase = renderHistory;
  renderHistory = function() {
    renderHistoryBase();
    syncNumericOverflow();
  };

  window.addEventListener('resize', syncNumericOverflow);
  syncNumericOverflow();
})();
