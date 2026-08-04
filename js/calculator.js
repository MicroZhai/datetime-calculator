const Calculator = {
  _isNarrow() { return window.innerWidth < 360; },

  /** 格式化为 HH:MM */
  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  /** 格式化为 M月d日 HH:MM（短日期+时间） */
  formatDateTime(date) {
    const M = date.getMonth() + 1;
    const d = date.getDate();
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${M}月${d}日 ${h}:${m}`;
  },

  /** 格式化为 yyyy-MM-dd（本地日期，非 UTC） */
  toLocalDateStr(date) {
    const y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${M}-${d}`;
  },

  /** 格式化为 HH:MM（本地时间） */
  toLocalTimeStr(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  /** 格式化为 YYYY-MM-DD（中文习惯：无前导零的月日） */
  formatDate(date) {
    const y = date.getFullYear();
    const M = date.getMonth() + 1;
    const d = date.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const w = weekdays[date.getDay()];
    return `${y}年${M}月${d}日 周${w}`;
  },

  /** 智能短格式：小屏 5/21 14:00，大屏 5月21日 14:00 */
  formatSmart(date) {
    if (this._isNarrow()) {
      const M = date.getMonth() + 1; const d = date.getDate();
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${M}/${d} ${h}:${m}`;
    }
    return this.formatDateTime(date);
  },

  /** 时长分钟 → 纯数字分钟格式（如 +80min） */
  formatDurationMin(totalMinutes) {
    const sign = totalMinutes >= 0 ? '+' : '−';
    const abs = Math.abs(totalMinutes);
    return `${sign}${abs}min`;
  },

  /**
   * 计算整个时段链的结果（每段开始时间独立，不链式推导）
   * @returns {Array<{name, duration, startTime: Date, time: Date, totalMinFromBase: number}>}
   */
  calcSegmentChain(baseTime, segments) {
    const base = baseTime === 'now' ? new Date() : new Date(baseTime);
    const results = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      // 优先用存储的独立开始时间，兜底用链式推导（兼容旧数据）
      let startTime;
      if (seg.startMinutes !== undefined) {
        startTime = new Date(base.getTime() + seg.startMinutes * 60 * 1000);
      } else if (i === 0) {
        startTime = new Date(base);
      } else {
        // 旧数据兜底：从前一段结束时间推导
        startTime = new Date(results[i - 1].time.getTime());
      }
      const endTime = new Date(startTime.getTime() + seg.durationMinutes * 60 * 1000);
      results.push({
        name: seg.name,
        duration: seg.durationMinutes,
        startTime: startTime,
        time: endTime,
        totalMinFromBase: Math.round((endTime.getTime() - base.getTime()) / 60000)
      });
    }
    return results;
  },

  /** 获取计算器最终结束时间 */
  getFinalResult(calc) {
    const chain = this.calcSegmentChain(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.segments
    );
    if (chain.length === 0) {
      return calc.isBaseTimeNow ? new Date() : new Date(calc.baseTime);
    }
    return chain[chain.length - 1].time;
  },

  /** 计算器开始时间（首个有正时长的时段起点） */
  getStartTime(calc) {
    const chain = this.calcSegmentChain(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.segments
    );
    for (let i = 0; i < chain.length; i++) {
      if (chain[i].duration > 0) return chain[i].startTime;
    }
    return null;
  },

  /** 计算器结束时间（最后一个有正时长的时段终点） */
  getEndTime(calc) {
    const chain = this.calcSegmentChain(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.segments
    );
    let end = null;
    for (let i = 0; i < chain.length; i++) {
      if (chain[i].duration > 0) end = chain[i].time;
    }
    return end;
  },

  /**
   * 卡片时间状态：'unset' | 'future' | 'active' | 'finished'
   * 与 v2 CalculatorTimeRules.getState 保持一致
   */
  getState(calc) {
    const now = Date.now();
    let hasPositive = false;
    let hasFuture = false;
    const chain = this.calcSegmentChain(
      calc.isBaseTimeNow ? 'now' : calc.baseTime,
      calc.segments
    );
    for (let i = 0; i < chain.length; i++) {
      const seg = chain[i];
      if (seg.duration <= 0) continue;
      hasPositive = true;
      const start = seg.startTime.getTime();
      const end = seg.time.getTime();
      if (now >= start && now < end) return 'active';
      if (start > now) hasFuture = true;
    }
    if (!hasPositive) return 'unset';
    return hasFuture ? 'future' : 'finished';
  },

  /** 进度百分比：进行中为 0~100，未开始/无效为 -1，已结束为 100 */
  getProgressPercent(calc) {
    const s = this.getStartTime(calc);
    const e = this.getEndTime(calc);
    if (!s || !e) return -1;
    const now = Date.now();
    const sMs = s.getTime();
    const eMs = e.getTime();
    const total = eMs - sMs;
    if (total <= 0) return -1;
    const p = ((now - sMs) / total) * 100;
    if (now <= sMs) return -1;   // 未开始
    if (now >= eMs) return -1;   // 已结束
    return p < 0 ? 0 : (p > 100 ? 100 : p);
  },

  /** 进度展示值：未开始/无效 0，进行中真实比例，已结束 100 */
  getProgressDisplayPercent(calc) {
    const p = this.getProgressPercent(calc);
    if (p >= 0) return p;
    return this.getState(calc) === 'finished' ? 100 : 0;
  },

  /** 总时长（分钟） */
  getTotalMinutes(calc) {
    return calc.segments.reduce((s, c) => s + c.durationMinutes, 0);
  },

  /** 时长格式化：X时Y分 / X天X时 / X分 */
  formatDurationReadable(totalMinutes) {
    const abs = Math.abs(totalMinutes);
    const sign = totalMinutes < 0 ? '−' : '';
    const days = Math.floor(abs / 1440);
    const hours = Math.floor((abs % 1440) / 60);
    const mins = abs % 60;
    if (days > 0) return `${sign}${days}天${hours}时`;
    if (hours > 0) return `${sign}${hours}时${mins}分`;
    return `${sign}${mins}分`;
  },

  /** 剩余时间简短文案（进度环中央） */
  getRemainingText(calc) {
    const e = this.getEndTime(calc);
    if (!e) return '';
    const diff = e.getTime() - Date.now();
    if (diff <= 0) return '已结束';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `剩 ${days}天${hours}时`;
    if (hours > 0) return `剩 ${hours}时${mins}分`;
    return `剩 ${mins} 分`;
  }
};
