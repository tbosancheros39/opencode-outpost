# Code Style & Conventions

## TypeScript
- `module: "ES2022"`, `moduleResolution: "bundler"`
- Target: ES2022
- Strict mode enabled
- Declaration files generated (`declaration: true`)

## Import Convention
All local imports use `.js` extension (required by NodeNext module resolution):
```typescript
import { config } from "../config.js";
```
Never use `.ts` extensions.

## ESLint Rules
- `no-console: "error"` — use `src/utils/logger.ts` instead
- Exemptions: `logger.ts`, `src/setup/**/*.ts`, `src/cli/doctor.ts`
- `@typescript-eslint/no-explicit-any: "warn"` — avoid `any`, use proper types
- `@typescript-eslint/no-unused-vars: ["warn", { argsIgnorePattern: "^_" }]` — prefix unused params with `_`

## File Structure
- Tests mirror `src/` structure under `tests/`
- No test files in `src/` (tsconfig excludes `**/*.test.ts`)
- 85 test files

## Shared Utilities
- Bot-specific helpers → `src/bot/utils/`
- General utilities → `src/utils/`
- Extract duplicate code, import with `.js` extensions, remove duplicates

## Config
- All config via environment variables (dotenv)
- Config module (`src/config.ts`) loaded eagerly at import time
- Tests must set env vars before importing config-dependent modules
