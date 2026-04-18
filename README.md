# OpenCode Telegram Bot (Production Edition)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

OpenCode Telegram Bot is a **production-grade, multi-user Telegram client** for the [OpenCode](https://opencode.ai) CLI that runs locally on your machine.
This fork significantly expands the capabilities of the original skeleton by bringing multi-chat processing, heavy concurrency scaling via BullMQ+Redis, Bubblewrap execution sandboxing, and a robust suite of system and file-interaction commands right to your chat.

Run AI coding tasks, monitor background progress, execute bash/git commands interactively, browse file systems, switch LLM models dynamically, and collaborate with secure bounded environments all from your phone.

<p align="center">
  <img src="assets/screencast.gif" width="45%" alt="OpenCode Telegram Bot screencast" />
</p>

## 🔥 Feature Highlights

- **Multi-Role User Architecture** — Securely handle requests from an array of allowed users rather than a single hardcoded ID. Defines granular roles ranging from `Super User` (auto-approval) to `Restricted`.
- **Advanced Concurrency Queue (BullMQ + Redis)** — Handles parallel processing reliably and safely. Run heavy scheduled and background tasks smoothly without UI blocking, allowing dynamic session recovery.
- **Bubblewrap Execution Sandboxing** — System commands and file integrations executed via Telegram are bound to isolated sandboxes ensuring zero host-system breakout vulnerabilities.
- **System & File Management Layer** — Full system toolkit added mapping directly to your session context. Directly manage directories with `/fe` (File Explorer), check journal telemetry with `/journal`, and view repository tree details.
- **Git Integration** — Advanced branching, commit evaluation, and repository tracking right through Telegram (`/diff`, `/branch`, `/commit`).
- **Live Streaming Sub-system** — High-end event sourcing tracks OpenCode responses and renders contextual UI meters, tracking token cost, active pinned status panels, streaming draft arrays, and intelligently batching tool executions.
- **Voice Transcription + STT** — Fully supports speech recognition by transcribing Whisper-compatible API calls (OpenAI/Groq/Together) directly to intelligent OpenCode task objectives.
- **Localized Internationalization** — Complete translation schema covering English, Deutsch, Español, Français, Русский, 简体中文, and Bosnian (`bs`).

---

## 🛠 Prerequisites & Dependencies

To host and manage this advanced bot environment, ensure you have:
- **Node.js 20+**
- **Redis Server** (Extremely critical requirement for BullMQ background synchronization)
- **OpenCode** (installed globally either via Web UI or GitHub source)
- **Telegram Bot Token** (Provided by [@BotFather](https://t.me/BotFather))

## 🚀 Installation & Setup

1. **Obtain Telegram Tokens:**
   Create a bot with [@BotFather](https://t.me/BotFather) and receive your API Token. Reach out to [@userinfobot](https://t.me/userinfobot) to get your numerical system ID.

2. **Launch Redis + OpenCode Local Service:**
   Since this orchestrates production-level queues, Redis must be bound:
   ```bash
   # Ensure your Redis instance is running locally 
   systemctl start redis
   
   # Boot up your OpenCode listener on default port 4096
   opencode serve
   ```

3. **Install & Run from Source:**
   Clone this repo and bind the environment variables.
   ```bash
   git clone https://github.com/your-username/opencode-telegram-bot.git
   cd opencode-telegram-bot
   
   npm install
   
   # Duplicate the robust environment schema
   cp .env.example .env
   ```
   > ⚠️ Edit `.env` and assign your `REDIS_URL`, `TELEGRAM_BOT_TOKEN`, and crucially, arrays for `TELEGRAM_ALLOWED_USER_IDS` and any `TELEGRAM_SUPER_USER_IDS`.

4. **Verify TypeScript & Start up:**
   ```bash
   # Confirm zero compilation errors
   npm run build
   
   # Run the development daemon
   npm run dev
   ```

## 📚 Core Commands Reference (34 Total)

This suite offers 34 comprehensive commands scaling far beyond basic integrations. Highlights include:

### Essential Bot Interfacing
| Command           | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `/start`          | Initialize engine bindings                              |
| `/status`         | Advanced health visualization and pinned state polling  |
| `/sessions`       | Browse and restore cached project intervals             |
| `/projects`       | Hot-Swap active environments                            |
| `/task`           | Queue up a scheduled background execution block         |

### Technical Execution & Diagnostics
| Command           | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `/fe`             | Interactive file explorer and browser within Telegram   |
| `/shell`          | Execute bash within the Bubblewrap bound sandbox        |
| `/ls` / `/read`   | Interactively visualize isolated directory/file scopes  |
| `/logs`           | Expose detailed process telemetry                       |
| `/diff`           | Compare remote Git indexes                              |
| `/commit`         | Interactively evaluate/push Git records                 |
| `/sandbox`        | View Bubblewrap binding isolations                      |

### Agent Tiers & Setup
| Command           | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `/skills`         | Setup or inject specific custom AI contexts             |
| `/mcps`           | Inject Model Context Protocol external servers dynamically|
| `/models`         | Adjust OpenCode LLMs between favorites and recents      |
| `/compact`        | Request prompt compaction dynamically to save tokens    |

---

## 🔒 Security Posture

Unlike the original templates, this version incorporates military-grade perimeter checks out-of-the-box:
1. **Multi-layer Whitelisting:** Access controls filter purely off numerical `userid` assignments preventing bypass spoofing.
2. **Directory Isolation:** Interactive bot tool executions strictly invoke through `path-validation` limiting directory traversal possibilities on the host filesystem.
3. **Environment Sanitization:** Automated redacting scrubs host SECRETS out of any stdout terminal outputs before displaying them to any Telegram chat screens.

## 🤝 Contribution Guidelines
Ensure your developments run correctly over our expanded CI layers. Follow conventional commits for branches (e.g. `feat/...` or `fix/...`). Run `npm run lint` and `npm run build` locally prior to opening PRs. 

## 📜 License
[MIT](LICENSE) (Built expanding upon original work licensed under `MIT` implicitly referencing [@grinev])
