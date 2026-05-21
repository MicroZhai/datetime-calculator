Object.assign(UI, {
openSheet(calcId) {
    const calc = calcId ? Storage.getAll().find(c => c.id === calcId) : null;
    clearTimeout(this._closeTimer);
    this._editingId = calcId || null;
    this._dirty = false;

    document.getElementById('sheet-title').textContent = calc ? '编辑计算器' : '新建计算器';
    document.getElementById('delete-btn').classList.toggle('hidden', !calc);

    document.getElementById('input-name').value = calc ? calc.name : '';

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
    this._syncBaseTimeDisplay();
    this._renderDurationHistory();

    document.getElementById('sheet-overlay').classList.remove('hidden');
    document.getElementById('edit-sheet').classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('input-name').focus();
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
    document.getElementById('new-btn-bottom').focus();
    // 等动画播完再清理状态（清除旧计时器防竞态）
    clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => {
      this._editingId = null;
      this._segments = [];
      this._dirty = false;
    }, 350);
  },

  _syncBaseTimeDisplay() {
    const display = document.getElementById('base-time-display');
    if (!display) return;
    const el = document.querySelector('.seg-editor[data-seg-idx="0"]');
    if (el) {
      const sd = el.querySelector('.js-seg-start-date');
      const st = el.querySelector('.js-seg-start-time');
      if (sd && st && sd.value && st.value) {
        const d = new Date(`${sd.value}T${st.value}:00`);
        if (!isNaN(d.getTime())) {
          display.textContent = Calculator.formatDateTime(d);
          return;
        }
      }
    }
    display.textContent = '--';
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
    const el = document.querySelector('.seg-editor[data-seg-idx="0"]');
    if (el) {
      const sd = el.querySelector('.js-seg-start-date');
      const st = el.querySelector('.js-seg-start-time');
      if (sd && st && sd.value && st.value) {
        return new Date(`${sd.value}T${st.value}:00`).toISOString();
      }
    }
    return new Date().toISOString();
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
    const newH = 166;                    // 9999 / 60 = 166
    const newM = 39;                     // 9999 % 60 = 39
    this.showToast('单段时长上限为9999分钟（约7天）');
    if (editor) {
      const hoursEl = editor.querySelector('.js-seg-hours');
      const minEl = editor.querySelector('.js-seg-minutes');
      if (hoursEl) hoursEl.value = newH;
      if (minEl) minEl.value = newM;
    }
    return { h: newH, m: newM, capped: true };
  },

  /** 时长变化 → 重算当前段结束时间，不影响其他段 */
  /**
   * 时长变化 → 重算当前段结束时间，各段独立不传播。
   * @param {number} idx - 时段索引
   */
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
  /**
   * 结束时间变化 → 反算开始时间（时长固定不变），各段独立不传播。
   * @param {number} idx - 时段索引
   */
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

    // 首段开始时间变化 → 同步顶部只读显示
    if (idx === 0) {
      this._syncBaseTimeDisplay();
    }

    // 不再向下传播
  },

  /** 开始时间变化 → 重算当前段结束时间（时长固定），不影响其他段 */
  /**
   * 开始时间变化 → 重算结束时间（时长固定不变），各段独立不传播。
   * @param {number} idx - 时段索引
   */
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

    // 首段开始时间变化 → 同步顶部只读显示
    if (idx === 0) {
      this._syncBaseTimeDisplay();
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

});
