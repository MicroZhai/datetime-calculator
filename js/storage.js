const STORAGE_KEY = 'dtc_calculators';
const THEME_KEY = 'dtc_theme';

const Storage = {
  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      list.sort((a, b) => b.createdAt - a.createdAt);
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
  }
};
