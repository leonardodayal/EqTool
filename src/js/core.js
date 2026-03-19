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
    if (node.t === 'func') { return node.args.some(containsTallContent); }
    if (node.t === 'binop') { return containsTallContent(node.left) || containsTallContent(node.right); }
    return false;
  }

  function wrapSizedParen(innerTex, depth, hasTallContent) {
    const sizeLevel = Math.min(4, depth + (hasTallContent ? 1 : 0));
    const sizeCmd = ['', '\\big', '\\Big', '\\bigg', '\\Bigg'];
    const cmd = sizeCmd[sizeLevel];
    const openTok = cmd ? cmd + '(' : '(';
    const closeTok = cmd ? cmd + ')' : ')';
    return openTok + innerTex + closeTok;
  }

  function astTex(node, depth) {
    const level = depth || 0;
    let out = '';
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

  function autoSubscriptVariableNumbers(latex) {
    if (!latex) { return latex; }

    let out = latex;
    let prev = '';
    let guard = 0;

    // Normalize incremental typing states until stable.
    while (out !== prev && guard < 6) {
      prev = out;

      // If a numeric subscript already exists and more digits are typed immediately
      // after it, absorb them into the same subscript: a_{1}23 -> a_{123}.
      out = out.replace(/(^|[^\\a-zA-Z_])([a-zA-Z])_\{([a-zA-Z0-9]+)\}\s*([0-9]+)/g, function (_m, pre, v, sub, extra) {
        return pre + v + '_{' + sub + extra + '}';
      });

      // Handle unbraced alphabetic subscripts with trailing digits emitted by MathQuill,
      // e.g. a_d123 -> a_{d123}, a_ref9 -> a_{ref9}.
      out = out.replace(/(^|[^\\a-zA-Z_])([a-zA-Z])_([a-zA-Z]+)\s*([0-9]+)/g, function (_m, pre, v, sub, extra) {
        return pre + v + '_{' + sub + extra + '}';
      });

      // Handle compact unbraced subscripts that may appear during edits: a_123 -> a_{123}.
      out = out.replace(/(^|[^\\a-zA-Z_])([a-zA-Z])_([0-9]+)/g, function (_m, pre, v, sub) {
        return pre + v + '_{' + sub + '}';
      });

      // Canonicalize single-letter unbraced subscripts: a_d -> a_{d}.
      out = out.replace(/(^|[^\\a-zA-Z_])([a-zA-Z])_([a-zA-Z])(?![a-zA-Z0-9{])/g, function (_m, pre, v, sub) {
        return pre + v + '_{' + sub + '}';
      });

      // Convert only single-letter variable+number runs, e.g. a3 -> a_{3}.
      // Allow digit-prefix contexts so compact terms like 332a12 normalize to 332a_{12}.
      // This still avoids changing multi-letter names like log223.
      out = out.replace(/(^|[^\\a-zA-Z_{])([a-zA-Z])([0-9]+)/g, function (_m, pre, v, digits) {
        return pre + v + '_{' + digits + '}';
      });

      guard += 1;
    }

    return out;
  }

  function normalizeCompactLogInput(latex) {
    if (!latex) { return latex; }

    let out = latex;
    // Compact input after explicit base-log syntax gets wrapped as argument.
    // Examples: \log_{10}1 -> \log_{10}\left(1\right), \log_{10}x -> \log_{10}\left(x\right).
    out = out.replace(/\\log_\{([0-9]+)\}\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)(?!\s*(?:\\left\s*\(|\())/g, function (_m, base, arg) {
      return '\\log_{' + base + '}\\left(' + arg + '\\right)';
    });

    // Compact plain log numeric input: \log1 -> \log\left(1\right), \log101 -> \log\left(101\right).
    out = out.replace(/\\log(?!_)\s*([0-9]+(?:\.[0-9]+)?)/g, function (_m, value) {
      return '\\log\\left(' + value + '\\right)';
    });

    // If user appends digits immediately after a numeric log argument,
    // absorb them into the same argument: \log\left(1\right)0 -> \log\left(10\right).
    out = out.replace(/\\log\\left\(([0-9]+(?:\.[0-9]+)?)\\right\)\s*([0-9]+)/g, function (_m, value, extra) {
      return '\\log\\left(' + value + extra + '\\right)';
    });

    // Compact plain trig numeric input: \sin1 -> \sin\left(1\right).
    out = out.replace(/\\(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\s*([0-9]+(?:\.[0-9]+)?)/g, function (_m, fn, value) {
      return '\\' + fn + '\\left(' + value + '\\right)';
    });
    
    // Merge appended digits into numeric trig arguments: \sin\left(1\right)0 -> \sin\left(10\right).
    out = out.replace(/\\(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\\left\(([0-9]+(?:\.[0-9]+)?)\\right\)\s*([0-9]+)/g, function (_m, fn, value, extra) {
      return '\\' + fn + '\\left(' + value + extra + '\\right)';
    });

    // Compact numeric input for additional unary functions.
    out = out.replace(/\\(ln|exp|asinh|acosh|atanh|asin|acos|atan|acot|asec|acsc|abs|floor|ceil)\s*([0-9]+(?:\.[0-9]+)?)/g, function (_m, fn, value) {
      return '\\' + fn + '\\left(' + value + '\\right)';
    });

    // Merge appended digits into numeric unary arguments: \exp\left(1\right)0 -> \exp\left(10\right).
    out = out.replace(/\\(ln|exp|asinh|acosh|atanh|asin|acos|atan|acot|asec|acsc|abs|floor|ceil)\\left\(([0-9]+(?:\.[0-9]+)?)\\right\)\s*([0-9]+)/g, function (_m, fn, value, extra) {
      return '\\' + fn + '\\left(' + value + extra + '\\right)';
    });

    // Compact sqrt numeric input: \sqrt1 -> \sqrt{1}.
    out = out.replace(/\\sqrt\s*([0-9]+(?:\.[0-9]+)?)(?!\s*\{)/g, function (_m, value) {
      return '\\sqrt{' + value + '}';
    });

    // Merge appended digits into numeric sqrt argument: \sqrt{1}0 -> \sqrt{10}.
    out = out.replace(/\\sqrt\{([0-9]+(?:\.[0-9]+)?)\}\s*([0-9]+)/g, function (_m, value, extra) {
      return '\\sqrt{' + value + extra + '}';
    });

    // Merge appended digits into numeric \mathrm function arguments,
    // e.g. \mathrm{ceil}\left(1\right)00 -> \mathrm{ceil}\left(100\right).
    out = out.replace(
      /\\mathrm\{(atanh|asinh|acosh|asin|acos|atan|acot|asec|acsc|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp|sqrt|abs|floor|ceil)\}\\left\(([0-9]+(?:\.[0-9]+)?)\\right\)\s*([0-9]+)/g,
      function (_m, fn, value, extra) {
        return '\\mathrm{' + fn + '}\\left(' + value + extra + '\\right)';
      }
    );
    out = out.replace(
      /\\mathrm\{(atanh|asinh|acosh|asin|acos|atan|acot|asec|acsc|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp|sqrt|abs|floor|ceil)\}\(([0-9]+(?:\.[0-9]+)?)\)\s*([0-9]+)/g,
      function (_m, fn, value, extra) {
        return '\\mathrm{' + fn + '}\\left(' + value + extra + '\\right)';
      }
    );

    // Render plain typed function names as upright roman text in MathQuill,
    // e.g. atan(x), ceil(1) should not appear as italic variables.
    out = out.replace(
      /(^|[^\\a-zA-Z])(atanh|asinh|acosh|asin|acos|atan|acot|asec|acsc|sinh|cosh|tanh|sin|cos|tan|cot|sec|csc|ln|log|exp|sqrt|abs|floor|ceil)(?=\s*(?:\\left\(|\())/g,
      function (_m, pre, fn) {
        return pre + '\\mathrm{' + fn + '}';
      }
    );

    // Plain typed function followed by a direct argument token should also render
    // as an upright function call, e.g. atanx -> \mathrm{atan}\left(x\right).
    out = out.replace(
      /(^|[^\\a-zA-Z])(atanh|asinh|acosh|asin(?!h)|acos(?!h)|atan(?!h)|acot|asec|acsc|sinh|cosh|tanh|sin(?!h)|cos(?!h)|tan(?!h)|cot|sec|csc|ln|log|exp|sqrt|abs|floor|ceil)\s*([0-9]+(?:\.[0-9]+)?|[a-zA-Z][a-zA-Z0-9]*(?:_\{[^}]+\}|_[a-zA-Z0-9]+)?)/g,
      function (_m, pre, fn, arg) {
        return pre + '\\mathrm{' + fn + '}\\left(' + arg + '\\right)';
      }
    );

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

  function splitSubscriptedBase(base, sub) {
    const expanded = splitAlphaRun(base, 0, base);
    if (expanded.indexOf(' * ') === -1) {
      return base + '_' + sub;
    }

    const parts = expanded.split(' * ');
    parts[parts.length - 1] = parts[parts.length - 1] + '_' + sub;
    return parts.join(' * ');
  }

  // Helper function to find the matching closing brace for a given opening brace position
  function findMatchingBrace(str, openPos) {
    if (str[openPos] !== '{') return -1;
    let depth = 0;
    for (let i = openPos; i < str.length; i++) {
      if (str[i] === '{') {
        depth += 1;
      } else if (str[i] === '}') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
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
    // Disambiguate \sin^{-1}h / \cos^{-1}h / \tan^{-1}h from asinh/acosh/atanh.
    s = s.replace(/\\cos\s*\^(?:\{-1\}|-1)(?=\s*[a-zA-Z_])/g, 'acos ');
    s = s.replace(/\\sin\s*\^(?:\{-1\}|-1)(?=\s*[a-zA-Z_])/g, 'asin ');
    s = s.replace(/\\tan\s*\^(?:\{-1\}|-1)(?=\s*[a-zA-Z_])/g, 'atan ');
    s = s.replace(/\\cos\s*\^(?:\{-1\}|-1)/g, 'acos').replace(/\\sin\s*\^(?:\{-1\}|-1)/g, 'asin').replace(/\\tan\s*\^(?:\{-1\}|-1)/g, 'atan');
    s = s.replace(/\\cot\^(?:\{-1\}|-1)/g, 'acot').replace(/\\sec\^(?:\{-1\}|-1)/g, 'asec').replace(/\\csc\^(?:\{-1\}|-1)/g, 'acsc');
    s = s.replace(/\\sinh\^(?:\{-1\}|-1)/g, 'asinh').replace(/\\cosh\^(?:\{-1\}|-1)/g, 'acosh').replace(/\\tanh\^(?:\{-1\}|-1)/g, 'atanh');

    s = s.replace(/\\(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\^\{([^}]+)\}\s*\\left\s*\(/g, 'TRIGPOW_$1_$2_(');
    s = s.replace(/\\(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\^\{([^}]+)\}\s*\(/g, 'TRIGPOW_$1_$2_(');
    s = s.replace(/\\(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\^([0-9])\s*\\left\s*\(/g, 'TRIGPOW_$1_$2_(');
    s = s.replace(/\\(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\^([0-9])\s*\(/g, 'TRIGPOW_$1_$2_(');
    // Compact trig power forms without explicit parentheses, e.g. \sin^2 x -> sin(x)^2.
    s = s.replace(/\\(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\^\{([^}]+)\}\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)/g, function (_m, fn, exp, arg) {
      return fn + '(' + arg + ')^' + exp;
    });
    s = s.replace(/\\(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\^([0-9]+)\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)/g, function (_m, fn, exp, arg) {
      return fn + '(' + arg + ')^' + exp;
    });

    // Convert LaTeX trig/math functions to plain text, but preserve spacing to prevent
    // identifier merging (e.g., a\cos should become 'a cos', not 'acos').
    // Also include inverse trig and other functions. Order by length (longest first) to prevent
    // shorter names like "tan" from matching within longer names like "atan".
    // NOTE: ln is handled separately below (converts to log), sqrt and log are handled specially,
    // so exclude them from this early stripping.
    s = s.replace(/\\(sinh|cosh|tanh|asinh|acosh|atanh|floor|ceil|arcsin|arccos|arctan|asin|acos|atan|acot|asec|acsc|sin|cos|tan|cot|sec|csc|exp|abs)(?![a-zA-Z_])/g, function (_m, fn, offset, full) {
      const prevChar = offset > 0 ? full[offset - 1] : '';
      // If preceded by a letter or identifier character, add space before function name
      if (/[a-zA-Z0-9_)]/.test(prevChar)) {
        return ' ' + fn;
      }
      return fn;
    });
    // Preserve explicit log-base forms with placeholders so we can distinguish
    // them from plain "log10" text entered by the user.
    s = s
      .replace(/\\log_\{10\}/g, 'LOGBASE10')
      .replace(/\\log_10(?![0-9])/g, 'LOGBASE10')
      .replace(/\\log_\{2\}/g, 'LOGBASE2')
      .replace(/\\log_2(?![0-9])/g, 'LOGBASE2')
      .replace(/\\ln(?![a-zA-Z_])/g, 'log')
      .replace(/\\log(?=[^a-zA-Z_]|$)/g, 'log');
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
    
    // Handle \sqrt[n]{arg} and \sqrt{arg} with proper nested brace matching
    // Process iteratively to handle arbitrarily nested sqrt calls like \sqrt{\sqrt{\sqrt{x}}}
    let changed = true;
    while (changed) {
      changed = false;
      // First handle \sqrt[n]{...}
      let match = s.match(/\\sqrt\[([^\]]+)\]\{/);
      if (match) {
        const openPos = match.index + match[0].length - 1;
        const closePos = findMatchingBrace(s, openPos);
        if (closePos !== -1) {
          const n = match[1];
          const inner = s.substring(openPos + 1, closePos);
          s = s.substring(0, match.index) + 'nthroot(' + l2m(inner) + ',' + l2m(n) + ')' + s.substring(closePos + 1);
          changed = true;
          continue;
        }
      }
      // Then handle \sqrt{...}
      match = s.match(/\\sqrt\{/);
      if (match) {
        const openPos = match.index + match[0].length - 1;
        const closePos = findMatchingBrace(s, openPos);
        if (closePos !== -1) {
          const inner = s.substring(openPos + 1, closePos);
          s = s.substring(0, match.index) + 'sqrt(' + l2m(inner) + ')' + s.substring(closePos + 1);
          changed = true;
          continue;
        }
      }
      // Handle \sqrt digit form (no braces)
      match = s.match(/\\sqrt\s*([0-9]+(?:\.[0-9]+)?)(?!\s*[\[{])/);
      if (match) {
        s = s.substring(0, match.index) + 'sqrt(' + match[1] + ')' + s.substring(match.index + match[0].length);
        changed = true;
      }
    }

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

    // Insert multiplication for explicit subscripts followed by an identifier,
    // e.g. mu_{0}nIL -> mu_{0} * nIL and a_{e}f -> a_{e} * f.
    for (let i = 0; i < subscriptProtections.length; i += 1) {
      const key = subscriptProtections[i].key;
      s = s.replace(new RegExp('\\b([a-zA-Z][a-zA-Z0-9]*_' + key + ')([a-zA-Z][a-zA-Z0-9]*)\\b', 'g'), '$1 * $2');
    }
    
    s = convertSuperscripts(s);
    prot = protectBracedIdentifiers(s);
    s = prot.text;
    // Preserve multiplication between adjacent braced identifiers,
    // e.g. {asss}{aass} -> QVARPROTAQ * QVARPROTBQ.
    s = s.replace(/(QVARPROT[A-Z]+Q)\s*(QVARPROT[A-Z]+Q)/g, '$1 * $2');
    // Preserve multiplication when a braced identifier is followed by an identifier,
    // e.g. {bbb}a -> QVARPROTAQ * a.
    s = s.replace(/(QVARPROT[A-Z]+Q)\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1 * $2');
    s = s.replace(/\^([a-zA-Z0-9])/g, '^$1');
    s = s.replace(/\s+/g, ' ').trim();

    s = s.replace(/TRIGPOW_([a-z]+)_([^_]+)_\(([^()]*)\)/g, function (_m, fn, exp, inner) {
      return fn + '(' + inner + ')^' + exp;
    });

    const trigFn2 = '(?:sinh|cosh|tanh|sin(?!h)|cos(?!h)|tan(?!h)|cot|sec|csc)';
    s = s.replace(new RegExp('(' + trigFn2 + ')\\s*([a-zA-Z_][a-zA-Z0-9_]*)(?![(])', 'g'), function (_m, fn, arg) {
      return fn + '(' + arg + ')';
    });
    const invTrigNoParen = '(?:asinh|acosh|atanh|asin(?!h)|acos(?!h)|atan(?!h)|acot|asec|acsc)';
    s = s.replace(new RegExp('(' + invTrigNoParen + ')\s*([a-zA-Z_][a-zA-Z0-9_]*)(?![(])', 'g'), function (_m, fn, arg) {
      return fn + '(' + arg + ')';
    });

    // Explicit base-log forms with parenthesized arguments map to MATLAB log10/log2.
    s = s.replace(/\bLOGBASE10\s*\(/g, 'log10(');
    s = s.replace(/\bLOGBASE2\s*\(/g, 'log2(');

    // Compact explicit base-log forms become function calls.
    s = s.replace(/\b(LOGBASE10|LOGBASE2)\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?|QVARPROT[A-Z]+Q)(?!\s*\()/g, function (_m, fn, arg) {
      const matlabFn = fn === 'LOGBASE10' ? 'log10' : 'log2';
      return matlabFn + '(' + arg + ')';
    });

    // Bare explicit base logs without arguments stay as MATLAB log function symbols.
    // Use protected placeholders so plain-text log10/log2 rewrite rules do not override this.
    s = s.replace(/\bLOGBASE10\b(?!\s*\()/g, 'QLOGBASE10FNQ');
    s = s.replace(/\bLOGBASE2\b(?!\s*\()/g, 'QLOGBASE2FNQ');

    // Compact plain log numeric input from LaTeX: \log1 -> log(1), \log101 -> log(101).
    s = s.replace(/\blog\s*([0-9]+(?:\.[0-9]+)?)(?![0-9(])/g, 'log($1)');

    // Merge trailing digits into existing numeric log arguments: log(1)0 -> log(10).
    s = s.replace(/\blog\(([0-9]+(?:\.[0-9]+)?)\)\s*([0-9]+)/g, 'log($1$2)');

    // Compact plain trig numeric input: sin1 -> sin(1).
    s = s.replace(/\b(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\s*([0-9]+(?:\.[0-9]+)?)(?![0-9(])/g, '$1($2)');

    // Merge trailing digits into existing numeric trig arguments: sin(1)0 -> sin(10).
    s = s.replace(/\b(sinh|cosh|tanh|sin|cos|tan|cot|sec|csc)\(([0-9]+(?:\.[0-9]+)?)\)\s*([0-9]+)/g, '$1($2$3)');

    // Compact numeric input for additional unary functions.
    s = s.replace(/\b(log|exp|sqrt|abs|floor|ceil|asinh|acosh|atanh|asin|acos|atan|acot|asec|acsc)\s*([0-9]+(?:\.[0-9]+)?)(?![0-9(])/g, '$1($2)');

    // Merge trailing digits into existing numeric unary arguments: exp(1)0 -> exp(10).
    s = s.replace(/\b(log|exp|sqrt|abs|floor|ceil|asinh|acosh|atanh|asin|acos|atan|acot|asec|acsc)\(([0-9]+(?:\.[0-9]+)?)\)\s*([0-9]+)/g, '$1($2$3)');

    // Plain text "log10" is treated as log(10), not base-10 log function.
    s = s.replace(/\blog10\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?|QVARPROT[A-Z]+Q)(?!\s*\()/g, 'log(10) * $1');
    s = s.replace(/\blog10\b(?!\s*\()/g, 'log(10)');

    // Ensure explicit multiplication after numeric log constants when followed by identifiers.
    s = s.replace(/\blog\(([0-9]+(?:\.[0-9]+)?)\)\s*([a-zA-Z_][a-zA-Z0-9_]*|QVARPROT[A-Z]+Q)(?!\s*\()/g, 'log($1) * $2');

    // Restore explicit base-log function symbols.
    s = s.replace(/QLOGBASE10FNQ/g, 'log10');
    s = s.replace(/QLOGBASE2FNQ/g, 'log2');

    const callableFnPattern = 'arcsin|arccos|arctan|asinh|acosh|atanh|asin|acos|atan|acot|asec|acsc|sinh|cosh|tanh|sqrt|floor|ceil|log10|log2|sin|cos|tan|cot|sec|csc|exp|abs|log|ln|atan2|nthroot';
    const knownFnPattern = 'arcsin|arccos|arctan|asinh|acosh|atanh|asin|acos|atan|acot|asec|acsc|sinh|cosh|tanh|floor|ceil|log10|log2|sqrt|sin|cos|tan|cot|sec|csc|exp|log|ln|abs';

    s = s.replace(new RegExp('\\b(' + callableFnPattern + ')\\s+([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\\.[0-9]+)?|QVARPROT[A-Z]+Q)(?!\\s*\\()', 'g'), function (_m, fn, arg) {
      return fn + '(' + arg + ')';
    });

    // Handle functions followed directly by parentheses with optional whitespace, e.g. cos (1) -> cos(1).
    s = s.replace(new RegExp('\\b(' + callableFnPattern + ')\\s+\\(', 'g'), '$1(');

    s = s.replace(/(delta|alpha|beta|gamma|rho|mu|theta|omega|sigma|phi|lambda|pi|eta|nu|xi|tau|epsilon|zeta)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, function (_m, g, r) {
      return g + ' * ' + r;
    });

    const protectedNames = new Set(['asin', 'acos', 'atan', 'asinh', 'acosh', 'atanh', 'acot', 'asec', 'acsc']);
    s = s.replace(new RegExp('([a-zA-Z_][a-zA-Z0-9_]*)(' + knownFnPattern + ')\\(', 'g'), function (_m, pre, fn) {
      const combined = pre + fn;
      if (protectedNames.has(combined)) {
        return combined + '(';
      }
      return pre + ' * ' + fn + '(';
    });

    // Insert multiplication between a closed group/function call and a following
    // identifier, e.g. log(1234)a -> log(1234) * a.
    s = s.replace(/\)\s*([a-zA-Z_][a-zA-Z0-9_]*|QVARPROT[A-Z]+Q)(?!\s*\()/g, ') * $1');

    // Insert multiplication between a closed group/function call and a following number,
    // e.g. (x)3 -> (x) * 3.
    s = s.replace(/\)\s*([0-9]+\.?[0-9]*)/g, ') * $1');

    // Insert multiplication between a number and a following opening parenthesis,
    // e.g. 3(x) -> 3 * (x), but not for function names like log10, log2.
    // Ensure we don't match when the number is part of "log10", "log2", etc.
    s = s.replace(/(?<![a-zA-Z_])([0-9]+\.?[0-9]*)\s*\((?!.*LOGBASE)/g, function (match, num, offset) {
      // Check if this number is part of a function name like 'log10' or 'log2'
      const before = s.substring(Math.max(0, offset - 10), offset);
      if (/(?:log)\d*$/.test(before)) {
        return match; // Don't modify if part of a function name
      }
      return num + ' * (';
    });

    s = s.replace(/([0-9]+\.?[0-9]*)([a-zA-Z_][a-zA-Z0-9_]*)/g, function (_m, n, v) {
      return n + ' * ' + v;
    });

    // Convert compact single-letter+digits factors into MATLAB subscript form,
    // e.g. a12 -> a_12 (including cases like 332a12 -> 332 * a_12).
    s = s.replace(/\b([a-zA-Z])([0-9]+)\b/g, '$1_$2');

    // Restore protected subscript text.
    for (let i = 0; i < subscriptProtections.length; i += 1) {
      s = s.replace(new RegExp(subscriptProtections[i].key, 'g'), subscriptProtections[i].sub);
    }

    // Split multi-letter bases while keeping the subscript on the last base symbol,
    // e.g. ASDF_GH -> A * S * D * F_GH.
    s = s.replace(/\b([a-zA-Z]{2,})_([a-zA-Z0-9]+)\b/g, function (_m, base, sub) {
      return splitSubscriptedBase(base, sub);
    });

    // Split mixed-case symbol runs into separate multiplicative factors, e.g. nIL -> n * I * L.
    s = s.replace(/\b([a-zA-Z][a-zA-Z0-9]*)\b/g, function (_m, tok, off, full) {
      return splitAlphaRun(tok, off, full);
    });

    // Insert explicit multiplication for adjacent parenthesized groups, e.g. (4*x)(x) -> (4*x) * (x).
    s = s.replace(/\)\s*\(/g, ') * (');

    // Insert explicit multiplication between closing paren and a function name, e.g. sin(a) cos(1) -> sin(a) * cos(1).
    s = s.replace(new RegExp('\\)\\s*(' + callableFnPattern + ')\\(', 'g'), ') * $1(');

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
    normalizeParenLatex: normalizeParenLatex,
    autoSubscriptVariableNumbers: autoSubscriptVariableNumbers,
    normalizeCompactLogInput: normalizeCompactLogInput
  };
}));
