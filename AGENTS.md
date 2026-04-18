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

CI runs `lint → build → test` in that order. Run all three before pushing.

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

All commands live in `src/bot/commands/definitions.ts`. When adding a command:

1. Add entry to `COMMAND_DEFINITIONS` array with `descriptionKey`
2. Add handler import and `bot.command("name", handler)` in `src/bot/index.ts`
3. Register **BEFORE** any fallback text handler (grammY matches in order)

Commands with arguments: use `ctx.match` (string after command).

### Runtime modes affect file paths

Two modes: `sources` (dev, `.env` in cwd) and `installed` (production, platform-specific config dir).

- `src/runtime/paths.ts` resolves all paths
- Don't hardcode paths — always use `getRuntimePaths()` or `os.tmpdir()` for temp files
- The `.env` location changes with mode

### Tests reset singleton state

`tests/setup.ts` calls `resetSingletonState()` before/after each test, clearing:
- question, permission, rename, interaction managers
- summary aggregator, keyboard manager, pinned message manager, process manager
- SSE event listeners, session directory cache

If you add a new singleton manager, register it in `tests/helpers/reset-singleton-state.ts`.

### Test environment

Vitest with `tests/setup.ts` auto-providing env vars (`TELEGRAM_BOT_TOKEN`, `OPENCODE_API_URL`, etc.) and a temp home directory per worker. Tests use `vi.mock()` for external deps.

Run single test: `npm run test -- --reporter=verbose tests/path/to/file.test.ts`

### i18n for user-facing strings

User-visible Telegram messages must go through `t()` from `src/i18n/index.ts`:

1. Add keys to `src/i18n/en.ts` first
2. Add to other locales (de, es, fr, ru, zh, bs) — copy English if unsure
3. Use in code: `t("key.name", { variable: value })`
4. Code identifiers and comments stay in English

### Config is env-driven

All configuration via `.env` (see `.env.example`). `src/config.ts` exports a typed `config` object.

**Required vars:**
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_USER_IDS`
- `OPENCODE_MODEL_PROVIDER`
- `OPENCODE_MODEL_ID`

**Critical for BullMQ tasks:**
- `REDIS_URL` (defaults to `redis://localhost:6379`)

### Interaction guard blocks concurrent commands

`interactionManager` prevents concurrent operations per chat. When busy:
- Only these commands work: `/steer`, `/stop`, `/abort`, `/status`, `/help`
- Others get: "⏳ Agent is already running a task. Wait for completion or use /abort"

Always wrap long operations with `interactionManager.start()` / `interactionManager.clear()`.

### SSE streaming never use nodemon

SSE streams break with process restarts. For production:
- Never use `nodemon`
- Use `npm run build && node dist/cli.js`
- Check `LOG_LEVEL=debug` for event details

### Message length limits

Telegram has 4096 char limit. Use `chunkOutput()` from utils for long responses. Code blocks use `<pre><code>` HTML with escaped entities.

## Git conventions

- **Commits:** only when explicitly asked. Format: `<type>(<scope>)?: <description>` (Conventional Commits)
- **Branches:** `<type>/<short-description>` (e.g., `feat/model-selector`)
- **PR titles:** same format — becomes squash-merge commit message
- **One change per PR.** Rebase on `main` before opening

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed release notes mapping and version bump policy.

## Coding rules

- TypeScript strict mode. ESM imports with `.js` extensions
- User-facing strings: i18n. Code: English only
- Error handling: `try/catch` around async ops, log with context, never expose stack traces to users
- The app is multi-user by design with role-based access (super/simple/restricted)

## Key files

| What | Where |
|------|-------|
| Entry (direct) | `src/index.ts` |
| Entry (CLI) | `src/cli.ts` → `dist/cli.js` |
| Config | `src/config.ts` |
| Bot commands registry | `src/bot/commands/definitions.ts` |
| Bot setup/wiring | `src/bot/index.ts` |
| Logger | `src/utils/logger.ts` |
| Runtime paths | `src/runtime/paths.ts` |
| Runtime mode | `src/runtime/mode.ts` |
| Test setup | `tests/setup.ts` |
| Test helpers | `tests/helpers/` |
| Env template | `.env.example` |
| CI workflow | `.github/workflows/ci.yml` |

## Deployment notes

Systemd service requires explicit PATH including `~/.opencode/bin`. See README.md for full service template.

```bash
journalctl -u opencode-outpost -f   # Monitor logs
systemctl restart opencode-outpost  # Restart
```
