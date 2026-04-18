# Concept

This document defines the current product concept and boundaries for OpenCode Telegram Bot.

## Vision

OpenCode Telegram Bot is designed as a **single OpenCode CLI window in Telegram**.

The goal is to provide a simple, reliable, mobile-friendly way to run and monitor OpenCode workflows from Telegram while keeping behavior predictable.

The bot supports text prompts, voice messages, photo and document attachments, streaming responses with live updates, and a persistent bottom keyboard for quick access to model, agent mode, and variant selection.

## Core Concept

- Primary mode is private chat (DM) with the bot.
- The bot favors a single active interaction context for reliable flows.
- Telegram UI is used intentionally, including the bottom reply keyboard as a core UX feature.
- Inline keyboards and callback queries handle multi-step interactions (menus, questions, permissions).
- Super users (configured via `TELEGRAM_SUPER_USER_IDS`) get automatic approval for permission requests.

## Interaction Model

### Prompt Flow
- Text messages are treated as prompts for OpenCode when no blocking interaction is active.
- Voice and audio messages are transcribed via Whisper-compatible STT API and sent as prompts.
- Photos, PDFs, and documents can be attached to prompts (model must support input).

### Response Delivery
- Assistant responses are streamed with live draft updates.
- Tool calls and file changes are batched and delivered periodically.
- Long responses are split across multiple Telegram messages.
- Code files are sent as documents when they exceed text limits.

### Interactive Flows
- Questions from the agent are presented with inline button options plus custom text answer.
- Permission requests show allow/always/reject buttons (auto-approved for super users).
- Context compaction, session rename, and command execution use inline menus.
- Only one interactive flow can be active at a time; unrelated input is blocked with a hint.

### Inline Mode Commands
- The bot supports inline queries via `@bot <command>:<args>` syntax (e.g., `@bot feynman: explain recursion`).
- Available inline commands: `summarise`, `eli5`, `deep_research`, `steel_man`, `feynman`, `devils_advocate`.
- Slash commands bypass Telegram Group Privacy Mode, so the bot receives them without needing @mention.

## Commands

The bot provides 34 commands organized by function:

**Session & Project Management:**
`/new`, `/sessions`, `/projects`, `/status`, `/abort`, `/stop`, `/rename`, `/messages`

**Task Execution:**
`/task`, `/tasklist`, `/compact`, `/steer`

**Local Operations:**
`/shell`, `/ls`, `/read`, `/logs`, `/health`, `/journal`, `/sandbox`, `/export`

**Browsing & Selection:**
`/skills`, `/mcps`, `/models`, `/commands`

**Bot Control:**
`/start`, `/help`, `/opencode_start`, `/opencode_stop`, `/cost`

Model, agent mode, variant, and context actions are available from the persistent bottom keyboard rather than as commands.

## Non-Goals (for now)

The following are intentionally out of scope at this stage:

- Group-first usage model as primary interaction design
- Parallel multi-session operation across multiple forum topics/threads
- Per-user project restrictions and access control (infrastructure exists but not enforced)
- Full forum-thread orchestration as a primary interaction design

You can try fork of this project which supports topics and parallel execution: https://github.com/shanekunz/opencode-telegram-group-topics-bot

## Why This Direction

This direction is intentional and practical:

- It keeps behavior predictable and easier to stabilize.
- It reduces race conditions in interactive flows (questions, permissions, confirmations).
- It preserves the main UX pattern (reply keyboard plus a compact command surface).
- It avoids over-expanding slash commands and fragmented inline-only navigation.

Telegram limits are also a practical constraint for thread-heavy parallel usage:

- About 1 message per second per chat
- About 20 messages per minute in groups
- About 30 messages per second for bulk broadcasts (without paid broadcast)

Source: https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this

## Architecture Highlights

- **Event streaming**: SSE subscription to OpenCode with summary aggregation and batching.
- **Scheduled tasks**: BullMQ queue with Redis for deferred prompt execution.
- **Response streaming**: Live draft message updates during agent generation.
- **State management**: Per-chat keyboard state, interaction guards, and pinned status messages.
- **Multi-user infrastructure**: Supports `TELEGRAM_ALLOWED_USER_IDS` (comma-separated) and `TELEGRAM_SUPER_USER_IDS` for permission auto-approval.

## Current Priorities

The project priorities are intentionally long-term and concept-aligned:

- Keep the bot stable and behavior predictable in daily use
- Expand functionality within the current concept boundaries
- Improve test coverage and maintainability for safe iteration
- Evolve the architecture without changing the core interaction model

## Change Policy

If a proposal changes this concept (for example, making group threads a primary mode), open an issue/discussion first and wait for maintainer alignment before implementation.

## Revisit Conditions

This concept can be revisited later after major stability, test, and architecture milestones are completed.
