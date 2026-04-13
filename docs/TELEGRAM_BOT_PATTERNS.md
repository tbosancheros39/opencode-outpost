# Telegram Bot Patterns

Comprehensive reference for Telegram UI patterns used in the opencode-telegram-bot project. This document catalogs every pattern, explains how it works, and provides reusable templates.

---

## Table of Contents

- [Pattern Catalog](#pattern-catalog)
- [Command Routing](#command-routing)
- [Inline Keyboard Patterns](#inline-keyboard-patterns)
- [Callback Query Handling](#callback-query-handling)
- [Interaction Flow Guards](#interaction-flow-guards)
- [Pinned Status Message](#pinned-status-message)
- [Persistent Bottom Keyboard](#persistent-bottom-keyboard)
- [Message Formatting](#message-formatting)
- [i18n Integration](#i18n-integration)
- [Middleware Chain](#middleware-chain)
- [File Handling](#file-handling)
- [Reusable Pattern Library](#reusable-pattern-library)
- [Anti-Patterns](#anti-patterns)

---

## Pattern Catalog

| # | Pattern | Description | Key Files |
|---|---------|-------------|-----------|
| 1 | Centralized Command Definitions | Single source of truth for all slash commands with i18n keys | `src/bot/commands/definitions.ts` |
| 2 | Command Registration Order | grammY matches handlers in registration order; text fallback must come last | `src/bot/index.ts` |
| 3 | Inline Keyboard Menus | Selection menus for models, agents, variants, projects, sessions | `src/bot/handlers/model.ts`, `src/bot/handlers/agent.ts`, `src/bot/handlers/variant.ts` |
| 4 | Question/Answer Flow | Multi-question polls with option selection, custom text input, and submit | `src/bot/handlers/question.ts` |
| 5 | Permission Request Flow | Interactive allow/always/reject buttons for tool permissions | `src/bot/handlers/permission.ts` |
| 6 | Interaction Guard | "One active flow at a time" middleware that blocks conflicting input | `src/bot/middleware/interaction-guard.ts` |
| 7 | Interaction Manager | In-memory state machine tracking active interaction kind, expected input, allowed commands | `src/interaction/manager.ts` |
| 8 | Pinned Status Message | Auto-updating pinned message showing session, project, model, tokens, cost, changed files | `src/pinned/manager.ts` |
| 9 | Persistent Bottom Keyboard | Reply keyboard with agent, model, variant, and context buttons; stays visible across messages | `src/bot/utils/keyboard.ts`, `src/keyboard/manager.ts` |
| 10 | Markdown Fallback | Try MarkdownV2 first; on parse error, retry with raw text | `src/bot/utils/send-with-markdown-fallback.ts` |
| 11 | SSE Event Subscription | Listen to OpenCode server events and drive Telegram UI updates | `src/opencode/events.ts` |
| 12 | Response Streaming | Throttled real-time message edits during agent thinking | `src/bot/streaming/response-streamer.ts` |
| 13 | Tool Call Streaming | Separate stream for tool-call notifications (file writes, edits) | `src/bot/streaming/tool-call-streamer.ts` |
| 14 | Tool Message Batching | Batch service messages on an interval to avoid rate limits | `src/summary/tool-message-batcher.ts` |
| 15 | Voice/STT Pipeline | Download audio, transcribe via Whisper-compatible API, forward as prompt | `src/bot/handlers/voice.ts` |
| 16 | Photo/Document Handling | Download photos, PDFs, text files; check model capabilities before sending | `src/bot/handlers/document.ts`, `src/bot/index.ts` |
| 17 | Inline Query Commands | `@bot command: query` pattern that bypasses Telegram Group Privacy Mode | `src/bot/handlers/inline-query.ts` |
| 18 | Auth Middleware | User ID whitelist; silently ignore unauthorized, clear their commands | `src/bot/middleware/auth.ts` |
| 19 | Unknown Command Fallback | Catch unrecognized slash commands with a helpful message | `src/bot/middleware/unknown-command.ts` |
| 20 | Inline Menu Cancel Pattern | Standardized cancel button appended to every inline menu | `src/bot/handlers/inline-menu.ts` |
| 21 | Draft Message Streaming | Live `sendMessageDraft` updates during agent response generation | `src/bot/index.ts` |
| 22 | Thinking Message Delivery | Lightweight "thinking" indicator instead of raw chain-of-thought | `src/bot/utils/thinking-message.ts` |
| 23 | Busy Guard | Session-level busy state blocks input while agent is working | `src/interaction/busy.ts` |
| 24 | Simple User Mode | Restricted users get only `/new`, `/abort`, `/help` and no bottom keyboard | `src/bot/index.ts`, `src/users/access.ts` |

---

## Command Routing

### How Commands Are Defined

All commands live in a single definitions file. Each entry has a command name and an i18n key for its description:

```typescript
// src/bot/commands/definitions.ts
const COMMAND_DEFINITIONS: BotCommandI18nDefinition[] = [
  { command: "status", descriptionKey: "cmd.description.status" },
  { command: "new", descriptionKey: "cmd.description.new" },
  { command: "abort", descriptionKey: "cmd.description.stop" },
  // ...
];
```

The `getLocalizedBotCommands()` function resolves i18n keys into the current locale's strings and produces the array passed to `setMyCommands()`.

### Registration Order (Critical)

grammY matches handlers in the order they are registered. The correct order in `src/bot/index.ts` is:

```
1. bot.use(logging/debug middleware)
2. bot.use(authMiddleware)           — reject unauthorized early
3. bot.use(user-access middleware)   — auto-select project/model for restricted users
4. bot.use(ensureCommandsInitialized) — setMyCommands per chat (once)
5. bot.on("inline_query", ...)       — inline query handler
6. bot.use(interactionGuardMiddleware) — block input during active flows
7. bot.command("start", ...)         — all slash commands
8. bot.command("help", ...)
9. ... (all other commands)
10. bot.on("message:text", unknownCommandMiddleware) — catch unknown slashes
11. bot.on("callback_query:data", ...) — ALL callback handlers in one place
12. bot.hears(AGENT_MODE_PATTERN, ...) — reply keyboard button handlers
13. bot.hears(MODEL_PATTERN, ...)
14. bot.hears(CONTEXT_PATTERN, ...)
15. bot.hears(VARIANT_PATTERN, ...)
16. bot.on("message:text", ...) — diagnostic + final text handler
17. bot.on("message:voice", ...) — voice handler
18. bot.on("message:audio", ...) — audio handler
19. bot.on("message:photo", ...) — photo handler
20. bot.on("message:document", ...) — document handler
```

**Why order matters:** If `bot.on("message:text")` is registered before `bot.command("...")`, grammY will consume the text message before the command handler sees it. Commands must come first, then the text fallback.

### Unknown Command Middleware

The `unknownCommandMiddleware` runs as a `message:text` handler after all commands. It detects strings starting with `/` that no command handler matched and returns a localized fallback message.

---

## Inline Keyboard Patterns

### Building Selection Menus

All selection menus (model, agent, variant, project, session) follow the same pattern:

1. Build an `InlineKeyboard` with one button per option
2. Each button's callback data encodes the selection: `prefix:identifier`
3. Append a cancel button via `appendInlineMenuCancelButton()`
4. Send with `replyWithInlineMenu()` which also registers the interaction state

```typescript
// Model selection example
const keyboard = new InlineKeyboard();
favorites.forEach((model) => {
  const isActive = model.providerID === currentModel.providerID && model.modelID === currentModel.modelID;
  const label = isActive ? `✅ ⭐ ${model.providerID}/${model.modelID}` : `⭐ ${model.providerID}/${model.modelID}`;
  keyboard.text(label, `model:${model.providerID}:${model.modelID}`).row();
});
recent.forEach((model) => {
  keyboard.text(`🕘 ${model.providerID}/${model.modelID}`, `model:${model.providerID}:${model.modelID}`).row();
});
```

### Question/Answer Keyboard

Questions support multiple choice, custom text input, and cancel:

```typescript
const keyboard = new InlineKeyboard();
question.options.forEach((option, index) => {
  const isSelected = selectedOptions.has(index);
  const icon = isSelected ? "✅ " : "";
  const buttonText = formatButtonText(option.label, option.description, icon);
  keyboard.text(buttonText, `question:select:${questionIndex}:${index}`).row();
});
if (question.multiple) {
  keyboard.text("Submit", `question:submit:${questionIndex}`).row();
}
keyboard.text("Custom answer", `question:custom:${questionIndex}`).row();
keyboard.text("Cancel", `question:cancel:${questionIndex}`);
```

### Permission Request Keyboard

Fixed three-button layout:

```typescript
const keyboard = new InlineKeyboard();
keyboard.text("Allow once", "permission:once").row();
keyboard.text("Allow always", "permission:always").row();
keyboard.text("Reject", "permission:reject");
```

### Inline Menu Cancel Pattern

Every inline menu gets a cancel button appended automatically:

```typescript
export function appendInlineMenuCancelButton(
  keyboard: InlineKeyboard,
  menuKind: InlineMenuKind,
): InlineKeyboard {
  // Remove trailing empty rows
  while (keyboard.inline_keyboard.length > 0 &&
         keyboard.inline_keyboard[keyboard.inline_keyboard.length - 1].length === 0) {
    keyboard.inline_keyboard.pop();
  }
  if (keyboard.inline_keyboard.length > 0) {
    keyboard.row();
  }
  keyboard.text(t("inline.button.cancel"), `inline:cancel:${menuKind}`);
  return keyboard;
}
```

### Stale Callback Protection

Each inline menu registers its `messageId` in the interaction state. When a callback arrives, `ensureActiveInlineMenu()` verifies the callback's message ID matches the active menu's ID. Stale callbacks (from deleted/replaced menus) are rejected with an alert.

---

## Callback Query Handling

### Centralized Dispatch

All callback queries flow through a single handler in `src/bot/index.ts`. Each sub-handler returns `true` if it handled the callback, `false` otherwise:

```typescript
bot.on("callback_query:data", async (ctx) => {
  const handledShell = await handleShellCallback(ctx);
  const handledInlineCancel = await handleInlineMenuCancel(ctx);
  const handledSession = await handleSessionSelect(ctx);
  const handledProject = await handleProjectSelect(ctx);
  const handledQuestion = await handleQuestionCallback(ctx);
  const handledPermission = await handlePermissionCallback(ctx);
  const handledAgent = await handleAgentSelect(ctx);
  const handledModel = await handleModelSelect(ctx);
  const handledVariant = await handleVariantSelect(ctx);
  // ... more handlers

  if (!handledShell && !handledInlineCancel && !handledSession && /* ... */) {
    await ctx.answerCallbackQuery({ text: t("callback.unknown_command") });
  }
});
```

### Callback Data Conventions

| Prefix | Pattern | Example |
|--------|---------|---------|
| `model:` | `model:providerID:modelID` | `model:openai:gpt-4o` |
| `agent:` | `agent:agentName` | `agent:build` |
| `variant:` | `variant:variantId` | `variant:default` |
| `question:` | `question:action:questionIndex[:optionIndex]` | `question:select:0:2` |
| `permission:` | `permission:reply` | `permission:once` |
| `inline:cancel:` | `inline:cancel:menuKind` | `inline:cancel:model` |
| `session:` | `session:select:sessionId` | `session:select:abc123` |
| `project:` | `project:select:projectName` | `project:select:myproject` |
| `task:` | `task:action[:params]` | `task:cancel` |
| `rename:` | `rename:cancel` | `rename:cancel` |
| `commands:` | `commands:action:commandName` | `commands:run:init` |
| `shell:` | `shell:action` | `shell:confirm` |
| `compact:` | `compact:cancel` (legacy) | `compact:cancel` |

### Answer Callback Query

Always call `ctx.answerCallbackQuery()` to dismiss the loading spinner on the button. Use `show_alert: true` for error messages that need a popup.

---

## Interaction Flow Guards

### The Problem

When the bot is waiting for a specific type of input (e.g., a button press on a model selection menu), any other input (text message, different command) should be blocked with a contextual hint rather than being processed normally.

### Architecture

Three components work together:

1. **InteractionManager** (`src/interaction/manager.ts`) — in-memory state machine per chatId
2. **Guard** (`src/interaction/guard.ts`) — pure function that classifies input and decides allow/block
3. **Middleware** (`src/bot/middleware/interaction-guard.ts`) — grammY middleware that enforces the decision

### Interaction State

```typescript
interface InteractionState {
  kind: "inline" | "permission" | "question" | "rename" | "task" | "custom";
  expectedInput: "callback" | "text" | "command" | "mixed";
  allowedCommands: string[];  // e.g., ["/help", "/status", "/abort"]
  metadata: Record<string, unknown>;
  createdAt: number;
  expiresAt: number | null;
}
```

### Guard Decision Logic

The guard classifies incoming input into one of: `callback`, `command`, `text`, `other`.

Then it checks:

1. **No active interaction** → allow everything
2. **Active interaction exists** → check if input type matches `expectedInput`
3. **Command during interaction** → check if command is in `allowedCommands`
4. **Busy state** (agent working) → only allow "busy-allowed" commands (`/help`, `/status`, `/abort`) and interactions that accept mixed input

### Blocking Behavior

- **Callback queries** → `answerCallbackQuery()` with block message
- **Text/messages** → `ctx.reply()` with block message
- Block messages are localized and interaction-kind-specific (e.g., "Please answer the question first" vs. "Please select a model first")

### Starting an Interaction

```typescript
// When showing a model selection menu:
interactionManager.start(chatId, {
  kind: "inline",
  expectedInput: "callback",
  metadata: { menuKind: "model", messageId: message.message_id },
});

// When waiting for a custom text answer to a question:
interactionManager.start(chatId, {
  kind: "question",
  expectedInput: "mixed",  // accepts both callback and text
  metadata: { questionIndex: 0, inputMode: "custom" },
});
```

### Clearing an Interaction

Interactions are cleared when:
- User completes the flow (answers all questions, selects a model)
- User cancels (cancel button)
- A new interaction replaces the old one (new question replaces old poll)
- Error occurs (callback handler error clears state)
- Bot restarts (startup clears all state)

**Important:** Interactions do NOT expire automatically. They wait for explicit completion.

---

## Pinned Status Message

### Purpose

A pinned message at the top of the chat that always shows the current session status: title, project, model, token usage, cost, and changed files.

### Lifecycle

1. **Creation** — When a session is selected or created, `onSessionChange()` unpins old messages, sends a new message, and pins it
2. **Updates** — The message is edited in place on every relevant event:
   - Token usage changes (`onMessageComplete`)
   - Cost updates (`onCostUpdate`)
   - Session title refresh (`refreshSessionTitle`)
   - File changes (`addFileChange`, `onSessionDiff`)
   - Session compaction (`onSessionCompacted`)
3. **Persistence** — The pinned message ID is saved to `settings.json` and restored on bot restart
4. **Recovery** — If the pinned message is deleted by the user, the manager detects "message to edit not found" and recreates it

### Content Format

```
Session Title
Project: myproject
Model: openai/gpt-4o
Context: 15K/200K (8%)
Cost: $0.42

Changed files (3):
  src/index.ts (+42 -5)
  src/utils.ts (+18)
  README.md (+3 -1)
```

### Debouncing

File change updates are debounced at 500ms to avoid excessive edits during rapid tool execution.

### Context Limit Fetching

On session change, the manager fetches the model's context limit from the OpenCode API (`config.providers`). Falls back to 200K if unavailable.

### Keyboard Context Sync

When the pinned message updates token usage, it triggers a callback that updates the bottom keyboard's context button via `keyboardManager.updateContext()`.

---

## Persistent Bottom Keyboard

### Layout

The reply keyboard is a 2x2 grid that stays visible at the bottom of the chat:

```
[🛠️ Build Mode]     [📊 15K/200K (8%)]
[🤖 openai/gpt-4o]  [💡 Default]
```

- **Row 1:** Agent mode button + Context usage button
- **Row 2:** Model selector button + Variant selector button

### Creation

```typescript
export function createMainKeyboard(
  currentAgent: string,
  currentModel: ModelInfo,
  contextInfo?: ContextInfo,
  variantName?: string,
): Keyboard {
  const keyboard = new Keyboard();
  keyboard.text(agentText).text(contextText).row();
  keyboard.text(modelText).text(variantText).row();
  return keyboard.resized().persistent();
}
```

The `.resized()` makes the keyboard fit the screen width. The `.persistent()` keeps it visible across messages.

### State Management

The `KeyboardManager` tracks per-chat state:
- Current agent
- Current model (provider + model ID + variant)
- Context info (tokens used / limit)
- Variant name

When any of these change, the keyboard is rebuilt. Updates are debounced at 2000ms to avoid spam.

### Button Press Handling

Each button is matched by regex pattern on the message text:

```typescript
bot.hears(AGENT_MODE_BUTTON_TEXT_PATTERN, async (ctx) => { ... });
bot.hears(MODEL_BUTTON_TEXT_PATTERN, async (ctx) => { ... });
bot.hears(/^📊(?:\s|$)/, async (ctx) => { ... });
bot.hears(VARIANT_BUTTON_TEXT_PATTERN, async (ctx) => { ... });
```

When pressed, the button opens the corresponding inline selection menu. The interaction guard prevents menu stacking.

### Simple User Mode

Restricted users (`isSimpleUser()`) do not get the bottom keyboard. Their command list is limited to `/new`, `/abort`, `/help`.

---

## Message Formatting

### MarkdownV2 with Fallback

The bot prefers MarkdownV2 for rich formatting (bold, italic, code, links). If Telegram rejects the message due to unescaped characters, it retries with raw text:

```typescript
export async function sendMessageWithMarkdownFallback({
  api, chatId, text, options, parseMode,
}) {
  if (!parseMode) return api.sendMessage(chatId, text, options);

  try {
    return await api.sendMessage(chatId, text, { ...options, parse_mode: parseMode });
  } catch (error) {
    if (!isTelegramMarkdownParseError(error)) throw error;
    logger.warn("[Bot] Markdown parse failed, retrying in raw mode");
    return api.sendMessage(chatId, text, options);
  }
}
```

### MarkdownV2 Escaping

MarkdownV2 requires escaping these characters: `_`, `*`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`. The `src/utils/html.ts` module provides escaping utilities.

### Code Block Handling

- Code blocks in assistant responses are sent as text when short enough
- Large code blocks are sent as `.txt` or language-specific files via `sendDocument`
- File captions include the file path and diff stats

### Message Chunking

Long responses are split into multiple Telegram messages. The `RESPONSE_STREAM_TEXT_LIMIT` constant (3800 chars) controls the maximum per-message size during streaming.

### Thinking Messages

Instead of exposing raw chain-of-thought, a lightweight "thinking" indicator is sent. The `deliverThinkingMessage()` utility handles this.

### Loading Messages

When a prompt is dispatched, a loading message is stored by session ID. It is cleared when streaming starts or the response completes.

---

## i18n Integration

### Setup

The i18n system is a lightweight custom implementation (not a library). It supports 7 locales:

- `en` — English (default)
- `bs` — Bosanski
- `de` — Deutsch
- `es` — Español
- `fr` — Français
- `ru` — Русский
- `zh` — 简体中文

### Usage

```typescript
import { t } from "../i18n/index.js";

// Simple key
await ctx.reply(t("cmd.description.status"));

// With interpolation
await ctx.reply(t("model.changed_callback", { name: displayName }));

// Force specific locale
await ctx.reply(t("common.error", {}, "ru"));
```

### Interpolation

Templates use `{key}` syntax:

```typescript
// In en.ts:
"model.changed_callback": "Model changed to {name}",

// Usage:
t("model.changed_callback", { name: "openai/gpt-4o" })
// → "Model changed to openai/gpt-4o"
```

### Type Safety

The `I18nKey` type is derived from the English dictionary keys, providing compile-time checking:

```typescript
type I18nKey = keyof typeof en;
```

### Locale Resolution

The active locale is determined by:
1. Runtime override (`setRuntimeLocale()`)
2. `BOT_LOCALE` environment variable
3. Fallback to `en`

---

## Middleware Chain

### Order

```
1. Debug logger (logs every update type)
2. Auth middleware (user ID whitelist)
3. User-access middleware (auto-select project/model for restricted users)
4. Command initialization (setMyCommands per chat, once)
5. Interaction guard (block input during active flows)
```

### Auth Middleware

Checks `ctx.from.id` against `config.telegram.allowedUserIds`. For group chats, also checks `ctx.chat.id` against `config.telegram.allowedChatIds`. Unauthorized users are silently ignored, and their command list is cleared.

### Interaction Guard Middleware

Runs after auth. Classifies the incoming input, checks against the active interaction state, and either allows it through or blocks it with a contextual message.

### Error Handling in Callbacks

The callback handler wraps all sub-handlers in a try/catch. On error:
- Logs the error with context
- Clears all interaction state for the chat
- Sends a localized error message via `answerCallbackQuery`

---

## File Handling

### Voice/Audio Messages

1. Receive `message:voice` or `message:audio`
2. Check if STT is configured (`STT_API_URL`, `STT_API_KEY`)
3. Send "recognizing..." status message
4. Download audio file from Telegram servers (with proxy support, redirect handling, timeout)
5. Transcribe via Whisper-compatible API
6. Edit status message to show recognized text
7. Forward recognized text as a prompt to OpenCode

### Photo Messages

1. Receive `message:photo`
2. Check if the current model supports image input (`getModelCapabilities()`)
3. If not, fall back to caption-only text
4. Download the largest photo variant
5. Convert to data URI (Telegram always provides JPEG)
6. Send as `FilePartInput` with type `"file"` and mime `"image/jpeg"`

### Document Messages (PDF and Text Files)

1. Receive `message:document`
2. Download the file
3. For PDFs: extract text content
4. For text files: read content directly
5. Forward as prompt parts to OpenCode

### Sending Code Files

When the agent produces code that is too large for a text message:
1. Write to a temp file in `src/.tmp/`
2. Send via `sendDocument()` with an `InputFile`
3. Include a caption with the file path and diff stats
4. Clean up the temp file in a `finally` block

---

## Reusable Pattern Library

### Template: New Slash Command

```typescript
// 1. Add to definitions.ts
{ command: "mycommand", descriptionKey: "cmd.description.mycommand" }

// 2. Create src/bot/commands/mycommand.ts
export async function myCommand(ctx: Context): Promise<void> {
  await ctx.reply(t("mycommand.response"));
}

// 3. Register in src/bot/index.ts (before text fallback)
import { myCommand } from "./commands/mycommand.js";
bot.command("mycommand", myCommand);
```

### Template: New Inline Selection Menu

```typescript
// src/bot/handlers/myselection.ts
import { Context, InlineKeyboard } from "grammy";
import { interactionManager } from "../interaction/manager.js";
import { replyWithInlineMenu, ensureActiveInlineMenu, clearActiveInlineMenu } from "./inline-menu.js";

export async function showMySelectionMenu(ctx: Context): Promise<void> {
  const keyboard = new InlineKeyboard();
  // ... build buttons with callback data like "myselection:item1"
  const text = "Select an option:";

  await replyWithInlineMenu(ctx, {
    menuKind: "myselection",  // add to INLINE_MENU_KINDS in inline-menu.ts
    text,
    keyboard,
  });
}

export async function handleMySelectionCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith("myselection:")) return false;

  const isActive = await ensureActiveInlineMenu(ctx, "myselection");
  if (!isActive) return true;

  // ... handle selection
  clearActiveInlineMenu(ctx.chat?.id ?? 0, "myselection_done");
  await ctx.answerCallbackQuery({ text: "Selected!" });
  await ctx.deleteMessage().catch(() => {});
  return true;
}
```

### Template: New Interaction Flow

```typescript
// Start the interaction
interactionManager.start(chatId, {
  kind: "custom",
  expectedInput: "callback",  // or "text", "mixed"
  allowedCommands: ["/help", "/abort"],
  metadata: { myData: "value" },
});

// Clear when done
interactionManager.clear(chatId, "myflow_completed");
```

### Template: Safe Background Task

```typescript
import { safeBackgroundTask } from "../utils/safe-background-task.js";

safeBackgroundTask({
  taskName: "my.operation",
  task: () => someAsyncOperation(),
  onSuccess: ({ error, result }) => {
    if (error) {
      logger.error("[MyComponent] Operation failed:", error);
    }
  },
});
```

### Template: Send Message with Reply Keyboard

```typescript
const keyboard = getCurrentReplyKeyboard(chatId);
await botInstance.api.sendMessage(chatId, text, {
  disable_notification: true,
  ...(keyboard ? { reply_markup: keyboard } : {}),
});
```

---

## Anti-Patterns

### DO NOT: Register text handler before commands

```typescript
// WRONG — text handler consumes everything before commands see it
bot.on("message:text", async (ctx) => { ... });
bot.command("help", helpCommand);  // Never reached
```

### DO NOT: Use raw `console.log` in feature code

```typescript
// WRONG
console.log("User selected model:", model);

// RIGHT
import { logger } from "../utils/logger.js";
logger.debug(`[ModelHandler] User selected model: ${model}`);
```

### DO NOT: Duplicate command definitions

Commands are defined once in `definitions.ts`. Do not hardcode command lists in help text, `setMyCommands` calls, or anywhere else.

### DO NOT: Forget to call `answerCallbackQuery`

Every callback handler must call `ctx.answerCallbackQuery()` to dismiss the loading spinner. Otherwise the user sees a spinning indicator indefinitely.

### DO NOT: Stack inline menus without clearing

Opening a new inline menu while one is already active leads to stale callbacks. Always use `replyWithInlineMenu()` which registers the interaction state, and verify with `ensureActiveInlineMenu()` in the callback handler.

### DO NOT: Send MarkdownV2 without escaping

User-generated content (file paths, session titles, agent output) can contain MarkdownV2 special characters. Always use the markdown fallback utility or escape content before sending.

### DO NOT: Assume bot/chat context is available

`botInstance` and `chatIdInstance` are module-level variables set during update handling. Always check they are non-null before using them in callbacks or event handlers.

### DO NOT: Register commands globally

Commands are set per-chat scope to hide them from unauthorized users. Never use `{ scope: { type: "default" } }` or `{ scope: { type: "all_private_chats" } }` for command registration. The startup code explicitly clears these scopes.

### DO NOT: Let interactions expire silently

Interactions wait for explicit completion. If a user abandons a flow, it blocks all subsequent input. Provide cancel buttons and error recovery paths.

### DO NOT: Expose stack traces to users

Error messages sent to Telegram should be localized and user-friendly. Log full errors with `logger.error()`, but send only a clean message to the user.
