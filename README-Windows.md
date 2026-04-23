# Windows Setup Guide

> Running OpenCode Outpost on Windows? Here's the honest truth: Linux is the easy path. Windows works, but you'll need to jump through a few more hoops. I've laid them out from least painful to most painful.

## What you're actually setting up

Before we get into installers and command prompts, here's what this bot gives you once it's running:

- **40 Telegram commands** — everything from `/shell` and `/read` to `/snapshot` and `/steer`. You'll use about 15 regularly and forget the rest exist.
- **Multi-user support** — add it to a Telegram group and give your friends different access levels (super, simple, restricted). Each chat gets its own isolated session.
- **Background task queue** — fire off a long job, close Telegram, go make coffee. The bot queues it via BullMQ and Redis and tells you when it's done.
- **Knowledge base** — pin files to context, search across them with FTS5, save snapshots, resume later. Uses `better-sqlite3` under the hood (this matters for Windows — see Option 3).
- **Voice messages & TTS** — send voice notes, get transcribed. Toggle `/tts` and the bot talks back.
- **7 languages** — English, German, Spanish, French, Russian, Chinese, Bosnian.
- **Sandboxed shell** — commands run in a `bubblewrap` sandbox. On Windows, this only works inside WSL2 or Docker. Native Windows gets the fallback safety layer instead.
- **Scheduled tasks** — `/task` supports cron syntax. `"Run backup every day at 3am"` actually works.

---

## Option 1: Docker (Recommended)

The easiest way by far. No Node.js headaches, no Python build tools, no fighting with Visual Studio compilers.

### What you need

- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) with WSL2 backend enabled
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Steps

1. **Install Docker Desktop** — download, run the installer, and say yes when it asks about WSL2.

2. **Clone the repo:**
   ```bash
   git clone https://github.com/tbosancheros39/opencode-outpost.git
   cd opencode-outpost
   ```

3. **Create your `.env` file:**
   ```bash
   copy .env.example .env
   ```
   Edit it and set at minimum:
   - `TELEGRAM_BOT_TOKEN` — from @BotFather
   - `TELEGRAM_ALLOWED_USER_IDS` — your numeric Telegram user ID (message [@userinfobot](https://t.me/userinfobot) to get it)
   - `OPENCODE_MODEL_PROVIDER` — e.g., `opencode`
   - `OPENCODE_MODEL_ID` — e.g., `big-pickle`

4. **Start everything:**
   ```bash
   docker compose up -d
   ```
   This spins up Redis and the bot. Check logs with `docker compose logs -f bot`.

5. **Start OpenCode locally** (outside Docker, in another terminal):
   ```bash
   opencode serve
   ```
   The bot talks to OpenCode at `http://localhost:4097` by default.

### Stopping

```bash
docker compose down
```

### Rebuilding after code changes

```bash
docker compose build --no-cache bot
docker compose up -d
```

### Data persistence

SQLite databases and task queue data live in `./data/` on your host, mounted into the container at `/app/.data/`. They survive container restarts.

---

## Option 2: WSL2 (The Developer Route)

WSL2 runs a real Linux kernel inside Windows. This is my personal preference for development because `npm install` just works — it's actually Ubuntu doing the work.

### What you need

- Windows 10 version 2004+ or Windows 11
- [WSL2 installed](https://learn.microsoft.com/en-us/windows/wsl/install)

### Steps

1. **Install WSL2** (if you haven't already):
   ```powershell
   wsl --install
   ```
   Restart when it tells you to.

2. **Open a WSL2 terminal** (Ubuntu should be in your Start menu).

3. **Install Node.js 20+** inside WSL2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

4. **Install Redis:**
   ```bash
   sudo apt install redis-server
   sudo systemctl start redis-server
   ```

5. **Install build tools** (for `better-sqlite3`, which the knowledge base needs):
   ```bash
   sudo apt install python3 make g++
   ```

6. **Clone and run:**
   ```bash
   git clone https://github.com/tbosancheros39/opencode-outpost.git
   cd opencode-outpost
   npm install
   cp .env.example .env
   # Edit .env with your settings
   npm run dev
   ```

7. **Start OpenCode** in a separate terminal:
   ```bash
   opencode serve
   ```

### Tips

- Access Windows files from WSL2: `/mnt/c/Users/yourname/`
- Access WSL2 files from Windows: `\\wsl$\Ubuntu\home\`
- Use Windows Terminal — it's genuinely good.
- VS Code has built-in WSL2 support via the [Remote - WSL extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl).

---

## Option 3: Native Windows (Not Recommended)

I won't sugarcoat this: running directly on Windows CMD or PowerShell is possible, but `better-sqlite3` needs to compile native C++ code, and that means installing Visual Studio Build Tools. Most people give up here. If Docker or WSL2 are options for you, use those instead.

### What you need

- Node.js 20+ from [nodejs.org](https://nodejs.org/)
- Python 3 from [python.org](https://www.python.org/downloads/) — check "Add to PATH" during install
- Visual Studio Build Tools:
  1. Download from [visualstudio.microsoft.com/visual-cpp-build-tools/](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  2. Install the **"Desktop development with C++"** workload
  3. This gives you `cl.exe`, which `better-sqlite3` needs to compile

### Steps

1. **Verify your build tools are actually working:**
   ```powershell
   node -v        # Should be v20+
   python --version  # Should be 3.x
   cl             # Should show Microsoft C/C++ Optimizing Compiler
   ```

2. **Install Redis for Windows:**
   - [tporadowski/redis](https://github.com/tporadowski/redis/releases) — community port
   - Or [Memurai](https://www.memurai.com/) — commercial but stable
   - Start Redis before running the bot

3. **Clone and run:**
   ```powershell
   git clone https://github.com/tbosancheros39/opencode-outpost.git
   cd opencode-outpost
   npm install
   copy .env.example .env
   # Edit .env with your settings
   npm run build
   npm start
   ```

4. **Start OpenCode** in a separate terminal:
   ```powershell
   opencode serve
   ```

### Common Issues

**`npm install` fails with `gyp ERR! find VS`**
Visual Studio Build Tools aren't installed or aren't in your PATH. Reinstall with the "Desktop development with C++" workload.

**`npm install` fails with `gyp ERR! find Python`**
Python isn't in PATH. Reinstall and check "Add to PATH" during installation.

**`better-sqlite3` compilation error**
This is the #1 Windows issue. You need BOTH Python 3 AND Visual Studio Build Tools with the C++ workload. No shortcuts here.

**Redis won't start**
Use Memurai (Windows-native) or just run Redis in Docker:
```powershell
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Line Ending Issues

This project enforces LF line endings via `.gitattributes` and `.editorconfig`. If you see weird diff output or shell scripts breaking on Windows:

### Fix existing files

```bash
# In WSL2 or Git Bash:
git rm --cached -r .
git reset --hard
```

### Configure Git for Windows

```bash
# Prevent Git from converting LF to CRLF on checkout
git config --global core.autocrlf input
```

This tells Git: "Keep LF in the repo, convert to CRLF only on Windows checkout, then convert back to LF on commit." The `.gitattributes` file enforces LF for all source files regardless.

---

## Development on Windows

### Watch mode

```bash
npm run dev:watch
```

Uses `tsx watch` for automatic recompilation and restart on file changes. Works in WSL2 and native Windows.

### Running tests

```bash
npm test
```

All 703 tests run in Node.js (no browser required). Works on Windows, WSL2, and Docker.

### Docker Compose for development

```bash
# Start Redis only (run bot natively for faster iteration)
docker compose up -d redis

# Run bot natively
npm run dev
```

This gives you Redis in Docker while running the bot natively for faster hot-reload.

---

## Quick Reference

| Method | Difficulty | Performance | Recommended For |
|--------|-----------|-------------|-----------------|
| Docker | Easy | Good | Most users, production |
| WSL2 | Medium | Native | Developers |
| Native Windows | Hard | Native | Only if you can't use Docker or WSL2 |
