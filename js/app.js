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
        createdAt: Date.now(),
        pinned: false
      });
    }

    Theme.init();
    UI.renderListDebounced = debounce(() => UI.renderList(), 100);
    UI.renderGroupTabs();
    UI.renderList();
    bindEvents();

    // 提醒初始化（尽量早点，先申请权限再开定时器）
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.init();
    }

    startLiveClock();
    registerSW();

    // 桌面快捷菜单 URL 参数检测
    handleShortcutAction();
  }

  /* ====== 底部弹窗通用开关（遮罩 + 面板） ====== */
  function openSheet(overlayId, sheetId) {
    document.getElementById(overlayId).classList.remove('hidden');
    document.getElementById(sheetId).classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSheet(overlayId, sheetId) {
    document.getElementById(sheetId).classList.remove('open');
    document.getElementById(overlayId).classList.add('hidden');
    document.body.style.overflow = '';
  }

  /* ====== 分组管理弹窗 ====== */
  function renderGroupList() {
    const listEl = document.getElementById('group-list');
    const groups = Groups.getAll();
    listEl.innerHTML = groups.map(g => {
      const count = Storage.getAll().filter(c => (c.groupId || 'default') === g.id).length;
      const delBtn = g.id === 'default' ? '' : `<button class="group-row-del" data-id="${g.id}">✕</button>`;
      return `<div class="group-row">
        <span class="group-row-name">${UI._escape(g.name)}</span>
        <span class="group-row-count">${count} 个</span>
        ${delBtn}
      </div>`;
    }).join('');
  }
  function openGroupSheet() { renderGroupList(); openSheet('group-overlay', 'group-sheet'); }

  /* ====== 设置弹窗 ====== */
  function openSettingsSheet() {
    const themeSelect = document.getElementById('settings-theme-select');
    themeSelect.value = Theme._state;
    if (typeof NotificationManager !== 'undefined') {
      NotificationManager.updateSettingsDesc();
    }
    openSheet('settings-overlay', 'settings-sheet');
  }

  /* ====== 提醒设置弹窗 ====== */
  function openReminderSheet() {
    if (typeof NotificationManager === 'undefined') return;
    const cfg = NotificationManager.getConfig();
    document.getElementById('reminder-enabled').checked = !!cfg.enabled;
    document.getElementById('reminder-lead').value = String(cfg.leadMinutes || 0);
    openSheet('reminder-overlay', 'reminder-sheet');
  }

  /* ========== 事件绑定 ========== */
  function bindEvents() {
    /* ====== 底部导航 ====== */
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const nav = item.dataset.nav;
        if (nav === 'toggle') {
          UI.toggleViewMode();
          return;
        }
        if (nav === 'group') { openGroupSheet(); return; }
        if (nav === 'history') { UI.openHistory(); return; }
        if (nav === 'settings') { openSettingsSheet(); return; }
      });
    });

    /* ====== 分组选择栏（chips） ====== */
    document.getElementById('group-filter-bar').addEventListener('click', e => {
      const chip = e.target.closest('.group-chip');
      if (!chip) return;
      UI._currentGroup = chip.dataset.groupId;
      UI.renderGroupTabs();
      UI.renderList();
    });

    /* ====== 新建 & 历史入口 ====== */
    const openNewSheet = () => UI.openSheet(null);
    document.getElementById('new-btn-bottom').addEventListener('click', openNewSheet);
    document.getElementById('empty-new-btn').addEventListener('click', openNewSheet);

    // 历史记录
    document.getElementById('history-close-btn').addEventListener('click', () => UI.closeHistory());
    document.getElementById('history-overlay').addEventListener('click', () => UI.closeHistory());
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

    /* ====== 分组管理弹窗 ====== */
    document.getElementById('group-close-btn').addEventListener('click', () => closeSheet('group-overlay', 'group-sheet'));
    document.getElementById('group-overlay').addEventListener('click', () => closeSheet('group-overlay', 'group-sheet'));
    document.getElementById('group-add-btn').addEventListener('click', () => {
      const input = document.getElementById('group-input');
      const name = input.value.trim();
      if (!name) return;
      if (Groups.getAll().find(g => g.name === name)) { UI.showToast('分组名称已存在'); return; }
      Groups.add(name);
      input.value = '';
      renderGroupList();
      UI.renderGroupTabs();
    });
    document.getElementById('group-list').addEventListener('click', e => {
      const delBtn = e.target.closest('.group-row-del');
      if (!delBtn) return;
      Groups.remove(delBtn.dataset.id);
      if (UI._currentGroup === delBtn.dataset.id) UI._currentGroup = 'all';
      renderGroupList();
      UI.renderGroupTabs();
      UI.renderList();
    });

    /* ====== 设置弹窗 ====== */
    document.getElementById('settings-close-btn').addEventListener('click', () => closeSheet('settings-overlay', 'settings-sheet'));
    document.getElementById('settings-overlay').addEventListener('click', () => closeSheet('settings-overlay', 'settings-sheet'));
    document.getElementById('settings-theme-select').addEventListener('change', e => {
      Theme.apply(e.target.value);
      Storage.saveTheme(e.target.value);
    });
    document.getElementById('settings-reminder-btn').addEventListener('click', openReminderSheet);

    /* ====== 提醒设置弹窗 ====== */
    document.getElementById('reminder-close-btn').addEventListener('click', () => closeSheet('reminder-overlay', 'reminder-sheet'));
    document.getElementById('reminder-overlay').addEventListener('click', () => closeSheet('reminder-overlay', 'reminder-sheet'));
    document.getElementById('reminder-enabled').addEventListener('change', () => {
      if (typeof NotificationManager === 'undefined') return;
      NotificationManager.setConfig({ enabled: document.getElementById('reminder-enabled').checked });
    });
    document.getElementById('reminder-lead').addEventListener('change', () => {
      if (typeof NotificationManager === 'undefined') return;
      NotificationManager.setConfig({ leadMinutes: parseInt(document.getElementById('reminder-lead').value, 10) || 0 });
    });

    /* ====== 编辑弹窗 ====== */
    document.getElementById('sheet-close-btn').addEventListener('click', () => UI.closeSheet());
    document.getElementById('sheet-overlay').addEventListener('click', () => UI.closeSheet());

    // 确认弹窗按钮
    document.getElementById('confirm-cancel-btn').addEventListener('click', () => UI.hideConfirm());
    document.getElementById('confirm-ok-btn').addEventListener('click', () => UI._executeConfirm());
    document.getElementById('confirm-overlay').addEventListener('click', () => UI.hideConfirm());

    // "此刻"按钮
    document.getElementById('now-btn').addEventListener('click', () => {
      UI.showConfirm('将清空所有时段数据，确定吗？', '清空', 'confirm-btn--danger', () => {
        UI._segments.forEach(s => {
          s.durationMinutes = 0;
          s.isNegative = false;
        });
        const now = new Date();
        const editor = document.querySelector('.seg-editor[data-seg-idx="0"]');
        if (editor) {
          editor.querySelector('.js-seg-start-date').value = Calculator.toLocalDateStr(now);
          editor.querySelector('.js-seg-start-time').value = Calculator.toLocalTimeStr(now);
          editor.querySelector('.js-seg-end-date').value = Calculator.toLocalDateStr(now);
          editor.querySelector('.js-seg-end-time').value = Calculator.toLocalTimeStr(now);
        }
        UI._dirty = true;
        UI._syncBaseTimeDisplay();
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

    // 时长输入变化 → 双向联动
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

    // 名称变化也标记 dirty
    document.getElementById('input-name').addEventListener('input', () => { UI._dirty = true; });

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
      UI._syncSegmentTimes(UI._activeSegIdx);
    });

    /* ====== 保存 & 删除 ====== */
    document.getElementById('save-btn').addEventListener('click', () => {
      const data = UI.readSheet();

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
        calc = { id: String(Date.now()), createdAt: Date.now(), pinned: false, groupId: UI._currentGroup, ...data };
      }

      Storage.save(calc);
      UI.closeSheet(true);
      UI.renderListDebounced();
      UI.showToast('已保存');

      // 记录历史
      const finalResult = Calculator.getFinalResult(calc);
      const baseDate = new Date(calc.baseTime);

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
        groupId: data.groupId,
        baseTime: calc.baseTime,
        baseTimeFormatted: Calculator.formatDateTime(baseDate),
        resultTime: finalResult.toISOString(),
        resultTimeFormatted: Calculator.formatDateTime(finalResult) + crossTag,
        segments: calc.segments.map(s => ({
          name: s.name || '',
          durationMinutes: s.durationMinutes,
          startMinutes: s.startMinutes
        })),
        savedAt: `${Calculator.toLocalDateStr(new Date())} ${Calculator.toLocalTimeStr(new Date())}`
      });
    });

    // 删除（弹窗内）
    document.getElementById('delete-btn').addEventListener('click', () => {
      if (!UI._editingId) return;
      const id = UI._editingId;
      const name = document.getElementById('input-name').value.trim() || '未命名计算器';
      UI.showConfirm(`确定删除「${name}」吗？此操作不可撤销。`, '删除', 'confirm-btn--danger', () => {
        const deleted = Storage.getAll().find(c => c.id === id);
        Storage.remove(id);
        UI.closeSheet(true);
        UI.renderList();
        UI.showToast('已删除', '撤销', () => {
          if (deleted) { Storage.save(deleted); UI.renderList(); }
        });
      });
    });

    /* ====== 列表卡片 ====== */
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
        if (action === 'edit-duration') {
          UI.openSheet(id);
          e.stopPropagation();
          return;
        }
        return;
      }

      UI.openSheet(id);
    });

    /* ====== 右键菜单 ====== */
    document.getElementById('ctx-pin').addEventListener('click', () => {
      const id = UI._contextTargetId;
      UI.hideContextMenu();
      if (id) {
        const calc = Storage.getAll().find(c => c.id === id);
        if (calc) {
          calc.pinned = !calc.pinned;
          Storage.save(calc);
          UI.renderList();
          UI.showToast(calc.pinned ? '已置顶' : '已取消置顶');
        }
      }
    });
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
    document.getElementById('ctx-move-group').addEventListener('click', () => {
      const id = UI._contextTargetId;
      UI.hideContextMenu();
      if (!id) return;
      const calc = Storage.getAll().find(c => c.id === id);
      if (!calc) return;
      const groups = Groups.getAll();
      const currentName = groups.find(g => g.id === calc.groupId);
      const label = currentName ? `当前：「${currentName.name}」` : '当前：全部';
      const groupNames = groups.map(g => g.name).join('、') || '暂无分组，请先创建分组';
      const newGroup = prompt(`${label}\n\n可选分组：${groupNames}\n\n输入分组名称移动到该分组（留空移回全部）：`);
      if (newGroup === null) return;
      const trimmed = newGroup.trim();
      if (trimmed === '') {
        calc.groupId = 'default';
      } else {
        let group = groups.find(g => g.name === trimmed);
        if (!group) {
          group = Groups.save({ id: String(Date.now()), name: trimmed, createdAt: Date.now() });
        }
        calc.groupId = group.id;
      }
      Storage.save(calc);
      UI.renderGroupTabs();
      UI.renderListDebounced();
      UI.showToast('已移动');
    });
    document.getElementById('ctx-delete').addEventListener('click', () => {
      const id = UI._contextTargetId;
      UI.hideContextMenu();
      if (id) {
        const calc = Storage.getAll().find(c => c.id === id);
        const name = calc ? calc.name : '未命名计算器';
        UI.showConfirm(`确定删除「${name}」吗？此操作不可撤销。`, '删除', 'confirm-btn--danger', () => {
          const deleted = calc;
          Storage.remove(id);
          UI.renderList();
          UI.showToast('已删除', '撤销', () => {
            if (deleted) { Storage.save(deleted); UI.renderList(); }
          });
        });
      }
    });

    /* ====== 全局事件 ====== */
    document.addEventListener('click', e => {
      if (!e.target.closest('.context-menu') && !e.target.closest('[data-action="menu"]')) {
        UI.hideContextMenu();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        UI.hideContextMenu();
        UI.hideConfirm();
        if (document.getElementById('edit-sheet').classList.contains('open')) {
          UI.closeSheet();
        }
        if (document.getElementById('group-sheet').classList.contains('open')) {
          closeSheet('group-overlay', 'group-sheet');
        }
        if (document.getElementById('settings-sheet').classList.contains('open')) {
          closeSheet('settings-overlay', 'settings-sheet');
        }
        if (document.getElementById('reminder-sheet').classList.contains('open')) {
          closeSheet('reminder-overlay', 'reminder-sheet');
        }
        if (document.getElementById('history-sheet').classList.contains('open')) {
          UI.closeHistory();
        }
      }
    });
  }

  /* ========== 实时时钟 ========== */
  let _clockTimer = null;

  function startLiveClock() {
    UI.updateClock();
    _clockTimer = setInterval(() => UI.updateClock(), 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(_clockTimer);
      _clockTimer = null;
    } else {
      UI.updateClock();
      if (!_clockTimer) {
        _clockTimer = setInterval(() => UI.updateClock(), 1000);
      }
      // 回到前台立即刷新提醒与卡片
      UI.renderList();
      if (typeof NotificationManager !== 'undefined') {
        NotificationManager.check();
      }
    }
  });

  /* ========== Service Worker ========== */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data === 'update-available') {
          showUpdateBanner();
        }
      });

      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }
    }).catch(() => {});
  }

  let _updateBannerShown = false;

  function showUpdateBanner() {
    if (_updateBannerShown) return;
    _updateBannerShown = true;
    const banner = document.getElementById('update-banner');
    if (!banner) return;
    banner.classList.remove('hidden');
    banner.classList.add('visible');
    document.getElementById('update-btn').addEventListener('click', () => {
      window.location.reload();
    });
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

    if (window.history && window.history.replaceState) {
      const url = new URL(window.location);
      url.search = '';
      window.history.replaceState({}, '', url);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();