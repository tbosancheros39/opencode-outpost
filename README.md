# OpenCode Outpost

> The Telegram bot for [OpenCode](https://opencode.ai) that I actually wanted to use.

<p align="center">
  <a href="https://www.npmjs.com/package/@tbosancheros39/opencode-outpost">
    <img src="https://img.shields.io/npm/v/@tbosancheros39/opencode-outpost" alt="npm version">
  </a>
  <a href="https://github.com/tbosancheros39/opencode-outpost/actions/workflows/ci.yml">
    <img src="https://github.com/tbosancheros39/opencode-outpost/actions/workflows/ci.yml/badge.svg" alt="CI">
  </a>
  <a href="https://github.com/tbosancheros39/opencode-outpost/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js">
  </a>
</p>

## Demo

<p align="center">
  <img src="https://s13.gifyu.com/images/bq1wN.md.gif" width="280" alt="OpenCode Outpost demo 1">
  <img src="https://s13.gifyu.com/images/bq1wH.md.gif" width="280" alt="OpenCode Outpost demo 2">
  <img src="https://s13.gifyu.com/images/bq1wI.gif" width="280" alt="OpenCode Outpost demo 3">
</p>

### Screenshots

<p align="center">
  <img src="assets/screenshot1.jpg" width="280" alt="Screenshot 1">
  <img src="assets/screenshot2.jpg" width="280" alt="Screenshot 2">
  <img src="assets/screenshot3.jpg" width="280" alt="Screenshot 3">
</p>

---

## Why this exists (and why I forked it)

There's already a great Telegram bot for OpenCode, built by [grinev](https://github.com/grinev/opencode-telegram-bot). It works perfectly if you're one person, on one machine, and you don't mind staring at your phone while a long task runs.

That wasn't quite what I needed.

I wanted to use this with a couple of friends in a group chat without our conversations getting tangled. I wanted to fire off a big refactor and then close Telegram for an hour while it churned in the background. And I wanted a bit more confidence that when OpenCode runs a shell command, it's not going to accidentally wander into my `~/.ssh` folder.

So I forked it and built **OpenCode Outpost**. It's the same core idea — control OpenCode from your phone — with a few extra layers for people who want to share, queue, and sandbox their way through the day.

If you're happy with a simple, personal remote, the original is still fantastic. But if you want a bot that can handle a bit more chaos, this fork might be your thing.

### What's different?

| What I added | Why |
|--------------|-----|
| **Multi-user access** | Because I'm not the only one who uses my homelab. You can set roles (super, simple, restricted) and drop the bot into a Telegram group. Everyone gets their own isolated session. |
| **Task queue (BullMQ + Redis)** | I got tired of waiting. Give the bot a long-running task and it goes into a queue. You can close Telegram, go to sleep — the bot will process it and tell you when it's done. |
| **Bubblewrap sandboxing** | Shell commands run in a sandbox. By default, it blocks access to `~/.ssh`, `~/.aws`, and the network. It's not bulletproof, but it's better than nothing. |
| **Knowledge base** | Pin files to context, search across them, save snapshots of sessions, and resume later. Your context survives restarts. |
| **More commands (40 total)** | Things like a file explorer (`/fe`), git operations (`/branch`, `/commit`, `/diff`), model switching (`/models`), and a handful of inline prompts (`@bot eli5: ...`) that I actually use. |
| **Proxy support everywhere** | The original routes Telegram through a proxy. Outpost does that *and* lets you proxy the OpenCode server connection and any external API calls the AI makes. Useful if you're bouncing through a tunnel. |

---

## Table of Contents

- [Features](#features)
- [Commands](#commands)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Skills](#skills)
- [Multi-chat setup](#multi-chat-setup)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Deployment](#deployment)
- [Security](#security)
- [Community](#community)
- [License](#license)

---

## Features

- **Multi-user with roles** — Give different people different levels of access. Super users bypass all restrictions. Each chat (DM or group) gets its own isolated session.
- **Background task queue** — Long jobs don't block the chat. Queue them with `/task` and check back later. Supports one-time and recurring (cron) schedules.
- **Sandboxed shell** — Commands run inside `bubblewrap`. Your SSH and AWS keys are off-limits. Network access is blocked unless you explicitly allow it.
- **Knowledge base** — Pin files to session context (`/pin`), search across them (`/find`), save snapshots (`/snapshot`), and resume later (`/resume`).
- **Voice transcription** — Send a voice note, it gets transcribed via Whisper-compatible APIs (OpenAI, Groq, Together).
- **Text-to-speech replies** — Toggle it on with `/tts` and the bot speaks back.
- **Inline mode** — `@YourBotName eli5: explain quantum computing` in any chat.
- **7 languages** — English, German, Spanish, French, Russian, Chinese, Bosnian.
- **Proxy support** — SOCKS5, HTTP/HTTPS for Telegram, OpenCode, and external API calls.
- **MarkdownV2 rendering** — Code blocks, tables, syntax highlighting.
- **40 commands** — A lot, but you'll probably only use 15 of them regularly.
- **Auto-restart watchdog** — If the OpenCode server crashes, the bot notices and tries to bring it back up.

---

## Commands

Here's the full list, organised by what they do. Don't panic — you don't need to memorise all of them.

### Session & Project
| Command | What it does |
|---------|--------------|
| `/new` | Start a new session (fresh context) |
| `/sessions` | See previous sessions |
| `/projects` | List your projects |
| `/status` | Show current session and server info |
| `/abort` | Kill the current task |
| `/rename` | Rename the session |
| `/messages` | Show conversation history |
| `/snapshot` | Save session state to the knowledge base |
| `/resume` | Restore from a snapshot |

### Task Execution
| Command | What it does |
|---------|--------------|
| `/task` | Queue a background task (supports cron scheduling) |
| `/tasks` | List recent prompt tasks |
| `/tasklist` | List scheduled tasks |
| `/compact` | Ask OpenCode to compact context and free tokens |
| `/steer` | Nudge or redirect the current task |
| `/digest` | Summarise recent activity |

### Local Operations
| Command | What it does |
|---------|--------------|
| `/shell` | Run a bash command in the sandbox |
| `/ls` | List a directory |
| `/read` | Read a file |
| `/fe` | File explorer (very handy) |
| `/find` | Search for files by name |
| `/logs` | Show process logs |
| `/health` | System health check |
| `/journal` | Telemetry dump from systemd journal |
| `/sandbox` | Sandbox status |
| `/export` | Export session data |

### Git
| Command | What it does |
|---------|--------------|
| `/branch` | Show or switch branch |
| `/commit` | Create a commit |
| `/diff` | Show changes |

### Browsing & Selection
| Command | What it does |
|---------|--------------|
| `/skills` | Manage skills |
| `/mcps` | Manage MCP servers |
| `/models` | Switch LLM models |
| `/pin` | Pin files to context |
| `/commands` | List all commands |

### Bot Control
| Command | What it does |
|---------|--------------|
| `/start` | Start the bot |
| `/help` | Show help |
| `/opencode_start` | Start OpenCode server remotely |
| `/opencode_stop` | Stop OpenCode server |
| `/cost` | Token usage cost |
| `/tts` | Toggle spoken replies on/off |

### Inline Commands (any chat)

Type `@YourBotName command: your query`

| Command | What it does |
|---------|--------------|
| `summarise:` | Bullet-point summary |
| `eli5:` | Explain like I'm five |
| `deep-research:` | Research with sources |
| `steel-man:` | Steel-man an argument |
| `feynman:` | Feynman technique |
| `devil's-advocate:` | Argue the opposite |

---

## Quick Start

### What you need

- **Node.js 20+** — [download](https://nodejs.org/)
- **Redis** — `apt install redis` (Linux) or `brew install redis` (macOS)
- **OpenCode CLI** — `npm install -g @opencode-ai/cli` or from [opencode.ai](https://opencode.ai/)

### 1. Get a Telegram bot token

1. Chat with [@BotFather](https://t.me/BotFather)
2. `/newbot` → pick a name → pick a username (must end in `bot`)
3. Copy the token.
4. **Enable inline mode:** `/setinline` → choose bot → enter placeholder text.
5. Find your user ID: message [@userinfobot](https://t.me/userinfobot)

### 2. Start OpenCode server

```bash
opencode serve
```

### 3. Run the bot

**Option 1: npx (no install)**

```bash
npx @tbosancheros39/opencode-outpost
```

It'll walk you through setup the first time.

**Option 2: Global install**

```bash
npm install -g @tbosancheros39/opencode-outpost
opencode-outpost
```

**Option 3: From source**

```bash
git clone https://github.com/tbosancheros39/opencode-outpost.git
cd opencode-outpost
npm install
cp .env.example .env
# Edit .env with your details
npm run dev
```

**Option 4: Docker**

```bash
git clone https://github.com/tbosancheros39/opencode-outpost.git
cd opencode-outpost
cp .env.example .env
# Add your token and user ID
docker compose up -d
```

If you're on Windows, check [README-Windows.md](README-Windows.md) for extra notes.

---

## Configuration

Edit the `.env` file. Here are the essentials:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_ALLOWED_USER_IDS=your_telegram_user_id
OPENCODE_MODEL_PROVIDER=opencode
OPENCODE_MODEL_ID=big-pickle

# Optional — voice transcription (Whisper)
STT_API_URL=https://api.openai.com/v1
STT_API_KEY=your_key

# Optional — spoken replies
TTS_ENABLED=true
TTS_API_URL=https://api.openai.com/v1
TTS_API_KEY=your_key
```

There are 41 variables in total. The full list is in `.env.example`.

### Multi-user roles

| Role | What they can do |
|------|------------------|
| **super** | Everything. Bypasses all restrictions and auto-approves permissions. Set via `TELEGRAM_SUPER_USER_IDS`. |
| **simple** | Normal usage. Some sensitive commands need approval. |
| **restricted** | Limited commands. Cannot run shell or modify files without approval. |

### Group chat setup (brief)

1. Add the bot to your group.
2. Get the chat ID: send `/chatid` in the group (or use `@userinfobot` temporarily).
3. Add it to `.env`: `TELEGRAM_ALLOWED_CHAT_IDS=-1001234567890`
4. Disable privacy mode via BotFather: `/setprivacy` → choose bot → Disable.

See the [Multi-chat setup](#multi-chat-setup) section for a full walkthrough.

### Model providers

OpenCode supports 75+ providers. The bot connects to your local OpenCode server (`opencode serve`), which handles the actual provider connections. Set your provider and model in `.env`:

```bash
OPENCODE_MODEL_PROVIDER=anthropic
OPENCODE_MODEL_ID=claude-sonnet-4-5
ANTHROPIC_API_KEY=your_key
```

Popular providers: OpenCode (free + paid), Anthropic, OpenAI, Google, Groq, DeepSeek, Together, OpenRouter, xAI, and local models via Ollama/LM Studio.

See `.env.example` for the full provider table.

---

## Skills

OpenCode loads skills from `~/.config/opencode/skills/`. I've included a zip of useful skills in `assets/skills.zip`.

> **Warning:** Loading every skill at once is a sure way to blow up your context window. Just pick the ones you actually use.

### Video Demo — All Available Skills

<p align="center">
  <a href="https://www.youtube.com/watch?v=YOUR_VIDEO_ID">
    <img src="https://img.shields.io/badge/Video-Skills%20Demo-red?logo=youtube" alt="Watch Skills Demo on YouTube">
  </a>
</p>

> 📹 **See all 40+ commands in action** — the video walks through every skill, from file exploration (`/fe`) to inline prompts (`@bot eli5:`), git operations, and multi-user session management.

```bash
# Extract a specific skill
unzip assets/skills.zip "skill-name/*" -d ~/.config/opencode/skills/

# Only do this if you know what you're doing
unzip assets/skills.zip -d ~/.config/opencode/skills/
```

---

## Multi-chat setup

By default, Outpost gives each user one private session. If you want separate sessions for different projects — or you want to use it with other people — you need to use Telegram groups.

Each group gets its own isolated session. You can switch between them just by jumping into a different chat.

### Step-by-step

1. **Turn off privacy mode** (required for groups):
   - Message @BotFather
   - Send `/setprivacy`
   - Choose your bot → Disable

2. **Create your groups:**
   - Group A (e.g., "Work Project")
   - Group B (e.g., "Side Hustle")
   - Add your bot to each group and promote it to **Admin** (so it can edit messages and read files).

3. **Get the chat IDs:**
   - Send `/status` in each group — it'll show the ID.
   - Groups IDs start with `-100`.

4. **Update your `.env`:**
   ```env
   TELEGRAM_ALLOWED_CHAT_IDS=-1001234567890,-1009876543210
   MAX_CONCURRENT_CHATS=3   # default is 3
   ```

5. **Restart the bot.**

Now you can talk to the bot in each group, and it'll keep the context completely separate.

---

## Troubleshooting

### Bot doesn't respond
- Double-check `TELEGRAM_ALLOWED_USER_IDS` in `.env`. It should be your numeric ID, not your username.
- Verify the bot token.
- Is the bot actually running? Check the console or `journalctl`.

### "OpenCode not available"
- Run `opencode serve` or try `/opencode_start` from Telegram.
- Check `OPENCODE_API_URL` (default: `http://localhost:4097`).

### Redis errors
- Make sure Redis is running: `redis-server` or `systemctl start redis`.
- Test with `redis-cli ping` → should say `PONG`.

### No models showing
- Add models to OpenCode's favourites: open the OpenCode TUI, choose a model, press `Ctrl+F` / `Cmd+F`.
- Check your `.env` — `OPENCODE_MODEL_PROVIDER` and `OPENCODE_MODEL_ID` must be set to something that exists.

### Voice / TTS not working
- Enable TTS with `/tts` command.
- Confirm `TTS_API_URL` and `TTS_API_KEY` are set.
- Make sure your provider billing is active.

---

## FAQ

**Do I have to use Redis?**
Yes. The task queue needs it. Install it — it's lightweight.

**Can I use this in a group with other people?**
Yes, that's one of the main reasons I built it. See [Multi-chat setup](#multi-chat-setup).

**Will this work without the OpenCode server running?**
No. You need `opencode serve` running somewhere. The bot IS a Telegram interface for OpenCode.

**What if Redis goes down?**
The task queue falls back to an in-memory FIFO queue. You won't lose tasks, but they won't survive a restart.

---

## Deployment

If you want this running 24/7, here's a basic systemd unit:

```ini
[Unit]
Description=OpenCode Outpost
After=network.target redis.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/opencode-outpost
ExecStart=/usr/bin/node dist/cli.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Save it to `/etc/systemd/system/opencode-outpost.service`, then `systemctl enable --now opencode-outpost`.

---

## Security

- **Sandboxing:** Shell commands run in a `bubblewrap` sandbox. By default, `~/.ssh`, `~/.aws`, and network access are blocked.
- **Path validation:** Prevents directory traversal and blocks access outside the project.
- **Env sanitization:** Sensitive environment variables are stripped before passing to OpenCode.
- **Rate limiting:** 30 messages per 60 seconds per user by default.
- **Command classification:** Potentially dangerous commands require confirmation.

It's not a security audit, but it's a decent set of guardrails for a dev tool.

---

## Community

Questions? Feedback?

- [GitHub Discussions](https://github.com/tbosancheros39/opencode-outpost/discussions)
- [GitHub Issues](https://github.com/tbosancheros39/opencode-outpost/issues)
- PRs welcome

## License

MIT License
