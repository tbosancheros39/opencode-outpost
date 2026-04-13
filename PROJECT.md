# Project Guidelines: opencode-telegram-bot

Technical reference for AI agents working on this project.

## Project Overview

**opencode-telegram-bot** is a Telegram bot that acts as a mobile client for OpenCode. It enables users to run and monitor coding tasks on a local machine through Telegram.

### Core Concept

The bot is designed as a **single OpenCode CLI window in Telegram**:

- Primary mode is private chat (DM) with the bot
- Single active interaction context for reliable flows
- Reply keyboard as a core UX feature
- No group-first usage, parallel multi-session, or multi-user support (see [CONCEPT.md](./CONCEPT.md))

### Target Usage

1. User works on a project locally with OpenCode (Desktop/TUI)
2. Finishes local session and leaves computer
3. Later, connects via Telegram while away
4. Chooses existing session or creates new one
5. Sends coding tasks and receives progress updates
6. Receives completed responses asynchronously

### Key Features

- OpenCode server control from Telegram (`/opencode_start`, `/opencode_stop`, `/status`)
- Project and session management (`/projects`, `/sessions`, `/new`)
- Remote task execution and interruption (`/abort`)
- Interactive question and permission handling
- Live pinned session status (project, model, context usage)
- Model, agent, variant, and context controls via keyboard
- Scheduled task creation and execution (`/task`, `/tasklist`)
- Voice/audio transcription via Whisper-compatible APIs
- Image, PDF, and text file attachment support
- Response streaming with markdown formatting
- System monitoring (journal, hardware sentinel)

---

## Technology Stack

| Component       | Technology       | Version |
| --------------- | ---------------- | ------- |
| Language        | TypeScript       | 5.x     |
| Runtime         | Node.js          | >=20    |
| Package Manager | npm              | -       |
| Bot Framework   | grammY           | ^1.42.0 |
| OpenCode SDK    | @opencode-ai/sdk | ^1.4.1  |
| Menus           | @grammyjs/menu   | ^1.3.1  |
| Task Queue      | BullMQ           | ^5.73.2 |
| Database        | better-sqlite3   | ^12.8.0 |
| Redis           | ioredis          | ^5.10.1 |
| Test Framework  | Vitest           | ^4.1.4  |
| Linting         | ESLint           | ^8.57.1 |
| Formatting      | Prettier         | ^3.8.0  |

---

## Architecture

### Data Flow

```
Telegram User
    ↓
Telegram Bot (grammY)
    ↓
Managers + OpenCodeClient
    ↓
OpenCode Server (SSE Events)
    ↓
Event Listener → Summary Aggregator → Tool Managers
    ↓
Telegram Bot → Telegram User
```

### Components

| Layer            | Directory          | Purpose                                        |
| ---------------- | ------------------ | ---------------------------------------------- |
| Bot Layer        | `src/bot/`         | grammY setup, commands, handlers, middleware   |
| OpenCode Client  | `src/opencode/`    | SDK wrapper, SSE event subscription            |
| State Managers   | `src/*/manager.ts` | Per-chat state persistence                     |
| Summary Pipeline | `src/summary/`     | Event aggregation, Telegram formatting         |
| Process Manager  | `src/process/`     | OpenCode server lifecycle                      |
| Runtime          | `src/runtime/`     | Mode, paths, bootstrap                         |
| i18n             | `src/i18n/`        | Localized strings (en, de, es, fr, ru, zh, bs) |

### State Management

- **Per-chat state**: `Map<number, Settings>` in each manager
- **Persistence**: Settings saved to `settings.json`
- **Pattern**: `getCurrentXxx(chatId)` / `setCurrentXxx(chatId, value)`

Key managers:

- `src/session/manager.ts` - Current session
- `src/project/manager.ts` - Current project
- `src/settings/manager.ts` - Persistent settings
- `src/model/manager.ts` - Model selection
- `src/agent/manager.ts` - Agent selection
- `src/variant/manager.ts` - Model variant (temperature)
- `src/keyboard/manager.ts` - Reply keyboard state
- `src/pinned/manager.ts` - Pinned status message

---

## File Structure

```
src/
├── agent/              # Agent mode management
├── app/                # Application entry point
├── bot/
│   ├── commands/       # Slash command handlers (one per command)
│   ├── handlers/       # Callback and message handlers
│   ├── middleware/     # Auth, interaction guard, unknown command
│   ├── streaming/      # Response and tool call streaming
│   └── utils/          # Bot utilities (chunking, markdown, etc.)
├── cli/                # CLI argument parsing
├── config.ts           # Environment configuration
├── constants.ts        # Static constants
├── i18n/               # Localization files
├── interaction/        # Interaction state management
├── keyboard/           # Reply keyboard management
├── model/              # Model selection and capabilities
├── monitoring/         # System and journal monitoring
├── opencode/           # OpenCode SDK client and events
├── permission/         # Permission request handling
├── pinned/             # Pinned message management
├── process/            # OpenCode server process management
├── project/            # Project management
├── question/           # Question handling (agent questions)
├── queue/              # BullMQ task queue
├── rename/              # Session rename flow
├── runtime/            # Runtime mode and paths
├── safety/             # Safety utilities (sandbox, validators)
├── scheduled-task/     # Scheduled task execution
├── services/           # External services
├── session/            # Session management
├── settings/           # Settings persistence
├── stt/                # Speech-to-text client
├── summary/            # Event aggregation and formatting
├── task-queue/         # Task tracking for persistence
├── users/              # User access control
├── utils/              # General utilities (logger, error format)
└── variant/            # Model variant management

tests/                  # Mirror src/ structure
├── helpers/            # Test utilities
└── setup.ts            # Vitest setup
```

---

## Code Patterns

### Manager Pattern

```typescript
// src/settings/manager.ts
const currentSettingsByChat: Map<number, Settings> = new Map();

function getSettings(chatId: number): Settings {
  let settings = currentSettingsByChat.get(chatId);
  if (!settings) {
    settings = {};
    currentSettingsByChat.set(chatId, settings);
  }
  return settings;
}

export function getCurrentProject(chatId: number): ProjectInfo | undefined {
  return getSettings(chatId).currentProject;
}

export function setCurrentProject(chatId: number, projectInfo: ProjectInfo): void {
  const settings = getSettings(chatId);
  settings.currentProject = projectInfo;
  void writeSettingsFile(settings);
}
```

### Command Pattern

Commands are defined in `src/bot/commands/definitions.ts`:

```typescript
const BOT_COMMANDS: BotCommandI18nDefinition[] = [
  { command: "status", descriptionKey: "cmd.description.status" },
  { command: "new", descriptionKey: "cmd.description.new" },
  { command: "abort", descriptionKey: "cmd.description.stop" },
  // ... more commands
];
```

Each command has its own file in `src/bot/commands/`:

```typescript
// src/bot/commands/status.ts
export async function statusCommand(ctx: CommandContext<Context>) {
  const { data, error } = await opencodeClient.global.health();
  // ... implementation
}
```

### i18n Pattern

```typescript
import { t } from "../i18n/index.js";

// Use with key and optional params
await ctx.reply(t("status.server_unavailable"));
await ctx.reply(t("status.line.model", { model: modelDisplay }));
```

### Logging Pattern

```typescript
import { logger } from "../utils/logger.js";

// Levels: debug, info, warn, error
logger.debug("[Component] Detailed diagnostics", { sessionId, messageId });
logger.info("[Component] Important event occurred");
logger.warn("[Component] Recoverable issue", error);
logger.error("[Component] Critical failure", error);

// NEVER use console.log/console.error directly
```

### Event Subscription Pattern

```typescript
// src/opencode/events.ts
export async function subscribeToEvents(directory: string, callback: EventCallback): Promise<void> {
  // Subscribe to SSE events
  const result = await opencodeClient.event.subscribe({ directory });

  for await (const event of result.stream) {
    // Yield to event loop before processing
    await new Promise<void>((resolve) => setImmediate(resolve));

    if (eventCallback) {
      setImmediate(() => eventCallback(event));
    }
  }
}
```

### Error Handling Pattern

```typescript
try {
  const { data, error } = await opencodeClient.session.create({ body: { title } });
  if (error || !data) {
    throw error || new Error("No data received");
  }
  // ... use data
} catch (error) {
  logger.error("[Component] Operation failed:", error);
  await ctx.reply(t("error.generic_message"));
}
```

---

## Testing

### Test Structure

Tests mirror the `src/` directory structure in `tests/`.

### Running Tests

```bash
npm test                  # Run all tests
npm run test:coverage     # Run with coverage report
```

### Test Patterns

```typescript
// tests/helpers/test-environment.ts
// Common test setup and utilities

// Example test file structure
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("ComponentName", () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it("should do something", async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Testing Guidelines

- Focus on critical paths, avoid over-testing trivial code
- Use `vi.mock()` for external dependencies
- Follow Arrange-Act-Assert pattern
- Test business logic, formatters, managers
- Mock OpenCode SDK calls

---

## Configuration

### Environment Variables

Configuration loaded from `.env` file (see `.env.example`):

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_USER_IDS=123456789
OPENCODE_MODEL_PROVIDER=anthropic
OPENCODE_MODEL_ID=claude-sonnet-4-20250514

# Optional
OPENCODE_API_URL=http://localhost:4096
TELEGRAM_PROXY_URL=socks5://proxy:1080
SESSIONS_LIST_LIMIT=10
PROJECTS_LIST_LIMIT=10
COMMANDS_LIST_LIMIT=10
TASK_LIMIT=10
BOT_LOCALE=en
SERVICE_MESSAGES_INTERVAL_SEC=5
HIDE_THINKING_MESSAGES=false
HIDE_TOOL_CALL_MESSAGES=false
RESPONSE_STREAMING=true
MESSAGE_FORMAT_MODE=markdown
CODE_FILE_MAX_SIZE_KB=100
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
STT_API_URL=https://api.openai.com/v1/audio/transcriptions
STT_API_KEY=your_key
STT_MODEL=whisper-large-v3-turbo
STT_LANGUAGE=en
```

### Runtime Modes

```typescript
// src/runtime/mode.ts
type RuntimeMode = "sources" | "compiled";

// Sources mode: Run directly with tsx
// Compiled mode: Run from dist/
```

### Config Loading

```typescript
// src/config.ts
export const config = {
  telegram: { token, allowedUserIds, proxyUrl },
  redis: { url },
  opencode: { apiUrl, username, password, model },
  server: { logLevel },
  bot: { sessionsListLimit, locale, ... },
  // ...
};
```

---

## Key Workflows

### Bot Startup

1. `src/index.ts` → `resolveRuntimeMode()` → `startBotApp()`
2. `src/app/start-bot-app.ts`:
   - Load settings from `settings.json`
   - Initialize managers (keyboard, pinned)
   - Create bot with middleware chain
   - Start BullMQ worker (if Redis available)
   - Subscribe to OpenCode events
   - Start system monitoring

### Message Flow

1. User sends text message
2. `authMiddleware` checks `TELEGRAM_ALLOWED_USER_IDS`
3. `interactionGuardMiddleware` checks for active interactions
4. If not a command, `processUserPrompt()` handles it
5. Prompt sent to OpenCode via SDK
6. SSE events received and aggregated
7. Response formatted and sent to Telegram

### Question Handling

1. Agent asks question → `question.asked` SSE event
2. `summaryAggregator.setOnQuestion()` callback
3. `questionManager.startQuestions()` creates poll
4. User votes on poll → callback query
5. `handleQuestionCallback()` sends answer via SDK

### Permission Handling

1. Agent needs permission → `permission.asked` SSE event
2. Check if super-user (auto-approve all)
3. Check if safe permission (auto-approve once)
4. Otherwise, show inline buttons for user decision
5. Send reply via `opencodeClient.permission.reply()`

### Response Streaming

1. `message.part.delta` events accumulate text
2. `ResponseStreamer` throttles edits (200ms)
3. Draft updates sent when available
4. On `message.updated` with completion:
   - Final message sent
   - Tokens tracked for context display
   - Cost recorded

---

## Critical Rules

1. **Commits**: Never create commits automatically. Commit only when explicitly asked by user.

2. **Git**: Follow Conventional Commits format. See [CONTRIBUTING.md](./CONTRIBUTING.md).

3. **Windows Compatibility**: Keep Windows runtime in mind. Use absolute paths. Avoid fragile one-liners.

4. **Language**:
   - Code, identifiers, comments in English
   - User-facing messages via i18n (`t()` function)

5. **Logging**: Use `logger` module. NEVER use `console.log`/`console.error` directly.

   ```typescript
   // Correct
   logger.info("[Component] Message");
   // Wrong
   console.log("Message");
   ```

6. **Error Handling**: Always use `try/catch` around async operations. Log errors with context.

7. **Bot Commands**: Update `definitions.ts` only. Never duplicate command lists.

8. **Interaction Model**: Only one interaction active at a time. Use `interactionGuardMiddleware`.

9. **State**: Per-chat Maps with `chatId` parameter. Persist via `writeSettingsFile()`.

10. **No Emojis**: In code, comments, or documentation unless explicitly requested.

---

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run bot (production)
npm start

# Run bot (development)
npm run dev

# Lint check
npm run lint

# Format code
npm run format

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Prepare release
npm run release:prepare
```

---

## Related Files

- [PRODUCT.md](./PRODUCT.md) - Product requirements and feature status
- [CONCEPT.md](./CONCEPT.md) - Project concept and boundaries
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [AGENTS.md](./AGENTS.md) - AI agent behavior rules

---

## Specific Patterns by Domain

### Session Management

```typescript
// Session info includes directory for OpenCode operations
interface SessionInfo {
  id: string;
  title: string;
  directory: string;
}

// Auto-resume last session for project
await autoResumeLastSession(chatId);
```

### Model Selection

```typescript
// Models come from OpenCode local state (favorites + recent)
// Display format: "🤖 provider/model"
const modelInfo = {
  providerID: string,
  modelID: string,
  variant?: string,  // temperature variant
};
```

### Pinned Message

```typescript
// Pinned status shows: project, model, context usage, changed files
pinnedMessageManager.initialize(api, chatId);
pinnedMessageManager.onMessageComplete(chatId, tokens);
pinnedMessageManager.onSessionDiff(chatId, diffs);
```

### Scheduled Tasks

```typescript
// Tasks stored in settings, executed by BullMQ worker
// Cron expressions and runtime execution
interface ScheduledTask {
  id: string;
  prompt: string;
  schedule: string; // cron expression
  nextRun: number;
  enabled: boolean;
}
```

### Keyboard Management

```typescript
// Reply keyboard shows: agent, model, context, variant
keyboardManager.initialize(api, chatId);
keyboardManager.updateContext(chatId, tokensUsed, tokensLimit);
const keyboard = keyboardManager.getKeyboard(chatId);
```
