# EqTool — MATLAB Bidirectional Equation Visualizer

**Current File Exchange Version:** v1.4.4

A bidirectional equation tool that runs inside MATLAB. Paste MATLAB code to see it rendered as symbolic math, or type equations in a live editor to generate valid MATLAB code.

## Quick Start (After Install)

**Command Window**: run `EqTool`

![EqTool screenshot](screenshot.png)

## Installation

**Option A — MATLAB File Exchange**
1. Open MATLAB → Add-Ons → Get Add-Ons
2. Search **EqTool**
3. Click Add

**Option B — Directly from GitHub**
1. Download the full repo (or at minimum `EqTool.m`, `matlab_equation_tool.html`, `styles/`, and `src/js/`)
2. Preserve the folder structure
3. Add that folder to your MATLAB path
4. Run `EqTool`

## Requirements

- MATLAB R2022b or later
- Internet connection on first launch only

## Usage

**MATLAB → Symbolic mode** (default)

Type or paste any MATLAB expression into the code field. The symbolic view updates live.

```matlab
(sin(theta)^2 + acos(alpha_0)) / (2 * delta_t) + sqrt(rho_ref^3)
```

**Symbolic → MATLAB mode**

Click the `⇄` button to switch. Type directly into the equation editor:

|              Key               |                     Action                     |
|--------------------------------|------------------------------------------------|
|              `/`               | Fraction                                       |
|              `^`               | Superscript                                    |
|              `_`               | Subscript                                      |
|     `\sqrt`,`\cbrt`,`\nthroot`    | Radical                                        |
|   `\rho`, `\theta`, `\Delta`   | Greek letters                                  |
| `\sin`, `\cos`, `\log`, `\exp` | Function names (auto-recognized operators)     |
|            `{abc}`             | Keep multiple characters as one variable token |

### Shortcuts and Input Behaviors
1. MATLAB → Symbolic input supports multiline expressions and `%` comments.
2. In equation editor, typing a single-letter variable followed by digits auto-subscripts:
	`x1` → `x_{1}`, `a12` → `a_{12}`.
3. Function-like tokens are kept as functions rather than subscripts where applicable:
	`log1` is treated as log input (not `l*o*g_1`).
4. Use braces in MATLAB input to preserve grouped identifiers as one variable:
	`{nIL}` stays a single symbol rather than splitting into `n * I * L`.
5. `copy` in Symbolic → MATLAB copies generated MATLAB code.
6. `copy LaTeX` in MATLAB → Symbolic copies cleaned LaTeX for external use.
7. `copy LaTeX` in Symbolic → MATLAB copies cleaned editor LaTeX with reduced formatting for better Microsoft Word equation compatibility.
8. Unsupported logarithm bases are auto-converted using change-of-base formula in Symbolic → MATLAB:
	`\log_{b}(x)` → `log(x)/log(b)` for bases other than `2` and `10`.

## Features

- **MATLAB → Symbolic** — paste any expression and see it rendered with proper fractions, radicals, trig powers, and color-coded variables
- **Symbolic → MATLAB** — live MathQuill equation editor outputs valid MATLAB code
- **Smart variable grouping** — use braces (`{...}`) in Equation Editor input to force multi-character identifiers to stay atomic
- **Auto-subscript typing** — compact variable and digit runs in the equation editor become subscripts automatically
- **Ambiguity detection** — flags greek-letter juxtaposition (e.g. `Δt` could be `Delta_t` or `Delta * t`) and lets you resolve with a click
- **Auto-setup** — downloads and bundles all dependencies on first run, no manual install steps
- **Full inverse trig** — `acos`, `arccos`, `cos⁻¹` all recognized in both directions
- **Log base fallback** — unsupported explicit bases are converted with change-of-base (`log(x)/log(b)`) for MATLAB compatibility
- **Copy-ready LaTeX** — LaTeX copy path strips color wrappers and heavy display sizing commands for easier paste into docs/Word

## Packaging

Packaging is for maintainers. End users should install from MATLAB Add-On Explorer.

To build a `.mltbx` for distribution:

```matlab
cd('/path/to/EqTool')
EqTool_package()
```

Requires MATLAB R2023a or later to package. The tool itself runs on R2022b+.

## Files

| File | Description |
|------|-------------|
| `EqTool.m` | Main launcher — self-bundling on first run |
| `matlab_equation_tool.html` | Tool UI shell — references modular CSS/JS files |
| `styles/main.css` | UI styling |
| `src/js/core.js` | Parser/conversion core (MATLAB ↔ LaTeX, ambiguity, vectorization) |
| `src/js/ui.js` | DOM/UI wiring and interactions |
| `EqTool_package.m` | Run once to build `EqTool.mltbx` for distribution |
| `tests/core.test.js` | Automated Node tests for parsing and conversion logic |
| `TESTING.md` | Full automated + manual test checklist |

## Development

### Run automated tests

```bash
npm test
```

All tests must pass before committing parser or conversion changes.

### Manual verification

Follow `TESTING.md` for browser and MATLAB smoke tests.

Additional UI sanity check:
- In MATLAB → Symbolic mode, paste a very long equation and verify horizontal scroll can reach both far-left and far-right ends of the rendered line.

## License

MIT
