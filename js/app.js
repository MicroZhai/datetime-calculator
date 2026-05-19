(function () {
  'use strict';

  /* ========== 初始化 ========== */
  function init() {
    if (Storage.getAll().length === 0) {
      Storage.save({
        id: String(Date.now()),
        name: '示例计算器',
        isBaseTimeNow: false,
        baseTime: new Date().toISOString(),
        segments: [
          { name: '', durationMinutes: 256 }
        ],
        createdAt: Date.now()
      });
    }

    Theme.init();
    document.getElementById('theme-btn').textContent = Theme.getIcon();
    UI.renderList();
    bindEvents();
    startLiveClock();
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

    // "此刻"按钮
    document.getElementById('now-btn').addEventListener('click', () => {
      const now = new Date();
      document.getElementById('input-date').value = Calculator.toLocalDateStr(now);
      document.getElementById('input-time').value = Calculator.toLocalTimeStr(now);
      // 清零所有时段数据
      UI._segments.forEach(s => {
        s.durationMinutes = 0;
        s.isNegative = false;
      });
      UI._rebuildSegmentEditors();
      UI.showToast('已同步为当前时间，数据已清零');
    });

    // 编辑弹窗事件代理：时段操作 + 时间字段变化
    document.getElementById('segments-container').addEventListener('click', e => {
      const editor = e.target.closest('.seg-editor');
      if (!editor) return;
      const idx = parseInt(editor.dataset.segIdx);

      if (e.target.closest('.js-seg-del')) {
        UI.removeSegment(idx);
        return;
      }
      if (e.target.closest('.js-seg-sign')) {
        UI.toggleSegmentSign(idx);
        return;
      }
      UI._activeSegIdx = idx;
    });

    // 时长输入变化 → 双向联动（change 事件，离开输入框后才触发）
    document.getElementById('segments-container').addEventListener('change', e => {
      const editor = e.target.closest('.seg-editor');
      if (!editor) return;
      const idx = parseInt(editor.dataset.segIdx);

      if (e.target.closest('.js-seg-hours') || e.target.closest('.js-seg-minutes')) {
        UI._syncSegmentTimes(idx);
      }
      if (e.target.closest('.js-seg-end-date') || e.target.closest('.js-seg-end-time')) {
        UI._syncFromEndTime(idx);
      }
      if (e.target.closest('.js-seg-start-date') || e.target.closest('.js-seg-start-time')) {
        UI._syncFromStartTime(idx);
      }
    });

    // 添加时段按钮
    document.getElementById('add-segment-btn').addEventListener('click', () => {
      UI.addSegment();
    });

    // 快捷时长（历史记录）按钮
    document.getElementById('duration-history').addEventListener('click', e => {
      const btn = e.target.closest('.history-btn');
      if (!btn) return;
      const mins = parseInt(btn.dataset.minutes);
      UI.setQuickDuration(mins);
      // 触发联动
      UI._syncSegmentTimes(UI._activeSegIdx);
    });

    // 保存
    document.getElementById('save-btn').addEventListener('click', () => {
      const data = UI.readSheet();
      const totalMin = data.segments.reduce((sum, s) => sum + s.durationMinutes, 0);
      if (totalMin === 0 && data.segments.length === 1) {
        UI.showToast('请输入时长');
        return;
      }

      // 记录时长历史
      data.segments.forEach(s => {
        if (s.durationMinutes !== 0) {
          Storage.addDurationHistory(Math.abs(s.durationMinutes));
        }
      });

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

    // 列表点击事件代理
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
            const result = Calculator.getFinalResult(calc);
            const text = `${Calculator.formatDate(result)} ${Calculator.formatTime(result)}`;
            navigator.clipboard.writeText(text).then(() => UI.showToast('已复制'))
              .catch(() => UI.showToast('复制失败'));
          }
          e.stopPropagation();
          return;
        }
        if (action === 'edit-duration') {
          UI.openSheet(id);
          e.stopPropagation();
          return;
        }
        return;
      }

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

    // ESC 关闭弹窗
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        UI.hideContextMenu();
        if (document.getElementById('edit-sheet').classList.contains('open')) {
          UI.closeSheet();
        }
      }
    });
  }

  /* ========== 实时时钟 ========== */
  let _clockTimer = null;

  function startLiveClock() {
    UI.updateClock();
    _clockTimer = setInterval(() => UI.updateClock(), 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(_clockTimer);
        _clockTimer = null;
      } else {
        UI.updateClock();
        startLiveClock();
      }
    });
  }

  /* ========== Service Worker ========== */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            window.location.reload();
          }
        });
      });

      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data === 'update') {
          window.location.reload();
        }
      });
    }).catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
