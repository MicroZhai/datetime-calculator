(() => {
  const KEY = 'dtc-language';
  const root = document.documentElement;
  const menu = document.getElementById('themeMenu');
  const translations = {
    zh: { title: '时间计算器', history: '计算历史', settings: '设置', clear: '清空', back: '退格', done: '完成', language: '语言', units: ['天','时','分','秒'] },
    en: { title: 'Time Calculator', history: 'History', settings: 'Settings', clear: 'Clear', back: 'Backspace', done: 'Done', language: 'Language', units: ['Day','Hour','Min','Sec'] }
  };
  const textMap = {
    '输入下一时间':'Enter next duration','输入数字，再选择单位':'Enter a number, then choose a unit','输入数字后选择单位':'Enter a number, then choose a unit',
    '已输入':'Entered','请选择单位':'select a unit','等待下一时间':'waiting for the next duration','编辑片段':'Editing part','编辑冒号片段':'Editing colon input',
    '已选择第':'Selected row','行':'row','基准行':'base row','切换加减':'Toggle +/-','删除行':'Delete row','完成':'Done','计算历史':'History','关闭':'Close','清空':'Clear','撤销':'Undo','点击恢复':'Restore',
    '还没有历史记录':'No history yet','点击左侧可修改':'Click the left side to edit','日期':'Date','结束日期超出范围':'End date is out of range','日期不可用':'Date unavailable',
    '跟随系统':'System','浅色':'Light','深色':'Dark','天':'day','小时':'hour','时':'hr','分':'min','秒':'sec','天时分秒':'D H M S','结果显示方式':'Result display format','切换结果显示方式':'Switch result display','当前':'current','十进制':'decimal','60进制':'base-60','请输入有效数字':'Enter a valid number',
    '按 = 保存到历史；历史记录可恢复后继续编辑。':'Press = to save to history; history entries can be restored and edited.',
    '请选择单位':'select a unit','已输入':'Entered','请输入两位分钟':'Enter two-digit minutes','请输入两位秒':'Enter two-digit seconds',
    '先输入数字':'Enter a number first','先选择单位':'Choose a unit first','无法精确表示':'Cannot represent precisely','当前输入无法精确到 1 毫秒':'Input cannot be precise to 1 ms',
    '分钟':'minutes','秒钟':'seconds','分钟必须是 00～59':'Minutes must be 00–59','秒必须是 00～59':'Seconds must be 00–59','未知时间单位':'Unknown time unit'
  };
  const extraMap = {
    '\u5192\u53f7\u8f93\u5165':'Colon input', '\u8303\u56f4\u662f':'Range:', '\u8303\u56f4':'Range', '\u5341\u4f4d\u53ea\u80fd\u662f':'The tens digit must be',
    '\u5df2\u7ecf\u8f93\u5165\u5b8c\u6210':'is complete', '\u5192\u53f7\u5c0f\u65f6\u4f4d\u4e0d\u4f7f\u7528\u5c0f\u6570':'Colon hours cannot use decimals',
    '\u6700\u591a\u652f\u6301 \u65f6:\u5206:\u79d2':'Maximum format: H:M:S', '\u8bf7\u5b8c\u6210\u5192\u53f7\u683c\u5f0f':'Complete the colon format',
    '\u5148\u5b8c\u6210\u5f53\u524d\u5192\u53f7\u8f93\u5165':'Finish the current colon input first', '\u8fd9\u4e2a\u6570\u5b57\u8fd8\u6ca1\u6709\u5355\u4f4d':'This number has no unit',
    '\u88f8\u6570\u5b57\u4e0d\u80fd\u76f4\u63a5\u7ed3\u7b97':'A bare number cannot be calculated', '\u8fd8\u6ca1\u6709\u53ef\u8ba1\u7b97\u7684\u65f6\u95f4':'There is no duration to calculate',
    '\u5f53\u524d\u8fd0\u7b97\u7b26\u540e\u8fd8\u7f3a\u5c11\u4e00\u4e2a\u65f6\u95f4\u503c':'A duration is missing after the current operator'
    ,'\u5f53\u524d\u8f93\u5165\u65e0\u6cd5\u7cbe\u786e\u5230 1 \u6beb\u79d2':'The current input cannot be precise to 1 ms'
    ,'\u8bf7\u8f93\u5165\u4e24\u4f4d\u5206\u949f\uff1a00\uff5e59':'Enter two-digit minutes: 00–59'
    ,'\u8bf7\u8f93\u5165\u4e24\u4f4d\u79d2\uff1a00\uff5e59':'Enter two-digit seconds: 00–59'
    ,'\u8bf7\u5148\u5b8c\u6210\u4e24\u4f4d\u5206\u949f':'Complete the two-digit minutes first'
    ,'\u5df2\u6539\u4e3a':'Changed to'
    ,'\u51cf':'Subtract','\u52a0':'Add','\u7b49\u5f85\u4e0b\u4e00\u65f6\u95f4':'waiting for the next duration'
    ,'\u5148\u5b8c\u6210\u5f53\u524d\u6b63\u5728\u8f93\u5165\u7684\u5185\u5bb9':'Finish the current input first'
    ,'\u6570\u5b57\u6700\u591a\u652f\u6301':'The number supports at most'
    ,'\u4f4d':'digits','\u5c0f\u6570\u8bf7\u4ece 0. \u5f00\u59cb\u8f93\u5165':'Enter decimals starting with 0.'
    ,'\u5c0f\u6570\u70b9':'Decimal point','\u5c0f\u65f6':'hour','\u65e0\u6cd5\u7cbe\u786e\u8868\u793a':'Cannot represent precisely'
    ,'\u5148\u8f93\u5165\u4e00\u4e2a\u65f6\u95f4':'Enter a duration first','\u8bf7\u5148\u9009\u62e9\u5355\u4f4d':'Choose a unit first'
    ,'\u8bf7\u5148\u8f93\u5165\u4e0b\u4e00\u65f6\u95f4':'Enter the next duration first','\u5df2\u6062\u590d\uff0c\u53ef\u7ee7\u7eed\u7f16\u8f91':'Restored; you can continue editing'
    ,'\u5df2\u5220\u9664\u8fd9\u4e00\u884c':'Row deleted','\u5df2\u5220\u9664\u5386\u53f2\u8bb0\u5f55':'History entry deleted','\u5386\u53f2\u8bb0\u5f55\u5df2\u6e05\u7a7a':'History cleared'
  };
  function translateText(value) {
    let next = value;
    Object.entries({...textMap, ...extraMap}).sort((a, b) => b[0].length - a[0].length).forEach(([from, to]) => { next = next.split(from).join(to); });
    next = next.replace(/(\d)(day|hour|hr|min|sec)\b/g, '$1 $2');
    return next;
  }
  function translateDom(lang) {
    if (lang !== 'en') return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => { const next = translateText(node.nodeValue); if (next !== node.nodeValue) node.nodeValue = next; });
    document.querySelectorAll('[aria-label],title').forEach(node => {
      ['aria-label','title'].forEach(attr => { const value = node.getAttribute(attr); if (value) node.setAttribute(attr, translateText(value)); });
    });
  }
  function detect() { return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'; }
  function get() { try { return localStorage.getItem(KEY) || detect(); } catch (_) { return detect(); } }
  function apply(language, persist = true) {
    const lang = language === 'en' ? 'en' : 'zh';
    if (persist) try { localStorage.setItem(KEY, lang); } catch (_) {}
    const t = translations[lang];
    root.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.querySelector('.title').textContent = t.title;
    const history = document.getElementById('historyBtn');
    const settings = document.getElementById('settingsBtn');
    history?.setAttribute('aria-label', t.history); history && (history.title = t.history);
    settings?.setAttribute('aria-label', t.settings); settings && (settings.title = t.settings);
    document.querySelector('[data-action="clear"]')?.setAttribute('aria-label', t.clear);
    document.querySelector('[data-action="back"]')?.setAttribute('aria-label', t.back);
    document.getElementById('doneRowBtn')?.replaceChildren(t.done);
    document.querySelectorAll('[data-unit]').forEach((b, i) => { b.textContent = t.units[i]; });
    document.querySelectorAll('[data-language-option]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.languageOption === (lang === 'en' ? 'en-US' : 'zh-CN'))));
    translateDom(lang);
  }
  if (menu) {
    const divider = document.createElement('div'); divider.className = 'settings-divider'; divider.setAttribute('role', 'separator');
    const label = document.createElement('div'); label.className = 'settings-section-label';
    const zh = document.createElement('button'); const en = document.createElement('button');
    [zh, en].forEach((b, i) => { b.className = 'theme-option'; b.type = 'button'; b.setAttribute('role','menuitemradio'); b.dataset.languageOption = i ? 'en-US' : 'zh-CN'; b.innerHTML = `<span>${i ? 'English' : '中文'}</span><span class="theme-check">✓</span>`; b.onclick = () => { apply(i ? 'en' : 'zh'); location.reload(); }; });
    label.textContent = '语言 / Language'; menu.append(divider, label, zh, en);
  }
  const language = get();
  const originalRender = window.render;
  const originalRenderHistory = window.renderHistory;
  if (typeof originalRender === 'function') {
    window.render = (...args) => { const result = originalRender(...args); translateDom(language); return result; };
  }
  if (typeof originalRenderHistory === 'function') {
    window.renderHistory = (...args) => { const result = originalRenderHistory(...args); translateDom(language); return result; };
  }
  apply(language, false);
  translateDom(language);
})();
