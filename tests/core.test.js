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

test('l2m inserts multiplication between adjacent parenthesized groups', () => {
  const code = core.l2m('\\left(4x\\right)\\left(x\\right)');
  assert.equal(code, '(4 * x) * (x)');
});

test('l2m handles nested stacked powers with braces', () => {
  const code = core.l2m('\\frac{x^{2-x^{2-4^{-4}}}}{d}');
  assert.equal(code, '(x^(2-x^(2-4^(-4))))/(d)');
});

test('l2m splits subscript-adjacent mixed-case symbols into factors', () => {
  const code = core.l2m('\\mu _0nIL');
  assert.equal(code, 'mu_0 * n * I * L');
});

test('l2m preserves explicitly braced mixed subscript text', () => {
  const code = core.l2m('M_{1N}^2');
  assert.equal(code, 'M_1N^2');
});

test('l2m splits multi-letter base and keeps trailing subscript', () => {
  const code = core.l2m('ASDF_{GH}');
  assert.equal(code, 'A * S * D * F_GH');
});

test('l2m keeps braced identifier as one variable', () => {
  const code = core.l2m('{nIL}');
  assert.equal(code, 'nIL');
});

test('l2m keeps braced identifier intact in larger expression', () => {
  const code = core.l2m('\\mu_0{nIL}+x');
  assert.equal(code, 'mu_0 * nIL+x');
});

test('l2m keeps left/right braced identifier as one variable', () => {
  const code = core.l2m('\\mu _0\\left\\{aNI\\right\\}');
  assert.equal(code, 'mu_0 * aNI');
});

test('l2m splits plain multi-letter symbol into character factors', () => {
  const code = core.l2m('abcd');
  assert.equal(code, 'a * b * c * d');
});

test('l2m keeps log as function without parentheses in input', () => {
  const code = core.l2m('\\log a');
  assert.equal(code, 'log(a)');
});

test('l2m handles indexed square root form', () => {
  const code = core.l2m('\\sqrt[1]{4}');
  assert.equal(code, 'nthroot(4,1)');
});

test('normalizeParenLatex wraps plain parentheses with left/right', () => {
  const out = core.normalizeParenLatex('(x(x^2))');
  assert.equal(out, '\\left(x\\left(x^2\\right)\\right)');
});

test('astTex applies sized parentheses in nested/tall contexts', () => {
  core.resetColors();
  const tex = core.astTex(core.parseMatlab('((x*(x^2)))'));
  assert.match(tex, /\\big|\\Big|\\bigg|\\Bigg/);
});

test('colorizeMatlabSource highlights nested parenthesis groups', () => {
  const html = core.colorizeMatlabSource('((x(x^2)))');
  assert.match(html, /t-paren-d0/);
  assert.match(html, /t-paren-d1/);
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

test('findParenMismatch detects missing closing parenthesis', () => {
  const mm = core.findParenMismatch('(x*(y+1)');
  assert.equal(mm.hasMismatch, true);
  assert.deepEqual(mm.unmatchedOpen, [0]);
  assert.deepEqual(mm.unmatchedClose, []);
});

test('highlightParenMismatch wraps unmatched delimiters with warning span', () => {
  const html = core.highlightParenMismatch('(x))');
  assert.match(html, /t-ambig/);
});

test('autoFixParenLine appends missing closing delimiters', () => {
  const fixed = core.autoFixParenLine('(x*(y+1)');
  assert.equal(fixed, '(x*(y+1))');
});

test('autoFixParenLine removes unmatched closing delimiters', () => {
  const fixed = core.autoFixParenLine('x)) + 1');
  assert.equal(fixed, 'x + 1');
});
