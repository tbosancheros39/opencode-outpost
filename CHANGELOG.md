# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [Unreleased]

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

### Security

- Multi-layer user ID whitelist with chat ID validation
- Environment variable sanitization (`sanitizeEnv()`) for child processes
- Command confirmation for dangerous operations (`/shell`, `/sandbox`)
- Bubblewrap sandbox with network isolation and read-only filesystem

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

- Initial fork from [grinev/opencode-telegram-bot](https://github.com/grinev/opencode-telegram-bot)
- Multi-user infrastructure (`TELEGRAM_ALLOWED_USER_IDS`, `TELEGRAM_SUPER_USER_IDS`)
- Group chat support (`TELEGRAM_ALLOWED_CHAT_IDS`)
- BullMQ + Redis integration for background task queues
- SQLite persistence for scheduled tasks and session cache

---

## Fork Origin

This project is a fork of [grinev/opencode-telegram-bot](https://github.com/grinev/opencode-telegram-bot)
by Ruslan Grinev, significantly expanded by Kerim (anini39).

**Original:** 14 commands, single-user, basic session management.
**Fork:** 34 commands, multi-user, BullMQ queue, sandboxing, Git ops, i18n, and more.
