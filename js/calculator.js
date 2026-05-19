const Calculator = {
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
    return chain[chain.length - 1].time;
  }
};
