const STORAGE_KEY = 'dtc_calculators';
const THEME_KEY = 'dtc_theme';
const DURATION_HISTORY_KEY = 'dtc_duration_history';

const Storage = {
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      let migrated = false;
      for (const c of list) {
        if (!c.segments) {
          c.segments = [{ name: '', durationMinutes: c.durationMinutes || 0 }];
          delete c.durationMinutes;
          migrated = true;
        }
      }
      if (migrated) this._write(list);
      return list;
    } catch {
      return [];
    }
  },

  save(calc) {
    const list = this.getAll();
    const idx = list.findIndex(c => c.id === calc.id);
    if (idx >= 0) {
      list[idx] = calc;
    } else {
      list.unshift(calc);
    }
    this._write(list);
    return calc;
  },

  remove(id) {
    const list = this.getAll().filter(c => c.id !== id);
    this._write(list);
  },

  _write(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // localStorage 满了或隐私模式下不可用
    }
  },

  getTheme() {
    return localStorage.getItem(THEME_KEY) || 'auto';
  },

  saveTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  },

  addDurationHistory(minutes) {
    if (!minutes || minutes === 0) return;
    let list = this.getDurationHistoryAll();
    list = list.filter(m => m !== minutes);
    list.unshift(minutes);
    if (list.length > 20) list = list.slice(0, 20);
    try {
      localStorage.setItem(DURATION_HISTORY_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
  },

  getDurationHistoryAll() {
    try {
      const raw = localStorage.getItem(DURATION_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getDurationHistory() {
    return this.getDurationHistoryAll().slice(0, 10);
  }
};
