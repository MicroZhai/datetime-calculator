'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DurationPrecision = require('../js/duration-precision.js');
const DateMapper = require('../js/date-mapper.js');
const HistoryStore = require('../js/history-store.js');
const CalculatorState = require('../js/calculator-state.js');

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    toggle: (name, force) => {
      if (force === true) values.add(name);
      else if (force === false) values.delete(name);
      else if (values.has(name)) values.delete(name);
      else values.add(name);
      return values.has(name);
    },
    contains: name => values.has(name)
  };
}

function fakeElement() {
  const attributes = new Map();
  return {
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    hidden: false,
    tabIndex: 0,
    title: '',
    type: '',
    className: '',
    style: {},
    dataset: {},
    classList: classList(),
    scrollTop: 0,
    scrollHeight: 0,
    firstChild: null,
    onclick: null,
    addEventListener() {},
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    focus() {},
    click() { if (typeof this.onclick === 'function') this.onclick(); },
    append() {},
    appendChild() {},
    insertBefore() {},
    insertAdjacentElement() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getClientRects() { return [1]; },
    closest() { return null; }
  };
}

function createHarness() {
  const elements = new Map();
  const byId = id => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
  };

  const body = fakeElement();
  const document = {
    hidden: false,
    activeElement: null,
    body,
    createElement() { return fakeElement(); },
    getElementById: byId,
    querySelector(selector) {
      if (selector === '[data-action="colon"]') return byId('action-colon');
      if (selector === '[data-action="clear"]') return byId('action-clear');
      if (selector === '[data-action="back"]') return byId('action-back');
      if (selector === '[data-action="equals"]') return byId('action-equals');
      if (selector.includes('date-toggle') || selector.includes('date-now')) return byId('action-date');
      if (selector === '.status-row') return byId('status-row');
      if (selector === '.result-group') return byId('result-group');
      if (selector === '.k-day') return byId('day-key');
      return fakeElement();
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };

  const storage = new Map();
  const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear()
  };

  const context = {
    console,
    DurationPrecision,
    DateMapper,
    HistoryStore,
    CalculatorState,
    document,
    localStorage,
    navigator: {},
    location: { search: '' },
    URLSearchParams,
    HTMLElement: function HTMLElement() {},
    requestAnimationFrame: fn => { if (typeof fn === 'function') fn(); return 1; },
    cancelAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
    addEventListener() {},
    structuredClone: global.structuredClone
  };
  context.globalThis = context;
  context.window = context;

  const run = file => {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    vm.runInNewContext(source, context, { filename: file });
  };

  run('js/duration-core.js');
  run('js/duration-ui.js');
  run('js/duration-app.js');
  run('js/date-anchor.js');
  run('js/display-mode.js');
  run('js/calculator-state-runtime.js');

  const call = expression => vm.runInNewContext(expression, context);
  const state = () => call('snapshotCalculator()');
  const result = () => call('lastResultMs.toString()');
  const history = () => call('historyRecords.map(r => ({...r, rows:r.rows.map(row=>({...row, parts:row.parts.map(p=>({...p}))}))}))');

  return { call, state, result, history, storage, elements };
}

function sequence(name, fn) {
  const h = createHarness();
  fn(h);
  process.stdout.write(`interaction-sequence: ${name} passed\n`);
}

sequence('equals then operator continues from exact result', ({ call, result, state }) => {
  call("inputDigit('1'); commitUnit('h'); inputOperator('+'); inputDigit('30'); commitUnit('m'); equals();");
  assert.equal(result(), '5400000');
  assert.equal(state().justEvaluated, true);

  call("inputOperator('-'); inputDigit('0.001'); commitUnit('s'); equals();");
  assert.equal(result(), '5399999');
  assert.equal(state().justEvaluated, true);
});

sequence('new digit after equals starts a fresh calculation', ({ call, result, state }) => {
  call("inputDigit('2'); commitUnit('h'); equals();");
  assert.equal(result(), '7200000');
  call("inputDigit('5'); commitUnit('m'); equals();");
  assert.equal(result(), '300000');
  assert.equal(state().rows.length, 1);
});

sequence('negative compound result continues without sign drift', ({ call, result }) => {
  call("inputDigit('1'); commitUnit('h'); inputOperator('-'); inputDigit('2'); commitUnit('h'); inputDigit('30'); commitUnit('m'); equals();");
  assert.equal(result(), '-5400000');
  call("inputOperator('+'); inputDigit('0.001'); commitUnit('s'); equals();");
  assert.equal(result(), '-5399999');
});

sequence('clear then undo restores exact editable state and shows feedback', ({ call, state, result, elements }) => {
  call("inputDigit('47'); pressColon(); inputDigit('12'); inputOperator('+'); inputDigit('3'); commitUnit('m');");
  const before = state();
  const beforeResult = result();
  call('clearCalculatorWithUndo();');
  assert.equal(state().rows.length, 0);
  assert.equal(state().currentParts.length, 0);
  assert.equal(elements.get('undoBar').classList.contains('show'), true);
  assert.equal(elements.get('undoMessage').textContent, '已清空计算内容');
  call('runUndo();');
  assert.deepEqual(state(), before);
  assert.equal(result(), beforeResult);
  assert.equal(elements.get('undoBar').classList.contains('show'), false);
});

sequence('delete row then undo restores expression and result', ({ call, state, result }) => {
  call("inputDigit('1'); commitUnit('h'); inputOperator('+'); inputDigit('30'); commitUnit('m'); inputOperator('+'); inputDigit('15'); commitUnit('m'); equals();");
  assert.equal(result(), '6300000');
  call('selectedRow=1; deleteSelectedRowWithUndo();');
  assert.equal(result(), '4500000');
  call('runUndo();');
  assert.equal(result(), '6300000');
  assert.equal(state().rows.length, 3);
});

sequence('history restore can continue calculating', ({ call, result, history, state }) => {
  call("inputDigit('300000000'); commitUnit('d'); inputOperator('+'); inputDigit('0.001'); commitUnit('s'); equals();");
  assert.equal(result(), '25920000000000001');
  assert.equal(history().length, 1);

  call('clearAll(false); restoreHistory(0);');
  assert.equal(result(), '25920000000000001');
  assert.equal(state().justEvaluated, false);
  call("inputOperator('-'); inputDigit('1'); commitUnit('h'); equals();");
  assert.equal(result(), '25919999996400001');
  assert.equal(history().length, 2);
});

sequence('dated history restores date context and continues calculating', ({ call, result, history, state }) => {
  call("restoreCalculator({...snapshotCalculator(), anchorDateTime:'2026-08-09T00:00'}); inputDigit('1'); commitUnit('d'); equals();");
  assert.equal(result(), '86400000');
  assert.equal(history().length, 1);
  assert.equal(history()[0].anchorDateTime, '2026-08-09T00:00');

  call('clearAll(false);');
  assert.equal(state().anchorDateTime, '2026-08-09T00:00');
  call('restoreHistory(0);');
  assert.equal(state().anchorDateTime, '2026-08-09T00:00');
  assert.equal(result(), '86400000');

  call("inputOperator('+'); inputDigit('1'); commitUnit('h'); equals();");
  assert.equal(result(), '90000000');
  assert.equal(history()[0].anchorDateTime, '2026-08-09T00:00');
});

sequence('display format changes never change exact result', ({ call, result }) => {
  call("inputDigit('3599999'); commitUnit('s'); equals();");
  const exact = result();
  call("switchResultFormat('h'); switchResultFormat('h'); switchResultFormat('m'); switchResultFormat('m'); switchResultFormat('d'); render();");
  assert.equal(result(), exact);
});

sequence('result display changes update the idle status hint', ({ call, elements }) => {
  const badge = () => elements.get('badge').textContent;
  assert.equal(badge(), '按天显示 · 60进制');
  call("switchResultFormat('h'); render();");
  assert.equal(badge(), '按小时显示 · 60进制');
  call('resultRadix=10; render();');
  assert.equal(badge(), '按小时显示 · 10进制');
  call("switchResultFormat('d'); render();");
  assert.equal(badge(), '按天显示 · 60进制');
});

sequence('active input status keeps priority over display hint', ({ call, elements }) => {
  const badge = () => elements.get('badge').textContent;
  call("inputDigit('8');");
  assert.equal(badge(), '已输入 8，请选择单位');
  call('resultUnit="h"; render();');
  assert.equal(badge(), '已输入 8，请选择单位');
});

sequence('process rows and current input remain separate', ({ call, elements }) => {
  call("inputDigit('8'); commitUnit('m'); inputOperator('+'); inputDigit('2'); commitUnit('m');");
  assert.match(elements.get('expression').innerHTML, /data-line="0"/);
  assert.doesNotMatch(elements.get('expression').innerHTML, /current-row/);
  assert.match(elements.get('currentInput').innerHTML, /current-row/);
  assert.equal(elements.get('currentInput').hidden, false);
  assert.equal(elements.get('currentInput').classList.contains('with-divider'), true);
});

sequence('backspace can reopen the last committed row without changing truth', ({ call, result, state }) => {
  call("inputDigit('1'); commitUnit('h'); inputOperator('+'); inputDigit('30'); commitUnit('m'); inputOperator('+');");
  assert.equal(result(), '5400000');
  call('backspace();');
  assert.equal(state().currentOp, null);
  call('backspace();');
  assert.equal(state().rows.length, 1);
  assert.equal(state().currentParts.length, 1);
  assert.equal(result(), '5400000');
});

console.log('interaction-sequence: all continuous-operation scenarios passed');
