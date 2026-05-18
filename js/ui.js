const UI = {
  // 当前正在编辑的计算器 id（null 表示新建）
  _editingId: null,
  // 当前右键菜单目标的计算器 id
  _contextTargetId: null,
  // 是否正在展示负时长
  _isNegative: false,

  /* ========== 列表渲染 ========== */

  renderList() {
    const calculators = Storage.getAll();

    // 按结果时间从早到晚排序
    calculators.sort((a, b) => {
      const tA = Calculator.calcResult(
        a.isBaseTimeNow ? 'now' : a.baseTime, a.durationMinutes
      );
      const tB = Calculator.calcResult(
        b.isBaseTimeNow ? 'now' : b.baseTime, b.durationMinutes
      );
      return tA - tB;
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
  },

  refreshLiveCards() {
    // 重新渲染整个列表（更新时间 + 重排序）
    this.renderList();
  },

  /** 更新顶部当前时间显示 */
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

    const result = Calculator.calcResult(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.durationMinutes
    );
    const resultTime = Calculator.formatTime(result);
    const resultDateStr = Calculator.formatDate(result);

    const durationLabel = Calculator.formatDurationMin(calc.durationMinutes);
    const baseLabel = calc.isBaseTimeNow ? '到温时间' : '基准';
    const countdown = Calculator.getTimeDiff(result);

    return `
      <div class="calc-card" data-id="${calc.id}">
        <div class="card-header">
          <span class="card-name">${this._escape(calc.name)}</span>
          <button class="card-menu-btn" data-action="menu" data-id="${calc.id}" aria-label="更多">⋮</button>
        </div>

        <div class="card-times">
          <div class="time-block time-block--base">
            <div class="time-label">${baseLabel}</div>
            <div class="time-value js-base-time">${baseTime}</div>
            <div class="time-date js-base-date">${baseDateStr}</div>
          </div>

          <div class="time-arrow" data-action="edit-duration" data-id="${calc.id}">
            <div class="arrow-duration">${durationLabel}</div>
            <div class="arrow-line">→</div>
          </div>

          <div class="time-block time-block--result">
            <div class="time-label">出炉时间</div>
            <div class="time-value time-value--result js-result-time">${resultTime}</div>
            <div class="time-date js-result-date">${resultDateStr}</div>
          </div>
        </div>

        <div class="card-footer">
          <span class="card-countdown js-countdown">${countdown}</span>
          <button class="card-copy-btn" data-action="copy" data-id="${calc.id}" title="复制结果">📋</button>
        </div>
      </div>`;
  },

  /* ========== 编辑弹窗 ========== */

  openSheet(calcId) {
    const calc = calcId ? Storage.getAll().find(c => c.id === calcId) : null;
    this._editingId = calcId || null;

    document.getElementById('sheet-title').textContent = calc ? '编辑计算器' : '新建计算器';
    document.getElementById('delete-btn').classList.toggle('hidden', !calc);

    // 名称
    document.getElementById('input-name').value = calc ? calc.name : '';

    // 基准时间模式
    const isNow = calc ? calc.isBaseTimeNow : true;
    this._setBaseTimeMode(isNow);

    if (calc && !calc.isBaseTimeNow) {
      const dl = Calculator.toDateTimeLocal(calc.baseTime);
      document.getElementById('input-date').value = dl.date;
      document.getElementById('input-time').value = dl.time;
    } else {
      const now = new Date();
      document.getElementById('input-date').value = now.toISOString().slice(0, 10);
      document.getElementById('input-time').value = now.toTimeString().slice(0, 5);
    }

    // 时长
    const dur = calc ? calc.durationMinutes : 0;
    this._isNegative = dur < 0;
    const abs = Math.abs(dur);
    document.getElementById('input-hours').value = Math.floor(abs / 60);
    document.getElementById('input-minutes').value = abs % 60;
    this._updateSignBtn();

    // 显示弹窗
    document.getElementById('sheet-overlay').classList.remove('hidden');
    document.getElementById('edit-sheet').classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeSheet() {
    document.getElementById('sheet-overlay').classList.add('hidden');
    document.getElementById('edit-sheet').classList.remove('open');
    document.body.style.overflow = '';
    this._editingId = null;
  },

  _setBaseTimeMode(isNow) {
    const segNow = document.getElementById('seg-now');
    const segManual = document.getElementById('seg-manual');
    const group = document.getElementById('manual-time-group');

    segNow.classList.toggle('active', isNow);
    segManual.classList.toggle('active', !isNow);
    group.classList.toggle('hidden', isNow);
  },

  _updateSignBtn() {
    const btn = document.getElementById('toggle-sign-btn');
    btn.textContent = this._isNegative ? '⊖' : '⊕';
    btn.classList.toggle('is-negative', this._isNegative);
  },

  /** 从弹窗表单读取当前值 */
  readSheet() {
    const name = document.getElementById('input-name').value.trim() || '未命名计算器';
    const isBaseTimeNow = document.getElementById('seg-now').classList.contains('active');
    let baseTime;
    if (isBaseTimeNow) {
      baseTime = 'now';
    } else {
      baseTime = Calculator.fromDateTimeLocal(
        document.getElementById('input-date').value,
        document.getElementById('input-time').value
      );
    }
    const hours = parseInt(document.getElementById('input-hours').value) || 0;
    const minutes = parseInt(document.getElementById('input-minutes').value) || 0;
    let totalMinutes = hours * 60 + minutes;
    if (this._isNegative) totalMinutes = -totalMinutes;

    return { name, isBaseTimeNow, baseTime, durationMinutes: totalMinutes };
  },

  /* ========== 右键菜单 ========== */

  showContextMenu(x, y, calcId) {
    this._contextTargetId = calcId;
    const menu = document.getElementById('context-menu');
    // 确保菜单不超出屏幕
    const maxX = window.innerWidth - 160;
    const maxY = window.innerHeight - 100;
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
    menu.classList.remove('hidden');
  },

  hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
    this._contextTargetId = null;
  },

  /* ========== Toast ========== */
  _toastTimer: null,

  showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('visible'), 1800);
  },

  /* ========== 工具 ========== */
  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
