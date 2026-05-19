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

    // 桌面快捷菜单 URL 参数检测
    handleShortcutAction();
  }

  function handleShortcutAction() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (!action) return;

    if (action === 'new') {
      UI.openSheet(null);
    } else if (action === 'history') {
      UI.openHistory();
    }

    // 清理 URL 参数，防止刷新重复触发
    if (window.history && window.history.replaceState) {
      const url = new URL(window.location);
      url.search = '';
      window.history.replaceState({}, '', url);
    }
  }

  /* ========== 事件绑定 ========== */
  function bindEvents() {
    // 主题切换
    document.getElementById('theme-btn').addEventListener('click', () => {
      Theme.toggle();
      document.getElementById('theme-btn').textContent = Theme.getIcon();
    });

    // 新建计算器
    const openNewSheet = () => UI.openSheet(null);
    document.getElementById('new-btn-bottom').addEventListener('click', openNewSheet);
    document.getElementById('empty-new-btn').addEventListener('click', openNewSheet);

    // 历史记录
    document.getElementById('history-btn').addEventListener('click', () => UI.openHistory());
    document.getElementById('history-close-btn').addEventListener('click', () => UI.closeHistory());
    document.getElementById('history-overlay').addEventListener('click', () => UI.closeHistory());

    // 清空历史
    document.getElementById('clear-history-btn').addEventListener('click', () => UI.clearHistory());

    // 历史列表内删除 + 复用
    document.getElementById('history-list').addEventListener('click', e => {
      const delBtn = e.target.closest('.js-history-del');
      if (delBtn) {
        UI.deleteHistoryItem(delBtn.dataset.id);
        return;
      }
      const reuseBtn = e.target.closest('.js-history-reuse');
      if (reuseBtn) {
        UI.reuseHistory(reuseBtn.dataset.id);
      }
    });

    // 关闭弹窗
    document.getElementById('sheet-close-btn').addEventListener('click', () => UI.closeSheet());
    document.getElementById('sheet-overlay').addEventListener('click', () => UI.closeSheet());

    // 确认弹窗按钮
    document.getElementById('confirm-cancel-btn').addEventListener('click', () => UI.hideConfirm());
    document.getElementById('confirm-ok-btn').addEventListener('click', () => UI._executeConfirm());
    document.getElementById('confirm-overlay').addEventListener('click', () => UI.hideConfirm());

    // "此刻"按钮
    document.getElementById('now-btn').addEventListener('click', () => {
      UI.showConfirm('将清空所有时段数据，确定吗？', '清空', 'confirm-btn--danger', () => {
        const now = new Date();
        document.getElementById('input-date').value = Calculator.toLocalDateStr(now);
        document.getElementById('input-time').value = Calculator.toLocalTimeStr(now);
        UI._segments.forEach(s => {
          s.durationMinutes = 0;
          s.isNegative = false;
        });
        UI._dirty = true;
        UI._rebuildSegmentEditors();
        UI.showToast('已同步为当前时间，数据已清零');
      });
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
      if (e.target.closest('.js-seg-clear')) {
        UI.clearSegmentDuration(idx);
        return;
      }
      UI._activeSegIdx = idx;
    });

    // 时长输入变化 → 双向联动（change 事件，离开输入框后才触发）
    document.getElementById('segments-container').addEventListener('change', e => {
      const editor = e.target.closest('.seg-editor');
      if (!editor) return;
      const idx = parseInt(editor.dataset.segIdx);

      UI._dirty = true;
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

    // 名称和基准时间变化也标记 dirty
    document.getElementById('input-name').addEventListener('input', () => { UI._dirty = true; });
    document.getElementById('input-date').addEventListener('change', () => { UI._dirty = true; });
    document.getElementById('input-time').addEventListener('change', () => { UI._dirty = true; });

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
        calc = { id: String(Date.now()), createdAt: Date.now(), pinned: false, ...data };
      }

      Storage.save(calc);
      UI.closeSheet(true);
      UI.renderList();
      UI.showToast('已保存');

      // 记录历史
      const finalResult = Calculator.getFinalResult(calc);
      const baseDate = new Date(calc.baseTime);

      // 跨天标识
      const baseDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      const resultDay = new Date(finalResult.getFullYear(), finalResult.getMonth(), finalResult.getDate());
      const dayDiff = Math.round((resultDay - baseDay) / 86400000);
      let crossTag = '';
      if (dayDiff === 1) crossTag = ' (次日)';
      else if (dayDiff > 1) crossTag = ` (+${dayDiff}天)`;
      else if (dayDiff < 0) crossTag = ` (${dayDiff}天)`;

      History.add({
        id: String(Date.now()),
        calcName: data.name,
        baseTime: calc.baseTime,
        baseTimeFormatted: Calculator.formatDateTime(baseDate),
        resultTime: finalResult.toISOString(),
        resultTimeFormatted: Calculator.formatDateTime(finalResult) + crossTag,
        segments: calc.segments.map(s => ({
          name: s.name || '',
          durationMinutes: s.durationMinutes
        })),
        savedAt: `${Calculator.toLocalDateStr(new Date())} ${Calculator.toLocalTimeStr(new Date())}`
      });
    });

    // 删除（弹窗内）
    document.getElementById('delete-btn').addEventListener('click', () => {
      if (!UI._editingId) return;
      const name = document.getElementById('input-name').value.trim() || '未命名计算器';
      UI.showConfirm(`确定删除「${name}」吗？此操作不可撤销。`, '删除', 'confirm-btn--danger', () => {
        Storage.remove(UI._editingId);
        UI.closeSheet(true);
        UI.renderList();
        UI.showToast('已删除');
      });
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
        if (action === 'expand') {
          const detail = card.querySelector('.card-process-detail');
          const btn = actionBtn;
          const arrow = btn.querySelector('.card-expand-arrow');
          if (detail.style.display === 'none') {
            detail.style.display = 'block';
            arrow.textContent = '▲';
            btn.childNodes[btn.childNodes.length - 1].textContent = ' 收起过程';
          } else {
            detail.style.display = 'none';
            arrow.textContent = '▼';
            btn.childNodes[btn.childNodes.length - 1].textContent = ' 展开过程';
          }
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
    document.getElementById('ctx-copy-detail').addEventListener('click', () => {
      const id = UI._contextTargetId;
      UI.hideContextMenu();
      if (id) {
        const calc = Storage.getAll().find(c => c.id === id);
        if (calc) {
          const text = UI.getCalcDetailText(calc);
          navigator.clipboard.writeText(text).then(() => UI.showToast('已复制计算详情'))
            .catch(() => UI.showToast('复制失败'));
        }
      }
    });
    document.getElementById('ctx-delete').addEventListener('click', () => {
      const id = UI._contextTargetId;
      UI.hideContextMenu();
      if (id) {
        const calc = Storage.getAll().find(c => c.id === id);
        const name = calc ? calc.name : '未命名计算器';
        UI.showConfirm(`确定删除「${name}」吗？此操作不可撤销。`, '删除', 'confirm-btn--danger', () => {
          Storage.remove(id);
          UI.renderList();
          UI.showToast('已删除');
        });
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
        UI.hideConfirm();
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
      // 检测到新 SW 等待激活
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      // 监听 SW 消息
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data === 'update-available') {
          showUpdateBanner();
        }
      });

      // 如果已有等待中的 SW
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }
    }).catch(() => {});
  }

  function showUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (!banner) return;
    banner.classList.remove('hidden');
    banner.classList.add('visible');
    document.getElementById('update-btn').addEventListener('click', () => {
      window.location.reload();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
