# Security

This isn't a security audit. It's an honest account of what Outpost does to reduce risk, what it doesn't cover, and what you should know before running it.

---

## The honest threat model

Outpost gives a Telegram chat a direct line to a machine running shell commands. That's the whole thing. The risk profile follows from that.

**What it protects against:**
- Strangers talking to your bot (allowlist-based access control)
- The AI wandering into sensitive directories (bubblewrap sandbox)
- One long-running command blocking everything else (task queue isolation)
- Accidental permission escalation in group chats (role system)

**What it doesn't protect against:**
- A compromised bot token — if someone gets it, they have access. Full stop.
- A compromised Telegram account belonging to an allowed user
- The OpenCode server itself doing something you didn't expect
- Running this on a machine you can't afford to lose

If your threat model includes a targeted attacker, this isn't the right tool. It's built for personal use and small trusted groups.

---

## Your bot token is a credential

Treat it like a private key. Don't paste it into chat, don't commit it to a public repo, don't put it in a `.env` that ends up in version control. If it leaks, revoke it immediately via [@BotFather](https://t.me/BotFather) — `/mybots` → choose bot → API Token → Revoke.

Anyone who has the token can impersonate the bot and, if your allowlist is misconfigured, could send commands to it.

---

## Access control

Access is controlled by `TELEGRAM_ALLOWED_USER_IDS` in `.env`. These are numeric Telegram user IDs. Usernames change; IDs don't. Use IDs.

For groups, `TELEGRAM_ALLOWED_CHAT_IDS` controls which group chats the bot responds in. If you skip this, any group the bot is added to can interact with it.

Three roles:

| Role | What it means |
|------|---------------|
| **super** | Set via `TELEGRAM_SUPER_USER_IDS`. Bypasses confirmations. Trust carefully. |
| **simple** | Normal access. Sensitive commands ask for confirmation first. |
| **restricted** | Can't run shell or modify files without a super user approving it. |

---

## The sandbox

Shell commands run inside a `bubblewrap` sandbox. By default it blocks:

- `~/.ssh`
- `~/.aws`
- Outbound network access from the sandboxed process

It's not a VM. It's not a container. It won't stop a determined local attacker — it's a guardrail against accidental damage and against the AI doing something dumb with your credentials. On Windows, bubblewrap doesn't run natively; WSL2 or Docker is the fallback.

You can tighten or loosen the sandbox via environment variables. The defaults are reasonable. If you open network access, know why.

---

## What gets stored locally

Outpost uses SQLite (via `better-sqlite3`) for session state and the knowledge base. It lives in `./data/` by default.

What's in there: conversation history, session snapshots, pinned files, task queue state.

What's not in there: your bot token, API keys, or credentials. Those stay in `.env`.

The database isn't encrypted at rest. If the machine is compromised, assume the session history is compromised too.

---

## Rate limiting

30 messages per 60 seconds per user, by default. Adjust via `RATE_LIMIT_*` env vars if you need to.

---

## Reporting a vulnerability

Open a [GitHub issue](https://github.com/tbosancheros39/opencode-outpost/issues) and mark it as a security report. If it's sensitive and you'd rather not post publicly, reach out via GitHub Discussions first and we can arrange a private channel.

No bounties, no SLA. But I'll read it and take it seriously.
