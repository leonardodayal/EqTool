(function () {
  const core = (typeof globalThis !== 'undefined' ? globalThis : window).EqToolCore;
  if (!core) {
    throw new Error('EqToolCore was not loaded before ui.js');
  }

  const state = {
    currentMode: 'm2s',
    mqField: null,
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
    state.mqField.latex(core.EXAMPLES_S2M[index]);
    renderS2M(core.EXAMPLES_S2M[index]);
  }

  function renderM2S() {
    core.resetColors();
    const raw = byId('m2s-input').value;
    const out = byId('m2s-output');

    if (!raw.trim()) {
      out.innerHTML = '<span class="eq-ph">rendered equation appears here</span>';
      byId('m2s-legend').innerHTML = '';
      state.lastLatex = '';
      return;
    }

    const lines = core.splitLines(raw);
    if (!lines.length) {
      out.innerHTML = '<span class="eq-ph">rendered equation appears here</span>';
      byId('m2s-legend').innerHTML = '';
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
      const raw = core.l2m(latex);
      state.currentToks = core.tokenize(raw);
      state.ambigPairs = core.findAmbig(state.currentToks);
      state.ambigRes = {};
      syncCodeDisplay();
    } catch (err) {
      el.innerHTML = '<span class="eq-err">' + err.message + '</span>';
    }
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
      handlers: {
        edit: function () {
          renderS2M(state.mqField.latex());
        }
      }
    });

    byId('mq-wrap').addEventListener('click', function () {
      state.mqField.focus();
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
      state.mqField.latex(pasted);
      renderS2M(pasted);
      state.mqField.focus();
    });
  }

  function bindEvents() {
    byId('flip-btn').addEventListener('click', flipMode);
    byId('m2s-input').addEventListener('input', renderM2S);
    byId('m2s-demo-btn').addEventListener('click', function () { loadEx1(0); });
    byId('s2m-demo-btn').addEventListener('click', function () { loadEx2(0); });
    byId('sym-copy-btn').addEventListener('click', copyLatex);
    byId('vec-btn').addEventListener('click', toggleVec);
    byId('copy-btn').addEventListener('click', copyCode);
  }

  function init() {
    bindEvents();
    initMathField();
    loadEx1(0);
  }

  globalThis.toggleAmbig = toggleAmbig;
  window.addEventListener('load', init);
}());
