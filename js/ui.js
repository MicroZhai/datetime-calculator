const UI = {
  _editingId: null,
  _contextTargetId: null,
  _segments: [],        // [{name, durationMinutes, isNegative}]
  _activeSegIdx: 0,
  _dirty: false,
  _confirmCallback: null,

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

  /* ========== 编辑弹窗 ========== */

  openSheet(calcId) {
    const calc = calcId ? Storage.getAll().find(c => c.id === calcId) : null;
    this._editingId = calcId || null;
    this._dirty = false;

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

  closeSheet(force) {
    if (!force && this._dirty) {
      this.showConfirm('有未保存的修改，确定放弃吗？', '放弃', 'confirm-btn--danger', () => {
        this._closeSheetInternal();
      });
      return;
    }
    this._closeSheetInternal();
  },

  _closeSheetInternal() {
    document.getElementById('edit-sheet').classList.remove('open');
    document.getElementById('sheet-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    // 等动画播完再清理状态
    setTimeout(() => {
      this._editingId = null;
      this._segments = [];
      this._dirty = false;
    }, 350);
  },

  _syncAllFromDOM() {
    const editors = document.querySelectorAll('.seg-editor');
    editors.forEach(el => {
      const i = parseInt(el.dataset.segIdx);
      const nameEl = el.querySelector('.js-seg-name');
      const hoursEl = el.querySelector('.js-seg-hours');
      const minEl = el.querySelector('.js-seg-minutes');
      if (nameEl) this._segments[i].name = nameEl.value.trim();
      if (hoursEl && minEl) {
        const h = parseInt(hoursEl.value) || 0;
        const m = parseInt(minEl.value) || 0;
        this._segments[i].durationMinutes = h * 60 + m;
      }
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
              <button class="seg-editor-clear js-seg-clear" title="清除时长">✕</button>
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

  _readDurationFromDOM(editor) {
    const hoursEl = editor.querySelector('.js-seg-hours');
    const minEl = editor.querySelector('.js-seg-minutes');
    let h = parseInt(hoursEl && hoursEl.value) || 0;
    let m = parseInt(minEl && minEl.value) || 0;
    const clamped = this._clampDuration(h, m, editor);
    if (clamped.capped) { h = clamped.h; m = clamped.m; }
    return { h, m, total: h * 60 + m };
  },

  _clampDuration(h, m, editor) {
    const total = h * 60 + m;
    if (total <= 9999) return { h, m, capped: false };
    this.showToast('单段时长上限为9999分钟（约7天）');
    // 截断并更新 DOM
    if (editor) {
      const hoursEl = editor.querySelector('.js-seg-hours');
      const minEl = editor.querySelector('.js-seg-minutes');
      const newH = Math.min(h, 166); // 166h * 60 = 9960
      const newM = Math.min(m, 39);  // 9960 + 39 = 9999
      if (hoursEl) hoursEl.value = newH;
      if (minEl) minEl.value = newM;
    }
    return { h: Math.min(h, 166), m: Math.min(h * 60 + m, 9999) % 60, capped: true };
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

    const dur = this._readDurationFromDOM(editor);
    const actualDuration = dur.total;
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

    const dur = this._readDurationFromDOM(editor);
    const actualDuration = dur.total;

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

    const dur = this._readDurationFromDOM(editor);
    const actualDuration = dur.total;

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

  clearSegmentDuration(idx) {
    this._segments[idx].durationMinutes = 0;
    this._segments[idx].isNegative = false;
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

  getCalcDetailText(calc) {
    const chain = Calculator.calcSegmentChain(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.segments
    );
    const last = chain[chain.length - 1];
    const baseDate = calc.isBaseTimeNow ? new Date() : new Date(calc.baseTime);

    let text = `【${calc.name}】\n`;
    text += `开始时间：${Calculator.formatDate(baseDate)} ${Calculator.formatTime(baseDate)}\n`;

    chain.forEach((s, i) => {
      const seg = calc.segments[i];
      const label = seg.name || `时段${i + 1}`;
      text += `${label} ${Calculator.formatDurationMin(s.duration)} → ${Calculator.formatTime(s.time)}\n`;
    });

    text += `最终结果：${Calculator.formatDate(last.time)} ${Calculator.formatTime(last.time)}`;
    return text;
  },

  /* ========== 历史记录 ========== */

  openHistory() {
    this.renderHistory();
    document.getElementById('history-overlay').classList.remove('hidden');
    document.getElementById('history-sheet').classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeHistory() {
    document.getElementById('history-sheet').classList.remove('open');
    document.getElementById('history-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  },

  renderHistory() {
    const list = History.getAll();
    const container = document.getElementById('history-list');
    if (list.length === 0) {
      container.innerHTML = '<div class="history-empty">暂无计算历史</div>';
      return;
    }
    container.innerHTML = list.map(r => {
      // 兼容旧记录（无 segments 字段）
      if (!r.segments && r.summary) {
        return this._renderOldHistoryCard(r);
      }

      const segs = r.segments || [];
      const totalMin = segs.reduce((s, c) => s + c.durationMinutes, 0);
      const isZero = totalMin === 0;

      const endDisplay = isZero ? '与开始时间相同' : this._escape(r.resultTimeFormatted);

      let processHTML = '';
      if (!isZero) {
        const baseMs = new Date(r.baseTime).getTime();
        const baseDay = new Date(new Date(r.baseTime).getFullYear(), new Date(r.baseTime).getMonth(), new Date(r.baseTime).getDate());
        let accumMin = 0;
        segs.forEach((s, i) => {
          accumMin += s.durationMinutes;
          const midTime = new Date(baseMs + accumMin * 60 * 1000);
          const midDay = new Date(midTime.getFullYear(), midTime.getMonth(), midTime.getDate());
          const dayDiff = Math.round((midDay - baseDay) / 86400000);
          let midTag = '';
          if (dayDiff === 1) midTag = ' (次日)';
          else if (dayDiff > 1) midTag = ` (+${dayDiff}天)`;
          else if (dayDiff < 0) midTag = ` (${dayDiff}天)`;

          const startMs = baseMs + (accumMin - s.durationMinutes) * 60 * 1000;
          const startTimeStr = Calculator.formatTime(new Date(startMs));
          const label = s.name || `时段${i + 1}`;
          const prefix = i === 0 ? '<span class="history-card-label">过程：</span>' : '<span class="history-card-label"></span>';
          processHTML += `
            <div class="history-process-row">
              ${prefix}<span class="history-process-label">${this._escape(label)}</span>
              <span>${startTimeStr}</span>
              <span class="history-process-dur">${Calculator.formatDurationMin(s.durationMinutes)}</span>
              <span>→</span>
              <span>${Calculator.formatTime(midTime)}${midTag}</span>
            </div>`;
        });
      } else {
        processHTML = '<div class="history-process-row history-process-none">无变化</div>';
      }

      return `
        <div class="history-card" data-id="${r.id}">
          <div class="history-card-main">
            <div class="history-card-name">${this._escape(r.calcName)}</div>
            <div class="history-card-line">
              <span class="history-card-label">开始：</span>${this._escape(r.baseTimeFormatted || '—')}
            </div>
            <div class="history-card-line">
              <span class="history-card-label">结束：</span>${endDisplay}
            </div>
            <div class="history-card-process">
              ${processHTML}
            </div>
            <div class="history-card-time">保存于 ${this._escape(r.savedAt)}</div>
          </div>
          <div class="history-card-actions">
            <button class="history-card-reuse js-history-reuse" data-id="${r.id}" title="再用一次">🔄 再用一次</button>
            <button class="history-card-del js-history-del" data-id="${r.id}" title="删除">✕</button>
          </div>
        </div>`;
    }).join('');
  },

  reuseHistory(id) {
    const record = History.getAll().find(r => r.id === id);
    if (!record) return;
    this.closeHistory();
    this.openSheet(null);
    // 预填数据
    if (record.baseTime) {
      const d = new Date(record.baseTime);
      document.getElementById('input-date').value = Calculator.toLocalDateStr(d);
      document.getElementById('input-time').value = Calculator.toLocalTimeStr(d);
    }
    if (record.segments && record.segments.length > 0) {
      this._segments = record.segments.map(s => ({
        name: s.name || '',
        durationMinutes: Math.abs(s.durationMinutes),
        isNegative: s.durationMinutes < 0
      }));
    }
    if (record.calcName) {
      document.getElementById('input-name').value = record.calcName + ' (副本)';
    }
    this._activeSegIdx = this._segments.length - 1;
    this._rebuildSegmentEditors();
    this._dirty = true;
  },

  _renderOldHistoryCard(r) {
    return `
      <div class="history-card" data-id="${r.id}">
        <div class="history-card-main">
          <div class="history-card-name">${this._escape(r.calcName)}</div>
          <div class="history-card-line">${this._escape(r.resultDate || '')} ${this._escape(r.resultTime || '')}</div>
          <div class="history-card-line" style="font-size:0.73rem;color:var(--text-secondary)">${this._escape(r.summary || '')}</div>
          <div class="history-card-time">保存于 ${this._escape(r.savedAt)}</div>
        </div>
        <button class="history-card-del js-history-del" data-id="${r.id}" title="删除">✕</button>
      </div>`;
  },

  clearHistory() {
    const self = this;
    this.showConfirm('确定清空全部计算历史吗？此操作不可撤销。', '清空', 'confirm-btn--danger', () => {
      History.clear();
      self.renderHistory();
      self.showToast('历史已清空');
    });
  },

  deleteHistoryItem(id) {
    History.remove(id);
    this.renderHistory();
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
    this._toastTimer = setTimeout(() => el.classList.remove('visible'), 2000);
  },

  showConfirm(msg, okLabel, okClass, callback) {
    this._confirmCallback = callback;
    document.getElementById('confirm-msg').textContent = msg;
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.textContent = okLabel || '确定';
    okBtn.className = 'confirm-btn ' + (okClass || 'confirm-btn--danger');
    document.getElementById('confirm-overlay').classList.remove('hidden');
    document.getElementById('confirm-dialog').classList.add('open');
  },

  hideConfirm() {
    document.getElementById('confirm-dialog').classList.remove('open');
    document.getElementById('confirm-overlay').classList.add('hidden');
    this._confirmCallback = null;
  },

  _executeConfirm() {
    if (this._confirmCallback) {
      const cb = this._confirmCallback;
      this.hideConfirm();
      cb();
    }
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
