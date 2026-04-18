# OpenCode Outpost

> A Telegram bot client for [OpenCode](https://opencode.ai) — run and monitor coding tasks from your phone.

**Fork of [grinev/opencode-telegram-bot](https://github.com/grinev/opencode-telegram-bot)** by Ruslan Grinev, significantly expanded with multi-user support, task queues, sandboxing, and 35 commands.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

<p align="center">
  <img src="assets/screencast.gif" width="45%" alt="OpenCode Telegram Bot screencast" />
  <img src="assets/Screenshot-1.png" width="45%" alt="OpenCode Telegram Bot screenshot 1" />
  <img src="assets/Screenshot-2.png" width="45%" alt="OpenCode Telegram Bot screenshot 2" />
  <img src="assets/Screenshot-3.png" width="45%" alt="OpenCode Telegram Bot screenshot 3" />
</p>

## Features

- Multi-user access control with role-based permissions
- BullMQ + Redis task queue for scheduled background tasks
- Bubblewrap execution sandboxing for shell commands
- 35 commands including /shell, /sandbox, /fe, /cost, /tts
- Streaming responses with live draft updates
- Voice transcription via Whisper-compatible APIs
- Text-to-speech replies
- Inline mode commands (@bot feynman: explain X)
- 7 locales (en, de, es, fr, ru, zh, bs)
- Proxy support (SOCKS5, HTTP/HTTPS)
- MarkdownV2 rendering with remark-gfm

## Commands

35 commands organized by function:

### Session & Project
| Command | Description |
| ------- | ----------- |
| `/new` | Start a new session |
| `/sessions` | List all cached sessions |
| `/projects` | List all projects |
| `/status` | Show current session status |
| `/abort` | Abort the current task |
| `/stop` | Stop OpenCode |
| `/rename` | Rename the current session |
| `/messages` | Show session messages |

### Task Execution
| Command | Description |
| ------- | ----------- |
| `/task` | Queue a background task |
| `/tasklist` | List pending tasks |
| `/compact` | Request prompt compaction |
| `/steer` | Steer the current task |

### Local Operations
| Command | Description |
| ------- | ----------- |
| `/shell` | Execute bash in sandbox |
| `/ls` | List directory contents |
| `/read` | Read file contents |
| `/fe` | File explorer |
| `/logs` | Show process logs |
| `/health` | Show system health |
| `/journal` | Show journal telemetry |
| `/sandbox` | Show sandbox status |
| `/export` | Export session data |

### Browsing & Selection
| Command | Description |
| ------- | ----------- |
| `/skills` | Manage skills |
| `/mcps` | Manage MCP servers |
| `/models` | Switch LLM models |
| `/commands` | List available commands |

### Bot Control
| Command | Description |
| ------- | ----------- |
| `/start` | Start the bot |
| `/help` | Show help |
| `/opencode_start` | Start OpenCode server |
| `/opencode_stop` | Stop OpenCode server |
| `/cost` | Show token cost |
| `/tts` | Text-to-speech reply |

### Inline Commands (via @bot)
Type in any chat: `@botname <command>: <query>`

| Command | Description |
| ------- | ----------- |
| `summarise:` | Summarize text to bullet points |
| `eli5:` | Explain like I'm 5 |
| `deep-research:` | Deep research with sources |
| `steel-man:` | Strongest argument FOR position |
| `feynman:` | Feynman technique explanation |
| `devil's-advocate:` | Argue opposite position |

## Prerequisites

- Node.js 20+
- Redis
- OpenCode CLI
- Telegram Bot Token
- (Optional) API keys for STT/TTS providers

## Installation

### 1. Get Telegram Bot Token & Enable Inline Mode

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` command
3. Follow prompts: name your bot, choose username (must end in `bot`)
4. BotFather sends token: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
5. **Enable Inline Mode:** Send `/setinline` to BotFather, select your bot, enter placeholder text (e.g., "Type your query...")
6. Save token — you'll need it in `.env`

**Group Support:** Add bot to groups and type `@botname ` (with space) to see 6 inline command options.

### 2. Install OpenCode CLI

```bash
# Install via npm (recommended)
npm install -g @opencode-ai/cli

# Or download from https://opencode.ai
# Verify installation
opencode --version
```

### 3. Clone and Setup

```bash
git clone https://github.com/anini39/opencode-outpost.git
cd opencode-outpost
npm install
cp .env.example .env
```

### 4. Configure Environment

Edit `.env` file:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_token_from_botfather
TELEGRAM_ALLOWED_USER_IDS=your_telegram_user_id
OPENCODE_MODEL_PROVIDER=opencode
OPENCODE_MODEL_ID=big-pickle

# Optional: Speech-to-Text (for voice messages)
STT_API_URL=https://api.openai.com/v1
STT_API_KEY=your_openai_key

# Optional: Text-to-Speech
TTS_ENABLED=true
TTS_API_URL=https://api.openai.com/v1
TTS_API_KEY=your_openai_key
```

**Get your Telegram User ID:** Message [@userinfobot](https://t.me/userinfobot)

**Group Chat Setup:**
1. Add bot to your group
2. Get group chat ID: Send `/chatid` in group (or check message details)
3. Add to `.env`: `TELEGRAM_ALLOWED_CHAT_IDS=-1001234567890`
4. **Note:** All allowed users can use bot in group. Responses visible to all members.

### Multi-Chat Setup

By default, the bot operates in **single-chat mode** — one private DM per user. To run multiple concurrent chats (e.g., separate sessions for different projects), you must use **Telegram groups**.

**How it works:**
- Each chat (DM or group) gets its own independent session with separate context and history
- `MAX_CONCURRENT_CHATS` (default: 3) limits active chats per user
- Inactive chats auto-close after 5 minutes

**Step-by-step:**

1. **Disable Privacy Mode** (required for groups):
   - Message [@BotFather](https://t.me/BotFather)
   - Send `/setprivacy`
   - Select your bot → choose **Disable**
   - This allows the bot to read all messages in groups (not just commands)

2. **Create groups and add the bot:**
   - Create **Group A** in Telegram (e.g., "Project Alpha")
   - Add your bot as a member
   - Promote bot to **Admin** (required for message editing and file access)
   - Repeat for **Group B** (e.g., "Project Beta")

3. **Get group chat IDs:**
   - Send `/status` in each group — the bot will show the chat ID
   - Or add [@userinfobot](https://t.me/userinfobot) to the group temporarily

4. **Update `.env`:**
   ```env
   # Allowed chat IDs (comma-separated, groups start with -100)
   TELEGRAM_ALLOWED_CHAT_IDS=-1001234567890,-1009876543210

   # Max concurrent active chats per user (default: 3)
   MAX_CONCURRENT_CHATS=3
   ```

5. **Restart the bot** for changes to take effect.

**Example setup for 3 concurrent chats:**

| Chat | Type | Session |
|------|------|---------|
| Private DM | Direct message to bot | Personal tasks |
| Group A | Telegram group with bot | Project Alpha |
| Group B | Telegram group with bot | Project Beta |

Each chat maintains its own session. Switch between them freely — the bot tracks context independently per chat.

**API Providers for STT/TTS:**
- OpenAI: https://platform.openai.com/api-keys
- Groq: https://console.groq.com/keys
- Together AI: https://api.together.xyz/settings/api-keys

See `.env.example` for all 41 supported environment variables.

## Deployment

### Start services

```bash
# Terminal 1: Start Redis
redis-server
# Or: systemctl start redis

# Terminal 2: Start OpenCode
opencode serve

# Terminal 3: Run the bot
npm run build
npm run dev
```

### Systemd service example

```ini
[Unit]
Description=OpenCode Telegram Bot
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

## Security

See [SECURITY.md](SECURITY.md) for access control, sandboxing, and environment sanitization details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and commit conventions.

## License

MIT License

Forked from [grinev/opencode-telegram-bot](https://github.com/grinev/opencode-telegram-bot) by Ruslan Grinev.
