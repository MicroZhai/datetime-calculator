function debounce(fn, delay) {
  let timer;
  return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
}
function throttle(fn, delay) {
  let last = 0;
  return function (...args) { const now = Date.now(); if (now - last >= delay) { last = now; fn.apply(this, args); } };
}

const UI = {
  _editingId: null,
  _contextTargetId: null,
  _segments: [],
  _activeSegIdx: 0,
  _dirty: false,
  _confirmCallback: null,
  _toastTimer: null,
  _closeTimer: null,
  _pendingDelete: null,
  _currentGroup: 'all',

  /* ========== Toast ========== */
  showToast(msg, actionText, onAction) {
    const el = document.getElementById('toast');
    el.innerHTML = this._escape(msg);
    if (actionText && onAction) {
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = actionText;
      btn.onclick = () => { onAction(); el.classList.remove('visible'); };
      el.appendChild(btn);
    }
    el.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
  },

  /* ========== 确认弹窗 ========== */
  showConfirm(msg, okLabel, okClass, callback) {
    this._confirmCallback = callback;
    document.getElementById('confirm-msg').textContent = msg;
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.textContent = okLabel || '确定';
    okBtn.className = 'confirm-btn ' + (okClass || 'confirm-btn--danger');
    document.getElementById('confirm-overlay').classList.remove('hidden');
    document.getElementById('confirm-dialog').classList.add('open');
    document.getElementById('confirm-cancel-btn').focus();
  },

  hideConfirm() {
    document.getElementById('confirm-dialog').classList.remove('open');
    document.getElementById('confirm-overlay').classList.add('hidden');
    this._confirmCallback = null;
  },

  _executeConfirm() {
    if (this._confirmCallback) {
      const cb = this._confirmCallback;
      this.hideConfirm();
      cb();
    }
  },

  /* ========== 右键菜单 ========== */
  showContextMenu(x, y, calcId) {
    this._contextTargetId = calcId;
    const calc = Storage.getAll().find(c => c.id === calcId);
    const pinBtn = document.getElementById('ctx-pin');
    if (pinBtn && calc) {
      pinBtn.textContent = calc.pinned ? '📌 取消置顶' : '📌 置顶';
    }
    const menu = document.getElementById('context-menu');
    const maxX = window.innerWidth - 160;
    const maxY = window.innerHeight - 100;
    menu.style.left = Math.min(x, maxX) + 'px';
    menu.style.top = Math.min(y, maxY) + 'px';
    menu.classList.remove('hidden');
  },

  hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
    this._contextTargetId = null;
  },

  /* ========== 工具 ========== */
  _escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  _escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  _numToCircle(n) {
    const circles = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    return circles[n - 1] || n + ' ';
  },

  renderListDebounced: null,  // 由 app.js 初始化

  /* ========== 分组管理 ========== */
  renderGroupTabs() {
    const groups = Groups.getAll();
    const bar = document.getElementById('group-filter-bar');
    let html = '<select class="group-select">';
    html += `<option value="all"${this._currentGroup === 'all' ? ' selected' : ''}>全部</option>`;
    groups.forEach(g => {
      html += `<option value="${g.id}"${this._currentGroup === g.id ? ' selected' : ''}>${this._escape(g.name)}</option>`;
    });
    html += '</select>';
    bar.innerHTML = html;
  },

};
