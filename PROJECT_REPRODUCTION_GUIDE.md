# 时间计算器 — 项目复现指南

## 一、文件结构树（生成顺序从上到下）

```
datetime-calculator/
├── index.html              # 主页面，DOM 结构，按依赖顺序加载 JS
├── manifest.json           # PWA 清单（图标尺寸、快捷菜单、显示模式）
├── sw.js                   # Service Worker（网络优先缓存、更新横幅通知）
├── icons/                  # PWA 图标目录
│   ├── icon-192.png        # 192×192 图标
│   └── icon-512.png        # 512×512 图标（含 maskable purpose）
├── css/
│   └── style.css           # 所有样式（1,300+ 行），CSS 变量驱动主题
└── js/
    ├── storage.js          # 数据持久化层（Storage + Groups 对象）
    ├── history.js          # 计算历史记录存储
    ├── calculator.js       # 纯函数时间计算核心
    ├── theme.js            # 浅色/深色/自动主题切换
    ├── ui.js               # UI 公共层：状态变量、Toast、确认弹窗、右键菜单、工具方法、防抖节流
    ├── ui-render.js        # 卡片列表渲染：renderList / _renderCard / updateClock
    ├── ui-sheet.js         # 编辑弹窗：openSheet / 时段编辑器 / 三向联动 / readSheet
    ├── ui-history.js       # 历史记录弹窗：renderHistory / reuseHistory / clearHistory
    └── app.js              # 入口 IIFE：初始化、所有事件绑定、SV 注册、时钟
```

## 二、数据模型（localStorage）

### key: `dtc_calculators`
```json
[
  {
    "id": "1718000000000",
    "name": "示例计算器",
    "isBaseTimeNow": false,
    "baseTime": "2026-05-21T06:00:00.000Z",
    "segments": [
      {
        "name": "时段1",
        "durationMinutes": 60,
        "startMinutes": 0
      }
    ],
    "pinned": false,
    "groupId": "",
    "createdAt": 1718000000000
  }
]
```
- `baseTime`: ISO 字符串，存储在 localStorage，渲染时用 `new Date()` 转为本地时间
- `segments[].startMinutes`: 该段开始时间相对 baseTime 的分钟偏移。段 0 固定为 0。段 N>0 如果用户未手动修改则不存在该字段（兼容旧数据），此时用链式推导兜底
- `pinned`: 置顶标志
- `groupId`: 分组 ID，空字符串 = "全部"

### key: `dtc_history`（最多 50 条）
```json
[
  {
    "id": "1718000000001",
    "calcName": "会议结束时间",
    "baseTime": "2026-05-21T06:00:00.000Z",
    "baseTimeFormatted": "5月21日 14:00",
    "resultTime": "2026-05-21T07:00:00.000Z",
    "resultTimeFormatted": "5月21日 15:00",
    "segments": [
      { "name": "时段1", "durationMinutes": 60, "startMinutes": 0 }
    ],
    "savedAt": "2026-05-21 14:05"
  }
]
```

### key: `dtc_groups`
```json
[
  { "id": "1718000000002", "name": "工作", "createdAt": 1718000000002 }
]
```

### key: `dtc_duration_history`（最多 20 条）
```json
[60, 30, 120, 90]
```

### key: `dtc_theme`
字符串值：`"auto"` | `"light"` | `"dark"`

## 三、文件生成指令

### 1. index.html（~150 行）

**结构从上到下：**

```html
<!DOCTYPE html><html lang="zh-CN"><head>
  <!-- meta: charset, viewport -->
  <!-- 两个 theme-color meta（media="prefers-color-scheme"），JS 动态修改 content -->
  <!-- apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style -->
  <title>时间计算器</title>
  <link rel="manifest" href="manifest.json">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <link rel="stylesheet" href="css/style.css">
</head><body>
  <!-- #update-banner: 固定顶部横幅，transform:translateY(-100%) 隐藏，.visible 滑入 -->
  <!-- #top-bar: sticky 顶栏 -->
  <!--   #history-btn (🕘) | h1.app-title "时间计算器" | #settings-btn (⚙) -->
  <!-- #group-filter-bar: 分组下拉选择器（JS 动态渲染 <select>） -->
  <!-- #current-time-bar: #current-time-display + #current-date-display -->
  <!-- #calc-list: JS 动态渲染 .calc-card -->
  <!-- #new-btn-bottom.fab-btn: 固定右下角悬浮 + 按钮 -->
  <!-- #empty-state.hidden: 空状态提示 + #empty-new-btn -->
  <!-- #sheet-overlay + #edit-sheet: 编辑弹窗（底部抽屉） -->
  <!--   .sheet-handle, .sheet-header, .sheet-body -->
  <!--   #input-name, #base-time-display + #now-btn -->
  <!--   #segments-container + #add-segment-btn -->
  <!--   #duration-history -->
  <!-- #history-overlay + #history-sheet: 历史弹窗（复用 .edit-sheet 样式） -->
  <!-- #settings-overlay + #settings-sheet: 设置弹窗 -->
  <!-- #confirm-overlay + #confirm-dialog: 确认弹窗（居中缩放弹出） -->
  <!-- #context-menu: 右键菜单（#ctx-pin, #ctx-rename, #ctx-copy-detail, #ctx-move-group, #ctx-delete） -->
  <!-- #toast: Toast 提示 -->
  <script src="js/storage.js"></script>
  <script src="js/history.js"></script>
  <script src="js/calculator.js"></script>
  <script src="js/theme.js"></script>
  <script src="js/ui.js"></script>
  <script src="js/ui-render.js"></script>
  <script src="js/ui-sheet.js"></script>
  <script src="js/ui-history.js"></script>
  <script src="js/app.js"></script>
</body></html>
```

**关键 ID 清单（共 38 个）：**
`update-banner`, `update-btn`, `top-bar`, `theme-btn`(已删除), `history-btn`, `settings-btn`, `group-filter-bar`, `current-time-bar`, `current-time-display`, `current-date-display`, `calc-list`, `new-btn-bottom`, `empty-state`, `empty-new-btn`, `sheet-overlay`, `edit-sheet`, `sheet-close-btn`, `sheet-title`, `input-name`, `base-time-display`, `now-btn`, `segments-container`, `add-segment-btn`, `duration-history`, `save-btn`, `delete-btn`, `history-overlay`, `history-sheet`, `history-list`, `history-close-btn`, `clear-history-btn`, `settings-overlay`, `settings-sheet`, `settings-close-btn`, `settings-theme-label`, `settings-theme-btn`, `group-list`, `input-group-name`, `add-group-btn`, `confirm-overlay`, `confirm-dialog`, `confirm-msg`, `confirm-cancel-btn`, `confirm-ok-btn`, `context-menu`, `ctx-pin`, `ctx-rename`, `ctx-copy-detail`, `ctx-move-group`, `ctx-delete`, `toast`

### 2. manifest.json

```json
{
  "name": "时间计算器", "short_name": "时间计算器",
  "start_url": ".", "display": "standalone", "orientation": "portrait",
  "background_color": "#000000", "theme_color": "#000000",
  "icons": [
    {"src":"icons/icon-72.png","sizes":"72x72","type":"image/png"},
    {"src":"icons/icon-96.png","sizes":"96x96","type":"image/png"},
    {"src":"icons/icon-128.png","sizes":"128x128","type":"image/png"},
    {"src":"icons/icon-144.png","sizes":"144x144","type":"image/png"},
    {"src":"icons/icon-152.png","sizes":"152x152","type":"image/png"},
    {"src":"icons/icon-180.png","sizes":"180x180","type":"image/png"},
    {"src":"icons/icon-192.png","sizes":"192x192","type":"image/png"},
    {"src":"icons/icon-384.png","sizes":"384x384","type":"image/png"},
    {"src":"icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}
  ],
  "shortcuts": [
    {"name":"新建计算器","short_name":"新建","url":"/?action=new","icons":[{"src":"icons/icon-192.png"}]},
    {"name":"查看历史","short_name":"历史","url":"/?action=history","icons":[{"src":"icons/icon-192.png"}]}
  ]
}
```

图标只要求 192 和 512 两个实际文件存在，其余声明即可。

### 3. sw.js（~70 行）

```js
const CACHE_NAME = 'dtc-v4'; // 每次发布可递增版本号
const FILES_TO_CACHE = ['.','index.html','css/style.css','js/storage.js','js/history.js','js/calculator.js','js/theme.js','js/ui.js','js/ui-render.js','js/ui-sheet.js','js/ui-history.js','js/app.js','manifest.json','icons/icon-192.png','icons/icon-512.png'];

// install: caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)); self.skipWaiting()
// activate: 删除旧 cache，clients.matchAll 发 postMessage('update-available')，self.clients.claim()
// fetch: 网络优先 fetch(event.request).then(res => { 更新缓存; return res }).catch(() => caches.match)
```

### 4. js/storage.js（~110 行）

```js
const Storage = {
  getAll() {
    // 从 localStorage 读 STORAGE_KEY，JSON.parse
    // 遍历校验：baseTime 非法则 continue 跳过
    // 迁移旧数据：无 segments → 自动创建；无 pinned → false；无 groupId → ''
    // 有迁移则写回
    // 返回合法列表
  },
  save(calc) {
    // 找到则替换，找不到则 unshift
    // 写回 localStorage
  },
  remove(id) { /* filter */ },
  getTheme() { return localStorage.getItem('dtc_theme') || 'auto' },
  saveTheme(t) { localStorage.setItem('dtc_theme', t) },
  addDurationHistory(min) { /* 去重，最多 20 条 */ },
  getDurationHistory() { return 最近 10 条 },
  _write(list) {
    // try-catch QuotaExceededError（name === 'QuotaExceededError' → alert）
  }
};

const Groups = {  // key: 'dtc_groups'
  getAll() { /* JSON.parse */ },
  save(g) { /* 找到替换，否则 push */ },
  remove(id) { /* filter */ },
  _write(list) { /* localStorage.setItem */ }
};
```

### 5. js/history.js（~50 行）

```js
const History = {
  getAll() { /* 从 'dtc_history' 读取，JSON.parse */ },
  add(record) {
    // 校验 baseTime（有效 ISO 且 !isNaN）
    // 校验 segments（Array）
    // unshift，截断至 50 条
    // _write
  },
  remove(id) { /* filter */ },
  clear() { _write([]) },
  _write(list) {
    // try-catch QuotaExceededError → alert
  }
};
```

### 6. js/calculator.js（~95 行）

```js
const Calculator = {
  formatTime(date)    // "14:00" — 2 位小时:2 位分钟
  formatDateTime(date) // "5月21日 14:00" — 本地短日期+时间
  toLocalDateStr(date) // "2026-05-21" — yyyy-MM-dd 本地日期（非 UTC）
  toLocalTimeStr(date) // "14:00" — HH:MM 本地时间
  formatDate(date)    // "2026年5月21日 周四" — 中文长日期含星期
  formatDurationMin(totalMinutes) // "+80min" 或 "−30min"

  calcSegmentChain(baseTime, segments) {
    // 参数 baseTime 为 ISO 或 "now"
    // 返回 [{name, duration, startTime:Date, time:Date, totalMinFromBase}]
    // 每段优先读取 seg.startMinutes（独立开始时间偏移）
    // 兜底：段0 用 baseTime，段N 用前一段的 time
    // 兼容空 segments（返回 []）
  }

  getFinalResult(calc) {
    // 调用 calcSegmentChain，返回最后一元素的 time Date
    // 空链返回 baseTime
  }
};
```

### 7. js/theme.js（~45 行）

```js
const Theme = {
  _state: 'auto', // 'auto'|'light'|'dark'
  init() { /* 从 Storage.getTheme 读，apply，_listenSystem */ },
  toggle() { /* auto→light→dark→auto */ },
  getIcon() { return {auto:'🌓',light:'☀️',dark:'🌙'}[this._state] },
  apply(state) {
    // state==='auto' → matchMedia 判断
    // 设置 html.setAttribute('data-theme', ...)
    // 同步更新 meta[name="theme-color"].content = isDark ? '#000000' : '#ffffff'
    // 更新 this._state
  },
  _listenSystem() { /* matchMedia change 监听，仅 auto 模式响应 */ }
};
```

### 8. js/ui.js（~110 行）— UI 公共层

```js
// 全局防抖/节流工具
function debounce(fn, delay) { let timer; return function(...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); }; }
function throttle(fn, delay) { let last = 0; return function(...args) { const now = Date.now(); if (now - last >= delay) { last = now; fn.apply(this, args); } }; }

const UI = {
  // 状态字段
  _editingId: null, _contextTargetId: null, _segments: [],
  _activeSegIdx: 0, _dirty: false, _confirmCallback: null,
  _toastTimer: null, _closeTimer: null, _pendingDelete: null,
  _currentGroup: '',

  // showToast(msg, actionText, onAction)
  //   - 设置 #toast 的 innerHTML（支持 action 按钮）
  //   - 添加 .visible，3s 后自动移除

  // showConfirm(msg, okLabel, okClass, callback)
  //   - 设置 #confirm-msg, #confirm-ok-btn 文字和样式
  //   - 显示 #confirm-overlay + .open #confirm-dialog
  //   - 自动 focus #confirm-cancel-btn

  // hideConfirm() / _executeConfirm()

  // showContextMenu(x, y, calcId)
  //   - 根据 calc.pinned 设置 #ctx-pin 文字
  //   - 位置限制在视口内（maxX=max(160), maxY=max(100)）

  // hideContextMenu()

  // _escape(str) — innerHTML 安全转义
  // _escapeAttr(str) — 属性值安全转义
  // _numToCircle(n) — ①②③...⑩

  // renderListDebounced: null  // 由 app.js init 赋值为 debounce(UI.renderList, 100)

  // --- 分组相关 ---
  // renderGroupTabs()
  //   - 从 Groups.getAll() 获取分组列表
  //   - 渲染 <select> 到 #group-filter-bar
  //   - 选中项匹配 this._currentGroup

  // renderGroupList()
  //   - 渲染分组到 #group-list（设置面板中）
  //   - 每项显示名称 + ✕ 删除按钮(.js-group-del)

  // openSettings()
  //   - 调用 renderGroupList()
  //   - 更新主题标签显示当前主题名
  //   - 显示 #settings-overlay + .open #settings-sheet

  // closeSettings()
};
```

### 9. js/ui-render.js（~145 行）

```js
Object.assign(UI, {
  renderList() {
    // 从 Storage.getAll() 获取
    // 若 this._currentGroup 非空则 filter(c => c.groupId === this._currentGroup)
    // 排序：pinned 优先，然后 createdAt 降序
    // 空列表显示 #empty-state
    // 渲染所有 .calc-card，每张设置递增 animation-delay (i * 0.04s)
  },

  refreshLiveCards() { this.renderList(); },

  updateClock() {
    // 更新 #current-time-display (HH:MM:SS) 和 #current-date-display (formatDate)
  },

  _renderCard(calc) {
    // 处理 isBaseTimeNow
    // 调用 Calculator.calcSegmentChain(calc.baseTime, calc.segments)
    // 若链为空则 last = { time: baseDate }
    // 计算 totalMin, isZero, totalDur, finalTimeDisplay
    // 跨天标签：对比 baseDay 和 resultDay 的天数差，附加 .cross-day-tag
    // 过程详情 detailHTML：
    //   - isZero 时显示 "无时段数据"
    //   - 否则遍历 chain，每行 .card-timeline-row：
    //     编号 | 开始时间 | [+60min] 药丸 | → | 结束时间
    //     （每段检测跨天，附加 .card-inline-tag "次日"/"+N天"）
    // 置顶：📌 图标 + .pinned class
    // 返回 HTML：
    //   .calc-card(.pinned)
    //     .card-header: .card-name + ⋮ 按钮
    //     .card-times（三列布局）:
    //       左: .time-block--base (开始时间 label + 时间大字 + 日期小字)
    //       中: .mid-single-dur (总时长，可点击 data-action="edit-duration")
    //       右: .time-block--result (结束时间 + 跨天标签)
    //     button.card-expand-btn (▲/▼ 展开/收起 + 虚线上分隔)
    //     .card-process-detail.expanded (竖线时间轴)
    //       border-left:1.5px, 默认 max-height:600px
  }
});
```

### 10. js/ui-sheet.js（~400 行）— 最重要文件

**openSheet(calcId)**:
- 清 closeTimer，设 _editingId 和 _dirty=false
- 从 Storage 载入 segments（深拷贝，durationMinutes 取绝对值，isNegative 保留符号）
- 调用 _rebuildSegmentEditors(), _syncBaseTimeDisplay(), _renderDurationHistory()
- 显示 #sheet-overlay + #edit-sheet.open

**closeSheet(force)**:
- 若 !force && _dirty → showConfirm → 回调中 _closeSheetInternal
- 否则直接 _closeSheetInternal

**_syncBaseTimeDisplay()**:
- 从 .seg-editor[data-seg-idx="0"] 的 .js-seg-start-date/.js-seg-start-time 读取
- 格式化：`Calculator.formatDate(d) + ' ' + Calculator.formatTime(d)`
- 更新 #base-time-display.textContent

**_renderSegmentEditor(i, seg)**:
- 计算 startTime 三级优先级：DOM 已有值 > seg.startMinutes > 链式推导
- 渲染三段字段：开始时间 (date+time inputs) / 时长 (h m inputs + 清除按钮) / 结束时间 (date+time inputs)
- 每个 .seg-editor 带 data-seg-idx

**三向联动（change 事件触发，各段独立不传播）**:

- `_syncSegmentTimes(idx)`: 时长变化 → 读 DOM 时长 → 重算结束时间 = start + dur
- `_syncFromEndTime(idx)`: 结束时间变化 → 读 DOM 结束 → 时长固定 → 反算开始 = end - dur。若 idx===0 同步 _syncBaseTimeDisplay
- `_syncFromStartTime(idx)`: 开始时间变化 → 时长固定 → 重算结束 = start + dur。若 idx===0 同步 _syncBaseTimeDisplay

三个方法都通过 `_readDurationFromDOM(editor)` 读取时长，内部调用 `_clampDuration(h, m, editor)` 限制 ≤9999 分钟

**readSheet()**:
- 调用 _syncAllFromDOM() 同步所有 DOM 到 _segments
- baseTime 从 _getCurrentBaseISO()（读段 0 DOM）
- 非首段从 DOM 计算 startMinutes
- 返回 { name, isBaseTimeNow: false, baseTime, segments }

### 11. js/ui-history.js（~170 行）

```js
Object.assign(UI, {
  getCalcDetailText(calc) {
    // 生成格式化文本：【名称】\n开始时间：...\n时段1 +60min → 15:00\n...
  },

  openHistory() { renderHistory(); 显示弹窗; focus close-btn },
  closeHistory() { 隐藏弹窗; focus #history-btn },

  renderHistory() {
    // 从 History.getAll() 获取
    // 空显示 "暂无计算历史"
    // 旧记录（无 segments）调用 _renderOldHistoryCard 降级
    // 新记录：遍历 segments，优先用 startMinutes 计算开始时间
    // 每行 .history-process-row:
    //   (首行)过程：时段名 startTime [+dur] → midTime(midTag)
    //   (后续)______时段名 startTime [+dur] → midTime(midTag)
    // 卡片底部：🔄 再用一次 + ✕ 删除
  },

  reuseHistory(id) {
    // 从历史记录找到完整数据
    // closeHistory → openSheet(null)
    // 预填 _segments（含 startMinutes），name+" (副本)"
    // _dirty=true
  },

  clearHistory() { showConfirm → History.clear() → renderHistory },

  deleteHistoryItem(id) { History.remove(id); this.renderHistory() }
});
```

### 12. js/app.js（~420 行）— 入口 IIFE

```js
(function() { 'use strict';
  // debounce/throttle/UI 等全局变量由前面的 script 标签提供

  function init() {
    // 首次使用：创建示例计算器（name, baseTime: new Date().toISOString(), segments:[{durationMinutes:256}], pinned:false）
    // Theme.init()
    // UI.renderListDebounced = debounce(() => UI.renderList(), 100)
    // UI.renderList(); UI.renderGroupTabs()
    // bindEvents()
    // startLiveClock()
    // registerSW()
    // handleShortcutAction() // ?action=new / ?action=history，处理后 replaceState 清 URL
  }

  function bindEvents() {
    /* 顶部栏 */
    // settings-btn → UI.openSettings()
    // settings-close-btn/overlay → UI.closeSettings()
    // settings-theme-btn → Theme.toggle() + 更新标签文字
    // group-list 内 .js-group-del → 删除分组 + 移回计算器 + 刷新
    // add-group-btn → 创建分组 + 刷新
    // group-filter-bar change → 切换 _currentGroup + renderList

    /* 新建 & 历史入口 */
    // new-btn-bottom + empty-new-btn → UI.openSheet(null)
    // history-btn → UI.openHistory()
    // history-close-btn/overlay → UI.closeHistory()
    // clear-history-btn → UI.clearHistory()
    // history-list 内 .js-history-del → UI.deleteHistoryItem
    // history-list 内 .js-history-reuse → UI.reuseHistory

    /* 编辑弹窗 */
    // sheet-close-btn/overlay → UI.closeSheet()
    // confirm-cancel-btn/overlay → UI.hideConfirm()
    // confirm-ok-btn → UI._executeConfirm()
    // now-btn → showConfirm("将清空...") → 清空 _segments → 段0 设为 now → _syncBaseTimeDisplay

    /* 时段操作（segments-container 事件代理） */
    // click: .js-seg-del → removeSegment; .js-seg-clear → clearSegmentDuration; 否则设 _activeSegIdx
    // change (三向联动): .js-seg-hours/minutes → _syncSegmentTimes
    //                     .js-seg-end-* → _syncFromEndTime
    //                     .js-seg-start-* → _syncFromStartTime
    //                 每次 change 设 _dirty=true

    // input-name input → _dirty=true
    // add-segment-btn → UI.addSegment()
    // duration-history 内 .history-btn → setQuickDuration + _syncSegmentTimes

    /* 保存 */
    // save-btn: readSheet → 记录时长历史 → Storage.save(calc) → closeSheet(true) → renderListDebounced + showToast("已保存")
    // → History.add(跨天标识 + segments 含 startMinutes)

    /* 删除（弹窗内） */
    // delete-btn: showConfirm → 确认后 Storage.remove → closeSheet(true) → renderList → showToast("已删除","撤销", 恢复回调)

    /* 列表卡片事件代理 */
    // calc-list click:
    //   action=menu → showContextMenu
    //   action=edit-duration → openSheet
    //   action=expand → detail.classList.toggle('expanded') + 箭头 class 切换
    //   否则 → openSheet(id)

    /* 右键菜单 */
    // ctx-pin: 切换 pinned → Storage.save → renderList → showToast
    // ctx-rename: openSheet
    // ctx-copy-detail: getCalcDetailText → navigator.clipboard
    // ctx-move-group: prompt 输入分组名 → 自动创建分组/移到"全部" → renderGroupTabs + renderList
    // ctx-delete: showConfirm → Storage.remove → renderList → showToast("已删除","撤销")

    /* 全局事件 */
    // 点击空白 → hideContextMenu
    // Escape → hideContextMenu + hideConfirm + closeSheet
  }

  function startLiveClock() {
    // UI.updateClock() + setInterval 1s
    // visibilitychange: hidden 时清除 interval，visible 时重新启动
  }

  function registerSW() {
    // sw.js 注册
    // updatefound → 新 SW installed 时调用 showUpdateBanner()
    // message 'update-available' → showUpdateBanner()
    // 已有 waiting → showUpdateBanner()
    // _updateBannerShown 防重复
  }

  function showUpdateBanner() {
    // 显示 #update-banner.visible，绑定 update-btn click → location.reload()
  }

  // handleShortcutAction(): URLSearchParams 检测 ?action → openSheet/openHistory → 清理 URL
  // DOMContentLoaded / readyState → init()
})();
```

## 四、UI 交互细节

| 交互 | 实现 |
|------|------|
| **卡片加载** | 0.4s 弹性缓出，每张延迟 0.04s 瀑布流入场，transform:translateY(24px)+scale(0.96)→原位 |
| **编辑弹窗** | 底部滑入，translateY(100%)→0，opacity 0→1，cubic-bezier(0.22,0.61,0.36,1) 0.4s |
| **确认弹窗** | 居中缩放，scale(0.85)→1，opacity 0→1，弹性回弹曲线 |
| **右键菜单** | translateY(-5px)+opacity 0 → 原位，4 个按钮逐项延迟 0/0.03/0.06/0.09s |
| **展开折叠** | max-height:0→600px，transition 0.35s；箭头 rotate 180° 0.25s |
| **按钮按压** | 所有按钮 cubic-bezier(0.34,1.56,0.64,1) 弹性缩放，松手回弹 |
| **FAB 波纹** | ::after 伪元素，:active 时 scale(0)→scale(4) + opacity 0.3→0，0.4s |
| **主题切换** | body + topbar + card 的 background-color transition 0.5s |
| **Toast** | translateY(12px)+scale(0.95) → 原位，0.3s 弹出，3s 后消失，支持内嵌撤销按钮 |
| **毛玻璃** | color-mix(in srgb, var(--bg-card) 72%, transparent) + backdrop-filter:blur(14px) |

## 五、设计规范

### CSS 变量（:root 浅色 / [data-theme="dark"] 深色）

| 变量 | 浅色 | 深色 |
|------|------|------|
| `--bg` | `#f5f3ee` | `#000000` |
| `--bg-card` | `#fafaf7` | `#1c1c1e` |
| `--bg-sheet` | `#fafaf7` | `#1c1c1e` |
| `--bg-input` | `#f0efec` | `#2c2c2e` |
| `--text-primary` | `#1c1c1e` | `#f0f0f0` |
| `--text-secondary` | `#8e8e93` | `#98989d` |
| `--border` | `#e5e5ea` | `#38383a` |
| `--accent` | `#000000` | `#f0f0f0` |
| `--danger` | `#ff3b30` | `#ff4444` |
| `--radius-sm/md/lg/xl` | 10/16/20/24px | 同 |
| `--shadow-card` | 双层阴影 0.04+0.07 | 0.5px 白描边+黑投影 |
| `--glass-alpha` | 0.72 | 0.65 |
| `--glass-blur` | 14px | 16px |
| `--glass-border` | rgba(255,255,255,0.25) | rgba(255,255,255,0.1) |
| `--bg-dot` | rgba(0,0,0,0.20) | rgba(255,255,255,0.10) |
| `--bg-spot-1` | rgba(255,200,150,0.12) | rgba(100,130,200,0.08) |
| `--bg-spot-2` | rgba(200,220,255,0.10) | rgba(80,100,180,0.06) |
| `--transition-fast/normal/slow` | 0.1s/0.2s/0.35s ease | 同 |

### 背景纹理
- body: 三层 background-image（两个椭圆光斑 + 一个 radial-gradient 20px 网格点）
- topbar: 继承相同网格

### 毛玻璃
- 卡片、弹窗、顶栏、FAB、确认弹窗、右键菜单均使用 color-mix + backdrop-filter
- 不支持 color-mix 的浏览器 @supports 降级为纯色

### 动画
- 全局 `button { touch-action: manipulation }`
- `@media (prefers-reduced-motion: reduce)` 禁用所有 transition/animation

### 字体
- 系统字体栈：`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ...`
- 等宽数字：`font-variant-numeric: tabular-nums`

## 六、PWA 配置

- manifest.json 声明 9 个图标尺寸 + 2 个快捷方式
- SW 网络优先策略：fetch 成功则更新缓存，失败则返回缓存
- SW 激活时通知所有页面 'update-available'
- app.js 收到消息显示顶部横幅，用户点击"更新"后 `location.reload()`
- 离线可用（SW 预缓存所有静态资源）
