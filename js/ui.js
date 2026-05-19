const UI = {
  _editingId: null,
  _contextTargetId: null,
  _segments: [],        // [{name, durationMinutes, isNegative}]
  _activeSegIdx: 0,

  /* ========== 列表渲染 ========== */

  renderList() {
    const calculators = Storage.getAll();

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

    const chain = Calculator.calcSegmentChain(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.segments
    );
    const last = chain[chain.length - 1];
    const finalTime = Calculator.formatTime(last.time);
    const finalDate = Calculator.formatDate(last.time);

    const totalMin = calc.segments.reduce((s, c) => s + c.durationMinutes, 0);
    const totalDur = Calculator.formatDurationMin(totalMin);

    // 阶段时间明细 + 段间间隔（始终显示）
    let calcDetailHTML = '';
    chain.forEach((s, i) => {
      const seg = calc.segments[i];
      const num = this._numToCircle(i + 1);
      const nameStr = seg.name ? ` ${this._escape(seg.name)}` : '';
      calcDetailHTML += `
        <div class="card-calc-row">
          <span class="card-calc-num">${num}${nameStr}</span>
          <span>${Calculator.formatDateTime(s.startTime)}</span>
          <span class="card-calc-dur">${Calculator.formatDurationMin(s.duration)}</span>
          <span>→</span>
          <span>${Calculator.formatDateTime(s.time)}</span>
        </div>`;

      if (i < chain.length - 1) {
        const nextStart = chain[i + 1].startTime;
        const gapMs = nextStart.getTime() - s.time.getTime();
        const gapMin = Math.round(gapMs / 60000);
        const gapLabel = gapMin === 0 ? '连续' : (gapMin > 0 ? `+${gapMin}min` : `${gapMin}min`);
        calcDetailHTML += `
        <div class="card-calc-row card-calc-gap">
          <span class="card-calc-num"></span>
          <span class="card-calc-gap-text">↳ 间隔 ${gapLabel}</span>
        </div>`;
      }
    });

    return `
      <div class="calc-card" data-id="${calc.id}">
        <div class="card-header">
          <span class="card-name">${this._escape(calc.name)}</span>
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
            <div class="time-value time-value--result js-result-time">${finalTime}</div>
            <div class="time-date js-result-date">${finalDate}</div>
          </div>
        </div>

        <div class="card-calc-detail">
          <div class="card-calc-title">阶段时间</div>
          ${calcDetailHTML}
        </div>

        <div class="card-footer">
          <button class="card-copy-btn" data-action="copy" data-id="${calc.id}" title="复制结果">📋 复制结束时间</button>
        </div>
      </div>`;
  },

  /* ========== 编辑弹窗 ========== */

  openSheet(calcId) {
    const calc = calcId ? Storage.getAll().find(c => c.id === calcId) : null;
    this._editingId = calcId || null;

    document.getElementById('sheet-title').textContent = calc ? '编辑计算器' : '新建计算器';
    document.getElementById('delete-btn').classList.toggle('hidden', !calc);

    document.getElementById('input-name').value = calc ? calc.name : '';

    const baseDate = calc ? new Date(calc.baseTime) : new Date();
    document.getElementById('input-date').value = Calculator.toLocalDateStr(baseDate);
    document.getElementById('input-time').value = Calculator.toLocalTimeStr(baseDate);

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
    this._renderDurationHistory();

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

  _syncAllFromDOM() {
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
  },

  _rebuildSegmentEditors() {
    const container = document.getElementById('segments-container');
    container.innerHTML = this._segments.map((s, i) => this._renderSegmentEditor(i, s)).join('');
  },

  _renderSegmentEditor(i, seg) {
    const segNum = i + 1;
    const label = this._segments.length > 1 ? `第${segNum}段` : '时段';

    // 计算开始时间：首段=基准时间，非首段独立于前段
    let startTime;
    const baseIso = this._getCurrentBaseISO();
    const baseMs = new Date(baseIso).getTime();
    if (i === 0) {
      startTime = new Date(baseIso);
    } else {
      // 优先级1：DOM 中已有值（本次编辑会话中用户手动设的）
      const existingEl = document.querySelector(`.seg-editor[data-seg-idx="${i}"]`);
      const sd = existingEl && existingEl.querySelector('.js-seg-start-date');
      const st = existingEl && existingEl.querySelector('.js-seg-start-time');
      if (sd && st && sd.value && st.value) {
        const domTime = new Date(`${sd.value}T${st.value}:00`);
        if (!isNaN(domTime.getTime())) {
          startTime = domTime;
        }
      }
      // 优先级2：存储的 startMinutes（上次保存的独立开始时间）
      if ((!startTime || isNaN(startTime.getTime())) && seg.startMinutes !== undefined) {
        startTime = new Date(baseMs + seg.startMinutes * 60 * 1000);
      }
      // 优先级3：兜底链式推导（全新无数据时段）
      if (!startTime || isNaN(startTime.getTime())) {
        let current = new Date(baseIso);
        for (let j = 0; j < i; j++) {
          const s = this._segments[j];
          current = new Date(current.getTime() + s.durationMinutes * 60 * 1000 * (s.isNegative ? -1 : 1));
        }
        startTime = current;
      }
    }

    const actualDuration = seg.isNegative ? -seg.durationMinutes : seg.durationMinutes;
    const endTime = new Date(startTime.getTime() + actualDuration * 60 * 1000);

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

        <div class="seg-editor-times">
          <div class="seg-editor-time-field">
            <label class="seg-editor-time-label">开始时间</label>
            <div class="seg-time-row">
              <input type="date" class="seg-time-input js-seg-start-date"
                     value="${Calculator.toLocalDateStr(startTime)}">
              <input type="time" class="seg-time-input js-seg-start-time"
                     value="${Calculator.toLocalTimeStr(startTime)}">
            </div>
          </div>

          <div class="seg-editor-time-field">
            <label class="seg-editor-time-label">时长</label>
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
          </div>

          <div class="seg-editor-time-field">
            <label class="seg-editor-time-label">结束时间</label>
            <div class="seg-time-row">
              <input type="date" class="seg-time-input js-seg-end-date"
                     value="${Calculator.toLocalDateStr(endTime)}">
              <input type="time" class="seg-time-input js-seg-end-time"
                     value="${Calculator.toLocalTimeStr(endTime)}">
            </div>
          </div>
        </div>
      </div>`;
  },

  _getCurrentBaseISO() {
    const dateStr = document.getElementById('input-date').value;
    const timeStr = document.getElementById('input-time').value;
    return new Date(`${dateStr}T${timeStr}:00`).toISOString();
  },

  /** 时长变化 → 重算当前段结束时间，不影响其他段 */
  _syncSegmentTimes(idx) {
    if (idx < 0 || idx >= this._segments.length) return;

    this._syncAllFromDOM();
    const editor = document.querySelector(`.seg-editor[data-seg-idx="${idx}"]`);
    if (!editor) return;

    // 从 DOM 读取开始时间（独立，非链式推导）
    const startDateEl = editor.querySelector('.js-seg-start-date');
    const startTimeEl = editor.querySelector('.js-seg-start-time');
    if (!startDateEl || !startTimeEl) return;
    const startStr = `${startDateEl.value}T${startTimeEl.value}:00`;
    const startTime = new Date(startStr);
    if (isNaN(startTime.getTime())) return;

    // 从 DOM 读取时长
    const hoursEl = editor.querySelector('.js-seg-hours');
    const minEl = editor.querySelector('.js-seg-minutes');
    const signEl = editor.querySelector('.js-seg-sign');
    const h = parseInt(hoursEl && hoursEl.value) || 0;
    const m = parseInt(minEl && minEl.value) || 0;
    const isNeg = signEl && signEl.classList.contains('is-negative');
    const actualDuration = isNeg ? -(h * 60 + m) : (h * 60 + m);
    const endTime = new Date(startTime.getTime() + actualDuration * 60 * 1000);

    // 更新结束时间
    const endDateEl = editor.querySelector('.js-seg-end-date');
    const endTimeEl = editor.querySelector('.js-seg-end-time');
    if (endDateEl) endDateEl.value = Calculator.toLocalDateStr(endTime);
    if (endTimeEl) endTimeEl.value = Calculator.toLocalTimeStr(endTime);

    // 不再向下传播——各段独立
  },

  /** 结束时间变化 → 反算当前段开始时间（时长固定），不影响其他段 */
  _syncFromEndTime(idx) {
    const editor = document.querySelector(`.seg-editor[data-seg-idx="${idx}"]`);
    if (!editor) return;

    const endDateEl = editor.querySelector('.js-seg-end-date');
    const endTimeEl = editor.querySelector('.js-seg-end-time');
    if (!endDateEl || !endTimeEl) return;
    const endStr = `${endDateEl.value}T${endTimeEl.value}:00`;
    const endTime = new Date(endStr);
    if (isNaN(endTime.getTime())) return;

    // 从 DOM 读取时长（确保是最新值）
    const hoursEl = editor.querySelector('.js-seg-hours');
    const minEl = editor.querySelector('.js-seg-minutes');
    const signEl = editor.querySelector('.js-seg-sign');
    const h = parseInt(hoursEl && hoursEl.value) || 0;
    const m = parseInt(minEl && minEl.value) || 0;
    const isNeg = signEl && signEl.classList.contains('is-negative');
    const actualDuration = isNeg ? -(h * 60 + m) : (h * 60 + m);

    // 反算开始时间
    const startTime = new Date(endTime.getTime() - actualDuration * 60 * 1000);

    const startDateEl = editor.querySelector('.js-seg-start-date');
    const startTimeEl = editor.querySelector('.js-seg-start-time');
    if (startDateEl) startDateEl.value = Calculator.toLocalDateStr(startTime);
    if (startTimeEl) startTimeEl.value = Calculator.toLocalTimeStr(startTime);

    // 首段开始时间变化 → 同步基准时间
    if (idx === 0) {
      document.getElementById('input-date').value = Calculator.toLocalDateStr(startTime);
      document.getElementById('input-time').value = Calculator.toLocalTimeStr(startTime);
    }

    // 不再向下传播
  },

  /** 开始时间变化 → 重算当前段结束时间（时长固定），不影响其他段 */
  _syncFromStartTime(idx) {
    const editor = document.querySelector(`.seg-editor[data-seg-idx="${idx}"]`);
    if (!editor) return;

    const startDateEl = editor.querySelector('.js-seg-start-date');
    const startTimeEl = editor.querySelector('.js-seg-start-time');
    if (!startDateEl || !startTimeEl) return;
    const startStr = `${startDateEl.value}T${startTimeEl.value}:00`;
    const startTime = new Date(startStr);
    if (isNaN(startTime.getTime())) return;

    // 从 DOM 读取时长（确保是最新值）
    const hoursEl = editor.querySelector('.js-seg-hours');
    const minEl = editor.querySelector('.js-seg-minutes');
    const signEl = editor.querySelector('.js-seg-sign');
    const h = parseInt(hoursEl && hoursEl.value) || 0;
    const m = parseInt(minEl && minEl.value) || 0;
    const isNeg = signEl && signEl.classList.contains('is-negative');
    const actualDuration = isNeg ? -(h * 60 + m) : (h * 60 + m);

    // 重算结束时间
    const endTime = new Date(startTime.getTime() + actualDuration * 60 * 1000);

    const endDateEl = editor.querySelector('.js-seg-end-date');
    const endTimeEl = editor.querySelector('.js-seg-end-time');
    if (endDateEl) endDateEl.value = Calculator.toLocalDateStr(endTime);
    if (endTimeEl) endTimeEl.value = Calculator.toLocalTimeStr(endTime);

    // 首段开始时间变化 → 同步基准时间
    if (idx === 0) {
      document.getElementById('input-date').value = startDateEl.value;
      document.getElementById('input-time').value = startTimeEl.value;
    }

    // 不再向下传播
  },

  addSegment() {
    this._segments.push({ name: '', durationMinutes: 0, isNegative: false });
    this._activeSegIdx = this._segments.length - 1;
    this._rebuildSegmentEditors();
  },

  removeSegment(idx) {
    if (this._segments.length <= 1) {
      this.showToast('至少保留一个时段');
      return;
    }
    this._segments.splice(idx, 1);
    this._activeSegIdx = Math.min(this._activeSegIdx, this._segments.length - 1);
    this._rebuildSegmentEditors();
  },

  readSheet() {
    this._syncAllFromDOM();

    const name = document.getElementById('input-name').value.trim() || '未命名计算器';
    const baseTime = this._getCurrentBaseISO();
    const baseMs = new Date(baseTime).getTime();

    const segments = this._segments.map((s, i) => {
      // 从 DOM 读取该段的开始时间，计算 startMinutes
      let startMinutes = 0;
      if (i > 0) {
        const editor = document.querySelector(`.seg-editor[data-seg-idx="${i}"]`);
        if (editor) {
          const sd = editor.querySelector('.js-seg-start-date');
          const st = editor.querySelector('.js-seg-start-time');
          if (sd && st && sd.value && st.value) {
            const startMs = new Date(`${sd.value}T${st.value}:00`).getTime();
            startMinutes = Math.round((startMs - baseMs) / 60000);
          }
        }
      }

      return {
        name: s.name,
        durationMinutes: s.isNegative ? -s.durationMinutes : s.durationMinutes,
        startMinutes: startMinutes
      };
    });

    return { name, isBaseTimeNow: false, baseTime, segments };
  },

  setQuickDuration(minutes) {
    const idx = this._activeSegIdx;
    if (idx < 0 || idx >= this._segments.length) return;
    this._segments[idx].durationMinutes = minutes;
    this._segments[idx].isNegative = false;
    this._rebuildSegmentEditors();
  },

  toggleSegmentSign(idx) {
    this._segments[idx].isNegative = !this._segments[idx].isNegative;
    this._rebuildSegmentEditors();
  },

  _renderDurationHistory() {
    const container = document.getElementById('duration-history');
    const history = Storage.getDurationHistory();
    if (history.length === 0) {
      container.innerHTML = '<span class="history-empty">暂无历史记录</span>';
      return;
    }
    container.innerHTML = history.map(m => {
      const display = Calculator.formatDurationMin(m);
      return `<button class="quick-btn history-btn" data-minutes="${m}">${display}</button>`;
    }).join('');
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
