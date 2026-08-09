'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class ClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) { if (force) this.values.add(name); else this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}

class FakeElement {
  constructor(text, scrollWidth, clientWidth) {
    this.textContent = text;
    this.scrollWidth = scrollWidth;
    this.clientWidth = clientWidth;
    this.scrollLeft = 0;
    this.title = '';
    this.tabIndex = -1;
    this.classList = new ClassList();
    this.attrs = new Map();
  }
  setAttribute(name, value) { this.attrs.set(name, String(value)); }
  removeAttribute(name) {
    this.attrs.delete(name);
    if (name === 'title') this.title = '';
    if (name === 'tabindex') this.tabIndex = -1;
  }
}

const longLine = new FakeElement('999999999999999999999天', 480, 220);
const shortLine = new FakeElement('1天', 80, 220);
const result = new FakeElement('999999999999999999999天', 620, 300);
const historyValue = new FakeElement('999999999999999999999天', 410, 180);
let renderCalls = 0;
let historyCalls = 0;
let rafId = 0;

const context = {
  expressionEl: { querySelectorAll: () => [longLine, shortLine] },
  resultEl: result,
  historyList: { querySelectorAll: () => [historyValue] },
  render: () => { renderCalls += 1; },
  renderHistory: () => { historyCalls += 1; },
  window: { addEventListener: () => {} },
  requestAnimationFrame: callback => { rafId += 1; callback(); return rafId; },
  cancelAnimationFrame: () => {},
  console
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../js/large-number-ui.js'), 'utf8'), context);

assert.equal(longLine.classList.contains('numeric-overflow'), true);
assert.equal(longLine.scrollLeft, longLine.scrollWidth);
assert.equal(shortLine.classList.contains('numeric-overflow'), false);
assert.equal(result.classList.contains('numeric-overflow'), true);
assert.equal(result.scrollLeft, result.scrollWidth);
assert.equal(result.tabIndex, 0);
assert.match(result.attrs.get('aria-label'), /可左右滚动查看完整数值/);
assert.equal(historyValue.classList.contains('numeric-overflow'), true);
assert.equal(historyValue.tabIndex, 0);

context.render();
context.renderHistory();
assert.equal(renderCalls, 1);
assert.equal(historyCalls, 1);

result.scrollWidth = 200;
context.render();
assert.equal(result.classList.contains('numeric-overflow'), false);
assert.equal(result.tabIndex, -1);
assert.equal(result.attrs.has('aria-label'), true);

console.log('large-number-ui: overflow behavior passed');
