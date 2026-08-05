Object.assign(UI, {
/* ========== 列表渲染 ========== */

  // 视图模式：0=简洁 1=详细，默认简洁
  _viewMode: 0,

  renderList() {
    let calculators = Storage.getAll();

    // 排序：置顶优先，再按状态（进行中→未开始→已结束→未设置），同状态按创建时间倒序
    calculators.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const rank = { active: 0, future: 1, finished: 2, unset: 3 };
      const ra = rank[Calculator.getState(a)];
      const rb = rank[Calculator.getState(b)];
      if (ra !== rb) return ra - rb;
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

  /** 简洁 / 详细切换 */
  toggleViewMode() {
    this._viewMode = this._viewMode === 0 ? 1 : 0;
    const label = document.getElementById('nav-toggle-label');
    const icon = document.getElementById('nav-toggle-icon');
    if (label) label.textContent = this._viewMode === 0 ? '简洁' : '详细';
    this.renderList();
  },

  _renderCard(calc) {
    const state = Calculator.getState(calc);
    const baseDate = calc.isBaseTimeNow ? new Date() : new Date(calc.baseTime);
    const startT = Calculator.getStartTime(calc);
    const endT = Calculator.getEndTime(calc);
    const totalMin = Calculator.getTotalMinutes(calc);
    const isZero = totalMin === 0;
    const segCount = calc.segments.length;

    // 元信息：N段 · 总时长
    const meta = `${segCount}段 · ${isZero ? '0分' : Calculator.formatDurationReadable(totalMin)}`;

    // 右侧时间
    let timeArea = '';
    if (startT && endT) {
      // 跨天标签
      let crossTag = '';
      const sDay = new Date(startT.getFullYear(), startT.getMonth(), startT.getDate());
      const eDay = new Date(endT.getFullYear(), endT.getMonth(), endT.getDate());
      const dayDiff = Math.round((eDay - sDay) / 86400000);
      if (dayDiff !== 0) {
        crossTag = `<span class="card-cross-tag">${dayDiff > 0 ? '+' + dayDiff : dayDiff}天</span>`;
      }
      const startStr = Calculator.formatSmart(startT);
      const endStr = Calculator.formatSmart(endT);
      timeArea = `
        <div class="card-time-area">
          <div class="card-time-row">
            <span class="card-time-label">开始</span>
            <span class="card-time-value">${startStr}</span>
          </div>
          <div class="card-time-row">
            <span class="card-time-label">结束</span>
            <span class="card-time-value">${endStr}${crossTag}</span>
          </div>
        </div>`;
    } else {
      timeArea = `<div class="card-time-area"><span class="card-time-value card-time-value--dim">未设置时段</span></div>`;
    }

    // 详请过程（详细模式）
    let detailHTML = '';
    if (this._viewMode === 1) {
      const chain = Calculator.calcSegmentChain(
        calc.isBaseTimeNow ? 'now' : calc.baseTime,
        calc.segments
      );
      if (isZero) {
        detailHTML = `
          <div class="card-detail">
            <div class="card-detail-row card-detail-empty">无时段数据</div>
          </div>`;
      } else {
        let rows = '';
        chain.forEach((s, i) => {
          const seg = calc.segments[i];
          const label = seg.name || `时段${i + 1}`;
          const dur = Calculator.formatDurationReadable(s.duration);
          rows += `
            <div class="card-detail-row">
              <span class="card-detail-label">${this._escape(label)}</span>
              <span class="card-detail-time">${Calculator.formatSmart(s.startTime)}</span>
              <span class="card-detail-dur">${dur}</span>
              <span class="card-detail-arrow">→</span>
              <span class="card-detail-time">${Calculator.formatSmart(s.time)}</span>
            </div>`;
        });
        detailHTML = `<div class="card-detail">${rows}</div>`;
      }
    }

    const pinIcon = calc.pinned ? '<span class="card-pin-icon">📌</span>' : '';
    const pinnedClass = calc.pinned ? ' pinned' : '';
    const stateClass = ' is-' + state;

    return `
      <div class="calc-card${pinnedClass}${stateClass}" data-id="${calc.id}" data-state="${state}">
        <button class="card-menu-btn" data-action="menu" data-id="${calc.id}" aria-label="更多">⋮</button>
        <div class="card-compact">
          <div class="card-info">
            <div class="card-info-top">
              ${pinIcon}<span class="card-name">${this._escape(calc.name)}</span>
            </div>
            <div class="card-meta"><span>${meta}</span></div>
          </div>
          ${timeArea}
        </div>
        ${detailHTML}
      </div>`;
  },
});