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

  /** 目标时间距今还有多久 */
  getTimeDiff(targetDate) {
    const diffMs = targetDate.getTime() - Date.now();
    const absMs = Math.abs(diffMs);
    const absMin = Math.floor(absMs / 60000);

    if (absMin < 1) {
      return diffMs >= 0 ? '即将到达' : '刚刚过去';
    }

    const h = Math.floor(absMin / 60);
    const m = absMin % 60;

    let text;
    if (h === 0) text = `${m} 分钟`;
    else if (m === 0) text = `${h} 小时`;
    else text = `${h} 小时 ${m} 分钟`;

    return diffMs >= 0 ? `距今还有 ${text}` : `已过去 ${text}`;
  },

  /** 获取当前时间的 ISO 字符串 (精确到分钟) */
  getNowISO() {
    const d = new Date();
    // 取整到分钟
    d.setSeconds(0, 0);
    return d.toISOString();
  },

  /** 格式化 ISO 时间为本地 datetime-local 值 */
  toDateTimeLocal(isoStr) {
    const d = new Date(isoStr);
    const y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const date = `${y}-${M}-${day}`;
    const time = d.toTimeString().slice(0, 5);
    return { date, time };
  },

  /** 从 date + time 字符串合并为 ISO */
  fromDateTimeLocal(dateStr, timeStr) {
    const d = new Date(`${dateStr}T${timeStr}:00`);
    return d.toISOString();
  }
};
