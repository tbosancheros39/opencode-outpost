# Architecture Decision Records

This document captures the key architectural decisions made during the development of the OpenCode Telegram Bot.

---

## ADR-001: grammY as the Telegram Bot Framework

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** The project needed a Telegram Bot API framework to handle updates, commands, callbacks, and middleware. Options included `node-telegram-bot-api`, `Telegraf`, and `grammy`.
**Decision:** `grammy` was chosen as the core Telegram Bot framework, with `@grammyjs/menu` for inline keyboards.
**Alternatives Considered:**
- `node-telegram-bot-api` — older, callback-heavy API, less active maintenance.
- `Telegraf` — popular but grammY offers better TypeScript support, a more modern middleware architecture, and smaller bundle size.
**Consequences:**
- Benefit: Strong TypeScript types, clean middleware pipeline, active community, good documentation.
- Trade-off: grammY's long-polling default means the bot cannot receive webhook-style push updates without explicit configuration (the project explicitly removes webhooks on startup to enforce long-polling).

---

## ADR-002: Long Polling over Webhooks

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** Telegram bots can receive updates via webhooks (HTTP push) or long polling (pull). The bot runs locally alongside OpenCode with no public inbound ports.
**Decision:** The bot uses long polling exclusively. On startup, any existing webhook is detected and removed (`bot.api.deleteWebhook()`), then `bot.start()` is called without webhook configuration.
**Alternatives Considered:**
- Webhooks — would require a publicly reachable HTTPS endpoint, adding infrastructure complexity (reverse proxy, TLS certificates).
**Consequences:**
- Benefit: No inbound ports or TLS needed; works on any machine with outbound internet access.
- Trade-off: Slightly higher latency than webhooks; the bot must maintain a persistent connection to Telegram's servers.

---

## ADR-003: Single-User Design with Telegram User ID Whitelist

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** The bot provides direct access to a local OpenCode server, including filesystem operations and shell command execution. Multi-user support would require permission isolation, project scoping, and conflict resolution.
**Decision:** The bot operates in single-user mode. Access is controlled by a whitelist of allowed Telegram user IDs (`TELEGRAM_ALLOWED_USER_IDS`). Messages from non-whitelisted users are silently ignored by the `authMiddleware`.
**Alternatives Considered:**
- Multi-user with role-based access — would add significant complexity (per-user sessions, project isolation, permission matrices).
- Telegram group bot — would require handling group privacy modes and message routing.
**Consequences:**
- Benefit: Simple security model; no risk of cross-user data leakage; minimal state management.
- Trade-off: Only one authorized user can operate the bot. A "simple user" mode exists for restricted users with limited commands (`/new`, `/abort`, `/help`).

---

## ADR-004: In-Memory State Managers with JSON File Persistence

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** The bot needs to persist settings (current project, session, model, pinned message ID, scheduled tasks, cost history) across restarts without requiring a database.
**Decision:** A hybrid approach: runtime state is held in in-memory managers (singleton classes with `Map<number, State>` keyed by chat ID), and persistence is handled by serializing to `settings.json` on disk. Writes are queued via a promise chain (`settingsWriteQueue`) to prevent concurrent write corruption.
**Alternatives Considered:**
- SQLite — already a dependency (`better-sqlite3`) but used only for the BullMQ queue backend, not for application state.
- Redis — used only for BullMQ job queue, not for application state.
- Full database (PostgreSQL) — overkill for a single-user tool.
**Consequences:**
- Benefit: Zero database setup; human-readable settings file; simple backup (copy one file).
- Trade-off: No ACID transactions; race conditions possible if multiple processes write simultaneously; the write queue mitigates this but does not provide rollback.

---

## ADR-005: Centralized Command Definitions in `definitions.ts`

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** Bot commands need to be registered with Telegram's `setMyCommands` API and also handled by individual command handler functions. Duplicating command lists across files leads to drift.
**Decision:** All commands are defined in a single `src/bot/commands/definitions.ts` file as `BotCommandI18nDefinition[]` with i18n keys for descriptions. The same source is used for both `setMyCommands` and command handler registration. Commands are localized via the `t()` function.
**Alternatives Considered:**
- Per-file command registration — each command module declares its own metadata, then a scanner aggregates them.
- Hardcoded command lists in the bot initialization file.
**Consequences:**
- Benefit: Single source of truth; adding a command requires updating only one file; descriptions are automatically localized.
- Trade-off: The definitions file does not auto-register handlers — each command must still be manually wired in `src/bot/index.ts`.

---

## ADR-006: SSE Event Subscription with Exponential Backoff Reconnection

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** OpenCode emits real-time events (tool calls, message deltas, session status) via Server-Sent Events. The connection can drop due to network issues, OpenCode restarts, or server-side timeouts.
**Decision:** The `subscribeToEvents()` function in `src/opencode/events.ts` maintains a persistent SSE connection with automatic reconnection using exponential backoff (base 1s, max 15s). The event stream is processed via `for await...of` with `setImmediate()` yields to prevent blocking the Node.js event loop and allow grammY to process Telegram updates between SSE events.
**Alternatives Considered:**
- Polling the OpenCode API at intervals — would increase latency and API load.
- WebSocket — OpenCode only exposes SSE for event streaming.
**Consequences:**
- Benefit: Near-real-time event delivery; resilient to transient failures; does not block Telegram update processing.
- Trade-off: Complex reconnection logic; the `setImmediate()` pattern is a manual event-loop yield that could be fragile under heavy event load.

---

## ADR-007: Summary Aggregator as Event-to-Telegram Translation Layer

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** OpenCode SSE events are low-level and verbose (individual tool call states, message part deltas, token counts). Telegram messages have length limits (4096 chars) and require specific formatting (MarkdownV2 escaping).
**Decision:** A `SummaryAggregator` class (`src/summary/aggregator.ts`) acts as a central event processor. It maintains per-message state, accumulates text deltas, deduplicates tool events via hash tracking, and emits high-level callbacks (`onComplete`, `onPartial`, `onTool`, `onQuestion`, etc.). The bot layer subscribes to these callbacks and formats output for Telegram.
**Alternatives Considered:**
- Direct SSE-to-Telegram mapping — each SSE event triggers a Telegram message. Would produce spammy, fragmented output.
- Template-based formatting — less flexible for streaming partial updates.
**Consequences:**
- Benefit: Clean separation between event processing and Telegram delivery; supports streaming partial updates; deduplicates redundant events.
- Trade-off: The aggregator is a large class (1100+ lines) with many callback types; adding new event types requires modifying both the aggregator and the bot subscriber.

---

## ADR-008: Pinned Status Message Pattern for Session Visibility

**Status:** Accepted
**Date:** 2024 (mid project)
**Context:** Users need at-a-glance visibility into the current session state (project, model, context usage, changed files, cost) without issuing commands.
**Decision:** A single pinned message in the Telegram chat serves as a live status dashboard. The `PinnedMessageManager` (`src/pinned/manager.ts`) tracks the message ID in `settings.json` and updates it in response to SSE events (token usage, cost changes, file diffs). The message ID survives bot restarts.
**Alternatives Considered:**
- Periodic status messages — would flood the chat with redundant information.
- Inline keyboard-only status — less visible, requires user interaction.
**Consequences:**
- Benefit: Always-visible status; zero user interaction required; survives restarts.
- Trade-off: Telegram rate limits on message edits; the pinned message can only be updated so frequently; if the pinned message is deleted by the user, the manager must recreate it.

---

## ADR-009: Single Active Interaction Flow with Guard Middleware

**Status:** Accepted
**Date:** 2024 (mid project)
**Context:** The bot supports multiple interactive flows (session selection, project switching, question answering, permission requests, rename, task creation, command browsing). If multiple flows are active simultaneously, user input becomes ambiguous.
**Decision:** The `InteractionManager` (`src/interaction/manager.ts`) enforces a "one active flow at a time" policy. Each flow registers with a `kind` and `expectedInput` type. The `interactionGuardMiddleware` blocks unrelated input with a contextual hint. Only utility commands (`/help`, `/status`, `/abort`) are allowed during active interactions. Flows do not expire automatically — they wait for explicit completion (answer, cancel, `/abort`).
**Alternatives Considered:**
- Concurrent flows with input routing — complex to implement and confusing for users.
- Timeout-based flow expiration — could interrupt legitimate user actions.
**Consequences:**
- Benefit: Predictable user experience; no ambiguous input handling; simple mental model for users.
- Trade-off: Users cannot multitask (e.g., check status while answering a question); flows that never complete block all other input until `/abort` is used.

---

## ADR-010: BullMQ + Redis for Scheduled Task Queue

**Status:** Accepted
**Date:** 2025 (mid project)
**Context:** The `/task` command allows users to schedule coding tasks for future execution. Tasks need reliable persistence, retry logic, and deferred delivery of results to Telegram.
**Decision:** BullMQ (`bullmq` + `ioredis`) is used as the task queue backend with Redis for persistence. A custom `ScheduledTaskStore` (`src/scheduled-task/store.ts`) manages task definitions (cron-like schedules), while BullMQ handles execution timing and worker processing. The `TelegramBotApi` abstraction allows deferred message delivery when the bot is not directly in the execution context.
**Alternatives Considered:**
- `node-cron` with in-memory scheduling — no persistence across restarts; no retry logic.
- Simple `setTimeout`-based scheduling — not durable; no job monitoring.
- Database-backed job queue — adds a new dependency and operational complexity.
**Consequences:**
- Benefit: Durable task persistence; built-in retry and failure handling; worker-based execution isolation.
- Trade-off: Requires a running Redis instance; if Redis is unavailable, the worker falls back gracefully but scheduled tasks cannot execute.

---

## ADR-011: External STT API for Voice Transcription

**Status:** Accepted
**Date:** 2025 (mid project)
**Context:** Users want to send voice/audio messages from Telegram and have them transcribed into text prompts for OpenCode. Running a local Whisper model requires significant GPU resources.
**Decision:** Voice transcription is delegated to an external Whisper-compatible API (OpenAI, Groq, Together, or any compatible provider). The `SttClient` (`src/stt/client.ts`) downloads the audio file from Telegram, sends it to the configured STT endpoint, and returns the transcribed text. Configuration is via environment variables (`STT_API_URL`, `STT_API_KEY`, `STT_MODEL`, `STT_LANGUAGE`).
**Alternatives Considered:**
- Local Whisper model — requires GPU, adds significant resource requirements.
- Telegram's built-in transcription — only available in Telegram Premium and not accessible via the Bot API.
**Consequences:**
- Benefit: No local GPU required; works on any machine; configurable provider.
- Trade-off: Requires an external API key and internet access; transcription latency depends on the provider; audio files must be uploaded to the STT service.

---

## ADR-012: OpenCode Server Process Management from Within the Bot

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** Users may want to start and stop the OpenCode server (`opencode serve`) directly from Telegram without SSH access to the machine.
**Decision:** The `ProcessManager` (`src/process/manager.ts`) spawns and manages the OpenCode server process as a child process. Process state (PID, start time) is persisted in `settings.json`. The `/opencode_start` and `/opencode_stop` commands provide user-facing controls. An `OpenCodeWatchdog` (`src/monitoring/opencode-watchdog.ts`) monitors the server health and can auto-restart it on crash (configurable via `OPENCODE_WATCHDOG_ENABLED`).
**Alternatives Considered:**
- Systemd-managed OpenCode server — more robust but requires system-level configuration.
- External process manager (PM2, supervisord) — adds operational dependencies.
**Consequences:**
- Benefit: Full lifecycle control from Telegram; no external tooling required; watchdog provides crash recovery.
- Trade-off: The bot process owns the OpenCode child process; if the bot crashes, the OpenCode server may become orphaned; process management is platform-dependent (Windows vs. Linux differences).

---

## ADR-013: TypeScript Strict Mode with ESLint + Prettier

**Status:** Accepted
**Date:** 2024 (early project)
**Context:** The project needed a code quality baseline to ensure maintainability, catch errors at compile time, and enforce consistent formatting.
**Decision:** TypeScript strict mode is enabled (`"strict": true` in `tsconfig.json`). ESLint with `@typescript-eslint` handles linting, and Prettier handles formatting. The CI/development workflow requires `npm run build`, `npm run lint`, and `npm test` to pass.
**Alternatives Considered:**
- JavaScript with JSDoc type annotations — less robust type checking.
- Biome — faster but less mature TypeScript rule set at the time of decision.
**Consequences:**
- Benefit: Compile-time type safety; consistent code style; catches common errors before runtime.
- Trade-off: Stricter type annotations increase initial development time; some OpenCode SDK types require workarounds (e.g., type assertions for event properties).

---

## ADR-014: i18n via Module-Based Locale Files

**Status:** Accepted
**Date:** 2024 (mid project)
**Context:** The bot serves users in multiple languages. User-facing strings (commands, messages, error texts) need localization without duplicating logic.
**Decision:** Each locale is defined as a TypeScript module (`src/i18n/en.ts`, `src/i18n/ru.ts`, `src/i18n/de.ts`, etc.) exporting a flat key-value object. The `t()` function resolves keys at runtime using the configured `BOT_LOCALE`. Locale normalization handles fallback (e.g., `de-AT` → `de` → `en`). Currently supported: English, Russian, German, French, Spanish, Chinese, Bosnian.
**Alternatives Considered:**
- `i18next` library — more features (pluralization, interpolation, namespaces) but adds a dependency.
- JSON-based locale files — would require runtime file I/O and lack TypeScript type checking.
**Consequences:**
- Benefit: Zero external i18n dependency; TypeScript type checking for keys (via `I18nKey` type); locale files are simple and easy to edit.
- Trade-off: No built-in pluralization or date formatting; adding a new language requires creating a full module copy; the `t()` function is a simple key lookup without advanced formatting.

---

## ADR-015: Response Streaming via Draft Messages and Edit Throttling

**Status:** Accepted
**Date:** 2025 (mid project)
**Context:** OpenCode responses can be long and take time to generate. Users benefit from seeing partial progress rather than waiting for the complete response.
**Decision:** When `RESPONSE_STREAMING=true` (default), the bot uses Telegram's `sendMessageDraft` API for live typing indicators and the `ResponseStreamer` class (`src/bot/streaming/response-streamer.ts`) for incremental message edits. Edits are throttled at 200ms intervals to respect Telegram rate limits. A 3800-character text limit prevents overflow during streaming.
**Alternatives Considered:**
- Send complete response only — poor UX for long-running tasks.
- Send periodic partial messages — would flood the chat with multiple messages.
**Consequences:**
- Benefit: Users see real-time progress; single message is edited in place; respects Telegram rate limits.
- Trade-off: `sendMessageDraft` is a relatively new Telegram API feature; fallback to non-streaming mode is needed for older clients; the 3800-character limit may truncate very long responses during streaming.
