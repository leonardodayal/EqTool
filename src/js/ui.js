(function () {
  const core = (typeof globalThis !== 'undefined' ? globalThis : window).EqToolCore;
  if (!core) {
    throw new Error('EqToolCore was not loaded before ui.js');
  }

  const state = {
    currentMode: 'm2s',
    mqField: null,
    isNormalizingEdit: false,
    skipAutoSubscriptOnce: false,
    isVec: false,
    currentToks: [],
    ambigPairs: [],
    ambigRes: {},
    lastCode: '',
    lastLatex: ''
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function updateBadge() {
    const unresolved = state.ambigPairs.filter(function (p) {
      return (state.ambigRes[p.li] || 'u') === 'u';
    }).length;

    const badge = byId('warn-badge');
    const hint = byId('ambig-hint');
    if (unresolved > 0) {
      badge.classList.remove('hidden');
      byId('warn-count').textContent = unresolved;
      hint.classList.remove('hidden');
      return;
    }
    badge.classList.add('hidden');
    hint.classList.add('hidden');
  }

  function renderLegend() {
    const legend = byId('m2s-legend');
    const map = core.getVarColorMap();
    legend.innerHTML = Object.entries(map).map(function (entry) {
      const name = entry[0];
      const color = entry[1];
      return '<div class="legend-item" style="color:' + color[0] + ';background:' + color[1] + '22;border-color:' + color[0] + '55">' + name + '</div>';
    }).join('');
  }

  function renderM2SParenWarnings(rawInput) {
    const warnEl = byId('m2s-paren-warn');
    if (!warnEl) {
      return;
    }

    const lines = rawInput.split(/\r?\n/);
    const items = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim()) {
        continue;
      }
      const mismatch = core.findParenMismatch(line);
      if (!mismatch.hasMismatch) {
        continue;
      }

      const parts = [];
      if (mismatch.unmatchedOpen.length) {
        parts.push(mismatch.unmatchedOpen.length + ' opening');
      }
      if (mismatch.unmatchedClose.length) {
        parts.push(mismatch.unmatchedClose.length + ' closing');
      }

      const title = 'Line ' + (i + 1) + ': unmatched parenthesis (' + parts.join(', ') + ')';
      const src = core.highlightParenMismatch(line, mismatch);
      items.push(
        '<div class="m2s-warn-item" data-line-index="' + i + '">' +
        title +
        ' <button class="warn-fix-btn" data-line-index="' + i + '">auto-fix</button>' +
        '<span class="m2s-warn-src" data-line-index="' + i + '">' + src + '</span></div>'
      );
    }

    if (!items.length) {
      warnEl.classList.add('hidden');
      warnEl.innerHTML = '';
      return;
    }

    warnEl.classList.remove('hidden');
    warnEl.innerHTML = items.join('');
  }

  function syncM2SInputOverlay(raw) {
    const wrap = byId('m2s-input-wrap');
    const overlay = byId('m2s-input-color');
    const input = byId('m2s-input');

    if (!wrap || !overlay || !input) {
      return;
    }

    if (!raw.trim()) {
      wrap.classList.remove('has-content');
      overlay.innerHTML = '';
      return;
    }

    wrap.classList.add('has-content');
    overlay.innerHTML = core.colorizeMatlabSource(raw);
    overlay.scrollTop = input.scrollTop;
    overlay.scrollLeft = input.scrollLeft;
  }

  function applyM2SParenFix(lineIndex) {
    const input = byId('m2s-input');
    const lines = input.value.split(/\r?\n/);
    const idx = Number(lineIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= lines.length) {
      return;
    }

    lines[idx] = core.autoFixParenLine(lines[idx]);
    input.value = lines.join('\n');
    renderM2S();
  }

  function buildRawCode() {
    return core.buildCode(state.currentToks, state.ambigPairs, state.ambigRes);
  }

  function syncCodeDisplay() {
    const rawCode = buildRawCode();
    state.lastCode = state.isVec ? core.vectorize(rawCode) : rawCode;
    byId('s2m-tokens').innerHTML = core.synHL(state.currentToks, state.ambigPairs, state.ambigRes, state.isVec);
    updateBadge();
  }

  function flipMode() {
    const btn = byId('flip-btn');
    const panel = byId('main-panel');
    btn.classList.add('spinning');
    panel.classList.add('fading');

    setTimeout(function () {
      if (state.currentMode === 'm2s') {
        state.currentMode = 's2m';
        byId('mode-m2s').classList.remove('active');
        byId('mode-s2m').classList.add('active');
        byId('lbl-left').textContent = 'Symbolic';
        byId('lbl-right').textContent = 'MATLAB';
        setTimeout(function () {
          if (state.mqField) {
            state.mqField.focus();
          }
        }, 100);
      } else {
        state.currentMode = 'm2s';
        byId('mode-s2m').classList.remove('active');
        byId('mode-m2s').classList.add('active');
        byId('lbl-left').textContent = 'MATLAB';
        byId('lbl-right').textContent = 'Symbolic';
        setTimeout(function () {
          byId('m2s-input').focus();
        }, 100);
      }
      panel.classList.remove('fading');
      btn.classList.remove('spinning');
    }, 150);
  }

  function loadEx1(index) {
    byId('m2s-input').value = core.EXAMPLES_M2S[index];
    renderM2S();
  }

  function loadEx2(index) {
    if (!state.mqField) {
      return;
    }
    const normalized = core.normalizeParenLatex(core.EXAMPLES_S2M[index]);
    state.mqField.latex(normalized);
    renderS2M(normalized);
  }

  function renderM2S() {
    core.resetColors();
    const raw = byId('m2s-input').value;
    const out = byId('m2s-output');

    if (!raw.trim()) {
      out.innerHTML = '<span class="eq-ph">rendered equation appears here</span>';
      syncM2SInputOverlay(raw);
      byId('m2s-legend').innerHTML = '';
      renderM2SParenWarnings('');
      state.lastLatex = '';
      return;
    }

    syncM2SInputOverlay(raw);

    renderM2SParenWarnings(raw);

    const lines = core.splitLines(raw);
    if (!lines.length) {
      out.innerHTML = '<span class="eq-ph">rendered equation appears here</span>';
      byId('m2s-legend').innerHTML = '';
      renderM2SParenWarnings(raw);
      state.lastLatex = '';
      return;
    }

    if (lines.length === 1) {
      const src = lines[0];
      try {
        const latex = core.astTex(core.parseMatlab(src));
        katex.render('\\displaystyle{' + latex + '}', out, {
          throwOnError: false,
          displayMode: true,
          trust: true,
          strict: false
        });
        out.scrollLeft = 0;
        state.lastLatex = latex;
      } catch (err) {
        out.innerHTML = '<span class="eq-err">' + err.message + '</span>';
        byId('m2s-legend').innerHTML = '';
        state.lastLatex = '';
        return;
      }
      renderLegend();
      return;
    }

    const allLatex = [];
    let html = '<div class="eq-multiline">';
    for (let i = 0; i < lines.length; i += 1) {
      const src = lines[i];
      if (/^\s*%/.test(src)) {
        html += '<div class="eq-line-skip">' + core.escHtml(src) + '</div>';
        continue;
      }
      try {
        const latex = core.astTex(core.parseMatlab(src));
        const div = document.createElement('div');
        katex.render('\\displaystyle{' + latex + '}', div, {
          throwOnError: false,
          displayMode: false,
          trust: true,
          strict: false
        });
        html += '<div class="eq-line"><div class="eq-line-sym">' + div.innerHTML + '</div></div>';
        allLatex.push(latex);
      } catch (_err) {
        html += '<div class="eq-line"><span class="eq-err" style="font-size:11px">' + core.escHtml(src) + '</span></div>';
      }
    }
    html += '</div>';
    out.innerHTML = html;
    state.lastLatex = allLatex.join('\\\\');
    renderLegend();
  }

  function renderS2M(latex) {
    const el = byId('s2m-tokens');
    if (!latex || !latex.trim()) {
      el.innerHTML = '<span class="eq-ph">output appears here</span>';
      state.lastCode = '';
      state.currentToks = [];
      state.ambigPairs = [];
      state.ambigRes = {};
      byId('warn-badge').classList.add('hidden');
      byId('ambig-hint').classList.add('hidden');
      return;
    }

    try {
      const resolvedLatex = resolveUnsupportedLogBases(latex);
      const raw = core.l2m(resolvedLatex);
      state.currentToks = core.tokenize(raw);
      state.ambigPairs = core.findAmbig(state.currentToks);
      state.ambigRes = {};
      syncCodeDisplay();
    } catch (err) {
      el.innerHTML = '<span class="eq-err">' + err.message + '</span>';
    }
  }

  function resolveUnsupportedLogBases(latex) {
    if (!latex) {
      return latex;
    }

    let out = latex;
    const isSupportedBase = function (base) {
      return base === '2' || base === '10';
    };

    const toChangeOfBase = function (base, arg) {
      return '\\frac{\\log\\left(' + arg + '\\right)}{\\log\\left(' + base + '\\right)}';
    };

    // \log_{b}\left(x\right) -> \frac{\log\left(x\right)}{\log\left(b\right)} for unsupported bases.
    out = out.replace(/\\log_\{([^}]+)\}\s*\\left\(([^()]*)\\right\)/g, function (_m, base, arg) {
      const b = base.trim();
      if (!b || isSupportedBase(b)) {
        return _m;
      }
      return toChangeOfBase(b, arg);
    });

    // \log_{b}(x) -> change-of-base for unsupported bases.
    out = out.replace(/\\log_\{([^}]+)\}\s*\(([^()]*)\)/g, function (_m, base, arg) {
      const b = base.trim();
      if (!b || isSupportedBase(b)) {
        return _m;
      }
      return toChangeOfBase(b, arg);
    });

    // \log_{b}x -> change-of-base for unsupported bases.
    out = out.replace(/\\log_\{([^}]+)\}\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)(?!\s*(?:\\left\(|\())/g, function (_m, base, arg) {
      const b = base.trim();
      if (!b || isSupportedBase(b)) {
        return _m;
      }
      return toChangeOfBase(b, arg);
    });

    return out;
  }

  function toggleVec() {
    state.isVec = !state.isVec;
    const btn = byId('vec-btn');
    if (state.isVec) {
      btn.classList.add('active');
      btn.textContent = '.* on';
    } else {
      btn.classList.remove('active');
      btn.textContent = '.*';
    }
    if (state.currentToks.length) {
      syncCodeDisplay();
    }
  }

  function toggleAmbig(pairIndex) {
    const pair = state.ambigPairs[pairIndex];
    const current = state.ambigRes[pair.li] || 'u';
    state.ambigRes[pair.li] = current === 'u' ? 'm' : current === 'm' ? 'k' : 'u';
    syncCodeDisplay();
  }

  function copyText(value, button, copiedText, idleText, timeoutMs) {
    if (!value) {
      return;
    }

    function onSuccess() {
      button.textContent = copiedText;
      button.classList.add('copied');
      setTimeout(function () {
        button.textContent = idleText;
        button.classList.remove('copied');
      }, timeoutMs);
    }

    function onFail() {
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) {
          onSuccess();
        }
      } catch (_err) {
        // Ignore fallback copy errors.
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(onSuccess).catch(onFail);
      return;
    }
    onFail();
  }

  function copyLatex() {
    if (!state.lastLatex) {
      return;
    }
    copyText(
      core.cleanLatexForCopy(state.lastLatex),
      byId('sym-copy-btn'),
      'copied as LaTeX',
      'copy LaTeX',
      2000
    );
  }

  function copyCode() {
    if (!state.lastCode) {
      return;
    }
    copyText(state.lastCode, byId('copy-btn'), 'copied!', 'copy', 1500);
  }

  function initMathField() {
    const MQ = MathQuill.getInterface(2);
    state.mqField = MQ.MathField(byId('mq-field'), {
      spaceBehavesLikeTab: true,
      leftRightIntoCmdGoes: 'up',
      restrictMismatchedBrackets: true,
      supSubsRequireOperand: true,
      charsThatBreakOutOfSupSub: '+-=<>',
      autoCommands: 'pi theta rho sqrt',
      autoOperatorNames: 'sin cos tan cot sec csc sinh cosh tanh asin acos atan acot asec acsc asinh acosh atanh exp log ln sqrt abs floor ceil',
      handlers: {
        edit: function () {
          if (state.isNormalizingEdit) {
            return;
          }

          const rawLatex = state.mqField.latex();
          const parenNormalized = core.normalizeCompactLogInput(core.normalizeParenLatex(rawLatex));
          const normalized = state.skipAutoSubscriptOnce
            ? parenNormalized
            : core.autoSubscriptVariableNumbers(parenNormalized);
          state.skipAutoSubscriptOnce = false;
          if (normalized !== rawLatex) {
            state.isNormalizingEdit = true;
            state.mqField.latex(normalized);
            state.isNormalizingEdit = false;
            renderS2M(normalized);
            return;
          }

          renderS2M(rawLatex);
        },
        moveOutOf: function (_dir, mathField) {
          mathField.focus();
        },
        upOutOf: function (mathField) {
          mathField.focus();
        },
        downOutOf: function (mathField) {
          mathField.focus();
        }
      }
    });

    byId('mq-wrap').addEventListener('click', function () {
      state.mqField.focus();
    });

    byId('mq-wrap').addEventListener('keydown', function (evt) {
      if (!evt || !evt.key) {
        return;
      }
      if (evt.key === 'Backspace' || evt.key === 'Delete') {
        state.skipAutoSubscriptOnce = true;
        return;
      }

      // Clear stale delete intent so the next typed character can auto-subscript.
      state.skipAutoSubscriptOnce = false;
    });

    // Force plain-text paste to be interpreted as LaTeX input for reliable round-trip workflows.
    byId('mq-wrap').addEventListener('paste', function (evt) {
      const clipboard = evt.clipboardData || window.clipboardData;
      if (!clipboard || !state.mqField) {
        return;
      }

      const pasted = (clipboard.getData('text/plain') || '').trim();
      if (!pasted) {
        return;
      }

      evt.preventDefault();
      const normalized = core.autoSubscriptVariableNumbers(core.normalizeCompactLogInput(core.normalizeParenLatex(pasted)));
      // Insert at cursor position instead of replacing entire field
      state.mqField.write(normalized);
      const fullLatex = state.mqField.latex();
      renderS2M(fullLatex);
      state.mqField.focus();
    });
  }

  function bindEvents() {
    byId('flip-btn').addEventListener('click', flipMode);
    byId('m2s-input').addEventListener('input', renderM2S);
    byId('m2s-input').addEventListener('scroll', function () {
      const overlay = byId('m2s-input-color');
      const input = byId('m2s-input');
      if (!overlay || !input) {
        return;
      }
      overlay.scrollTop = input.scrollTop;
      overlay.scrollLeft = input.scrollLeft;
    });
    byId('m2s-demo-btn').addEventListener('click', function () { loadEx1(0); });
    byId('s2m-demo-btn').addEventListener('click', function () { loadEx2(0); });
    byId('sym-copy-btn').addEventListener('click', copyLatex);
    byId('vec-btn').addEventListener('click', toggleVec);
    byId('copy-btn').addEventListener('click', copyCode);
    byId('m2s-paren-warn').addEventListener('click', function (evt) {
      const target = evt.target;
      if (!target) {
        return;
      }

      const directLine = target.getAttribute && target.getAttribute('data-line-index');
      if (directLine !== null) {
        applyM2SParenFix(directLine);
        return;
      }

      const row = target.closest ? target.closest('.m2s-warn-item') : null;
      if (!row) {
        return;
      }
      applyM2SParenFix(row.getAttribute('data-line-index'));
    });
  }

  function init() {
    bindEvents();
    initMathField();
    loadEx1(0);
  }

  globalThis.toggleAmbig = toggleAmbig;
  window.addEventListener('load', init);
}());
