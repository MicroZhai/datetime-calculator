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
  return {
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    tabIndex: 0,
    style: {},
    dataset: {},
    classList: classList(),
    scrollTop: 0,
    scrollHeight: 0,
    onclick: null,
    addEventListener() {},
    setAttribute() {},
    focus() {},
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

  const document = {
    hidden: false,
    activeElement: null,
    getElementById: byId,
    querySelector(selector) {
      if (selector === '[data-action="colon"]') return byId('action-colon');
      if (selector === '[data-action="clear"]') return byId('action-clear');
      if (selector === '[data-action="back"]') return byId('action-back');
      if (selector === '[data-action="equals"]') return byId('action-equals');
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

sequence('clear then undo restores exact editable state', ({ call, state, result }) => {
  call("inputDigit('47'); pressColon(); inputDigit('12'); inputOperator('+'); inputDigit('3'); commitUnit('m');");
  const before = state();
  const beforeResult = result();
  call('clearCalculatorWithUndo();');
  assert.equal(state().rows.length, 0);
  assert.equal(state().currentParts.length, 0);
  call('runUndo();');
  assert.deepEqual(state(), before);
  assert.equal(result(), beforeResult);
});

sequence('delete row then undo restores expression and result', ({ call, state, result }) => {
  call("inputDigit('1'); commitUnit('h'); inputOperator('+'); inputDigit('30'); commitUnit('m'); inputOperator('+'); inputDigit('15'); commitUnit('m'); equals();");
  assert.equal(result(), '6300000');
  call('selectedRow=1; deleteSelectedRowWithUndo();');
  assert.equal(result(), '5400000');
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

sequence('display format changes never change exact result', ({ call, result }) => {
  call("inputDigit('3599999'); commitUnit('s'); equals();");
  const exact = result();
  call('formatIndex=1; render(); formatIndex=2; render(); formatIndex=0; render();');
  assert.equal(result(), exact);
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
