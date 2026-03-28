(function () {
  const core = (typeof globalThis !== 'undefined' ? globalThis : window).EqToolCore;
  if (!core) {
    throw new Error('EqToolCore was not loaded before ui.js');
  }

  const state = {
    currentMode: 'm2s',
    mqField: null,
    isNormalizingEdit: false,
    isVec: false,
    currentToks: [],
    ambigPairs: [],
    ambigRes: {},
    lastCode: '',
    lastLatex: ''
  };

  const KNOWN_LATEX_COMMANDS = new Set(
    typeof core.getKnownLatexCommands === 'function'
      ? core.getKnownLatexCommands()
      : ['sqrt', 'cbrt', 'log', 'ln', 'sin', 'cos', 'tan', 'frac', 'left', 'right']
  );
  const ARG_REQUIRED_TRAILING_COMMANDS = new Set([
    'sqrt', 'cbrt', 'frac', 'left', 'right', 'operatorname', 'text', 'mathrm'
  ]);

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

    // For multi-line MATLAB snippets, allow parentheses to balance across
    // line boundaries. In that case, line-by-line warnings are noisy false
    // positives even though the full expression is valid.
    const nonCommentJoined = lines
      .map(function (line) { return line.replace(/%.*$/, ''); })
      .join(' ');
    const globalMismatch = core.findParenMismatch(nonCommentJoined);
    if (lines.length > 1 && !globalMismatch.hasMismatch) {
      warnEl.classList.add('hidden');
      warnEl.innerHTML = '';
      return;
    }

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

  function handleGlobalJumpShortcuts(evt) {
    if (!evt) {
      return;
    }
    const key = evt.key;
    const isChordJump = (evt.metaKey || evt.ctrlKey) && !evt.altKey && (key === 'ArrowLeft' || key === 'ArrowRight');
    const isHomeEndJump = !evt.metaKey && !evt.ctrlKey && !evt.altKey && (key === 'Home' || key === 'End');
    const isJumpChord = isChordJump || isHomeEndJump;
    if (!isJumpChord) {
      return;
    }

    const active = document.activeElement;
    const target = evt.target;
    const mqWrap = byId('mq-wrap');
    const inM2S = (active && active.id === 'm2s-input') || (target && target.id === 'm2s-input');
    const inS2M = mqWrap && (
      (active && (active.id === 'mq-field' || mqWrap.contains(active))) ||
      (target && (target.id === 'mq-field' || (target.closest && target.closest('#mq-wrap'))))
    );
    if (!inM2S && !inS2M) {
      return;
    }

    evt.preventDefault();

    if (inM2S) {
      const input = byId('m2s-input');
      if (!input) {
        return;
      }
      const pos = (key === 'ArrowLeft' || key === 'Home') ? 0 : (input.value || '').length;
      input.selectionStart = pos;
      input.selectionEnd = pos;
      input.focus();
      return;
    }

    if (!state.mqField) {
      return;
    }
    if ((key === 'ArrowLeft' || key === 'Home') && typeof state.mqField.moveToLeftEnd === 'function') {
      state.mqField.moveToLeftEnd();
    } else if ((key === 'ArrowRight' || key === 'End') && typeof state.mqField.moveToRightEnd === 'function') {
      state.mqField.moveToRightEnd();
    }
    requestAnimationFrame(function () {
      const wrap = byId('mq-wrap');
      if (wrap) {
        wrap.scrollLeft = (key === 'ArrowLeft' || key === 'Home') ? 0 : wrap.scrollWidth;
      }
      ensureMqCursorVisible();
    });
  }

  function ensureMqCursorVisible() {
    const wrap = byId('mq-wrap');
    if (!wrap) {
      return;
    }
    const cursor = wrap.querySelector('.mq-cursor');
    if (!cursor) {
      return;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const curRect = cursor.getBoundingClientRect();
    const pad = 24;

    if (curRect.right > wrapRect.right - pad) {
      wrap.scrollLeft += (curRect.right - (wrapRect.right - pad));
      return;
    }
    if (curRect.left < wrapRect.left + pad) {
      wrap.scrollLeft -= ((wrapRect.left + pad) - curRect.left);
    }
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
    const logWarn = byId('s2m-log-warn');
    if (!latex || !latex.trim()) {
      setS2MIncompleteState(false);
      el.innerHTML = '<span class="eq-ph">output appears here</span>';
      state.lastCode = '';
      state.currentToks = [];
      state.ambigPairs = [];
      state.ambigRes = {};
      if (logWarn) {
        logWarn.classList.add('hidden');
        logWarn.textContent = '';
      }
      byId('warn-badge').classList.add('hidden');
      byId('ambig-hint').classList.add('hidden');
      return;
    }

    const unsupportedBase = findUnsupportedLogBase(latex);
    if (logWarn && unsupportedBase) {
      logWarn.textContent = 'No log with base {' + unsupportedBase + '} exists in matlab using base-change formula';
      logWarn.classList.remove('hidden');
    } else if (logWarn) {
      logWarn.classList.add('hidden');
      logWarn.textContent = '';
    }

    try {
      const resolvedLatex = resolveUnsupportedLogBases(latex);
      const raw = core.l2m(resolvedLatex);
      state.currentToks = core.tokenize(raw);
      state.ambigPairs = core.findAmbig(state.currentToks);
      state.ambigRes = {};
      syncCodeDisplay();
    } catch (err) {
      // Retry once with robust log-base auto-resolution before surfacing an error.
      if (/Unsupported logarithm base/.test(err.message || '')) {
        const pendingBase = findPendingUnsupportedLogBase(latex);
        if (pendingBase) {
          const pendingRaw = '(log()) / (log(' + pendingBase + '))';
          state.currentToks = core.tokenize(pendingRaw);
          state.ambigPairs = core.findAmbig(state.currentToks);
          state.ambigRes = {};
          syncCodeDisplay();
          return;
        }

        try {
          const retried = core.l2m(resolveUnsupportedLogBases(latex));
          state.currentToks = core.tokenize(retried);
          state.ambigPairs = core.findAmbig(state.currentToks);
          state.ambigRes = {};
          syncCodeDisplay();
          return;
        } catch (_retryErr) {
          // Fall through to show original error.
        }
      }
      el.innerHTML = '<span class="eq-err">' + err.message + '</span>';
    }
  }

  function resolveUnsupportedLogBases(latex) {
    if (!latex) {
      return latex;
    }

    const src = normalizeCompactExplicitLogBaseInput(latex);
    let out = '';
    let i = 0;

    const isSupportedBase = function (base) {
      return base === '2' || base === '10';
    };

    const toChangeOfBase = function (base, arg) {
      return '\\frac{\\left(\\log\\left(' + arg + '\\right)\\right)}{\\left(\\log\\left(' + base + '\\right)\\right)}';
    };

    const readBraced = function (text, start) {
      if (text[start] !== '{') {
        return null;
      }
      let d = 0;
      for (let p = start; p < text.length; p += 1) {
        if (text[p] === '{') { d += 1; }
        else if (text[p] === '}') {
          d -= 1;
          if (d === 0) {
            return { value: text.slice(start + 1, p), end: p + 1 };
          }
        }
      }
      return null;
    };

    const readParened = function (text, start, openCh, closeCh) {
      if (text[start] !== openCh) {
        return null;
      }
      let d = 0;
      for (let p = start; p < text.length; p += 1) {
        if (text[p] === openCh) { d += 1; }
        else if (text[p] === closeCh) {
          d -= 1;
          if (d === 0) {
            return { value: text.slice(start + 1, p), end: p + 1 };
          }
        }
      }
      return null;
    };

    const readArg = function (text, start) {
      let p = start;
      while (p < text.length && /\s/.test(text[p])) { p += 1; }

      if (text.startsWith('\\left(', p)) {
        p += 6;
        let d = 1;
        let q = p;
        while (q < text.length) {
          if (text.startsWith('\\left(', q)) {
            d += 1;
            q += 6;
            continue;
          }
          if (text.startsWith('\\right)', q)) {
            d -= 1;
            if (d === 0) {
              return { value: text.slice(p, q), end: q + 7 };
            }
            q += 7;
            continue;
          }
          q += 1;
        }
        return null;
      }

      if (text[p] === '(') {
        const parsed = readParened(text, p, '(', ')');
        if (!parsed) {
          return null;
        }
        return { value: parsed.value, end: parsed.end };
      }

      const m = text.slice(p).match(/^([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)/);
      if (!m) {
        return null;
      }
      return { value: m[1], end: p + m[1].length };
    };

    while (i < src.length) {
      const slashIdx = src.indexOf('\\log_{', i);
      const plainIdx = src.indexOf('log_{', i);

      let at = -1;
      let prefixLen = 0;
      if (slashIdx === -1 && plainIdx === -1) {
        out += src.slice(i);
        break;
      }
      if (slashIdx !== -1 && (plainIdx === -1 || slashIdx <= plainIdx)) {
        at = slashIdx;
        prefixLen = 6; // "\\log_{"
      } else {
        at = plainIdx;
        prefixLen = 5; // "log_{"
      }

      out += src.slice(i, at);
      const baseParsed = readBraced(src, at + prefixLen - 1);
      if (!baseParsed) {
        out += src.slice(at, at + prefixLen);
        i = at + prefixLen;
        continue;
      }

      const base = (baseParsed.value || '').trim();
      const argParsed = readArg(src, baseParsed.end);
      if (!argParsed) {
        out += src.slice(at, baseParsed.end);
        i = baseParsed.end;
        continue;
      }

      if (isSupportedBase(base)) {
        out += src.slice(at, argParsed.end);
      } else {
        out += toChangeOfBase(base, argParsed.value);
      }
      i = argParsed.end;
    }

    return out;
  }

  function findPendingUnsupportedLogBase(latex) {
    if (!latex) {
      return '';
    }

    const src = normalizeCompactExplicitLogBaseInput(latex);

    const m = src.match(/(?:\\log_|log_)\{([^}]+)\}(?!\s*(?:\\left\(|\(|[a-zA-Z_]|[0-9]))/);
    if (!m) {
      return '';
    }

    const base = (m[1] || '').trim();
    if (!base || base === '2' || base === '10') {
      return '';
    }
    return base;
  }

  function findUnsupportedLogBase(latex) {
    if (!latex) {
      return '';
    }

    const src = normalizeCompactExplicitLogBaseInput(latex);
    const m = src.match(/(?:\\log_|log_)\{([^}]+)\}/);
    if (!m) {
      return '';
    }

    const base = (m[1] || '').trim();
    if (!base || base === '2' || base === '10') {
      return '';
    }
    return base;
  }

  function normalizeCompactExplicitLogBaseInput(latex) {
    if (!latex) {
      return latex;
    }

    // Interpret compact typing as base+argument when the base is a single digit,
    // e.g. \log_32 -> \log_{3}\left(2\right), log_3x -> log_{3}\left(x\right).
    // For multi-digit bases, users can keep explicit braces (log_{32}).
    return latex
      .replace(/\\log_([0-9])([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)(?![a-zA-Z0-9_])/g, '\\log_{$1}\\left($2\\right)')
      .replace(/\blog_([0-9])([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)(?![a-zA-Z0-9_])/g, 'log_{$1}\\left($2\\right)')
      .replace(/\\log_([a-zA-Z0-9]+)(?!\{)/g, '\\log_{$1}')
      .replace(/\blog_([a-zA-Z0-9]+)(?!\{)/g, 'log_{$1}');
  }

  function normalizeCbrtLatex(latex) {
    if (!latex) {
      return latex;
    }

    // Support \cbrt as a convenient alias for indexed square root.
    // Examples: \cbrt{x} -> \sqrt[3]{x}, \cbrt\left(x\right) -> \sqrt[3]{x}.
    return latex
      .replace(/\\operatorname\{cbrt\}/g, '\\cbrt')
      .replace(/\\text\{cbrt\}/g, '\\cbrt')
      .replace(/\\mathrm\{cbrt\}/g, '\\cbrt')
      .replace(/\\cbrt\s*\\left\(([^()]*)\\right\)/g, '\\sqrt[3]{$1}')
      .replace(/\\cbrt\s*\(([^()]*)\)/g, '\\sqrt[3]{$1}')
      .replace(/\\cbrt\s*\{([^{}]+)\}/g, '\\sqrt[3]{$1}')
      .replace(/\\cbrt\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)/g, '\\sqrt[3]{$1}')
      .replace(/\\cbrt\b/g, '\\sqrt[3]')
      .replace(/\bcbrt\s*\(([^()]*)\)/g, '\\sqrt[3]{$1}')
      .replace(/\bcbrt\s*\{([^{}]+)\}/g, '\\sqrt[3]{$1}')
      .replace(/\bcbrt\s*([a-zA-Z_][a-zA-Z0-9_]*|[0-9]+(?:\.[0-9]+)?)/g, '\\sqrt[3]{$1}');
  }

  function expandBareCbrtToken(latex) {
    if (!latex) {
      return latex;
    }

    // Expand bare cbrt tokens immediately so the editor shows cube-root
    // structure right away instead of transient text/operator formatting.
    return latex
      .replace(/\\operatorname\{cbrt\}(?!\s*(?:\\left\(|\(|\{|\[))/g, '\\sqrt[3]{ }')
      .replace(/\\text\{cbrt\}(?!\s*(?:\\left\(|\(|\{|\[))/g, '\\sqrt[3]{ }')
      .replace(/\\mathrm\{cbrt\}(?!\s*(?:\\left\(|\(|\{|\[))/g, '\\sqrt[3]{ }')
      .replace(/\\cbrt(?!\s*(?:\\left\(|\(|\{|\[))/g, '\\sqrt[3]{ }')
      .replace(/\bcbrt\b(?!\s*(?:\\left\(|\(|\{|\[))/g, '\\sqrt[3]{ }');
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

  function copyS2MLatex() {
    if (!state.mqField) {
      return;
    }
    const rawLatex = (state.mqField.latex() || '').trim();
    if (!rawLatex) {
      return;
    }
    const normalized = core.autoSubscriptVariableNumbers(normalizeCbrtLatex(core.normalizeParenLatex(rawLatex)));
    copyText(
      core.cleanLatexForCopy(normalized),
      byId('s2m-latex-copy-btn'),
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

  function safeSetMathFieldLatex(value) {
    try {
      state.mqField.latex(value);
      return true;
    } catch (_err) {
      return false;
    }
  }

  function hasIncompleteLatexCommand(latex) {
    if (!latex) {
      return false;
    }
    // If the user just typed "\" or is still typing a command token,
    // avoid normalization passes that rewrite the field mid-keystroke.
    if (/(?:^|[^\\])\\\s*$/.test(latex)) {
      return true;
    }

    const trailingCmd = latex.match(/(?:^|[^\\])\\\s*([a-zA-Z]+)$/);
    if (!trailingCmd) {
      return false;
    }

    const cmd = trailingCmd[1] || '';
    if (!KNOWN_LATEX_COMMANDS.has(cmd)) {
      return true;
    }

    // Commands like \sqrt are syntactically valid tokens but still incomplete
    // if they are the last thing typed and have no argument yet.
    return ARG_REQUIRED_TRAILING_COMMANDS.has(cmd);
  }

  function setS2MIncompleteState(isIncomplete) {
    const codeEl = byId('s2m-code-block');
    if (!codeEl) {
      return;
    }
    codeEl.classList.toggle('has-error', !!isIncomplete);
  }

  function repairLikelyCommandGlitches(latex) {
    if (!latex) {
      return latex;
    }
    let out = latex;

    // MathQuill can transiently emit backslash+space before command letters.
    // Canonicalize "\\ qrt" -> "\\qrt" once the command token is complete.
    out = out
      .replace(/(^|[^\\])\\\s+([a-zA-Z]+)(?=[^a-zA-Z]|$)/g, '$1\\$2');

    // Observed intermittent MathQuill input glitch: "\\sqrt" may appear as "\\qrt".
    out = out.replace(/(^|[^\\])\\qrt\b/g, '$1\\sqrt');

    return out;
  }

  function hasLivePlaceholderSlot(latex) {
    if (!latex) {
      return false;
    }
    // MathQuill represents an empty slot as "{ }"; rewriting latex while slots
    // are open can move the cursor out of the slot unexpectedly.
    return /\{\s\}/.test(latex);
  }

  function initMathField() {
    const MQ = MathQuill.getInterface(2);
    state.mqField = MQ.MathField(byId('mq-field'), {
      spaceBehavesLikeTab: true,
      autoCommands: 'pi theta rho sqrt cbrt',
      autoOperatorNames: 'sin cos tan cot sec csc sinh cosh tanh asin acos atan acot asec acsc asinh acosh atanh exp log ln sqrt cbrt abs floor ceil',
      handlers: {
        edit: function () {
          if (state.isNormalizingEdit) {
            return;
          }
          try {
            const rawLatex = state.mqField.latex();
            const cbrtExpanded = expandBareCbrtToken(rawLatex);
            if (cbrtExpanded !== rawLatex) {
              state.isNormalizingEdit = true;
              const cbrtOk = safeSetMathFieldLatex(cbrtExpanded);
              state.isNormalizingEdit = false;
              renderS2M(cbrtOk ? cbrtExpanded : rawLatex);
              requestAnimationFrame(ensureMqCursorVisible);
              return;
            }

            const incomplete = hasIncompleteLatexCommand(rawLatex);
            setS2MIncompleteState(incomplete);

            if (incomplete) {
              // Do not normalize or rewrite while command token is still being typed.
              return;
            }

            if (hasLivePlaceholderSlot(rawLatex)) {
              renderS2M(rawLatex);
              return;
            }

            const repairedLatex = repairLikelyCommandGlitches(rawLatex);
            const normalized = core.autoSubscriptVariableNumbers(normalizeCbrtLatex(core.normalizeParenLatex(repairedLatex)));
            if (normalized !== rawLatex) {
              state.isNormalizingEdit = true;
              const ok = safeSetMathFieldLatex(normalized);
              state.isNormalizingEdit = false;
              renderS2M(ok ? normalized : rawLatex);
              return;
            }

            renderS2M(rawLatex);
            requestAnimationFrame(ensureMqCursorVisible);
          } catch (_err) {
            // Keep the editor responsive even if MathQuill throws during incremental edits.
            try {
              renderS2M(state.mqField.latex());
              requestAnimationFrame(ensureMqCursorVisible);
            } catch (__err) {
              renderS2M('');
            }
          }
        }
      }
    });

    byId('mq-wrap').addEventListener('click', function () {
      state.mqField.focus();
      requestAnimationFrame(ensureMqCursorVisible);
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
      const normalized = core.autoSubscriptVariableNumbers(normalizeCbrtLatex(core.normalizeParenLatex(pasted)));
      // Insert at cursor position instead of replacing entire field
      try {
        state.mqField.write(normalized);
      } catch (_err) {
        state.mqField.write(pasted);
      }
      const fullLatex = state.mqField.latex();
      renderS2M(fullLatex);
      state.mqField.focus();
      requestAnimationFrame(ensureMqCursorVisible);
    });
  }

  function bindEvents() {
    byId('flip-btn').addEventListener('click', flipMode);
    document.addEventListener('keydown', handleGlobalJumpShortcuts, true);
    byId('m2s-input').addEventListener('keydown', function (evt) {
      // Some embedded webview hosts swallow default Enter behavior in textareas.
      // Force plain Enter to insert a newline so multiline MATLAB input remains usable.
      if (!evt || evt.key !== 'Enter' || evt.shiftKey || evt.ctrlKey || evt.metaKey || evt.altKey) {
        return;
      }
      const input = byId('m2s-input');
      if (!input) {
        return;
      }
      evt.preventDefault();
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const value = input.value || '';
      input.value = value.slice(0, start) + '\n' + value.slice(end);
      input.selectionStart = start + 1;
      input.selectionEnd = start + 1;
      renderM2S();
    });
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
    byId('m2s-clear-btn').addEventListener('click', function () {
      const input = byId('m2s-input');
      if (!input) {
        return;
      }
      input.value = '';
      renderM2S();
      input.focus();
    });
    byId('s2m-clear-btn').addEventListener('click', function () {
      if (!state.mqField) {
        return;
      }
      state.mqField.latex('');
      renderS2M('');
      state.mqField.focus();
      const wrap = byId('mq-wrap');
      if (wrap) {
        wrap.scrollLeft = 0;
      }
    });
    byId('sym-copy-btn').addEventListener('click', copyLatex);
    byId('s2m-latex-copy-btn').addEventListener('click', copyS2MLatex);
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
    renderM2S();
  }

  globalThis.toggleAmbig = toggleAmbig;
  window.addEventListener('load', init);
}());
