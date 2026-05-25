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
    UI.renderList();
    UI.renderGroupTabs();
    bindEvents();
    startLiveClock();
    registerSW();
    initSidebar();

    // 桌面快捷菜单 URL 参数检测
    handleShortcutAction();
  }

  function initSidebar() {
    const themeSelect = document.getElementById('sidebar-theme-select');
    themeSelect.value = Theme._state;
    themeSelect.addEventListener('change', () => {
      Theme.apply(themeSelect.value);
      Storage.saveTheme(themeSelect.value);
    });

    const bgSelect = document.getElementById('sidebar-bg-select');
    const savedBg = localStorage.getItem('dtc_bg_style') || 'none';
    bgSelect.value = savedBg;
    applyBackground(savedBg);
    bgSelect.addEventListener('change', () => {
      applyBackground(bgSelect.value);
    });

    // 分组管理展开/收起
    document.getElementById('sidebar-groups-toggle').addEventListener('click', () => {
      const sub = document.getElementById('sidebar-group-list');
      const arrow = document.querySelector('#sidebar-groups-toggle .sidebar-arrow');
      sub.classList.toggle('hidden');
      arrow.classList.toggle('open');
      if (!sub.classList.contains('hidden')) { renderSidebarGroups(); }
    });

    // 分组列表点击（切换 + 删除 + 添加）
    document.getElementById('sidebar-group-list').addEventListener('click', e => {
      const delBtn = e.target.closest('.sidebar-group-del');
      if (delBtn) {
        const id = delBtn.dataset.id;
        Groups.remove(id);
        if (UI._currentGroup === id) UI._currentGroup = 'all';
        renderSidebarGroups();
        UI.renderGroupTabs();
        UI.renderList();
        return;
      }
      const row = e.target.closest('.sidebar-group-row');
      if (row) {
        UI._currentGroup = row.dataset.groupId;
        renderSidebarGroups();
        UI.renderGroupTabs();
        UI.renderList();
      }
    });

    // 添加分组
    document.getElementById('sidebar-group-add').addEventListener('click', () => {
      const input = document.getElementById('sidebar-group-input');
      const name = input.value.trim();
      if (!name) return;
      if (Groups.getAll().find(g => g.name === name)) { UI.showToast('分组名称已存在'); return; }
      Groups.add(name);
      input.value = '';
      renderSidebarGroups();
      UI.renderGroupTabs();
    });

    document.getElementById('sidebar-about').addEventListener('click', () => {
      UI.showToast('时间计算器 v1.0.0 — 轻量级 PWA 时间计算工具');
    });
  }

  function renderSidebarGroups() {
    const groups = Groups.getAll();
    const listEl = document.getElementById('sidebar-group-list');
    let html = `<div class="sidebar-group-row${UI._currentGroup === 'all' ? ' active' : ''}" data-group-id="all"><span>全部</span></div>`;
    groups.forEach(g => {
      const active = UI._currentGroup === g.id || (UI._currentGroup === '' && g.id === 'default') ? ' active' : '';
      const delBtn = g.id === 'default' ? '' : `<button class="sidebar-group-del" data-id="${g.id}">✕</button>`;
      html += `<div class="sidebar-group-row${active}" data-group-id="${g.id}"><span>${UI._escape(g.name)}</span>${delBtn}</div>`;
    });
    // 添加新分组行
    html += `<div style="display:flex;gap:4px;padding:6px 12px">
      <input type="text" id="sidebar-group-input" placeholder="新分组..." maxlength="10" style="flex:1;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;font-family:inherit">
      <button id="sidebar-group-add" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;cursor:pointer;font-family:inherit;white-space:nowrap">添加</button>
    </div>`;
    listEl.innerHTML = html;
  }

  function applyBackground(style) {
    document.body.classList.remove('bg-grid','bg-gradient','bg-geometry','bg-dynamic');
    if (style && style !== 'none') document.body.classList.add('bg-' + style);
    localStorage.setItem('dtc_bg_style', style || 'none');
  }

  function openSidebar() {
    renderSidebarGroups();
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    document.body.style.overflow = '';
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
    // 侧边栏开关
    document.getElementById("menu-btn").addEventListener("click", () => openSidebar());
    document.getElementById("sidebar-overlay").addEventListener("click", () => closeSidebar());

    // 分组选择
    document.getElementById('group-filter-bar').addEventListener('change', e => {
      if (e.target.classList.contains('group-select')) {
        UI._currentGroup = e.target.value;
        UI.renderList();
      }
    });

    /* ====== 新建 & 历史入口 ====== */
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

    /* ====== 编辑弹窗 ====== */
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
      // 触发联动
      UI._syncSegmentTimes(UI._activeSegIdx);
    });

    /* ====== 保存 & 删除 & 历史按钮 ====== */
    // 保存
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
        if (action === 'edit-duration') {
          UI.openSheet(id);
          e.stopPropagation();
          return;
        }
        if (action === 'expand') {
          const detail = card.querySelector('.card-process-detail');
          const btn = actionBtn;
          const arrow = btn.querySelector('.card-expand-arrow');
          if (detail.classList.contains('expanded')) {
            // 收起
            detail.style.maxHeight = detail.scrollHeight + 'px';
            detail.classList.remove('expanded');
            requestAnimationFrame(() => {
              requestAnimationFrame(() => { detail.style.maxHeight = '0px'; });
            });
            arrow.classList.add('collapsed');
            btn.childNodes[btn.childNodes.length - 1].textContent = ' 展开过程';
          } else {
            // 展开
            detail.classList.add('expanded');
            detail.style.maxHeight = detail.scrollHeight + 'px';
            arrow.classList.remove('collapsed');
            btn.childNodes[btn.childNodes.length - 1].textContent = ' 收起过程';
          }
          e.stopPropagation();
          return;
        }
        return;
      }

      UI.openSheet(id);
    });

    /* ====== 右键菜单 ====== */
    // 右键菜单项
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
      const groupNames = groups.map(g => g.name).join('、') || '暂无分组，请先在设置中创建';
      const newGroup = prompt(`${label}\n\n可选分组：${groupNames}\n\n输入分组名称移动到该分组（留空移回全部）：`);
      if (newGroup === null) return; // 取消
      const trimmed = newGroup.trim();
      if (trimmed === '') {
        calc.groupId = '';
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
    // 点击空白关闭右键菜单
    document.addEventListener('click', e => {
      if (!e.target.closest('.context-menu') && !e.target.closest('[data-action="menu"]')) {
        UI.hideContextMenu();
      }
    });

    // ESC 关闭弹窗/侧边栏
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        UI.hideContextMenu();
        UI.hideConfirm();
        closeSidebar();
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
    }
  });

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
