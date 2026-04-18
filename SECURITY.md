# Security Policy

This document describes the security model, access controls, and best practices for the **OpenCode Telegram Bot**.

---

## Table of Contents

1. [Threat Model](#threat-model)
2. [Access Control](#access-control)
3. [Command Confirmation](#command-confirmation)
4. [Sandbox Behavior](#sandbox-behavior)
5. [Secret Handling](#secret-handling)
6. [Production Settings](#production-settings)
7. [Known Risks and Non-Goals](#known-risks-and-non-goals)
8. [Reporting Security Issues](#reporting-security-issues)

---

## 1. Threat Model

### Design Principles

The **OpenCode Telegram Bot** is designed as a **single-user, local-first** tool that acts as a mobile bridge to an OpenCode server running on your own machine. The security model is built around these assumptions:

- **Single User:** The bot is intended for individual use, not multi-tenant scenarios.
- **Local Server:** Both the bot and OpenCode server run on `localhost` or the same trusted local network.
- **Physical Access = Full Control:** If an attacker has access to the machine running the bot, they have full control (this is out of scope).
- **Long Polling (No Webhooks):** The bot uses Telegram's long polling, so no inbound ports are exposed.

### In-Scope Threats

1. **Unauthorized Telegram Access:** Malicious users sending commands to your bot.
2. **Credential Leakage:** Bot token or API keys exposed to child processes or logs.
3. **Path Traversal:** Commands like `/ls` or `/read` (future) accessing files outside intended directories.
4. **Shell Injection:** Untrusted input passed to shell commands.
5. **Remote OpenCode Server:** Connecting to a remote OpenCode instance without authentication.

### Out-of-Scope Threats

1. **Multi-User Isolation:** The bot is single-user by design. No user-to-user privilege separation.
2. **Local Machine Compromise:** If the machine is compromised, the attacker can read `.env` and control the bot.
3. **Telegram Platform Security:** We trust Telegram's end-to-end encryption and user authentication.
4. **DDoS/Rate Limiting:** The bot is for personal use, not public-facing services.

---

## 2. Access Control

### User and Chat Allowlists

Access is controlled via two environment variables:

```bash
# Required: Comma-separated list of Telegram user IDs
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321

# Optional: Comma-separated list of Telegram chat/group IDs
TELEGRAM_ALLOWED_CHAT_IDS=-1001234567890
```

**How It Works:**

1. **User ID Check:**  
   The bot verifies `ctx.from.id` against `TELEGRAM_ALLOWED_USER_IDS`.  
   - **Private chats:** User ID must be in the allowlist.  
   - **Group chats:** Both user ID and chat ID are checked.

2. **Chat ID Check (Groups Only):**  
   If the message is from a group, `ctx.chat.id` must be in `TELEGRAM_ALLOWED_CHAT_IDS`.  
   - **Use case:** Allow the bot in specific group chats while restricting individual users.

3. **Implementation:**  
   See `src/bot/middleware/auth.ts` (lines 9-35).

**Security Notes:**

- **Empty Allowlists:** If `TELEGRAM_ALLOWED_USER_IDS` is empty, the bot will not respond to **anyone** (startup warning shown).
- **Group Chat Bug (Fixed in P1-6):** Line 27 of `auth.ts` previously had a bug where user IDs were checked against chat IDs. This is now fixed.

---

## 3. Command Confirmation

Dangerous operations require **explicit user confirmation** via Telegram inline keyboards:

### Commands Requiring Confirmation

- **`/sandbox <command>`** - Execute arbitrary shell commands in a sandbox
- **`/shell <command>`** - Execute arbitrary shell commands (no sandbox)
- **`/abort`** - Stop an in-progress OpenCode session

### Confirmation Flow

1. User sends a dangerous command (e.g., `/sandbox rm -rf /tmp/test`)
2. Bot sends an inline keyboard: `[✅ Confirm] [❌ Cancel]`
3. User clicks `✅ Confirm` → command executes
4. User clicks `❌ Cancel` → command aborted

**Implementation:**  
See `src/permission/manager.ts` and `src/bot/handlers/permission.ts`.

**Security Benefit:**  
Prevents accidental or malicious command execution from:
- Inline query suggestions
- Forwarded messages
- Bot API injection attacks

---

## 4. Sandbox Behavior

The bot supports two sandbox modes for command execution:

### 4.1. Bubblewrap Sandbox (Default)

When `bubblewrap` is installed on the system:

- **Isolated Filesystem:** Read-only access to system directories, writable `/tmp`
- **No Network Access:** `--unshare-net` flag
- **Cleared Environment:** `--clearenv` flag strips all environment variables
- **Re-injected Safe Vars:** `PATH`, `HOME`, `LANG`, etc. are added back

**Configuration:**  
See `src/safety/sandbox.ts` (lines 48-174).

**Recommended Install (Linux):**
```bash
sudo apt install bubblewrap  # Debian/Ubuntu
sudo dnf install bubblewrap  # Fedora
```

### 4.2. Fallback Mode (runDirect)

When `bubblewrap` is not available:

- **No Filesystem Isolation:** Commands run with full filesystem access
- **Environment Sanitization:** `sanitizeEnv()` strips sensitive variables (see below)
- **Basic Security:** No network/process isolation

**When This Happens:**
- Windows systems (bubblewrap not available)
- `bubblewrap` binary not found in `PATH`

**User Warning:**  
The bot logs a warning on startup if bubblewrap is unavailable.

### 4.3. Environment Sanitization

All child processes (both sandbox modes) use `sanitizeEnv()` to strip sensitive variables:

**Blocked Variables (Stripped):**
```typescript
SENSITIVE_ENV_VARS = [
  "TELEGRAM_BOT_TOKEN",
  "STT_API_KEY",
  "OPENCODE_SERVER_PASSWORD",
];
// Plus all variables matching: *_API_KEY, *_SECRET, *_TOKEN
```

**Allowed Variables (Preserved):**
```typescript
ALLOWED_ENV_VARS = [
  "PATH", "HOME", "USER", "TMPDIR", "LANG",
  "SHELL", "TERM", "COLORTERM", "NODE_ENV"
];
```

**Implementation:**  
See `src/safety/env-sanitizer.ts` (lines 7-52).

**Verification:**
```bash
# In Telegram: /sandbox env
# Verify TELEGRAM_BOT_TOKEN is NOT visible
# Verify PATH, HOME are still visible
```

---

## 5. Secret Handling

### Environment Variables

All secrets are stored in `.env` and loaded via `dotenv`:

```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
STT_API_KEY=your-speech-to-text-api-key
OPENCODE_SERVER_PASSWORD=your-opencode-password
```

**Security Practices:**

1. **.env Protection:**  
   - **Permissions:** `.env` should be `0600` (readable only by owner)
   - **Git Ignore:** `.env` is in `.gitignore` (never commit secrets)
   - **Template:** Use `.env.example` as a template (no secrets)

2. **Never Logged:**  
   - `TELEGRAM_BOT_TOKEN` is never logged (logger redacts it)
   - API keys are never printed in error messages

3. **Never Transmitted:**  
   - Secrets are not sent to Telegram (not in messages or inline keyboards)
   - OpenCode prompts do not include secrets

4. **Child Process Isolation:**  
   - `sanitizeEnv()` ensures child processes cannot access secrets

---

## 6. Production Settings

### 6.1. Remote OpenCode Server (Discouraged)

The bot **can** connect to a remote OpenCode server, but this is **strongly discouraged** for security reasons:

**If You Must Use a Remote Server:**

```bash
OPENCODE_API_URL=https://your-server.example.com:4096
OPENCODE_SERVER_PASSWORD=strong-random-password
```

**Risks:**
- **Man-in-the-Middle:** Ensure HTTPS with valid TLS certificates
- **Credential Theft:** If the remote server is compromised, your password is exposed
- **Data Leakage:** Session data (code, prompts, files) is sent over the network

**Startup Warning:**  
The bot warns on startup if `OPENCODE_API_URL` is remote but `OPENCODE_SERVER_PASSWORD` is not set.

**Recommended:** Run OpenCode locally on `localhost:4096`.

---

### 6.2. Redis Configuration (BullMQ)

If using Redis for background task queues:

**Memory Limits (Production):**
```bash
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
```

**Why This Matters:**
- **Without `maxmemory`:** Redis can consume all available RAM, causing OOM crashes
- **Without `maxmemory-policy`:** Redis refuses new jobs when full (breaks task scheduling)
- **`allkeys-lru`:** Least-recently-used eviction across all keys (recommended for job queues)

**Job Retention (BullMQ):**
```typescript
// src/queue/types.ts (lines 41-48)
removeOnComplete: {
  count: 100,  // Keep last 100 completed jobs
  age: 86400,  // Delete after 24 hours
},
removeOnFail: {
  count: 500,  // Keep last 500 failed jobs
  age: 604800, // Delete after 7 days
}
```

**Startup Check:**  
The bot warns on startup if Redis is configured but unreachable.

---

### 6.3. Systemd Service Hardening

When deploying as a systemd service, use the provided templates:

**Service Files:**
- `opencode-telegram-bot.service`
- `opencode-serve.service`

**Security Hardening (Recommended):**
```ini
[Service]
# Drop privileges (not implemented yet - run as dedicated user)
User=opencode-bot
Group=opencode-bot

# Restrict filesystem access
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/opencode-bot/.local/share/opencode-telegram-bot

# Restrict capabilities
NoNewPrivileges=true
CapabilityBoundingSet=
```

**Note:** The current templates do not include these hardening options. Consider adding them for production deployments.

---

## 7. Known Risks and Non-Goals

### Known Risks

1. **Local Access = Full Control:**  
   If an attacker has shell access to the machine running the bot, they can:
   - Read `.env` and steal the bot token
   - Modify the bot code
   - Access the SQLite database (`settings.json`, task queue DB)
   - **Mitigation:** Secure the host system (SSH keys, firewall, user permissions)

2. **Group Chat Authorization:**  
   If the bot is added to a group chat:
   - **All group members** can see bot responses (including session outputs)
   - **All allowed users** can control the bot (no user-to-user isolation)
   - **Mitigation:** Only add the bot to trusted group chats with `TELEGRAM_ALLOWED_CHAT_IDS`

3. **SQLite Concurrency:**  
   The bot uses SQLite for task scheduling and settings storage:
   - **WAL mode enabled** for better concurrency
   - **Single writer** at a time (BullMQ + scheduled tasks + settings manager)
   - **Risk:** Rare race conditions under heavy load
   - **Mitigation:** Use Redis (BullMQ) for high-concurrency task queuing

4. **Path Traversal (Partial Mitigation):**  
   - `validateAndCanonicalizePath()` exists but is **not yet integrated** into `/ls` or `/read` commands
   - **Current Status:** Path validation infrastructure ready, integration pending
   - **Timeline:** Future work (marked in `SubAgentsAndFinalImplementation.md`)

---

### Non-Goals (Intentional Limitations)

1. **Multi-User Support:**  
   The bot is **single-user by design**. No plans for:
   - Per-user session isolation
   - User-specific OpenCode projects
   - Role-based access control (admin/user/guest)

2. **Public Bot Deployment:**  
   The bot is **not designed for public use** (e.g., adding `@YourBot` to random chats). No plans for:
   - Rate limiting per user
   - Usage quotas
   - Abuse prevention
   - DDoS protection

3. **Audit Logging:**  
   The bot does **not log user commands** for audit purposes:
   - **Logs:** Operational events (session start/stop, errors)
   - **Not Logged:** User prompts, command arguments, file contents
   - **Rationale:** Privacy-first design (no centralized audit trail)

4. **Encrypted Storage:**  
   `settings.json` and SQLite databases are **not encrypted at rest**:
   - **Rationale:** Assumes secure host system (full-disk encryption at OS level)
   - **Not Planned:** Application-level encryption

---

## 8. Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT open a public GitHub issue**
2. **Email:** security@opencode-telegram-bot.dev
3. **Include:**
   - Vulnerability description
   - Steps to reproduce
   - Affected versions
   - Suggested fix (if applicable)

**Response Time:**  
We aim to acknowledge security reports within **48 hours** and provide a fix timeline within **7 days**.

**Disclosure Policy:**  
We follow **coordinated disclosure**:
- Fix developed and tested privately
- Security advisory published after fix is released
- Reporter credited (unless they prefer anonymity)

---

## Summary of Security Controls

| Threat | Mitigation | Status |
|--------|------------|--------|
| Unauthorized Telegram access | User/chat allowlists | ✅ Implemented |
| Credential leakage to child processes | `sanitizeEnv()` | ✅ Implemented |
| Shell injection | Command confirmation + input validation | ✅ Implemented |
| Path traversal | `validateAndCanonicalizePath()` | ⚠️  Infrastructure ready, not integrated |
| Remote server without auth | Startup warnings | ✅ Implemented |
| Redis OOM crashes | Documentation (maxmemory-policy) | ✅ Documented |
| Group chat auth bypass | Fixed chat ID validation bug | ✅ Fixed (P1-6) |
| Multi-user isolation | Not supported (by design) | ⚠️  Non-goal |

---

**Last Updated:** 2026-04-17 (P1+P2 Security Hardening)  
**Maintained By:** OpenCode Telegram Bot Contributors  
**Version:** 0.14.0
