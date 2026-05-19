const Calculator = {
  /**
   * 计算目标时间
   * @param {string} baseTime - ISO 时间字符串或 "now"
   * @param {number} durationMinutes - 时长（分钟，可正可负）
   * @returns {Date}
   */
  calcResult(baseTime, durationMinutes) {
    let base;
    if (baseTime === 'now') {
      base = new Date();
    } else {
      base = new Date(baseTime);
    }
    return new Date(base.getTime() + durationMinutes * 60 * 1000);
  },

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

  /** 格式化为 YYYY-MM-DD（中文习惯：无前导零的月日） */
  formatDate(date) {
    const y = date.getFullYear();
    const M = date.getMonth() + 1;
    const d = date.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const w = weekdays[date.getDay()];
    return `${y}年${M}月${d}日 周${w}`;
  },

  /** 时长分钟 → 可读文本 */
  formatDuration(totalMinutes) {
    const abs = Math.abs(totalMinutes);
    const sign = totalMinutes >= 0 ? '+' : '−';
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    if (h === 0) return `${sign}${m} 分钟`;
    if (m === 0) return `${sign}${h} 小时`;
    return `${sign}${h} 小时 ${m} 分钟`;
  },

  /** 时长分钟 → 纯数字分钟格式（如 +80min） */
  formatDurationMin(totalMinutes) {
    const sign = totalMinutes >= 0 ? '+' : '−';
    const abs = Math.abs(totalMinutes);
    return `${sign}${abs}min`;
  },

  /**
   * 计算整个时段链的结果
   * @returns {Array<{name, duration, startTime: Date, time: Date, totalMinFromBase: number}>}
   */
  calcSegmentChain(baseTime, segments) {
    let current = baseTime === 'now' ? new Date() : new Date(baseTime);
    const results = [];
    let totalMin = 0;
    for (const seg of segments) {
      const startTime = new Date(current);
      current = new Date(current.getTime() + seg.durationMinutes * 60 * 1000);
      totalMin += seg.durationMinutes;
      results.push({
        name: seg.name,
        duration: seg.durationMinutes,
        startTime: startTime,
        time: current,
        totalMinFromBase: totalMin
      });
    }
    return results;
  },

  /** 获取计算器最终结束时间 */
  getFinalResult(calc) {
    let current = calc.isBaseTimeNow ? new Date() : new Date(calc.baseTime);
    for (const seg of calc.segments) {
      current = new Date(current.getTime() + seg.durationMinutes * 60 * 1000);
    }
    return current;
  }
};
