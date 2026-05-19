const UI = {
  _editingId: null,
  _contextTargetId: null,
  _segments: [],        // 编辑中的时段数据 [{name, durationMinutes, isNegative}]
  _activeSegIdx: 0,     // 快捷时长按钮作用的时段索引

  /* ========== 列表渲染 ========== */

  renderList() {
    const calculators = Storage.getAll();

    // 按结束时间从早到晚排序
    calculators.sort((a, b) => {
      return Calculator.getFinalResult(a) - Calculator.getFinalResult(b);
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
    const baseLabel = '开始时间';

    const chain = Calculator.calcSegmentChain(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.segments
    );
    const last = chain[chain.length - 1];
    const finalTime = Calculator.formatTime(last.time);
    const finalDate = Calculator.formatDate(last.time);
    const countdown = Calculator.getTimeDiff(last.time);

    // 总时长
    const totalMin = calc.segments.reduce((s, c) => s + c.durationMinutes, 0);

    // 中间列：单时段显示时长，多时段显示明细行
    let midHTML;
    const showNum = calc.segments.length > 1;
    if (showNum) {
      let rows = '';
      chain.forEach((s, i) => {
        const seg = calc.segments[i];
        const num = this._numToCircle(i + 1);
        const name = seg.name ? `<span class="mid-seg-name">${this._escape(seg.name)}</span>` : '';
        rows += `
          <div class="mid-row">
            <span class="mid-seg-num">${num}</span>${name}
            <span class="mid-seg-dur" data-action="edit-duration" data-id="${calc.id}">${Calculator.formatDurationMin(s.duration)}</span>
            <span class="mid-seg-arrow">→</span>
            <span class="mid-seg-time">${Calculator.formatTime(s.time)}</span>
          </div>`;
      });
      midHTML = `${rows}<div class="mid-total">总 ${Calculator.formatDurationMin(totalMin)}</div>`;
    } else {
      const dur = Calculator.formatDurationMin(totalMin);
      midHTML = `
        <div class="mid-single">
          <span class="mid-single-dur" data-action="edit-duration" data-id="${calc.id}">${dur}</span>
          <span class="mid-single-arrow">→</span>
        </div>`;
    }

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

          <div class="time-mid">
            ${midHTML}
          </div>

          <div class="time-block time-block--result">
            <div class="time-label">结束时间</div>
            <div class="time-value time-value--result js-result-time">${finalTime}</div>
            <div class="time-date js-result-date">${finalDate}</div>
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

    // 开始时间模式
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

    // 时段数据（深拷贝）
    if (calc && calc.segments) {
      this._segments = calc.segments.map(s => ({
        name: s.name || '',
        durationMinutes: Math.abs(s.durationMinutes),
        isNegative: s.durationMinutes < 0
      }));
    } else {
      this._segments = [{ name: '', durationMinutes: 0, isNegative: false }];
    }
    this._activeSegIdx = this._segments.length - 1;

    this._rebuildSegmentEditors();

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
    this._segments = [];
  },

  _setBaseTimeMode(isNow) {
    const segNow = document.getElementById('seg-now');
    const segManual = document.getElementById('seg-manual');
    const group = document.getElementById('manual-time-group');
    segNow.classList.toggle('active', isNow);
    segManual.classList.toggle('active', !isNow);
    group.classList.toggle('hidden', isNow);
  },

  /** 重建所有时段编辑器 DOM */
  _rebuildSegmentEditors() {
    const container = document.getElementById('segments-container');
    container.innerHTML = this._segments.map((s, i) => this._renderSegmentEditor(i, s)).join('');
  },

  /** 渲染单个时段编辑器 */
  _renderSegmentEditor(i, seg) {
    const label = this._segments.length > 1 ? `时段 ${this._numToCircle(i + 1)}` : '时段';
    const signClass = seg.isNegative ? ' is-negative' : '';
    const signText = seg.isNegative ? '⊖' : '⊕';
    return `
      <div class="seg-editor" data-seg-idx="${i}">
        <div class="seg-editor-top">
          <span class="seg-editor-label">${label}</span>
          <input type="text" class="seg-editor-name js-seg-name"
                 placeholder="名称（选填）" value="${this._escapeAttr(seg.name)}" maxlength="10">
          <button class="seg-editor-del js-seg-del" title="删除时段">✕</button>
        </div>
        <div class="seg-editor-row">
          <div class="seg-editor-field">
            <input type="number" class="js-seg-hours" min="0" max="999"
                   value="${Math.floor(seg.durationMinutes / 60)}" inputmode="numeric">
            <span>h</span>
          </div>
          <div class="seg-editor-field">
            <input type="number" class="js-seg-minutes" min="0" max="59"
                   value="${seg.durationMinutes % 60}" inputmode="numeric">
            <span>m</span>
          </div>
          <button class="seg-editor-sign${signClass} js-seg-sign">${signText}</button>
        </div>
      </div>`;
  },

  /** 添加时段 */
  addSegment() {
    this._segments.push({ name: '', durationMinutes: 0, isNegative: false });
    this._activeSegIdx = this._segments.length - 1;
    this._rebuildSegmentEditors();
  },

  /** 删除时段 */
  removeSegment(idx) {
    if (this._segments.length <= 1) {
      this.showToast('至少保留一个时段');
      return;
    }
    this._segments.splice(idx, 1);
    this._activeSegIdx = Math.min(this._activeSegIdx, this._segments.length - 1);
    this._rebuildSegmentEditors();
  },

  /** 从编辑器 DOM 同步数据到 _segments 数组，再读取出干净数据 */
  readSheet() {
    // 先从 DOM 同步
    const editors = document.querySelectorAll('.seg-editor');
    editors.forEach(el => {
      const i = parseInt(el.dataset.segIdx);
      const nameEl = el.querySelector('.js-seg-name');
      const hoursEl = el.querySelector('.js-seg-hours');
      const minEl = el.querySelector('.js-seg-minutes');
      const signEl = el.querySelector('.js-seg-sign');
      if (nameEl) this._segments[i].name = nameEl.value.trim();
      if (hoursEl && minEl) {
        const h = parseInt(hoursEl.value) || 0;
        const m = parseInt(minEl.value) || 0;
        this._segments[i].durationMinutes = h * 60 + m;
      }
      if (signEl) this._segments[i].isNegative = signEl.classList.contains('is-negative');
    });

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

    const segments = this._segments.map(s => ({
      name: s.name,
      durationMinutes: s.isNegative ? -s.durationMinutes : s.durationMinutes
    }));

    return { name, isBaseTimeNow, baseTime, segments };
  },

  /** 设置最后一个时段为快捷时长 */
  setQuickDuration(minutes) {
    const idx = this._activeSegIdx;
    if (idx < 0 || idx >= this._segments.length) return;
    this._segments[idx].durationMinutes = minutes;
    this._segments[idx].isNegative = false;
    this._rebuildSegmentEditors();
  },

  /** 切换指定时段的正负 */
  toggleSegmentSign(idx) {
    this._segments[idx].isNegative = !this._segments[idx].isNegative;
    this._rebuildSegmentEditors();
  },

  /* ========== 右键菜单 ========== */

  showContextMenu(x, y, calcId) {
    this._contextTargetId = calcId;
    const menu = document.getElementById('context-menu');
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
  },

  _escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  _numToCircle(n) {
    const circles = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    return circles[n - 1] || n + ' ';
  }
};
