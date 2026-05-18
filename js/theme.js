const Theme = {
  _state: 'auto', // 'auto' | 'light' | 'dark'

  init() {
    this._state = Storage.getTheme();
    this.apply(this._state);
    this._listenSystem();
  },

  toggle() {
    const next = { auto: 'light', light: 'dark', dark: 'auto' };
    this._state = next[this._state];
    Storage.saveTheme(this._state);
    this.apply(this._state);
  },

  getIcon() {
    return { auto: '🌓', light: '☀️', dark: '🌙' }[this._state];
  },

  apply(state) {
    const html = document.documentElement;
    if (state === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      html.setAttribute('data-theme', state);
    }
    this._state = state;
  },

  _listenSystem() {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this._state === 'auto') {
        this.apply('auto');
      }
    });
  }
};
