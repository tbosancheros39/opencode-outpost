# Architecture

## Overview
OpenCode Outpost is a Telegram bot client for OpenCode. It bridges Telegram chat to a local OpenCode server via outbound REST API + SSE connections.

## Connection Topology
The bot is a **pure outbound-only client**. It never listens on any port:
- **Outbound** → OpenCode server at `config.opencode.apiUrl` (default `http://localhost:4097`, actual `.env` uses `http://localhost:4098`)
- **Outbound** → Telegram Bot API (`api.telegram.org`) via long polling (grammY runner)
- No webhook, no HTTP server, no listening socket

## Port Configuration (CRITICAL — currently mismatched)
| Source | Port |
|---|---|
| `opencode-server.service` (systemd) | 4096 |
| `src/config.ts` default / `.env.example` | 4097 |
| `.env` (production) | 4098 |

The `.env` and systemd service MUST be aligned. Currently `OPENCODE_API_URL=http://localhost:4098` in `.env` but the systemd service starts the server on port 4096.

## Runtime Modes
- **sources**: Config from project root (`.env`, `settings.json`). Used during dev (`npm run dev`).
- **installed**: Config from `~/.config/opencode-outpost/`. Used for npm global install.
- `OPENCODE_TELEGRAM_HOME` env var overrides the config directory in either mode.

## Key Modules
| Directory | Purpose |
|---|---|
| `src/bot/commands/` | 40 Telegram command handlers |
| `src/bot/handlers/` | Message routing (agent, voice, document, inline query, permission) |
| `src/bot/middleware/` | Auth, rate-limit, chat-concurrency, interaction-guard |
| `src/bot/streaming/` | Response + tool-call streaming to Telegram |
| `src/bot/utils/` | Shared utilities (pin-helpers, etc.) |
| `src/opencode/` | OpenCode SDK client and SSE event listener |
| `src/queue/` | BullMQ task queue with in-memory fallback |
| `src/task-queue/` | SQLite-backed persistent task store |
| `src/knowledge-base/` | Document indexing and search (SQLite + FTS5) |
| `src/safety/` | Bubblewrap sandbox, env sanitizer, command classifier |
| `src/runtime/` | Mode resolution, path resolution, config wizard |
| `src/i18n/` | 7 locales (en, de, es, fr, ru, zh, bs) |
| `src/monitoring/` | OpenCode watchdog, journal monitor, system monitor |
| `src/telegram/render/` | MarkdownV2 rendering pipeline |
| `src/session/` | Session cache, auto-resume |
| `src/summary/` | Response aggregation |

## Queue Fallback
If Redis is unavailable (`REDIS_ENABLED=false` or connection fails), falls back to `MemoryQueue` (in-memory FIFO). BullMQ features are lost.

## Singleton Managers
Many modules export singleton instances. Tests must call `resetSingletonState()` between tests. `tests/setup.ts` handles this automatically.

## Dependencies
- **Required services**: Redis (optional, fallback to memory), OpenCode server
- **Key packages**: grammY (Telegram), @opencode-ai/sdk, bullmq + ioredis, better-sqlite3, remark-gfm
- **Native deps**: better-sqlite3 requires C++ build tools (python3, make, g++)
