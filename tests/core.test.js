const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/js/core.js');

test('tokenize handles scalar, element-wise, and backslash operators', () => {
  const toks = core.tokenize('A .* B + C\\D');
  const ops = toks.filter((t) => t.t === 'op').map((t) => t.v);
  assert.deepEqual(ops, ['.*', '+', 'back']);
});

test('parseMatlab + astTex render trig power and fraction forms', () => {
  core.resetColors();
  const ast = core.parseMatlab('(sin(theta)^2)/(2*delta_t)');
  const tex = core.astTex(ast);
  assert.match(tex, /\\sin\^\{2\}\\left\(/);
  assert.match(tex, /\\dfrac\{/);
  assert.match(tex, /delta_\{\\text\{t\}\}/);
});

test('l2m converts inverse trig and greek spacing', () => {
  const code = core.l2m('\\cos^{-1}\\left(\\alpha_0\\right)+\\Delta t');
  assert.equal(code, 'acos(alpha_0)+delta * t');
});

test('splitLines handles continuation, semicolons, comments, and vector ops', () => {
  const src = 'a = 2 .* x ...\n + 3;\n% skip this\nb = y.^2;';
  const lines = core.splitLines(src);
  assert.deepEqual(lines, ['a = 2 * x + 3', 'b = y^2']);
});

test('findAmbig + buildCode merges greek pair into subscript', () => {
  const toks = core.tokenize('delta * t + x');
  const pairs = core.findAmbig(toks);
  assert.equal(pairs.length, 1);
  const code = core.buildCode(toks, pairs, { [pairs[0].li]: 'm' });
  assert.equal(code, 'delta_t + x');
});

test('vectorize inserts dot operators', () => {
  const vec = core.vectorize('a*b + x^2 / y');
  assert.equal(vec, 'a.*b + x.^2 ./ y');
});

test('cleanLatexForCopy removes textcolor and dfrac', () => {
  const out = core.cleanLatexForCopy('\\textcolor{#fff}{x}+\\dfrac{1}{2}');
  assert.equal(out, 'x+\\frac{1}{2}');
});
