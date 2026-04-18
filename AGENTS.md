# AGENTS.md

Telegram bot client for OpenCode — run and monitor coding tasks from Telegram.
Scope and feature status: [PRODUCT.md](./PRODUCT.md). Design boundaries: [CONCEPT.md](./CONCEPT.md).

## Quick commands

```bash
npm run lint          # ESLint (zero warnings allowed)
npm run build         # tsc
npm run test          # vitest run
npm run dev           # build + start
```

CI runs lint → build → test in that order. Run all three before pushing.

## Architecture

Single-package ESM app (`"type": "module"`). Key layers:

1. **Bot** (`src/bot/`) — grammY setup, middleware, commands, callbacks
2. **OpenCode Client** (`src/opencode/`) — `@opencode-ai/sdk` wrapper, SSE event subscription
3. **Managers** (`src/session/`, `src/project/`, `src/question/`, `src/permission/`, `src/keyboard/`, `src/pinned/`, etc.) — in-memory state, one instance each (singletons)
4. **Summary Pipeline** (`src/summary/`) — SSE event aggregation → Telegram-friendly messages
5. **Process Manager** (`src/process/`) — start/stop local OpenCode server
6. **Runtime/CLI** (`src/runtime/`, `src/cli/`) — mode resolution, config bootstrap, CLI entrypoint
7. **I18n** (`src/i18n/`) — locales: en, de, es, fr, ru, zh, bs

Data flow: Telegram → grammY → Managers + OpenCodeClient → OpenCode Server → SSE → Summary → Telegram.

## Things agents get wrong

### Console is banned

ESLint `no-console: "error"` everywhere except `src/utils/logger.ts`, `src/setup/**`, and `src/cli/doctor.ts`. Always use `logger.debug/info/warn/error` from `src/utils/logger.ts`.

### Bot commands are centralized

All commands live in `src/bot/commands/definitions.ts`. When adding a command, update that file only — it feeds both `setMyCommands` and help text. Do not duplicate command lists.

### Runtime modes affect file paths

Two modes: `sources` (dev, `.env` in cwd) and `installed` (production, `.env` in platform-specific config dir). `src/runtime/paths.ts` resolves all paths. The `.env` location changes with mode — don't hardcode paths.

### Tests reset singleton state

`tests/setup.ts` calls `resetSingletonState()` before/after each test, clearing managers (question, permission, rename, interaction, summary, keyboard, pinned, process, session cache). If you add a new singleton manager, register it in `tests/helpers/reset-singleton-state.ts`.

### Test environment

Vitest with `tests/setup.ts` auto-providing env vars (`TELEGRAM_BOT_TOKEN`, `OPENCODE_API_URL`, etc.) and a temp home directory per worker. Tests use `vi.mock()` for external deps.

### i18n for user-facing strings

User-visible Telegram messages must go through `t()` from `src/i18n/index.ts`. Add keys to `src/i18n/en.ts` first, then other locales. Code identifiers and comments stay in English.

### Config is env-driven

All configuration via `.env` (see `.env.example`). `src/config.ts` exports a typed `config` object. Required vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`, `OPENCODE_MODEL_PROVIDER`, `OPENCODE_MODEL_ID`.

## Git conventions

- **Commits:** only when explicitly asked. Format: `<type>(<scope>)?: <description>` (Conventional Commits).
- **Branches:** `<type>/<short-description>` (e.g., `feat/model-selector`).
- **PR titles:** same Conventional Commits format — becomes the squash-merge commit message.
- **One change per PR.** Rebase on `main` before opening.

## Coding rules

- TypeScript strict mode. ESM imports with `.js` extensions.
- User-facing strings: i18n. Code: English only.
- Error handling: `try/catch` around async ops, log with context, never expose stack traces to users.
- The app is single-user by design. Runs on Linux with systemd.

## Key files

| What | Where |
|------|-------|
| Entry (direct) | `src/index.ts` |
| Entry (CLI) | `src/cli.ts` → `dist/cli.js` |
| Config | `src/config.ts` |
| Bot commands | `src/bot/commands/definitions.ts` |
| Logger | `src/utils/logger.ts` |
| Runtime paths | `src/runtime/paths.ts` |
| Test setup | `tests/setup.ts` |
| Test helpers | `tests/helpers/` |
| Env template | `.env.example` |
