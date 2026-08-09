'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'js/calculator-state-runtime.js'), 'utf8');
const state = fs.readFileSync(path.join(root, 'js/calculator-state.js'), 'utf8');

const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
function position(src) {
  const index = scripts.indexOf(src);
  assert.notEqual(index, -1, `${src} must be loaded by index.html`);
  return index;
}

assert.ok(position('js/duration-precision.js') < position('js/calculator-state.js'));
assert.ok(position('js/date-mapper.js') < position('js/calculator-state.js'));
assert.ok(position('js/calculator-state.js') < position('js/duration-core.js'));
assert.ok(position('js/display-mode.js') < position('js/calculator-state-runtime.js'));
assert.ok(position('js/date-anchor.js') < position('js/calculator-state-runtime.js'));

assert.ok(sw.includes("'./js/calculator-state.js'"), 'PWA shell must cache CalculatorState');
assert.ok(sw.includes("'./js/calculator-state-runtime.js'"), 'PWA shell must cache state runtime bridge');

assert.doesNotThrow(() => new Function(state), 'calculator-state.js must parse');
assert.doesNotThrow(() => new Function(runtime), 'calculator-state-runtime.js must parse');
assert.match(runtime, /DurationPrecision\.toBigIntMs\(normalized\.lastResultMs\)/,
  'runtime restore must convert JSON-safe result string back to BigInt');
assert.match(runtime, /CalculatorState\.fromHistoryRecord\(record, snapshotCalculator\(\)\)/,
  'history restore must route through canonical CalculatorState');

console.log('state-runtime-wiring: all tests passed');
