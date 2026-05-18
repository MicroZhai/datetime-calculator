(function () {
  'use strict';

  /* ========== 初始化 ========== */
  function init() {
    // 首次使用：造一个示例计算器
    if (Storage.getAll().length === 0) {
      Storage.save({
        id: String(Date.now()),
        name: '示例计算器',
        isBaseTimeNow: true,
        baseTime: 'now',
        durationMinutes: 256,
        createdAt: Date.now()
      });
    }

    Theme.init();
    document.getElementById('theme-btn').textContent = Theme.getIcon();
    UI.renderList();
    bindEvents();
    startLiveRefresh();
    registerSW();
  }

  /* ========== 事件绑定 ========== */
  function bindEvents() {
    // 主题切换
    document.getElementById('theme-btn').addEventListener('click', () => {
      Theme.toggle();
      document.getElementById('theme-btn').textContent = Theme.getIcon();
    });

    // 新建计算器
    document.getElementById('new-btn').addEventListener('click', () => UI.openSheet(null));
    document.getElementById('empty-new-btn').addEventListener('click', () => UI.openSheet(null));

    // 关闭弹窗
    document.getElementById('sheet-close-btn').addEventListener('click', () => UI.closeSheet());
    document.getElementById('sheet-overlay').addEventListener('click', () => UI.closeSheet());

    // 分段控件：切换基准时间模式
    document.getElementById('seg-now').addEventListener('click', () => UI._setBaseTimeMode(true));
    document.getElementById('seg-manual').addEventListener('click', () => UI._setBaseTimeMode(false));

    // 重置为"现在"
    document.getElementById('reset-now-btn').addEventListener('click', () => {
      UI._setBaseTimeMode(true);
      const now = new Date();
      document.getElementById('input-date').value = now.toISOString().slice(0, 10);
      document.getElementById('input-time').value = now.toTimeString().slice(0, 5);
    });

    // 正负切换
    document.getElementById('toggle-sign-btn').addEventListener('click', () => {
      UI._isNegative = !UI._isNegative;
      UI._updateSignBtn();
    });

    // 快捷时长按钮
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.minutes);
        document.getElementById('input-hours').value = Math.floor(mins / 60);
        document.getElementById('input-minutes').value = mins % 60;
        UI._isNegative = false;
        UI._updateSignBtn();
      });
    });

    // 保存
    document.getElementById('save-btn').addEventListener('click', () => {
      const data = UI.readSheet();
      if (data.durationMinutes === 0) {
        UI.showToast('请输入时长');
        return;
      }

      let calc;
      if (UI._editingId) {
        const existing = Storage.getAll().find(c => c.id === UI._editingId);
        calc = { ...existing, ...data };
      } else {
        calc = { id: String(Date.now()), createdAt: Date.now(), ...data };
      }

      Storage.save(calc);
      UI.closeSheet();
      UI.renderList();
    });

    // 删除
    document.getElementById('delete-btn').addEventListener('click', () => {
      if (!UI._editingId) return;
      Storage.remove(UI._editingId);
      UI.closeSheet();
      UI.renderList();
      UI.showToast('已删除');
    });

    // 列表点击事件代理 —— 卡片点击 / 菜单按钮 / 复制按钮
    document.getElementById('calc-list').addEventListener('click', e => {
      const card = e.target.closest('.calc-card');
      if (!card) return;
      const id = card.dataset.id;

      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const action = actionBtn.dataset.action;
        if (action === 'menu') {
          const rect = actionBtn.getBoundingClientRect();
          UI.showContextMenu(rect.left - 120, rect.bottom + 4, id);
          e.stopPropagation();
          return;
        }
        if (action === 'copy') {
          const calc = Storage.getAll().find(c => c.id === id);
          if (calc) {
            const result = Calculator.calcResult(
              calc.isBaseTimeNow ? 'now' : calc.baseTime,
              calc.durationMinutes
            );
            const text = `${Calculator.formatDate(result)} ${Calculator.formatTime(result)}`;
            navigator.clipboard.writeText(text).then(() => UI.showToast('已复制'))
              .catch(() => UI.showToast('复制失败'));
          }
          e.stopPropagation();
          return;
        }
        if (action === 'edit-duration') {
          UI.openSheet(id);
          setTimeout(() => document.getElementById('input-hours').focus(), 400);
          e.stopPropagation();
          return;
        }
        return;
      }

      // 点击卡片主体 → 编辑
      UI.openSheet(id);
    });

    // 右键菜单项
    document.getElementById('ctx-rename').addEventListener('click', () => {
      const id = UI._contextTargetId;
      UI.hideContextMenu();
      if (id) UI.openSheet(id);
    });
    document.getElementById('ctx-delete').addEventListener('click', () => {
      const id = UI._contextTargetId;
      UI.hideContextMenu();
      if (id) {
        Storage.remove(id);
        UI.renderList();
        UI.showToast('已删除');
      }
    });

    // 点击空白关闭右键菜单
    document.addEventListener('click', e => {
      if (!e.target.closest('.context-menu') && !e.target.closest('[data-action="menu"]')) {
        UI.hideContextMenu();
      }
    });

    // 键盘：ESC 关闭弹窗
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        UI.hideContextMenu();
        if (document.getElementById('edit-sheet').classList.contains('open')) {
          UI.closeSheet();
        }
      }
    });
  }

  /* ========== 实时刷新 ========== */
  let _refreshTimer = null;

  function startLiveRefresh() {
    _refreshTimer = setInterval(() => {
      UI.refreshLiveCards();
    }, 60000); // 每分钟刷新

    // 页面不可见时暂停，重新可见时立即刷新一次
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(_refreshTimer);
        _refreshTimer = null;
      } else {
        UI.refreshLiveCards();
        startLiveRefresh();
      }
    });
  }

  /* ========== Service Worker ========== */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // 静默失败，离线也能用（浏览器首次缓存了）
      });
    }
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
