# EqTool Testing Guide

## Automated Tests

Run from repository root:

```bash
npm test
```

Expected result: all tests in tests/core.test.js pass.

Coverage includes:
- Tokenization for scalar, element-wise, and backslash operators.
- MATLAB parse to LaTeX conversion for fractions and trig powers.
- LaTeX to MATLAB conversion for inverse trig and greek symbol spacing.
- Line splitting for MATLAB continuations and vectorized operators.
- Ambiguity detection and merge behavior.
- Vectorization transformation.
- Copy sanitization for LaTeX export.

## Manual Browser Tests

Open matlab_equation_tool.html in a browser and verify:

1. MATLAB to Symbolic render
- Paste `(sin(theta)^2 + acos(alpha_0)) / (2 * delta_t) + sqrt(rho_ref^3)`.
- Confirm equation renders and variable legend appears.

2. Multi-line handling
- Paste:
  ```matlab
  a = 2 .* x + 3;
  b = sqrt(a) / 2;
  ```
- Confirm each line renders in symbolic output.

3. Symbolic to MATLAB conversion
- Switch mode, enter `\\frac{\\sin^2\\left(\\theta\\right)}{2\\cdot\\Delta t}`.
- Confirm output includes `sin(theta)^2` and `delta * t`.

4. Ambiguity cycle
- In Symbolic to MATLAB mode, create an expression containing `Delta t`.
- Click orange ambiguity token repeatedly.
- Confirm cycle is: ambiguous -> merged subscript -> multiply.

5. Vectorize toggle
- Click `.*` button.
- Confirm output operators become `.*`, `.^`, and `./`.

6. Copy buttons
- Verify `copy` copies MATLAB output.
- Verify `copy LaTeX` copies cleaned LaTeX without textcolor wrappers.

## MATLAB App Test

Run in MATLAB:

```matlab
EqTool
```

Verify:
- UI opens correctly in a uihtml window.
- Both modes work.
- Copy buttons still function.
- First run dependency bundle still succeeds.
