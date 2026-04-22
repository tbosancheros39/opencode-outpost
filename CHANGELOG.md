# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [0.15.0] - 2026-04-22

### Added

- Knowledge base module with FTS5 full-text search (`/find`, `/digest`, CLI `kb` commands)
- Session snapshot and resume (`/snapshot`, `/resume`)
- File pinning to session context (`/pin`)
- Photo/image attachment handling with vision model support
- Recent files tracker for quick-access file menus
- Foreground session state guard for scheduled task concurrency
- Response cache for quick-action keyboard
- Docker setup: multi-stage Dockerfile + docker-compose.yml (Redis + bot)
- Windows setup guide (READMEwindows.md) — Docker, WSL2, Native Windows paths
- Cross-platform config: `.gitattributes` (LF enforcement), `.editorconfig`, `.dockerignore`
- `dev:watch` script using tsx for hot-reload development
- Docker quickstart in README.md
- Chinese locale (zh) — 7th language
- `opencode kb` CLI subcommands: ingest, search, list, reset
- API key validation and masked logging on startup
- Diagnostic logging for message:text events

### Changed

- Expanded command set from 34 to 40 commands
- DB path resolution uses `getRuntimePaths().appHome` (safe in installed mode)
- Task queue store: fixed initSchema recursion, added persistent SQLite backend
- Settings manager: added semanticSearch, pinnedFiles, costHistory, projectSessions
- Model filtering: added OpenCode Go and Free model groups with wildcard support
- Inline menu and query handlers updated for new commands
- Streaming constants documented as non-configurable in .env.example
- Removed unused `lastUpdated` field from SummaryAggregator
- Deleted empty `src/constants.ts` (no imports remained)

### Fixed

- Task queue and knowledge base initSchema recursion bug (called getDb() inside itself)
- Hardcoded `.data/` paths in task-queue and knowledge-base stores (broke installed mode)
- `foregroundSessionState.__resetForTests()` missing from test helper (state leak between tests)
- AGENTS.md test file count corrected (88 → 85)
- Interaction guard deadlock when prompt completes
- Watchdog restart now passes port from config to `opencode serve`
- SDK auth param (use apiKey instead of Basic auth)
- Default port changed to 4097

## [0.14.0] - 2026-04-18

### Added

- Multi-user access control with super/simple/restricted roles
- BullMQ + Redis task queue for scheduled background tasks
- Bubblewrap execution sandboxing for shell commands
- Git integration commands (`/diff`, `/branch`, `/commit`)
- File explorer command (`/fe`)
- System monitoring (`/health`, `/journal`)
- Speech-to-text via Whisper-compatible APIs
- Text-to-speech replies (`/tts`)
- Inline mode commands (`@bot feynman: explain X`)
- 6 locales: English, Deutsch, Espanol, Francais, Russky, Bosnian
- Multi-chat group support with chat ID allowlists
- Proxy support (SOCKS5, HTTP/HTTPS)
- Context compaction from chat (`/compact`)
- Steer command for redirecting active tasks (`/steer`)
- MCP server browser (`/mcps`)
- Skills browser (`/skills`)
- Cost tracking (`/cost`)
- Session export (`/export`)
- Session messages browser with fork/revert (`/messages`)

### Changed

- Expanded command set from 14 to 34 commands
- Added Redis requirement for BullMQ task scheduling
- Enhanced security with environment sanitization for child processes
- Improved pinned status message with real-time context usage tracking
- Migrated to OpenCode SDK v2 with flat params
- Replaced telegram-markdown-v2 with remark-gfm MarkdownV2 renderer
- Serialized TTS responses (no fire-and-forget)
- Upgraded https-proxy-agent to 9.0.0 and socks-proxy-agent to 10.0.0
- Temp directory now uses `os.tmpdir()` instead of project-relative path
- All user-facing strings now use i18n `t()` function (7 locales)
- Removed duplicate `escapeHtml` in sandbox.ts (now imports from utils)

### Security

- Multi-layer user ID whitelist with chat ID validation
- Environment variable sanitization (`sanitizeEnv()`) for child processes
- Command confirmation for dangerous operations (`/shell`, `/sandbox`)
- Bubblewrap sandbox with network isolation and read-only filesystem

### Fixed

- All 122 test failures resolved (chatId params, mock updates, context objects)
- i18n compliance: 40+ hardcoded strings replaced with `t()` calls across 7 command files
- Hardcoded temp directory paths replaced with `os.tmpdir()`
- ESLint config migrated from `.eslintrc.cjs` to `eslint.config.js`
- Removed unused `remark` and `opencode-wakatime` dependencies

## [0.13.2] - 2026-04-16

### Fixed

- Migrate all OpenCode SDK v2 calls from path/body/query to flat params
- Stabilize tool call streaming and escape MarkdownV2 tables

### Added

- Tool calls streaming support

## [0.13.1] - 2026-04-15

### Fixed

- Make command execution message clearer
- Exclude skills and MCP prompts from `/commands`

## [0.13.0] - 2026-04-14

### Added

- Commands list pagination
- Response streaming with live draft updates

## [0.12.1] - 2026-04-13

### Fixed

- Correctly aggregate session cost in pinned message
- Sync reply keyboard context with pinned message updates

### Added

- Display session cost in pinned message

## [0.12.0] - 2026-04-12

### Added

- Scheduled tasks support with BullMQ + Redis

## [0.11.4] - 2026-04-10

### Added

- French locale (fr)

## [0.11.3] - 2026-04-08

### Fixed

- Avoid markdown parse failures in interactive flows

## [0.11.2] - 2026-04-07

### Fixed

- Filter unavailable favorites/recent models
- Reset invalid stored model to default

### Changed

- Renamed `/stop` to `/abort` (clearer intent)

## [0.11.1] - 2026-04-05

### Fixed

- Recover from Telegram clear-history by allowing `/start` to reset stuck interactions
- Fix Russian localization for pinned message

## [0.11.0] - 2026-04-01

### Added

- Voice/audio transcription via Whisper-compatible APIs
- Image, PDF, and document attachments support
- Interactive question and permission handling
- Live pinned session status
- Model, agent, and variant selection menus
- Custom command catalog (`/commands`)
- i18n support for 6 languages

## [0.10.0] - 2026-03-15

### Added

- Multi-user infrastructure (`TELEGRAM_ALLOWED_USER_IDS`, `TELEGRAM_SUPER_USER_IDS`)
- Group chat support (`TELEGRAM_ALLOWED_CHAT_IDS`)
- BullMQ + Redis integration for background task queues
- SQLite persistence for scheduled tasks and session cache
