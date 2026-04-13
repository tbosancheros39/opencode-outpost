Research Summary: OpenCode Telegram Bot Enhancement Opportunities
Agent 1: Core Bot Features & UX (15 features identified)
Top Priority (P0):
- Edit Messages Instead of Replying — Clean up chat by editing a single status message instead of flooding with updates. Low effort, already partially implemented.
- Session Summarization (/summarize) — Uses existing SDK session.summarize() endpoint. Instant context recovery for long sessions.
- Message Revert/Undo (/undo) — Safety net via session.revert(). Add "↩️ Undo" button after responses.
High Value (P1):
- Prompt Templates (/templates) — Save/reuse prompt templates. Store in settings.json or SQLite.
- Interactive Model Selector — Paginated inline keyboard with cost tier indicators.
- Syntax-Highlighted Code Images — highlight.js + svg2png-wasm for mobile-readable code.
Notable (P2-P3):
- File browser (/browse), structured output (JSON schema), session cloning, voice commands, cost dashboard enhancement, Telegram Mini App dashboard, inline mode, reaction feedback, scheduled sessions.
---
Agent 2: Infrastructure & DevOps (8 improvements identified)
Top Priority (P0):
- BullMQ Production Config — Redis noeviction policy, graceful worker shutdown, auto-removal of completed jobs. Prevents data loss and crashes.
- Graceful Shutdown Handler — SIGTERM/SIGINT handling for bot polling, BullMQ, SQLite. 15s timeout with force exit.
High Value (P1):
- Systemd Hardening — ProtectSystem=strict, NoNewPrivileges, ProtectHome, RestrictNamespaces. Drops security score from ~7.6 to ~1.1.
- Docker Compose Deployment — Multi-stage builds, Redis + bot + OpenCode server in one stack. Volume management for settings.json/SQLite.
- CI Matrix Testing — Linux/macOS/Windows + Node 20/22 matrix, security audit, Docker image publishing to GHCR.
Notable (P2-P3):
- Health check endpoint (/health + /metrics), backup & recovery (systemd timer), Prometheus metrics (overkill for single-user), webhook migration (not recommended for current setup).
---
Agent 3: Security & Sandboxing (13 measures identified)
Top Priority (P0) — Quick Wins:
- Shell Injection Prevention — Replace /bin/sh -c with array-based spawn(). Critical vulnerability in current sandbox.ts.
- Environment Sanitization — Strip TELEGRAM_BOT_TOKEN, API keys from child process environments.
- Path Canonicalization — path.resolve() + symlink resolution + prefix validation for /ls and /read.
- systemd Hardening — Same as Agent 2, from security perspective.
High Value (P1):
- Seccomp Profiles — Restrict syscall surface for sandboxed commands (block ptrace, mount, bpf).
- Rate Limiting — Per-user command limits (10/min), max concurrent commands (3), command length caps, fork bomb detection.
- Temp File Security — mkdtemp + randomBytes for unpredictable names, 0o600 permissions, guaranteed cleanup.
- Command Allowlisting — Positive allowlist for restricted users instead of denylist-only.
Notable (P2-P3):
- Landlock filesystem sandboxing, audit logging with cryptographic chaining, network namespace controls, TLS certificate pinning, permission TTL expiry.
---
Consolidated Priority Roadmap
Phase	Focus	Key Items
Phase 1 (Immediate)	Security Quick Wins	Shell injection fix, env sanitization, path canonicalization, graceful shutdown
Phase 2 (Short-term)	Stability + UX	BullMQ production config, systemd hardening, session summarize, message undo, rate limiting
Phase 3 (Medium-term)	Features + DevOps	Docker compose, CI matrix, prompt templates, code image formatting, seccomp profiles
Phase 4 (Long-term)	Advanced	Mini App dashboard, Landlock sandboxing, audit logging, inline mode
