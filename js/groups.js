const GROUPS_KEY = 'dtc_groups';

const Groups = {
  _initDefault() {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify([{ id: 'default', name: '未分组', createdAt: 0 }])); } catch {}
  },

  getAll() {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      if (!raw) { this._initDefault(); return this._read(); }
      const list = JSON.parse(raw);
      if (list.length === 0) { this._initDefault(); return this._read(); }
      list.sort((a, b) => a.createdAt - b.createdAt);
      return list;
    } catch { this._initDefault(); return this._read(); }
  },

  _read() {
    try {
      const raw = localStorage.getItem(GROUPS_KEY);
      return raw ? JSON.parse(raw).sort((a, b) => a.createdAt - b.createdAt) : [];
    } catch { return []; }
  },

  add(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    if (this.getAll().find(g => g.name === trimmed)) return null;
    const g = { id: String(Date.now()), name: trimmed, createdAt: Date.now() };
    const list = this.getAll();
    list.push(g);
    this._write(list);
    return g;
  },

  remove(id) {
    if (id === 'default') return;
    // 将组内计算器移回 default
    const calcs = Storage.getAll();
    calcs.forEach(c => { if (c.groupId === id) { c.groupId = 'default'; Storage.save(c); } });
    this._write(this.getAll().filter(g => g.id !== id));
  },

  rename(id, newName) {
    if (id === 'default') return null;
    const trimmed = newName.trim();
    if (!trimmed) return null;
    const list = this.getAll();
    const g = list.find(x => x.id === id);
    if (!g) return null;
    if (list.find(x => x.name === trimmed && x.id !== id)) return null;
    g.name = trimmed;
    this._write(list);
    return g;
  },

  _write(list) {
    try { localStorage.setItem(GROUPS_KEY, JSON.stringify(list)); } catch {}
  }
};
