---
applyTo: "**/*.{ts,tsx,json,css,html}"
---
# Skill Mapping: code-formatting

To maintain consistency and reduce code review friction, all TypeScript, React, CSS, and configuration files must follow these formatting guidelines.

## Code Standards
- **Indentation**: Use 2 spaces for indentation in TypeScript, TSX, HTML, and CSS.
- **Semicolons**: Always end statements with semicolons in TypeScript.
- **Quotes**: Prefer single quotes (`'`) for string literals in TSX and TS files, unless double quotes are required for attribute definitions in TSX.
- **Trailing Commas**: Use trailing commas in multi-line objects, arrays, and imports.

## TypeScript Configuration
- Adhere to the configurations specified in `tsconfig.json`.
- Do not use `@ts-ignore` or `@ts-nocheck` to bypass compiler warnings unless absolutely necessary and accompanied by a detailed comment explanation.
- Ensure all custom interfaces are stored in `types.ts` or near their respective components when specific to that view.

## Verification Check
Run this check locally before staging changes:
```bash
npm run type-check
```
If the TypeScript compiler returns errors, resolve them before committing.
