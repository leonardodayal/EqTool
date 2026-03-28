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
  assert.equal(code, 'acos(alpha_0)+Delta * t');
});

test('l2m preserves uppercase Delta and lowercase delta distinctly', () => {
  const code = core.l2m('\\Delta \\delta');
  assert.equal(code, 'Delta * delta');
});

test('l2m preserves adjacent Greek commands without whitespace', () => {
  const code = core.l2m('\\Delta\\delta');
  assert.equal(code, 'Delta * delta');
});

test('l2m preserves adjacent lowercase-uppercase Greek commands without whitespace', () => {
  const code = core.l2m('\\gamma\\Gamma');
  assert.equal(code, 'gamma * Gamma');
});

test('l2m preserves adjacent lowercase-uppercase delta pair without whitespace', () => {
  const code = core.l2m('\\delta\\Delta');
  assert.equal(code, 'delta * Delta');
});

test('l2m inserts multiplication for identifier followed by Greek command', () => {
  const code = core.l2m('a\\rho + b\\psi + c\\Gamma');
  assert.equal(code, 'a * rho + b * psi + c * Gamma');
});

test('l2m converts Gamma and zeta function product without backslash leakage', () => {
  const code = core.l2m('\\Gamma \\left(s\\right)\\zeta \\left(s\\right)');
  assert.equal(code, 'Gamma (s) * zeta(s)');
});

test('l2m treats Gamma and gamma as adjacent symbolic factors', () => {
  const code = core.l2m('\\Gamma \\gamma');
  assert.equal(code, 'Gamma * gamma');
});

test('l2m maps uppercase Greek commands to identifiers without splitting', () => {
  const code = core.l2m('\\Theta + \\Omega');
  assert.equal(code, 'Theta + Omega');
});

test('l2m maps additional Greek and math symbol commands without backslash leakage', () => {
  const code = core.l2m('\\psi \\left(s\\right) + \\varphi + \\partial x + \\nabla f');
  assert.equal(code, 'psi(s) + varphi + partial * x + nabla * f');
});

test('l2m inserts multiplication between adjacent parenthesized groups', () => {
  const code = core.l2m('\\left(4x\\right)\\left(x\\right)');
  assert.equal(code, '(4 * x) * (x)');
});

test('l2m handles nested stacked powers with braces', () => {
  const code = core.l2m('\\frac{x^{2-x^{2-4^{-4}}}}{d}');
  assert.equal(code, '(x^(2-x^(2-4^(-4))))/d');
});

test('l2m splits subscript-adjacent mixed-case symbols into factors', () => {
  const code = core.l2m('\\mu _0nIL');
  assert.equal(code, 'mu_0 * n * I * L');
});

test('l2m inserts multiplication after explicit symbolic subscript', () => {
  const code = core.l2m('a_{e}f');
  assert.equal(code, 'a_e * f');
});

test('l2m preserves chained symbolic subscripts without mixed braced output', () => {
  const code = core.l2m('a_{s}_{s}_{s}');
  assert.equal(code, 'a_s_s_s');
});

test('l2m flattens nested symbolic subscripts into chain-safe form', () => {
  const code = core.l2m('a_{s_{s_s}}');
  assert.equal(code, 'a_s_s_s');
});

test('l2m keeps chained symbolic subscripts stable in fraction denominator', () => {
  const code = core.l2m('\\frac{1}{a_{s}_{s}}');
  assert.equal(code, '1/a_s_s');
});

test('l2m removes redundant fraction parentheses for atomic terms', () => {
  const code = core.l2m('\\frac{1}{x}+\\frac{x}{2}+\\frac{1}{x+y}');
  assert.equal(code, '1/x+x/2+1/(x+y)');
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

test('l2m applies numeric coefficient to plain log token', () => {
  const code = core.l2m('2\\log x');
  assert.equal(code, '2 * log(x)');
});

test('l2m treats trig function followed by Greek command as function application', () => {
  const code = core.l2m('\\cos \\alpha');
  assert.equal(code, 'cos(alpha)');
});

test('l2m keeps psi as symbolic factor without explicit call', () => {
  const code = core.l2m('\\psi x');
  assert.equal(code, 'psi * x');
});

test('l2m keeps zeta as symbolic factor without explicit call', () => {
  const code = core.l2m('\\zeta x');
  assert.equal(code, 'zeta * x');
});

test('l2m supports explicit psi and zeta function calls with parentheses', () => {
  const code = core.l2m('psi(x) + zeta(x)');
  assert.equal(code, 'psi(x) + zeta(x)');
});

test('l2m keeps multiplication when trig function already has explicit argument', () => {
  const code = core.l2m('\\cos\\left(x\\right)\\alpha');
  assert.equal(code, 'cos(x) * alpha');
});

test('l2m converts compact plain log numeric input', () => {
  const code = core.l2m('\\log1 + \\log101');
  assert.equal(code, 'log(1) + log(101)');
});

test('l2m merges trailing digits into numeric log argument', () => {
  const code = core.l2m('\\log\\left(1\\right)0');
  assert.equal(code, 'log(10)');
});

test('l2m converts compact plain trig numeric input', () => {
  const code = core.l2m('\\sin1 + \\cos2');
  assert.equal(code, 'sin(1) + cos(2)');
});

test('l2m converts compact plain unary numeric input for ln/exp/sqrt/abs/floor/ceil', () => {
  const code = core.l2m('\\ln1 + \\exp2 + \\sqrt3 + \\abs4 + \\floor5 + \\ceil6');
  assert.equal(code, 'log(1) + exp(2) + sqrt(3) + abs(4) + floor(5) + ceil(6)');
});

test('l2m converts compact inverse and hyperbolic trig numeric input', () => {
  const code = core.l2m('asin1 + atanh2 + sinh3');
  assert.equal(code, 'asin(1) + atanh(2) + sinh(3)');
});

test('l2m disambiguates inverse trig from hyperbolic names when followed by h', () => {
  const code = core.l2m('\\tan^{-1}h + \\sin^{-1}h + \\cos^{-1}h');
  assert.equal(code, 'atan(h) + asin(h) + acos(h)');
});

test('l2m handles spaced inverse trig notation with subscript argument', () => {
  const code = core.l2m('\\tan ^{-1}h_1');
  assert.equal(code, 'atan(h_1)');
});

test('l2m handles inverse trig with LaTeX command subscript argument', () => {
  const code = core.l2m('\\cos ^{-1}\\alpha _0');
  assert.equal(code, 'acos(alpha_0)');
});

test('l2m keeps multiplication after inverse trig application', () => {
  const code = core.l2m('\\cos^{-1}\\alpha_0\\beta');
  assert.equal(code, 'acos(alpha_0) * beta');
});

test('l2m keeps literal hyperbolic inverse names as hyperbolic functions', () => {
  const code = core.l2m('atanhx + asinhy + acoshz');
  assert.equal(code, 'atanh(x) + asinh(y) + acosh(z)');
});

test('l2m merges trailing digits into numeric trig argument', () => {
  const code = core.l2m('\\sin\\left(1\\right)0');
  assert.equal(code, 'sin(10)');
});

test('l2m merges trailing digits into numeric unary arguments', () => {
  const code = core.l2m('exp(1)0 + sqrt(2)3 + floor(4)5 + asinh(6)7');
  assert.equal(code, 'exp(10) + sqrt(23) + floor(45) + asinh(67)');
});

test('l2m converts compact trig power without parentheses', () => {
  const code = core.l2m('\\sin^2 x');
  assert.equal(code, 'sin(x)^2');
});

test('l2m converts compact trig power with optional spacing and command argument', () => {
  const code = core.l2m('\\sin ^2\\theta');
  assert.equal(code, 'sin(theta)^2');
});

test('l2m converts compact trig braced power without parentheses', () => {
  const code = core.l2m('\\cos^{3}y');
  assert.equal(code, 'cos(y)^3');
});

test('l2m converts compact trig braced power with command argument', () => {
  const code = core.l2m('\\sin^{2}\\theta');
  assert.equal(code, 'sin(theta)^2');
});

test('l2m converts compact trig braced power with braced argument', () => {
  const code = core.l2m('\\sin^{2}{x}');
  assert.equal(code, 'sin(x)^2');
});

test('l2m converts compact base-10 log application to function call', () => {
  const code = core.l2m('\\log_{10}a');
  assert.equal(code, 'log10(a)');
});

test('l2m converts explicit base-10 log with numeric argument', () => {
  const code = core.l2m('\\log_{10}1');
  assert.equal(code, 'log10(1)');
});

test('l2m converts compact base-2 log application to function call', () => {
  const code = core.l2m('\\log_{2}x');
  assert.equal(code, 'log2(x)');
});

test('l2m maps bare explicit base-log to matlab function symbol', () => {
  const code = core.l2m('\\log_{10} + \\log_{2}');
  assert.equal(code, 'log10 + log2');
});

test('l2m keeps explicit parenthesized base-log as MATLAB log function', () => {
  const code = core.l2m('\\log_{10}(a) + \\log_{2}(x)');
  assert.equal(code, 'log10(a) + log2(x)');
});

test('l2m treats plain log10 token as log of 10', () => {
  const code = core.l2m('log10');
  assert.equal(code, 'log(10)');
});

test('l2m treats plain log10 followed by variable as multiplication', () => {
  const code = core.l2m('log10x');
  assert.equal(code, 'log(10) * x');
});

test('l2m inserts multiplication after symbolic subscript for multi-letter tail', () => {
  const code = core.l2m('a_{e}bc');
  assert.equal(code, 'a_e * b * c');
});

test('l2m handles indexed square root form', () => {
  const code = core.l2m('\\sqrt[1]{4}');
  assert.equal(code, 'nthroot(4,1)');
});

test('l2m converts cbrt braced input to nthroot with index 3', () => {
  const code = core.l2m('\\cbrt{x}');
  assert.equal(code, 'nthroot(x,3)');
});

test('l2m converts cbrt parenthesized input to nthroot with index 3', () => {
  const code = core.l2m('\\cbrt\\left(x+1\\right)');
  assert.equal(code, 'nthroot(x+1,3)');
});

test('l2m converts plain cbrt token to nthroot with index 3', () => {
  const code = core.l2m('cbrt(x+1)');
  assert.equal(code, 'nthroot(x+1,3)');
});

test('l2m converts operatorname cbrt token to nthroot with index 3', () => {
  const code = core.l2m('\\operatorname{cbrt}(x+1)');
  assert.equal(code, 'nthroot(x+1,3)');
});

test('l2m converts text cbrt token to nthroot with index 3', () => {
  const code = core.l2m('\\text{cbrt}\\left(x\\right)');
  assert.equal(code, 'nthroot(x,3)');
});

test('l2m handles deeply nested square root expressions', () => {
  const code = core.l2m('\\left(\\sqrt{\\sqrt{\\sqrt{x}}}\\right)');
  assert.equal(code, '(sqrt(sqrt(sqrt(x))))');
});

test('l2m inserts multiplication between number and parenthesis', () => {
  const code = core.l2m('3\\left(x\\right) + 2.5(y) + 10\\left(z\\right)');
  assert.equal(code, '3 * (x) + 2.5 * (y) + 10 * (z)');
});

test('l2m keeps single multiplication around cdot before Greek symbols', () => {
  const code = core.l2m('2\\cdot \\Delta t');
  assert.equal(code, '2*Delta * t');
  assert.equal(code.includes('**'), false);
});

test('l2m keeps single multiplication around times before Greek symbols', () => {
  const code = core.l2m('2\\times \\Delta t');
  assert.equal(code, '2*Delta * t');
  assert.equal(code.includes('**'), false);
});

test('l2m inserts multiplication between parenthesis and number', () => {
  const code = core.l2m('\\left(x\\right)3 + (a + b)2.5 + sin(x)10');
  assert.equal(code, '(x) * 3 + (a + b) * 2.5 + sin(x) * 10');
});

test('l2m converts compact single-letter digit token after coefficient into subscript', () => {
  const code = core.l2m('\\left(x\\right)332a12');
  assert.equal(code, '(x) * 332 * a_12');
});

test('l2m preserves consecutive trig functions with proper spacing and multiplication', () => {
  const code = core.l2m('\\sin a\\cos \\left(1\\right)');
  assert.equal(code, 'sin(a) * cos(1)');
});

test('l2m inserts multiplication for chained function calls followed by identifier', () => {
  const code = core.l2m('\\log \\left(123\\right)\\log \\left(1234\\right)a');
  assert.equal(code, 'log(123) * log(1234) * a');
});

test('l2m inserts multiplication for longer chained function calls', () => {
  const code = core.l2m('\\log \\left(2\\right)\\sin \\left(3\\right)\\ceil \\left(4\\right)a');
  assert.equal(code, 'log(2) * sin(3) * ceil(4) * a');
});

test('l2m applies numeric coefficients to plain function tokens', () => {
  const code = core.l2m('2\\log x + 3\\sin x');
  assert.equal(code, '2 * log(x) + 3 * sin(x)');
});

test('l2m inserts multiplication between adjacent braced identifiers', () => {
  const code = core.l2m('\\left\\{asss\\right\\}\\left\\{aass\\right\\}');
  assert.equal(code, 'asss * aass');
});

test('l2m inserts multiplication between braced identifier and following identifier', () => {
  const code = core.l2m('\\left\\{bbb\\right\\}a');
  assert.equal(code, 'bbb * a');
});

test('normalizeParenLatex wraps plain parentheses with left/right', () => {
  const out = core.normalizeParenLatex('(x(x^2))');
  assert.equal(out, '\\left(x\\left(x^2\\right)\\right)');
});

test('autoSubscriptVariableNumbers converts single-letter variable-digit runs', () => {
  const out = core.autoSubscriptVariableNumbers('a3+b12+c');
  assert.equal(out, 'a_{3}+b_{12}+c');
});

test('autoSubscriptVariableNumbers extends existing numeric subscripts with trailing digits', () => {
  const out = core.autoSubscriptVariableNumbers('a_{1}23+b_{45}6');
  assert.equal(out, 'a_{123}+b_{456}');
});

test('autoSubscriptVariableNumbers handles spaced and compact incremental subscript forms', () => {
  const out = core.autoSubscriptVariableNumbers('a_{1} 23 + b_45');
  assert.equal(out, 'a_{123} + b_{45}');
});

test('autoSubscriptVariableNumbers extends non-numeric subscripts with trailing digits', () => {
  const out = core.autoSubscriptVariableNumbers('a_{d}123 + b_{ref}9');
  assert.equal(out, 'a_{d123} + b_{ref9}');
});

test('autoSubscriptVariableNumbers handles unbraced alphabetic subscripts with trailing digits', () => {
  const out = core.autoSubscriptVariableNumbers('a_d123 + b_ref9');
  assert.equal(out, 'a_{d123} + b_{ref9}');
});

test('autoSubscriptVariableNumbers canonicalizes single-letter unbraced subscript', () => {
  const out = core.autoSubscriptVariableNumbers('a_d + c_4');
  assert.equal(out, 'a_{d} + c_{4}');
});

test('autoSubscriptVariableNumbers canonicalizes greek command with trailing digit', () => {
  const out = core.autoSubscriptVariableNumbers('\\alpha 0 + \\rho2');
  assert.equal(out, '\\alpha_{0} + \\rho_{2}');
});

test('autoSubscriptVariableNumbers canonicalizes greek command numeric subscript', () => {
  const out = core.autoSubscriptVariableNumbers('\\alpha_02 + \\rho_7');
  assert.equal(out, '\\alpha_{02} + \\rho_{7}');
});

test('autoSubscriptVariableNumbers absorbs trailing digits for greek command subscript', () => {
  const out = core.autoSubscriptVariableNumbers('\\alpha_{0}23x');
  assert.equal(out, '\\alpha_{023}x');
});

test('autoSubscriptVariableNumbers does not rewrite compact explicit log base forms', () => {
  const out = core.autoSubscriptVariableNumbers('\\log_10 + \\log_2');
  assert.equal(out, '\\log_10 + \\log_2');
});

test('autoSubscriptVariableNumbers treats partial and nabla like regular variables', () => {
  const out = core.autoSubscriptVariableNumbers('\\partial 2 + \\nabla 3');
  assert.equal(out, '\\partial_{2} + \\nabla_{3}');
});

test('autoSubscriptVariableNumbers does not rewrite multi-letter identifiers', () => {
  const out = core.autoSubscriptVariableNumbers('log223\\left(x\\right)+alpha12');
  assert.equal(out, 'log223\\left(x\\right)+alpha12');
});

test('autoSubscriptVariableNumbers does not merge trailing digits into log base subscripts', () => {
  const out = core.autoSubscriptVariableNumbers('log_{10}1 + log_{2}3');
  assert.equal(out, 'log_{10}1 + log_{2}3');
});

test('autoSubscriptVariableNumbers converts compact coefficient-variable-digit tokens', () => {
  const out = core.autoSubscriptVariableNumbers('\\left(x\\right)332a12');
  assert.equal(out, '\\left(x\\right)332a_{12}');
});

test('autoSubscriptVariableNumbers canonicalizes unbraced numeric subscripts after coefficients', () => {
  const out = core.autoSubscriptVariableNumbers('\\left(x\\right)33a_243');
  assert.equal(out, '\\left(x\\right)33a_{243}');
});

test('normalizeCompactLogInput wraps compact explicit base-log numeric input', () => {
  const out = core.normalizeCompactLogInput('\\log_{10}1 + \\log_{2}3');
  assert.equal(out, '\\log_{10}\\left(1\\right) + \\log_{2}\\left(3\\right)');
});

test('normalizeCompactLogInput leaves bare explicit base-log constants unchanged', () => {
  const out = core.normalizeCompactLogInput('\\log_{10}+x');
  assert.equal(out, '\\log_{10}+x');
});

test('normalizeCompactLogInput wraps compact plain log numeric input', () => {
  const out = core.normalizeCompactLogInput('\\log1+\\log101');
  assert.equal(out, '\\log\\left(1\\right)+\\log\\left(101\\right)');
});

test('normalizeCompactLogInput merges appended digits into numeric log argument', () => {
  const out = core.normalizeCompactLogInput('\\log\\left(1\\right)0');
  assert.equal(out, '\\log\\left(10\\right)');
});

test('normalizeCompactLogInput wraps compact plain trig numeric input', () => {
  const out = core.normalizeCompactLogInput('\\sin1+\\cos2');
  assert.equal(out, '\\sin\\left(1\\right)+\\cos\\left(2\\right)');
});

test('normalizeCompactLogInput wraps compact unary numeric input', () => {
  const out = core.normalizeCompactLogInput('\\ln1+\\exp2+\\sqrt3+\\abs4+\\floor5+\\ceil6');
  assert.equal(out, '\\ln\\left(1\\right)+\\exp\\left(2\\right)+\\sqrt{3}+\\abs\\left(4\\right)+\\floor\\left(5\\right)+\\ceil\\left(6\\right)');
});

test('normalizeCompactLogInput merges appended digits into numeric trig argument', () => {
  const out = core.normalizeCompactLogInput('\\sin\\left(1\\right)0');
  assert.equal(out, '\\sin\\left(10\\right)');
});

test('normalizeCompactLogInput merges appended digits into numeric unary arguments', () => {
  const out = core.normalizeCompactLogInput('\\exp\\left(1\\right)0+\\sqrt{2}3+\\asinh\\left(4\\right)5');
  assert.equal(out, '\\exp\\left(10\\right)+\\sqrt{23}+\\asinh\\left(45\\right)');
});

test('normalizeCompactLogInput merges appended digits for \\mathrm unary functions', () => {
  const out = core.normalizeCompactLogInput('\\mathrm{ceil}\\left(1\\right)00+\\mathrm{exp}\\left(2\\right)3');
  assert.equal(out, '\\mathrm{ceil}\\left(100\\right)+\\mathrm{exp}\\left(23\\right)');
});

test('normalizeCompactLogInput merges appended digits for \\mathrm trig/inverse functions', () => {
  const out = core.normalizeCompactLogInput('\\mathrm{tan}\\left(4\\right)5+\\mathrm{atanh}\\left(6\\right)7');
  assert.equal(out, '\\mathrm{tan}\\left(45\\right)+\\mathrm{atanh}\\left(67\\right)');
});

test('normalizeCompactLogInput renders plain inverse hyperbolic names as operators', () => {
  const out = core.normalizeCompactLogInput('atanh(1)+asinh(2)+acosh(3)');
  assert.equal(out, '\\mathrm{atanh}(1)+\\mathrm{asinh}(2)+\\mathrm{acosh}(3)');
});

test('normalizeCompactLogInput wraps compact numeric inverse hyperbolic names as operators', () => {
  const out = core.normalizeCompactLogInput('atanh1+asinh2+acosh3');
  assert.equal(out, '\\mathrm{atanh}\\left(1\\right)+\\mathrm{asinh}\\left(2\\right)+\\mathrm{acosh}\\left(3\\right)');
});

test('normalizeCompactLogInput renders plain typed atan and ceil as operators', () => {
  const out = core.normalizeCompactLogInput('atan(x)+ceil(1)');
  assert.equal(out, '\\mathrm{atan}(x)+\\mathrm{ceil}(1)');
});

test('normalizeCompactLogInput wraps plain typed function plus variable/number argument', () => {
  const out = core.normalizeCompactLogInput('atanx+ceil1+exp t');
  assert.equal(out, '\\mathrm{atan}\\left(x\\right)+\\mathrm{ceil}\\left(1\\right)+\\mathrm{exp}\\left(t\\right)');
});

test('normalizeCompactLogInput wraps plain typed inverse-hyperbolic function plus variable argument', () => {
  const out = core.normalizeCompactLogInput('atanhx+asinhy+acoshz');
  assert.equal(out, '\\mathrm{atanh}\\left(x\\right)+\\mathrm{asinh}\\left(y\\right)+\\mathrm{acosh}\\left(z\\right)');
});

test('astTex applies sized parentheses in nested/tall contexts', () => {
  core.resetColors();
  const tex = core.astTex(core.parseMatlab('((x*(x^2)))'));
  assert.match(tex, /\\big|\\Big|\\bigg|\\Bigg/);
});

test('astTex omits redundant explicit parentheses around fraction operands', () => {
  core.resetColors();
  const tex = core.astTex(core.parseMatlab('x=(-b+sqrt(b^2-4*a*c))/(2*a)'));
  assert.match(tex, /= \\dfrac\{/);
  assert.equal(tex.includes('\\Big('), false);
  assert.equal(tex.includes('\\big('), false);
});

test('astTex keeps outer parentheses larger than inner for nested fractions', () => {
  core.resetColors();
  const tex = core.astTex(core.parseMatlab('((x/(y+1)))'));
  const outerPos = tex.indexOf('\\Bigg(');
  const innerPos = tex.indexOf('\\bigg(');
  assert.equal(outerPos >= 0, true);
  assert.equal(innerPos >= 0, true);
  assert.equal(outerPos < innerPos, true);
});

test('astTex renders long rotor sample without clipping-sensitive size inversion', () => {
  core.resetColors();
  const src = 'C_T ./ sigma = a ./ 4 .* ((2 ./ 3 + mu .^ 2) .* theta_0 + (1 ./ 2 + 1 ./ 2 .* mu .^ 2) .* theta_T + mu .* (alpha_TTP - (B_1 + a_1_s)) - lambda_1)';
  const line = core.splitLines(src)[0];
  const tex = core.astTex(core.parseMatlab(line));
  const outerPos = tex.indexOf('\\Bigg(');
  const innerPos = tex.indexOf('\\bigg(');
  assert.equal(outerPos >= 0, true);
  assert.equal(innerPos >= 0, true);
  assert.equal(outerPos < innerPos, true);
  assert.match(tex, /a_\{\\text\{1\\_s\}\}/);
});

test('astTex escapes underscore inside subscript text', () => {
  core.resetColors();
  const tex = core.astTex(core.parseMatlab('a_1_s + B_1'));
  assert.match(tex, /a_\{\\text\{1\\_s\}\}/);
  assert.match(tex, /B_\{\\text\{1\}\}/);
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

test('findAmbig + buildCode merges Delta pair into subscript', () => {
  const toks = core.tokenize('Delta * t + x');
  const pairs = core.findAmbig(toks);
  assert.equal(pairs.length, 1);
  const code = core.buildCode(toks, pairs, { [pairs[0].li]: 'm' });
  assert.equal(code, 'Delta_t + x');
});

test('vectorize inserts dot operators', () => {
  const vec = core.vectorize('a*b + x^2 / y');
  assert.equal(vec, 'a.*b + x.^2 ./ y');
});

test('cleanLatexForCopy removes textcolor and dfrac', () => {
  const out = core.cleanLatexForCopy('\\textcolor{#fff}{x}+\\dfrac{1}{2}');
  assert.equal(out, 'x+\\frac{1}{2}');
});

test('cleanLatexForCopy normalizes sized parentheses to left/right delimiters', () => {
  const out = core.cleanLatexForCopy('\\Bigg(x+1\\Bigg) + \\bigg(y\\bigg)');
  assert.equal(out, '\\left(x+1\\right) + \\left(y\\right)');
});

test('cleanLatexForCopy normalizes sized brackets to left/right delimiters', () => {
  const out = core.cleanLatexForCopy('\\Big[z\\Big] + \\big[w\\big]');
  assert.equal(out, '\\left[z\\right] + \\left[w\\right]');
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
