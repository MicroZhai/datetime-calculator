const HISTORY_KEY = 'dtc_history';
const HISTORY_MAX = 50;

const History = {
  getAll() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  add(record) {
    const list = this.getAll();
    list.unshift(record);
    if (list.length > HISTORY_MAX) {
      list.length = HISTORY_MAX;
    }
    this._write(list);
  },

  remove(id) {
    const list = this.getAll().filter(r => r.id !== id);
    this._write(list);
  },

  clear() {
    this._write([]);
  },

  _write(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
  }
};
