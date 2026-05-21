Object.assign(UI, {
/* ========== 列表渲染 ========== */

  renderList() {
    let calculators = Storage.getAll();
    if (this._currentGroup) {
      calculators = calculators.filter(c => c.groupId === this._currentGroup);
    }

    calculators.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

    const listEl = document.getElementById('calc-list');
    const emptyEl = document.getElementById('empty-state');

    if (calculators.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    listEl.innerHTML = calculators.map(c => this._renderCard(c)).join('');
    // 瀑布流入场
    listEl.querySelectorAll('.calc-card').forEach((card, i) => {
      card.style.animationDelay = (i * 0.04) + 's';
    });
  },

  refreshLiveCards() {
    this.renderList();
  },

  updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('current-time-display');
    const dateEl = document.getElementById('current-date-display');
    if (timeEl) {
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      timeEl.textContent = `${h}:${m}:${s}`;
    }
    if (dateEl) {
      dateEl.textContent = Calculator.formatDate(now);
    }
  },

  _renderCard(calc) {
    const baseDate = calc.isBaseTimeNow ? new Date() : new Date(calc.baseTime);
    const baseTime = Calculator.formatTime(baseDate);
    const baseDateStr = Calculator.formatDate(baseDate);

    const chain = Calculator.calcSegmentChain(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.segments
    );
    const last = chain.length > 0 ? chain[chain.length - 1] : { time: baseDate };
    const finalTime = Calculator.formatTime(last.time);
    const finalDate = Calculator.formatDate(last.time);

    const totalMin = calc.segments.reduce((s, c) => s + c.durationMinutes, 0);
    const isZero = totalMin === 0;
    const totalDur = isZero ? '—' : Calculator.formatDurationMin(totalMin);
    const finalTimeDisplay = isZero ? '无变化' : finalTime;

    // 跨天标签
    const baseDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const lastDay = new Date(last.time.getFullYear(), last.time.getMonth(), last.time.getDate());
    const dayDiff = Math.round((lastDay - baseDay) / 86400000);
    let crossDayTag = '';
    if (!isZero && dayDiff !== 0) {
      crossDayTag = `<span class="cross-day-tag">${dayDiff > 0 ? '+' + dayDiff + '天' : dayDiff + '天'}</span>`;
    }

    // 过程详情（默认隐藏）
    let detailHTML = '';
    if (!isZero) {
      chain.forEach((s, i) => {
        const seg = calc.segments[i];
        const sDay = new Date(s.startTime.getFullYear(), s.startTime.getMonth(), s.startTime.getDate());
        const eDay = new Date(s.time.getFullYear(), s.time.getMonth(), s.time.getDate());
        const sDiff = Math.round((sDay - baseDay) / 86400000);
        const eDiff = Math.round((eDay - baseDay) / 86400000);
        let sTag = '', eTag = '';
        if (sDiff === 1) sTag = ' <span class="card-inline-tag">次日</span>';
        else if (sDiff > 1) sTag = ` <span class="card-inline-tag">+${sDiff}天</span>`;
        else if (sDiff < 0) sTag = ` <span class="card-inline-tag">${sDiff}天</span>`;
        if (eDiff === 1) eTag = ' <span class="card-inline-tag">次日</span>';
        else if (eDiff > 1) eTag = ` <span class="card-inline-tag">+${eDiff}天</span>`;
        else if (eDiff < 0) eTag = ` <span class="card-inline-tag">${eDiff}天</span>`;

        const label = seg.name || `时段${i + 1}`;
        const dur = Calculator.formatDurationMin(s.duration);
        detailHTML += `
          <div class="card-timeline-row">
            <span class="card-tl-num">${label}</span>
            <span class="card-tl-time">${Calculator.formatDateTime(s.startTime)}${sTag}</span>
            <span class="card-tl-dur">${dur}</span>
            <span class="card-tl-arrow">→</span>
            <span class="card-tl-time">${Calculator.formatDateTime(s.time)}${eTag}</span>
          </div>`;
      });
    } else {
      detailHTML = '<div class="card-timeline-row card-tl-none">无时段数据</div>';
    }

    const pinIcon = calc.pinned ? '<span class="card-pin-icon">📌</span>' : '';
    const pinnedClass = calc.pinned ? ' pinned' : '';

    return `
      <div class="calc-card${pinnedClass}" data-id="${calc.id}">
        <div class="card-header">
          <span class="card-name">${pinIcon}${this._escape(calc.name)}</span>
          <button class="card-menu-btn" data-action="menu" data-id="${calc.id}" aria-label="更多">⋮</button>
        </div>

        <div class="card-times">
          <div class="time-block time-block--base">
            <div class="time-label">开始时间</div>
            <div class="time-value js-base-time">${baseTime}</div>
            <div class="time-date js-base-date">${baseDateStr}</div>
          </div>

          <div class="time-mid">
            <div class="mid-single">
              <span class="mid-single-dur" data-action="edit-duration" data-id="${calc.id}">${totalDur}</span>
            </div>
          </div>

          <div class="time-block time-block--result">
            <div class="time-label">结束时间</div>
            <div class="time-value time-value--result js-result-time">${finalTimeDisplay}</div>
            <div class="time-date js-result-date">${finalDate}</div>
            ${crossDayTag}
          </div>
        </div>

        <button class="card-expand-btn" data-action="expand" data-id="${calc.id}">
          <span class="card-expand-arrow">▲</span> 收起过程
        </button>

        <div class="card-process-detail expanded">
          ${detailHTML}
        </div>
      </div>`;
  },
});
