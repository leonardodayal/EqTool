(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.EqToolCore = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VAR_COLORS = [
    ['#4f8ef7', '#1a2a4a'], ['#34d399', '#0d3326'], ['#f87171', '#3b1515'], ['#c084fc', '#2d1645'],
    ['#fb923c', '#3d1d08'], ['#22d3ee', '#0a2f38'], ['#f472b6', '#3b0f2a'], ['#facc15', '#3b2e05'],
    ['#a3e635', '#1e2e05'], ['#818cf8', '#1a1f45']
  ];
  const TRIG_POW = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh']);
  const TRIG_INV = {
    acos: '\\cos^{-1}', asin: '\\sin^{-1}', atan: '\\tan^{-1}', acot: '\\cot^{-1}', asec: '\\sec^{-1}',
    acsc: '\\csc^{-1}', asinh: '\\sinh^{-1}', acosh: '\\cosh^{-1}', atanh: '\\tanh^{-1}', arccos: '\\cos^{-1}',
    arcsin: '\\sin^{-1}', arctan: '\\tan^{-1}', arccot: '\\cot^{-1}', arcsec: '\\sec^{-1}', arccsc: '\\csc^{-1}',
    atan2: '\\operatorname{atan2}'
  };
  const KNOWN_TEX = {
    sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', sec: '\\sec', csc: '\\csc',
    sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', exp: '\\exp', log: '\\ln', log2: '\\log_2',
    log10: '\\log_{10}', abs: '\\left|#\\right|', floor: '\\lfloor#\\rfloor', ceil: '\\lceil#\\rceil'
  };
  const GREEK_WORDS = new Set([
    'delta', 'alpha', 'beta', 'gamma', 'rho', 'mu', 'theta', 'omega', 'sigma',
    'phi', 'lambda', 'pi', 'eta', 'nu', 'xi', 'tau', 'epsilon', 'zeta'
  ]);
  const CONSTANTS = { pi: '\\pi', Inf: '\\infty', inf: '\\infty', NaN: '\\text{NaN}' };

  const EXAMPLES_M2S = [
    '(sin(theta)^2 + acos(alpha_0)) / (2 * delta_t) + sqrt(rho_ref^3)'
  ];
  const EXAMPLES_S2M = [
    '\\frac{\\sin^2\\left(\\theta\\right)+\\cos^{-1}\\left(\\alpha_0\\right)}{2\\cdot\\Delta t}+\\sqrt{\\rho_{ref}^3}'
  ];

  let varColorMap = {};
  let colorIdx = 0;

  function resetColors() {
    varColorMap = {};
    colorIdx = 0;
  }

  function getVarColor(name) {
    if (!(name in varColorMap)) {
      varColorMap[name] = VAR_COLORS[colorIdx++ % VAR_COLORS.length];
    }
    return varColorMap[name];
  }

  function getVarColorMap() {
    return Object.assign({}, varColorMap);
  }

  function tokenize(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      if (/\s/.test(src[i])) { i += 1; continue; }
      if (src[i] === '.' && '*/^'.includes(src[i + 1] || '')) {
        toks.push({ t: 'op', v: src[i] + src[i + 1] });
        i += 2;
        continue;
      }
      if ('+-*/^='.includes(src[i])) { toks.push({ t: 'op', v: src[i] }); i += 1; continue; }
      if (src[i] === '\\') { toks.push({ t: 'op', v: 'back' }); i += 1; continue; }
      if (src[i] === '(') { toks.push({ t: 'lp', v: '(' }); i += 1; continue; }
      if (src[i] === ')') { toks.push({ t: 'rp', v: ')' }); i += 1; continue; }
      if (src[i] === ',') { toks.push({ t: 'cm', v: ',' }); i += 1; continue; }
      if (/[a-zA-Z_]/.test(src[i])) {
        let j = i;
        while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) { j += 1; }
        const word = src.slice(i, j);
        let k = j;
        while (k < src.length && src[k] === ' ') { k += 1; }
        toks.push({ t: src[k] === '(' ? 'func' : 'var', v: word });
        i = j;
        continue;
      }
      if (/[0-9.]/.test(src[i])) {
        let j = i;
        while (j < src.length && /[0-9.]/.test(src[j])) { j += 1; }
        toks.push({ t: 'num', v: src.slice(i, j) });
        i = j;
        continue;
      }
      toks.push({ t: 'other', v: src[i] });
      i += 1;
    }
    return toks;
  }

  let _T = [];
  let _P = 0;

  function _peek() {
    return _T[_P] || { t: 'eof', v: '' };
  }

  function _next() {
    const tok = _T[_P] || { t: 'eof', v: '' };
    _P += 1;
    return tok;
  }

  function _prec(tok) {
    if (tok.t !== 'op') { return -1; }
    if (tok.v === '=') { return 1; }
    if (tok.v === '+' || tok.v === '-') { return 2; }
    if (tok.v === '*' || tok.v === '.*' || tok.v === '/' || tok.v === './' || tok.v === 'back') { return 3; }
    if (tok.v === '^' || tok.v === '.^') { return 5; }
    return -1;
  }

  function _expr(mp) {
    let left = _unary();
    while (true) {
      const op = _peek();
      const p = _prec(op);
      if (p < mp) { break; }
      _next();
      left = {
        t: 'binop',
        op: op.v,
        left: left,
        right: _expr((op.v === '^' || op.v === '.^') ? p : p + 1)
      };
    }
    return left;
  }

  function _unary() {
    if (_peek().t === 'op' && _peek().v === '-') {
      _next();
      return { t: 'unary', op: '-', arg: _unary() };
    }
    if (_peek().t === 'op' && _peek().v === '+') {
      _next();
      return _unary();
    }
    return _prim();
  }

  function _prim() {
    const tok = _peek();
    if (tok.t === 'num') { _next(); return { t: 'num', v: tok.v }; }
    if (tok.t === 'var') { _next(); return { t: 'var', v: tok.v }; }
    if (tok.t === 'func') {
      _next();
      _next();
      const args = [];
      if (_peek().t !== 'rp') {
        args.push(_expr(0));
        while (_peek().t === 'cm') {
          _next();
          args.push(_expr(0));
        }
      }
      if (_peek().t === 'rp') { _next(); }
      return { t: 'func', name: tok.v, args: args };
    }
    if (tok.t === 'lp') {
      _next();
      const inner = _expr(0);
      if (_peek().t === 'rp') { _next(); }
      return { t: 'paren', inner: inner };
    }
    _next();
    return { t: 'other', v: tok.v };
  }

  function parseMatlab(src) {
    _T = tokenize(src);
    _P = 0;
    return _expr(0);
  }

  function varTex(name) {
    if (CONSTANTS[name]) { return CONSTANTS[name]; }
    const fg = getVarColor(name)[0];
    const parts = name.split('_');
    const base = parts[0];
    const sub = parts.slice(1).join('_');
    return '\\textcolor{' + fg + '}{' + (sub ? base + '_{\\text{' + sub + '}}' : base) + '}';
  }

  function needsP(node, parentOp, side) {
    if (node.t !== 'binop') { return false; }
    const cp = _prec({ t: 'op', v: node.op });
    const pp = _prec({ t: 'op', v: parentOp });
    return cp < pp || (cp === pp && side === 'right' && (parentOp === '/' || parentOp === './'));
  }

  function containsTallContent(node) {
    if (!node) { return false; }
    if (node.t === 'binop' && (node.op === '/' || node.op === './' || node.op === '^' || node.op === '.^')) {
      return true;
    }
    if (node.t === 'paren') { return containsTallContent(node.inner); }
    if (node.t === 'unary') { return containsTallContent(node.arg); }
    if (node.t === 'func') { return node.args.some(containsTallContent); }
    if (node.t === 'binop') { return containsTallContent(node.left) || containsTallContent(node.right); }
    return false;
  }

  function wrapSizedParen(innerTex, depth, hasTallContent) {
    const sizeLevel = Math.min(4, depth + (hasTallContent ? 1 : 0));
    const cmd = ['', '\\big', '\\Big', '\\bigg', '\\Bigg'][Math.max(0, sizeLevel)];
    const openTok = cmd ? cmd + '(' : '(';
    const closeTok = cmd ? cmd + ')' : ')';
    return openTok + innerTex + closeTok;
  }

  function astTex(node, depth) {
    const level = depth || 0;
    if (!node) { return ''; }
    if (node.t === 'num') { return node.v; }
    if (node.t === 'var') { return varTex(node.v); }
    if (node.t === 'paren') {
      const inner = astTex(node.inner, level + 1);
      return wrapSizedParen(inner, level + 1, containsTallContent(node.inner));
    }
    if (node.t === 'unary') { return '-' + astTex(node.arg, level); }
    if (node.t === 'other') { return node.v; }

    if (node.t === 'func') {
      const name = node.name;
      const a0 = node.args[0] ? astTex(node.args[0], level) : '';
      const all = node.args.map(function (arg) { return astTex(arg, level); }).join(', ');
      if (name === 'sqrt') { return '\\sqrt{' + a0 + '}'; }
      if (TRIG_INV[name]) { return TRIG_INV[name] + '\\left(' + all + '\\right)'; }
      if (KNOWN_TEX[name]) {
        const templ = KNOWN_TEX[name];
        return templ.includes('#') ? templ.replace('#', all) : templ + '\\left(' + all + '\\right)';
      }
      return '\\operatorname{' + name + '}\\left(' + all + '\\right)';
    }

    if (node.t === 'binop') {
      const op = node.op;
      const left = node.left;
      const right = node.right;

      if ((op === '^' || op === '.^') && left.t === 'func' && TRIG_POW.has(left.name)) {
        const fn = KNOWN_TEX[left.name] || '\\operatorname{' + left.name + '}';
        return fn + '^{' + astTex(right, level) + '}\\left(' + left.args.map(function (arg) {
          return astTex(arg, level);
        }).join(', ') + '\\right)';
      }

      if (op === '/' || op === './') {
        return '\\dfrac{' + astTex(left, level) + '}{' + astTex(right, level) + '}';
      }

      if (op === '^' || op === '.^') {
        let base = astTex(left, level);
        if (left.t === 'binop' || left.t === 'func') {
          base = '\\left(' + astTex(left, level + 1) + '\\right)';
        }
        let exp;
        if (
          right.t === 'paren' && right.inner && right.inner.t === 'binop' &&
          (right.inner.op === '/' || right.inner.op === './')
        ) {
          exp = '\\frac{' + astTex(right.inner.left, level + 1) + '}{' + astTex(right.inner.right, level + 1) + '}';
        } else {
          exp = astTex(right, level + 1);
        }
        return base + '^{' + exp + '}';
      }

      if (op === '*' || op === '.*') {
        let l = astTex(left, level);
        let r = astTex(right, level);
        if (needsP(left, op, 'left')) { l = '\\left(' + l + '\\right)'; }
        if (needsP(right, op, 'right')) { r = '\\left(' + r + '\\right)'; }
        const numLeft = left.t === 'num';
        const numRight = right.t === 'num';
        const varLeft = left.t === 'var';
        const varRight = right.t === 'var';
        if ((numLeft && varRight) || (varLeft && numRight)) {
          return l + r;
        }
        return l + ' \\cdot ' + r;
      }

      if (op === 'back') { return astTex(left, level) + ' \\backslash ' + astTex(right, level); }
      if (op === '+' || op === '-') { return astTex(left, level) + ' ' + op + ' ' + astTex(right, level); }
      if (op === '=') { return astTex(left, level) + ' = ' + astTex(right, level); }
    }

    return '';
  }

  function normalizeParenLatex(latex) {
    if (!latex) { return latex; }

    let out = '';
    let i = 0;
    const stack = [];

    while (i < latex.length) {
      if (latex.startsWith('\\left(', i)) {
        out += '\\left(';
        stack.push('paren');
        i += 6;
        continue;
      }
      if (latex.startsWith('\\right)', i)) {
        out += '\\right)';
        if (stack.length) { stack.pop(); }
        i += 7;
        continue;
      }
      if (latex[i] === '(') {
        out += '\\left(';
        stack.push('paren');
        i += 1;
        continue;
      }
      if (latex[i] === ')') {
        if (stack.length) {
          out += '\\right)';
          stack.pop();
        } else {
          out += ')';
        }
        i += 1;
        continue;
      }

      out += latex[i];
      i += 1;
    }

    return out;
  }

  function exBraced(s, i) {
    while (i < s.length && s[i] === ' ') { i += 1; }
    if (s[i] !== '{') { return [s[i] || '', i + 1]; }
    let d = 0;
    let j = i;
    let out = '';
    while (j < s.length) {
      if (s[j] === '{') {
        d += 1;
        if (d > 1) { out += s[j]; }
      } else if (s[j] === '}') {
        d -= 1;
        if (d === 0) { j += 1; break; }
        out += s[j];
      } else {
        out += s[j];
      }
      j += 1;
    }
    return [out, j];
  }

  function exFrac(s) {
    let out = '';
    let i = 0;
    while (i < s.length) {
      const fi = s.indexOf('\\frac', i);
      if (fi === -1) {
        out += s.slice(i);
        break;
      }
      out += s.slice(i, fi);
      i = fi + 5;
      const numRes = exBraced(s, i);
      i = numRes[1];
      const denRes = exBraced(s, i);
      i = denRes[1];
      out += '(' + l2m(numRes[0]) + ')/(' + l2m(denRes[0]) + ')';
    }
    return out;
  }

  function convertSuperscripts(expr) {
    let out = '';
    let i = 0;

    while (i < expr.length) {
      if (expr[i] === '^' && expr[i + 1] === '{') {
        const braced = exBraced(expr, i + 1);
        const inner = convertSuperscripts(braced[0].trim());
        out += '^(' + inner + ')';
        i = braced[1];
        continue;
      }

      out += expr[i];
      i += 1;
    }

    return out;
  }

  function protectBracedIdentifiers(src) {
    function alphaIndex(n) {
      let out = '';
      let x = n;
      do {
        out = String.fromCharCode(65 + (x % 26)) + out;
        x = Math.floor(x / 26) - 1;
      } while (x >= 0);
      return out;
    }

    const saved = [];
    const protectedSrc = src.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, function (_m, ident, offset, full) {
      const key = 'QVARPROT' + alphaIndex(saved.length) + 'Q';
      saved.push({ key: key, ident: ident });
      const prev = offset > 0 ? full[offset - 1] : '';
      if (/[a-zA-Z0-9_)]/.test(prev)) {
        return ' * ' + key;
      }
      return key;
    });
    return { text: protectedSrc, saved: saved };
  }

  function restoreBracedIdentifiers(src, saved) {
    let out = src;
    for (let i = 0; i < saved.length; i += 1) {
      out = out.replace(new RegExp(saved[i].key, 'g'), saved[i].ident);
    }
    return out;
  }

  function splitAlphaRun(token, offset, fullText) {
    if (!token || token.includes('_')) {
      return token;
    }

    if (/^QVARPROT[A-Z]+Q$/.test(token)) {
      return token;
    }

    const functionNames = new Set([
      'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh',
      'asin', 'acos', 'atan', 'acot', 'asec', 'acsc', 'asinh', 'acosh', 'atanh',
      'arcsin', 'arccos', 'arctan', 'sqrt', 'exp', 'log', 'log2', 'log10',
      'abs', 'floor', 'ceil', 'atan2', 'nthroot'
    ]);
    if (functionNames.has(token)) {
      return token;
    }

    // Keep function calls intact, e.g. sin( ... ), sqrt( ... )
    const nextChar = fullText[offset + token.length] || '';
    if (nextChar === '(') {
      return token;
    }

    // Preserve common symbolic names and constants as single identifiers.
    const preserve = new Set([
      'delta', 'alpha', 'beta', 'gamma', 'rho', 'mu', 'theta', 'omega', 'sigma',
      'phi', 'lambda', 'pi', 'eta', 'nu', 'xi', 'tau', 'epsilon', 'zeta',
      'Inf', 'NaN'
    ]);
    if (preserve.has(token)) {
      return token;
    }

    if (!/^[a-zA-Z]+$/.test(token) || token.length <= 1) {
      return token;
    }

    return token.split('').join(' * ');
  }

  function l2m(src) {
    let s = src.trim();
    let prot = { text: s, saved: [] };

    s = s.replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, '$1');
    s = s.replace(/\\left\s*\(/g, '(').replace(/\\right\s*\)/g, ')');
    s = s.replace(/\\left\s*\[/g, '(').replace(/\\right\s*\]/g, ')');
    s = s.replace(/\\left\s*\\\{/g, '{').replace(/\\right\s*\\\}/g, '}');
    s = s.replace(/\\left\s*\{/g, '{').replace(/\\right\s*\}/g, '}');
    s = s.replace(/\\left\s*\|/g, 'abs(').replace(/\\right\s*\|/g, ')');
    s = s.replace(/\\\{/g, '{').replace(/\\\}/g, '}');
    s = s.replace(/\\lfloor/g, 'floor(').replace(/\\rfloor/g, ')');
    s = s.replace(/\\lceil/g, 'ceil(').replace(/\\rceil/g, ')');

    s = s.replace(/\\arccos\b/g, 'acos').replace(/\\arcsin\b/g, 'asin').replace(/\\arctan\b/g, 'atan');
    s = s.replace(/\\arccot\b/g, 'acot').replace(/\\arcsec\b/g, 'asec').replace(/\\arccsc\b/g, 'acsc');
    s = s.replace(/\\cos\^(?:\{-1\}|-1)/g, 'acos').replace(/\\sin\^(?:\{-1\}|-1)/g, 'asin').replace(/\\tan\^(?:\{-1\}|-1)/g, 'atan');
    s = s.replace(/\\cot\^(?:\{-1\}|-1)/g, 'acot').replace(/\\sec\^(?:\{-1\}|-1)/g, 'asec').replace(/\\csc\^(?:\{-1\}|-1)/g, 'acsc');
    s = s.replace(/\\sinh\^(?:\{-1\}|-1)/g, 'asinh').replace(/\\cosh\^(?:\{-1\}|-1)/g, 'acosh').replace(/\\tanh\^(?:\{-1\}|-1)/g, 'atanh');

    s = s.replace(/\\(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh)\^\{([^}]+)\}\s*\\left\s*\(/g, 'TRIGPOW_$1_$2_(');
    s = s.replace(/\\(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh)\^\{([^}]+)\}\s*\(/g, 'TRIGPOW_$1_$2_(');
    s = s.replace(/\\(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh)\^([0-9])\s*\\left\s*\(/g, 'TRIGPOW_$1_$2_(');
    s = s.replace(/\\(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh)\^([0-9])\s*\(/g, 'TRIGPOW_$1_$2_(');

    s = s.replace(/\\(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|exp)\b/g, '$1');
    s = s.replace(/\\log_\{10\}/g, 'log10').replace(/\\log_10(?![0-9])/g, 'log10').replace(/\\log_\{2\}/g, 'log2').replace(/\\log_2(?![0-9])/g, 'log2').replace(/\\ln\b/g, 'log').replace(/\\log(?=[^a-zA-Z_]|$)/g, 'log');
    s = s.replace(/\blog\s+([0-9]+)/g, 'log($1)');
    s = s.replace(/\\operatorname\{a(cos|sin|tan|cot|sec|csc|sinh|cosh|tanh)\}/g, 'a$1');
    s = s.replace(/\\operatorname\{atan2\}/g, 'atan2');
    s = s.replace(/\\operatorname\{([^}]+)\}/g, '$1');
    s = s.replace(/\\text\{([^}]+)\}/g, '$1');
    s = s.replace(/\\mathrm\{([^}]+)\}/g, '$1');

    const greek = {
      Delta: 'delta', delta: 'delta', alpha: 'alpha', beta: 'beta', gamma: 'gamma', rho: 'rho', mu: 'mu',
      theta: 'theta', omega: 'omega', sigma: 'sigma', phi: 'phi', pi: 'pi', lambda: 'lambda', eta: 'eta',
      nu: 'nu', xi: 'xi', tau: 'tau', epsilon: 'epsilon', zeta: 'zeta'
    };
    for (const k in greek) {
      s = s.replace(new RegExp('\\\\' + k + '(?![a-zA-Z])', 'g'), greek[k]);
    }

    s = s.replace(/\\infty/g, 'Inf');
    s = s.replace(/\\cdot\s*/g, '*').replace(/\\times\s*/g, '*');

    s = exFrac(s);
    s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, function (_m, n, inner) {
      return 'nthroot(' + l2m(inner) + ',' + l2m(n) + ')';
    });
    s = s.replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, function (_m, inner) {
      return 'sqrt(' + l2m(inner) + ')';
    });

    // Normalize all subscript forms into braced form first so explicit grouping is preserved.
    s = s.replace(/([a-zA-Z0-9_]+)\s+_\s*\{([^}]+)\}/g, '$1_{$2}');
    s = s.replace(/([a-zA-Z0-9_]+)\s+_\s*([a-zA-Z0-9])/g, '$1_{$2}');
    s = s.replace(/([a-zA-Z0-9_]+)_([a-zA-Z0-9])/g, '$1_{$2}');

    // Protect braced subscripts while inserting multiplication to avoid splitting inside subscript text.
    const subscriptProtections = [];
    const subscriptProtKey = (idx) => {
      let out = '';
      let x = idx;
      do {
        out = String.fromCharCode(65 + (x % 26)) + out;
        x = Math.floor(x / 26) - 1;
      } while (x >= 0);
      return 'QSUBPROT' + out + 'Q';
    };
    s = s.replace(/([a-zA-Z][a-zA-Z0-9]*)_\{([^}]+)\}/g, function (_m, base, sub) {
      const key = subscriptProtKey(subscriptProtections.length);
      subscriptProtections.push({ key: key, sub: sub, isNumeric: /^[0-9]+$/.test(sub) });
      return base + '_' + key;
    });

    // Insert multiplication only for numeric subscripts followed by an identifier, e.g. mu_{0}nIL -> mu_{0} * nIL.
    for (let i = 0; i < subscriptProtections.length; i += 1) {
      if (!subscriptProtections[i].isNumeric) {
        continue;
      }
      const key = subscriptProtections[i].key;
      s = s.replace(new RegExp('\\b([a-zA-Z][a-zA-Z0-9]*_' + key + ')([a-zA-Z][a-zA-Z0-9]*)\\b', 'g'), '$1 * $2');
    }
    
    s = convertSuperscripts(s);
    prot = protectBracedIdentifiers(s);
    s = prot.text;
    s = s.replace(/\^([a-zA-Z0-9])/g, '^$1');
    s = s.replace(/\s+/g, ' ').trim();

    s = s.replace(/TRIGPOW_([a-z]+)_([^_]+)_\(([^()]*)\)/g, function (_m, fn, exp, inner) {
      return fn + '(' + inner + ')^' + exp;
    });

    const trigFn2 = '(?:a(?:sin|cos|tan|sinh|cosh|tanh)|sin|cos|tan|cot|sec|csc|sinh|cosh|tanh)';
    s = s.replace(new RegExp('(' + trigFn2 + ')\\s*([a-zA-Z_][a-zA-Z0-9_]*)(?![(])', 'g'), function (_m, fn, arg) {
      return fn + '(' + arg + ')';
    });

    const fnNoParen = '(?:log10|log2|log|sqrt|exp|abs|floor|ceil|asin|acos|atan|acot|asec|acsc|asinh|acosh|atanh|arcsin|arccos|arctan|sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|atan2|nthroot)';
    s = s.replace(new RegExp('\\b(' + fnNoParen + ')\\s+([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\\.[0-9]+)?|QVARPROT[A-Z]+Q)(?!\\s*\\()', 'g'), function (_m, fn, arg) {
      return fn + '(' + arg + ')';
    });

    s = s.replace(/(delta|alpha|beta|gamma|rho|mu|theta|omega|sigma|phi|lambda|pi|eta|nu|xi|tau|epsilon|zeta)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, function (_m, g, r) {
      return g + ' * ' + r;
    });

    const knownFn = 'sqrt|sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|exp|log|log2|log10|abs|floor|ceil|asin|acos|atan|asinh|acosh|atanh|arcsin|arccos|arctan';
    const protectedNames = new Set(['asin', 'acos', 'atan', 'asinh', 'acosh', 'atanh', 'acot', 'asec', 'acsc']);
    s = s.replace(new RegExp('([a-zA-Z_][a-zA-Z0-9_]*)(' + knownFn + ')\\(', 'g'), function (_m, pre, fn) {
      const combined = pre + fn;
      if (protectedNames.has(combined)) {
        return combined + '(';
      }
      return pre + ' * ' + fn + '(';
    });

    s = s.replace(/([0-9]+\.?[0-9]*)([a-zA-Z_][a-zA-Z0-9_]*)/g, function (_m, n, v) {
      return n + ' * ' + v;
    });

    // Restore protected subscript text.
    for (let i = 0; i < subscriptProtections.length; i += 1) {
      s = s.replace(new RegExp(subscriptProtections[i].key, 'g'), subscriptProtections[i].sub);
    }

    // Split mixed-case symbol runs into separate multiplicative factors, e.g. nIL -> n * I * L.
    s = s.replace(/\b([a-zA-Z][a-zA-Z0-9]*)\b/g, function (_m, tok, off, full) {
      return splitAlphaRun(tok, off, full);
    });

    // Insert explicit multiplication for adjacent parenthesized groups, e.g. (4*x)(x) -> (4*x) * (x).
    s = s.replace(/\)\s*\(/g, ') * (');

    s = restoreBracedIdentifiers(s, prot.saved);
    return s.replace(/\s+/g, ' ').trim();
  }

  function findAmbig(toks) {
    const pairs = [];
    for (let i = 0; i < toks.length - 2; i += 1) {
      const left = toks[i];
      const op = toks[i + 1];
      const right = toks[i + 2];
      if (left.t === 'var' && GREEK_WORDS.has(left.v) && op.t === 'op' && op.v === '*' && right.t === 'var') {
        pairs.push({ li: i, ri: i + 2, lv: left.v, rv: right.v });
      }
    }
    return pairs;
  }

  function buildCode(toks, pairs, res) {
    const suppressOps = new Set();
    const mergeRight = new Set();
    for (const p of pairs) {
      if ((res[p.li] || 'u') === 'm') {
        suppressOps.add(p.li + 1);
        mergeRight.add(p.ri);
      }
    }

    const out = [];
    for (let i = 0; i < toks.length; i += 1) {
      if (suppressOps.has(i)) { continue; }
      if (mergeRight.has(i)) {
        out[out.length - 1].v += '_' + toks[i].v;
        continue;
      }
      out.push(Object.assign({}, toks[i]));
    }

    return out.map(function (t) {
      if (t.t === 'op') { return ' ' + t.v + ' '; }
      if (t.t === 'cm') { return ', '; }
      return t.v;
    }).join('').replace(/\s+/g, ' ').trim();
  }

  function synHL(toks, pairs, res, vec) {
    if (!toks.length) {
      return '<span class="eq-ph">output appears here</span>';
    }

    resetColors();
    const mapL = new Map();
    const mapR = new Map();
    const mapO = new Map();

    pairs.forEach(function (p, pi) {
      mapL.set(p.li, pi);
      mapR.set(p.ri, pi);
      mapO.set(p.li + 1, pi);
    });

    return toks.map(function (tok, i) {
      const isL = mapL.has(i);
      const isR = mapR.has(i);
      const isO = mapO.has(i);
      const pi = isL ? mapL.get(i) : isR ? mapR.get(i) : isO ? mapO.get(i) : -1;
      const r = pi >= 0 ? (res[pairs[pi].li] || 'u') : null;

      if (tok.t === 'var') {
        const fg = getVarColor(tok.v)[0];
        if ((isL || isR) && r === 'u') {
          return '<span class="t-ambig" onclick="toggleAmbig(' + pi + ')" title="Ambiguous: click to resolve">' + tok.v + '</span>';
        }
        if ((isL || isR) && r === 'm') {
          return '<span class="t-merge" onclick="toggleAmbig(' + pi + ')" title="Merged as subscript">' + tok.v + '</span>';
        }
        if ((isL || isR) && r === 'k') {
          return '<span class="t-keep" onclick="toggleAmbig(' + pi + ')" title="Kept as multiply">' + tok.v + '</span>';
        }
        return '<span style="color:' + fg + ';font-weight:500">' + tok.v + '</span>';
      }

      if (tok.t === 'func') { return '<span class="t-func">' + tok.v + '</span>'; }
      if (tok.t === 'num') { return '<span class="t-num">' + tok.v + '</span>'; }
      if (tok.t === 'op') {
        if (isO && r === 'u') {
          return '<span class="t-ambig" onclick="toggleAmbig(' + pi + ')"> ' + tok.v + ' </span>';
        }
        if (isO && r === 'm') {
          return '';
        }
        let disp = tok.v;
        if (vec && (tok.v === '*' || tok.v === '^' || tok.v === '/')) {
          disp = '.' + tok.v;
        }
        return '<span class="t-op"> ' + disp + ' </span>';
      }

      if (tok.t === 'lp' || tok.t === 'rp') {
        return '<span class="t-paren">' + tok.v + '</span>';
      }
      if (tok.t === 'cm') {
        return '<span class="t-paren">, </span>';
      }
      return tok.v;
    }).join('');
  }

  function splitLines(raw) {
    const joined = raw.replace(/\.\.\.[ \t]*\r?\n[ \t]*/g, ' ');
    const lines = joined.split(/\n|;/);
    const result = [];

    for (let i = 0; i < lines.length; i += 1) {
      let line = lines[i].trim();
      if (!line) { continue; }
      if (line.startsWith('%')) { continue; }
      line = line.replace(/^@\s*\([^)]*\)\s*/, '');
      line = line.replace(/\.\*/g, '*').replace(/\.\^/g, '^').replace(/\.\//g, '/');
      line = line.replace(/;\s*$/, '').trim();
      line = line.replace(/\s+/g, ' ');
      if (!line) { continue; }
      result.push(line);
    }

    return result;
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function findParenMismatch(src) {
    const stack = [];
    const unmatchedClose = [];

    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '(') {
        stack.push(i);
      } else if (ch === ')') {
        if (stack.length) {
          stack.pop();
        } else {
          unmatchedClose.push(i);
        }
      }
    }

    return {
      unmatchedOpen: stack.slice(),
      unmatchedClose: unmatchedClose,
      hasMismatch: stack.length > 0 || unmatchedClose.length > 0
    };
  }

  function highlightParenMismatch(src, mismatch) {
    const mm = mismatch || findParenMismatch(src);
    if (!mm.hasMismatch) {
      return escHtml(src);
    }

    const bad = new Set(mm.unmatchedOpen.concat(mm.unmatchedClose));
    let out = '';
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      const esc = escHtml(ch);
      if (bad.has(i) && (ch === '(' || ch === ')')) {
        out += '<span class="t-ambig" title="Unmatched parenthesis">' + esc + '</span>';
      } else {
        out += esc;
      }
    }
    return out;
  }

  function autoFixParenLine(src) {
    const mm = findParenMismatch(src);
    if (!mm.hasMismatch) {
      return src;
    }

    const removeClose = new Set(mm.unmatchedClose);
    let out = '';
    for (let i = 0; i < src.length; i += 1) {
      if (removeClose.has(i)) {
        continue;
      }
      out += src[i];
    }

    if (mm.unmatchedOpen.length) {
      out += ')'.repeat(mm.unmatchedOpen.length);
    }

    return out;
  }

  function vectorize(code) {
    return code
      .replace(/([^.])(\*)/g, function (_m, pre) { return pre + '.*'; })
      .replace(/([^.])(\^)/g, function (_m, pre) { return pre + '.^'; })
      .replace(/([^.])(\/)([^/])/g, function (_m, pre, _op, post) { return pre + './' + post; })
      .replace(/\.\.\.\*/g, '.*')
      .replace(/\.\.\.\^/g, '.^')
      .replace(/\.\.\.\//g, './')
      .replace(/\.\.\.\*/g, '.*');
  }

  function colorizeMatlabSource(src) {
    const mismatch = findParenMismatch(src);
    const bad = new Set(mismatch.unmatchedOpen.concat(mismatch.unmatchedClose));
    const groupByIndex = new Map();
    const stack = [];
    let nextGroup = 0;

    // Build matched parenthesis groups so each pair can have a distinct color.
    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '(') {
        stack.push({ idx: i, g: nextGroup });
        nextGroup += 1;
      } else if (ch === ')') {
        if (!stack.length) {
          continue;
        }
        const top = stack.pop();
        groupByIndex.set(top.idx, top.g);
        groupByIndex.set(i, top.g);
      }
    }

    let out = '';

    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '&') { out += '&amp;'; continue; }
      if (ch === '<') { out += '&lt;'; continue; }
      if (ch === '>') { out += '&gt;'; continue; }

      if (ch === '(') {
        const gid = groupByIndex.has(i) ? groupByIndex.get(i) : 0;
        const cls = bad.has(i) ? 't-ambig' : 't-paren-d' + (gid % 10);
        out += '<span class="' + cls + '">(</span>';
        continue;
      }

      if (ch === ')') {
        const gid = groupByIndex.has(i) ? groupByIndex.get(i) : 0;
        const cls = bad.has(i) ? 't-ambig' : 't-paren-d' + (gid % 10);
        out += '<span class="' + cls + '">)</span>';
        continue;
      }

      out += ch;
    }

    return out;
  }

  function cleanLatexForCopy(latex) {
    return latex
      .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, '$1')
      .replace(/\\dfrac/g, '\\frac');
  }

  return {
    EXAMPLES_M2S: EXAMPLES_M2S,
    EXAMPLES_S2M: EXAMPLES_S2M,
    resetColors: resetColors,
    getVarColor: getVarColor,
    getVarColorMap: getVarColorMap,
    tokenize: tokenize,
    parseMatlab: parseMatlab,
    astTex: astTex,
    l2m: l2m,
    findAmbig: findAmbig,
    buildCode: buildCode,
    synHL: synHL,
    splitLines: splitLines,
    escHtml: escHtml,
    findParenMismatch: findParenMismatch,
    highlightParenMismatch: highlightParenMismatch,
    autoFixParenLine: autoFixParenLine,
    colorizeMatlabSource: colorizeMatlabSource,
    vectorize: vectorize,
    cleanLatexForCopy: cleanLatexForCopy,
    normalizeParenLatex: normalizeParenLatex
  };
}));
