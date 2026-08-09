---
applyTo: "**"
---
# Skill Mapping: vite-react-development

This project uses React, TypeScript, and Vite. Follow these practices for local development and build verification.

## Local Development Commands

### Start Development Server
```bash
npm run dev
```
Starts the local dev server. Hot Module Replacement (HMR) is active by default.

### Build Production Package
Verify that the project bundles successfully without any Rollup chunking errors:
```bash
npm run build
```

### TypeScript Validation
Run compilation check to verify typings before pushing commits:
```bash
npm run type-check
```

## Production Optimization
- Keep asset bundle sizes optimized. If build output warns about large chunks (> 500kB), consider using dynamic `import()` for code-splitting (e.g. splitting heavy utilities or charting libraries).
- Ensure all environment variables needed for production (Supabase keys) are injected properly during the build action.
