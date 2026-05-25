Object.assign(UI, {
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
    document.getElementById('history-close-btn').focus();
  },

  closeHistory() {
    document.getElementById('history-sheet').classList.remove('open');
    document.getElementById('history-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    document.getElementById('history-btn').focus();
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

      // 分组名
      let groupTag = '';
      if (r.groupId) {
        const groups = Groups.getAll();
        const group = groups.find(g => g.id === r.groupId);
        if (group && group.id !== 'default') {
          groupTag = `<span class="history-group-tag">${this._escape(group.name)}</span>`;
        }
      }

      // 三列布局数据
      const baseDate = new Date(r.baseTime);
      const baseTimeStr = Calculator.formatTime(baseDate);
      const baseDateStr = Calculator.formatDate(baseDate);
      const finalResult = new Date(r.resultTime);
      const finalTimeStr = isZero ? '无变化' : Calculator.formatTime(finalResult);
      const finalDateStr = isZero ? '' : Calculator.formatDate(finalResult);
      const totalDur = isZero ? '—' : Calculator.formatDurationMin(totalMin);

      // 跨天标签
      const baseDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      const resultDay = new Date(finalResult.getFullYear(), finalResult.getMonth(), finalResult.getDate());
      const dayDiff = Math.round((resultDay - baseDay) / 86400000);
      let crossDayTag = '';
      if (!isZero && dayDiff !== 0) {
        crossDayTag = `<span class="cross-day-tag">${dayDiff > 0 ? '+' + dayDiff + '天' : dayDiff + '天'}</span>`;
      }

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

          // 优先用存储的独立开始时间，兜底链式推导（兼容旧历史记录）
          let startMs;
          if (s.startMinutes !== undefined) {
            startMs = baseMs + s.startMinutes * 60 * 1000;
          } else {
            startMs = baseMs + (accumMin - s.durationMinutes) * 60 * 1000;
          }
          const startTimeStr = Calculator.formatSmart(new Date(startMs));
          const label = s.name || `时段${i + 1}`;
          const prefix = i === 0 ? '<span class="history-card-label">过程：</span>' : '<span class="history-card-label"></span>';
          processHTML += `
            <div class="history-process-row">
              ${prefix}<span class="history-process-label">${this._escape(label)}</span>
              <span class="history-process-dur">${Calculator.formatDurationMin(s.durationMinutes)}</span>
              <span class="history-process-arrow">→</span>
              <span class="history-process-time">${startTimeStr}</span>
              <span class="history-process-time">${Calculator.formatSmart(midTime)}${midTag}</span>
            </div>`;
        });
      } else {
        processHTML = '<div class="history-process-row history-process-none">无变化</div>';
      }

      return `
        <div class="history-card" data-id="${r.id}">
          <div class="history-card-top">
            <div class="history-card-name">${this._escape(r.calcName)}${groupTag}</div>
            <div class="history-card-actions">
              <button class="history-card-reuse js-history-reuse" data-id="${r.id}" title="再用一次">🔄 再用一次</button>
              <button class="history-card-del js-history-del" data-id="${r.id}" title="删除">✕</button>
            </div>
          </div>
          <div class="card-times history-card-times">
            <div class="time-block time-block--base">
              <div class="time-label">开始时间</div>
              <div class="time-value">${baseTimeStr}</div>
              <div class="time-date">${baseDateStr}</div>
            </div>
            <div class="time-mid">
              <div class="mid-single">
                <span class="mid-single-dur">${totalDur}</span>
              </div>
            </div>
            <div class="time-block time-block--result">
              <div class="time-label">结束时间</div>
              <div class="time-value time-value--result">${finalTimeStr}</div>
              <div class="time-date">${finalDateStr}</div>
              ${crossDayTag}
            </div>
          </div>
          <div class="history-card-process">
            ${processHTML}
          </div>
          <div class="history-card-time">保存于 ${this._escape(r.savedAt)}</div>
        </div>`;
    }).join('');
  },

  reuseHistory(id) {
    const record = History.getAll().find(r => r.id === id);
    if (!record) return;
    this.closeHistory();
    this.openSheet(null);
    // 预填时段数据
    if (record.segments && record.segments.length > 0) {
      this._segments = record.segments.map(s => ({
        name: s.name || '',
        durationMinutes: Math.abs(s.durationMinutes),
        isNegative: s.durationMinutes < 0,
        startMinutes: s.startMinutes
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

});
