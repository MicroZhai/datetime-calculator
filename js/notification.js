/*
 * 前台提醒：应用打开时，通过 Notification API 在计算器结束前弹出提醒。
 * 后台/锁屏时浏览器可能无法弹窗，这是浏览器的安全限制。
 * 配置为全局设定（开启 + 提前分钟数），对所有计算器生效。
 */
const NotificationManager = {
  _key: 'dtc_reminder_settings',
  _config: { enabled: false, leadMinutes: 0 },
  _timer: null,
  _fired: new Set(),   // 已提醒的关键字 `id:endTime`，避免重复弹窗

  load() {
    try {
      const raw = localStorage.getItem(this._key);
      if (raw) {
        const cfg = JSON.parse(raw);
        this._config = {
          enabled: !!cfg.enabled,
          leadMinutes: parseInt(cfg.leadMinutes, 10) || 0
        };
      }
    } catch (e) { /* 忽略损坏数据 */ }
  },

  save() {
    try { localStorage.setItem(this._key, JSON.stringify(this._config)); } catch (e) {}
  },

  getConfig() {
    return { ...this._config };
  },

  setConfig(partial) {
    const wasEnabled = this._config.enabled;
    this._config = { ...this._config, ...partial };
    this._config.leadMinutes = parseInt(this._config.leadMinutes, 10) || 0;
    this.save();

    if (this._config.enabled) {
      // 用户开启时（用户手势）申请权限
      if (!wasEnabled) this.requestPermission();
      this.check();
    } else {
      this._fired.clear();
    }
    this.updateSettingsDesc();
  },

  isSupported() {
    return typeof Notification !== 'undefined' && 'Notification' in window;
  },

  requestPermission() {
    if (!this.isSupported()) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
    Notification.requestPermission().then(() => {
      if (Notification.permission === 'granted') this.check();
    }).catch(() => {});
  },

  updateSettingsDesc() {
    const el = document.getElementById('settings-reminder-desc');
    if (!el) return;
    if (!this._config.enabled) {
      el.textContent = '未开启';
      return;
    }
    const lead = this._config.leadMinutes;
    el.textContent = lead > 0 ? `提前 ${lead} 分钟` : '结束时提醒';
  },

  /** 扫描所有计算器，在触发点弹提醒 */
  check() {
    if (!this._config.enabled) return;
    if (!this.isSupported()) return;
    if (Notification.permission !== 'granted') return;

    const now = Date.now();
    const leadMs = this._config.leadMinutes * 60 * 1000;
    Storage.getAll().forEach(c => {
      const end = Calculator.getEndTime(c);
      if (!end) return;
      const endMs = end.getTime();
      const triggerAt = endMs - leadMs;
      if (now < triggerAt) return;   // 未到触发点
      if (now > endMs) return;       // 已结束
      const key = `${c.id}:${endMs}`;
      if (this._fired.has(key)) return;
      this._fired.add(key);
      this._fire(c, end, leadMs);
    });
  },

  _fire(calc, end, leadMs) {
    const name = calc.name || '未命名计算器';
    const title = leadMs > 0 ? `「${name}」即将结束` : `「${name}」已结束`;
    const body = `结束时间：${Calculator.formatDateTime(end)}`;
    try {
      const n = new Notification(title, { body, icon: 'icons/icon-192.png' });
      n.onclick = () => { n.close(); window.focus(); };
    } catch (e) { /* 个别环境需 service worker 支持，忽略 */ }
  },

  init() {
    this.load();
    this.updateSettingsDesc();
    if (this._config.enabled) {
      this.requestPermission();
    }
    this._timer = setInterval(() => this.check(), 30000);
    this.check();
  }
};