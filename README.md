# EqTool — MATLAB Bidirectional Equation Visualizer

A bidirectional equation tool that runs inside MATLAB. Paste MATLAB code to see it rendered as symbolic math, or type equations in a live editor to generate valid MATLAB code.

![EqTool demo](screenshot.png)

## Features

- **MATLAB → Symbolic** — paste any expression and see it rendered with proper fractions, radicals, trig powers, and color-coded variables
- **Symbolic → MATLAB** — live MathQuill equation editor outputs valid MATLAB code
- **Ambiguity detection** — flags greek-letter juxtaposition (e.g. `Δt` could be `delta_t` or `delta * t`) and lets you resolve with a click
- **Auto-setup** — downloads and bundles all dependencies on first run, no manual install steps
- **Full inverse trig** — `acos`, `arccos`, `cos⁻¹` all recognized in both directions

## Requirements

- MATLAB R2020b or later
- Internet connection on first launch only

## Installation

**Option A — MATLAB File Exchange**
1. Open MATLAB → Add-Ons → Get Add-Ons
2. Search **EqTool**
3. Click Install
4. Run `EqTool`

**Option B — Direct from GitHub**
1. Download `EqTool.m` and `matlab_equation_tool.html`
2. Place both in the same folder
3. Add that folder to your MATLAB path
4. Run `EqTool`

## Usage

**MATLAB → Symbolic mode** (default)

Type or paste any MATLAB expression into the code field. The symbolic view updates live.

```matlab
(sin(theta)^2 + acos(alpha_0)) / (2 * delta_t) + sqrt(rho_ref^3)
```

**Symbolic → MATLAB mode**

Click the `⇄` button to switch. Type directly into the equation editor:

| Key | Action |
|-----|--------|
| `/` | Fraction |
| `^` | Superscript |
| `\sqrt` | Radical |
| `\rho`, `\theta`, `\Delta` | Greek letters |
| `\sin`, `\arccos` | Trig functions |
| Arrow keys | Navigate slots |

## Files

| File | Description |
|------|-------------|
| `EqTool.m` | Main launcher — self-bundling on first run |
| `matlab_equation_tool.html` | Tool UI — HTML/JS with all rendering logic |
| `EqTool_package.m` | Run once to build `EqTool.mltbx` for distribution |

## Packaging

To build a `.mltbx` for distribution:

```matlab
cd('/path/to/EqTool')
EqTool_package()
```

Requires MATLAB R2023a or later to package. The tool itself runs on R2020b+.

## License

MIT
