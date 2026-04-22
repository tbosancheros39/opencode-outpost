# Windows Setup Guide

> Running OpenCode Outpost on Windows? Here are your options, from easiest to hardest.

## Option 1: Docker (Recommended)

The easiest way to run OpenCode Outpost on Windows. No Node.js, Python, or build tools needed.

### Prerequisites

- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) (includes WSL2 backend)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### Steps

1. **Install Docker Desktop** — Download from https://www.docker.com/products/docker-desktop/ and enable WSL2 backend during setup.

2. **Clone the repository:**
   ```bash
   git clone https://github.com/tbosancheros39/opencode-outpost.git
   cd opencode-outpost
   ```

3. **Create your `.env` file:**
   ```bash
   copy .env.example .env
   ```
   Edit `.env` and set at minimum:
   - `TELEGRAM_BOT_TOKEN` — from @BotFather
   - `TELEGRAM_ALLOWED_USER_IDS` — your Telegram user ID
   - `OPENCODE_MODEL_PROVIDER` — e.g., `opencode`
   - `OPENCODE_MODEL_ID` — e.g., `big-pickle`

4. **Start the services:**
   ```bash
   docker compose up -d
   ```
   This starts Redis and the bot. View logs with `docker compose logs -f bot`.

5. **Start OpenCode locally** (outside Docker):
   ```bash
   opencode serve
   ```
   The bot connects to OpenCode at `http://localhost:4097` by default.

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

SQLite databases and task data are stored in `./data/` on the host, mounted into the container at `/app/.data/`. This data survives container restarts.

---

## Option 2: WSL2 (Native Linux Environment)

WSL2 runs a real Linux kernel inside Windows. `npm install` works flawlessly because it's actually running in Ubuntu.

### Prerequisites

- Windows 10 version 2004+ or Windows 11
- [WSL2 installed](https://learn.microsoft.com/en-us/windows/wsl/install)

### Steps

1. **Install WSL2** (if not already installed):
   ```powershell
   wsl --install
   ```
   Restart your computer when prompted.

2. **Open a WSL2 terminal** (Ubuntu):

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

5. **Install build tools** (for better-sqlite3):
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
- Use Windows Terminal for the best experience
- VS Code has built-in WSL2 support: install the [Remote - WSL extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl)

---

## Option 3: Native Windows (Not Recommended)

Running directly on Windows CMD/PowerShell is possible but requires extra setup for the `better-sqlite3` native module.

### Prerequisites

- Node.js 20+ (from https://nodejs.org/)
- Python 3 (from https://www.python.org/downloads/ — check "Add to PATH" during install)
- Visual Studio Build Tools:
  1. Download from https://visualstudio.microsoft.com/visual-cpp-build-tools/
  2. Install the **"Desktop development with C++"** workload
  3. This provides the C++ compiler (`cl.exe`) that `better-sqlite3` needs

### Steps

1. **Verify build tools:**
   ```powershell
   node -v        # Should be v20+
   python --version  # Should be 3.x
   cl             # Should show Microsoft C/C++ Optimizing Compiler
   ```

2. **Install Redis for Windows:**
   - Download from https://github.com/tporadowski/redis/releases
   - Or use Memurai: https://www.memurai.com/
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
→ Visual Studio Build Tools are not installed or not in PATH. Reinstall with "Desktop development with C++" workload.

**`npm install` fails with `gyp ERR! find Python`**
→ Python is not in PATH. Reinstall Python and check "Add to PATH" during installation.

**`better-sqlite3` compilation error**
→ Ensure you have both Python 3 AND Visual Studio Build Tools with C++ workload. This is the #1 Windows issue.

**Redis won't start**
→ Use Memurai (Windows-native Redis) or run Redis in Docker: `docker run -d -p 6379:6379 redis:7-alpine`

---

## Line Ending Issues

This project enforces LF line endings via `.gitattributes` and `.editorconfig`. If you see weird diff output or shell script failures on Windows:

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

All 643 tests run in Node.js (no browser required). Works on Windows, WSL2, and Docker.

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
| Native Windows | Hard | Native | Users who can't use Docker or WSL2 |