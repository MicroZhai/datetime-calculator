(() => {
  const STORAGE_KEY = 'dtc-theme';
  const root = document.documentElement;
  const themeButton = document.getElementById('themeBtn');
  const themeMenu = document.getElementById('themeMenu');
  const themeColorMeta = document.getElementById('themeColorMeta');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const options = [...document.querySelectorAll('[data-theme-option]')];
  const labels = { system: '跟随系统', light: '浅色', dark: '深色' };

  function getPreference() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch (_) {
      return 'system';
    }
  }

  function getEffectiveTheme(preference = getPreference()) {
    if (preference === 'light' || preference === 'dark') return preference;
    return systemTheme.matches ? 'dark' : 'light';
  }

  function updateThemeColor(preference = getPreference()) {
    if (!themeColorMeta) return;
    themeColorMeta.content = getEffectiveTheme(preference) === 'dark' ? '#000000' : '#F1F3F5';
  }

  function syncControls(preference = getPreference()) {
    options.forEach(option => {
      option.setAttribute('aria-checked', String(option.dataset.themeOption === preference));
    });
    if (themeButton) {
      const label = labels[preference];
      themeButton.setAttribute('aria-label', `主题：${label}`);
      themeButton.title = `主题：${label}`;
    }
  }

  function applyTheme(preference, persist = false) {
    const next = preference === 'light' || preference === 'dark' ? preference : 'system';

    if (next === 'system') delete root.dataset.theme;
    else root.dataset.theme = next;

    if (persist) {
      try {
        if (next === 'system') localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, next);
      } catch (_) {}
    }

    updateThemeColor(next);
    syncControls(next);
  }

  function openMenu() {
    if (!themeMenu || !themeButton) return;
    themeMenu.hidden = false;
    themeButton.setAttribute('aria-expanded', 'true');
    const selected = themeMenu.querySelector('[aria-checked="true"]') || options[0];
    requestAnimationFrame(() => selected?.focus({ preventScroll: true }));
  }

  function closeMenu(returnFocus = false) {
    if (!themeMenu || !themeButton || themeMenu.hidden) return;
    themeMenu.hidden = true;
    themeButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) requestAnimationFrame(() => themeButton.focus({ preventScroll: true }));
  }

  themeButton?.addEventListener('click', () => {
    if (themeMenu.hidden) openMenu();
    else closeMenu(true);
  });

  themeMenu?.addEventListener('click', event => {
    const option = event.target.closest('[data-theme-option]');
    if (!option) return;
    applyTheme(option.dataset.themeOption, true);
    closeMenu(true);
  });

  themeMenu?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = Math.max(0, options.indexOf(document.activeElement));
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = options.length - 1;
    options[nextIndex]?.focus();
  });

  document.addEventListener('pointerdown', event => {
    if (!themeMenu || themeMenu.hidden) return;
    if (themeMenu.contains(event.target) || themeButton?.contains(event.target)) return;
    closeMenu(false);
  });

  systemTheme.addEventListener?.('change', () => {
    if (getPreference() === 'system') updateThemeColor('system');
  });

  applyTheme(getPreference(), false);
})();
