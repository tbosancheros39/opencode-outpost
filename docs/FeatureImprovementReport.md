# Feature Improvement Report
**OpenCode Telegram Bot — Competitive Analysis & Roadmap**
*Generated: 08.04.2026 | Based on: 7 competitor projects, grammY 1.42 ecosystem audit, user research*

---

## Executive Summary

Three independent research streams (grammY plugin audit, 7 competitor projects, user feature demand research) were cross-referenced to produce this prioritized roadmap. All suggestions are grammY 1.42 compatible and fit the existing TypeScript/BullMQ/SSE architecture.

**TL;DR — Top 4 Actions:**
1. `npm install @grammyjs/auto-retry` → 1 line of code, stops silent API failures in streaming pipeline
2. **HUD Footer** on every response (branch · cost · model) → 3 commands replaced, ~25 lines
3. **Plan mode toggle** (`/plan` / `/execute`) → prevents accidental file writes, ~15 lines
4. **Forum Topic routing** as session key → 3 competitors already have this, ~5 lines

---

## Part 1: grammY Plugin Additions

These are purely additive — zero architecture changes, no regression risk.

### 🔴 Tier 1 — Install Immediately

#### `@grammyjs/auto-retry`
```bash
npm install @grammyjs/auto-retry
```
```typescript
// src/bot/index.ts — add ONE line after bot creation
import { autoRetry } from "@grammyjs/auto-retry";
bot.api.config.use(autoRetry());
```
**Why**: Every SSE streaming cycle sends 5–15 `editMessageText` calls. Any 429 or transient 500 currently drops that streaming frame silently. `auto-retry` wraps all `bot.api` calls transparently, reads the `retry_after` header, and retries at the right moment. Zero handler changes. Directly fixes the class of silent streaming failures we've seen.

---

#### `@grammyjs/hydrate`
```bash
npm install @grammyjs/hydrate
```
```typescript
// src/bot/index.ts
import { hydrate, HydrateFlavor } from "@grammyjs/hydrate";
// Replace: type Context = ...
type Context = HydrateFlavor<BaseContext>;
bot.use(hydrate());
```
**Why**: SSE streaming currently threads `chat.id` + `message_id` through every edit call. With hydrate:
```typescript
// Before:
const msg = await ctx.reply("⏳ Working...");
await bot.api.editMessageText(chatId, msg.message_id, newChunk);
// After:
const msg = await ctx.reply("⏳ Working...");
await msg.editText(newChunk);  // method lives on the object
```
Directly simplifies `src/bot/streaming/` and `src/queue/worker.ts` edit paths.

---

#### `@grammyjs/ratelimiter`
```bash
npm install @grammyjs/ratelimiter
```
```typescript
// src/bot/index.ts — plug into existing ioredis client (already used for BullMQ)
import { limit } from "@grammyjs/ratelimiter";
bot.use(limit({
  timeFrame: 2000,
  limit: 3,
  storageClient: redisClient,  // reuse existing BullMQ Redis client
  onLimitExceeded: async (ctx) => ctx.reply(t("error.rate_limit")),
}));
```
**Why**: Replaces custom rate-limiting logic with a battle-tested Redis-backed solution. Fires before BullMQ job creation — stops spam before it hits the queue. Redis client already available in the project.

---

### 🟡 Tier 2 — High Value, Low Friction

#### `@grammyjs/parse-mode`
```bash
npm install @grammyjs/parse-mode
```
**Why**: CLI output routed through SSE contains `_`, `*`, `` ` ``, `[`, `]` — all of which break MarkdownV2 and require escaping. The `fmt` tagged template approach produces `MessageEntity[]` arrays — characters passed verbatim, no escaping at all. Add incrementally to the streaming formatter, no refactor needed.

```typescript
import { bold, code, fmt } from "@grammyjs/parse-mode";
// Instead of: "**Error:**\n```\n" + escape(output) + "\n```"
// Use:
const { text, entities } = fmt`${bold("Error:")}\n${code(output)}`;
await ctx.reply(text, { entities });
```

---

#### `@grammyjs/commands`
**Why**: 30 commands × 6 locale variants currently need manual `setMyCommands` calls. This plugin auto-registers locale-scoped BotCommand lists during `bot.start()`. Eliminates a maintenance burden and correctly scopes commands to chat types.

**Effort**: Medium (one-time restructure of command registration, handlers unchanged)

---

## Part 2: Feature Improvements

### 🔴 Tier 1 — High Impact / Low Effort (Quick Wins)

---

#### Feature: Developer HUD Footer
**Competitors with it**: RichardAtCT (most praised UX feature), partial in others  
**User demand**: Eliminates need to run `/cost`, `/branch`, `/health` repeatedly  

Every AI response ends with:
```
🌿 main · 2 dirty · 💰 $0.043 · 🧠 claude-opus-4 · ⏱ 14s
```

**Implementation** (grammY):
- Create `buildHUD(sessionState): string` reading: git branch, dirty file count, session cost, active model, elapsed time
- Append to response in message formatter before `ctx.reply()` / `editMessageText()`
- Format as HTML `<code>` block to avoid MarkdownV2 escaping
- ~25 lines in `src/summary/` formatter

**Files to touch**: `src/summary/`, `src/bot/streaming/`

---

#### Feature: Plan Mode Toggle (`/plan` / `/execute`)
**Competitors with it**: Discussed in copilot-telegram-bot, multiple Reddit "vibe coding" threads  
**User demand**: Most common complaint from remote AI coding — "it changed 40 files before I confirmed"  

```
/plan   → 🗺 Plan mode: AI brainstorms + asks questions, NO file writes or shell commands
/execute → ⚡ Execute mode: full agentic (default)
```

**Implementation** (grammY):
```typescript
// src/bot/commands/plan.ts
export async function planCommand(ctx: CommandContext<Context>) {
  ctx.session.mode = 'plan';
  await ctx.reply(t("cmd.plan.enabled"));
}
// Prepend to every OpenCode prompt in plan mode:
const prefix = session.mode === 'plan'
  ? "Do NOT write or modify files. Do NOT run shell commands. Only analyze and return a numbered plan.\n\n"
  : "";
```
- ~15 lines total across 2 files
- Show current mode in HUD footer

**Files to touch**: `src/bot/commands/plan.ts` (new), `src/bot/handlers/prompt.ts`, `src/bot/index.ts`

---

#### Feature: Forum Topic → Session Routing
**Competitors with it**: 3 of 7 competitors (RichardAtCT, a5c-ai, ajoslin)  
**User demand**: GitHub issue against Anthropic's Claude Telegram integration, developer-submitted PR  

When used in a Telegram Supergroup with Forum Topics, each topic maps to a distinct OpenCode session.

**Implementation** (grammY):
```typescript
// src/bot/index.ts — session middleware setup
// Change session key from:
getSessionKey: (ctx) => String(ctx.from?.id)
// To:
getSessionKey: (ctx) => {
  const chatId = ctx.chat?.id ?? ctx.from?.id ?? "unknown";
  const threadId = ctx.message?.message_thread_id ?? 0;
  return `${chatId}_${threadId}`;
}
// And in all reply calls, pass through thread ID:
await ctx.reply(text, { message_thread_id: ctx.message?.message_thread_id });
```
- ~5–10 line change
- Enables "Topic: backend" → session A, "Topic: frontend" → session B

**Files to touch**: `src/bot/index.ts` (session key), all `ctx.reply()` calls in handlers

---

#### Feature: Session Export (`/share`)
**Competitors with it**: RichardAtCT (MD/HTML/JSON export)  
**User demand**: "How do I save this conversation?" is a top Reddit question for all AI bots  

```
/share → sends current session as session-2026-04-08.md attachment
```

**Implementation** (grammY):
```typescript
import { InputFile } from "grammy";
// Serialize session messages to Markdown
const md = session.messages.map(m =>
  `**${m.role === "user" ? "You" : "AI"}**: ${m.content}`
).join("\n\n---\n\n");
const buf = Buffer.from(md, "utf8");
await ctx.replyWithDocument(new InputFile(buf, `session-${Date.now()}.md`));
```
- `InputFile` accepts `Buffer` directly — no temp file needed
- ~20 lines

**Files to touch**: `src/bot/commands/share.ts` (new), `src/bot/index.ts`

---

#### Feature: Message Macros / Quick Prompts
**Competitors with it**: CoderBOT (`[m0]`–`[m9]`), multiple productivity bot discussions  
**User demand**: Mobile typing is slow — one-tap for common long prompts  

```
[fix]    → "Find and fix all TypeScript errors and linting warnings"
[review] → "Review this code for bugs, security issues, and performance"
[test]   → "Write comprehensive unit tests for the last modified file"
```

**Implementation** (grammY — middleware approach):
```typescript
// src/bot/middleware/macro-expansion.ts
const MACROS: Record<string, string> = {
  "[fix]": "Find and fix all TypeScript errors and linting warnings in the project.",
  "[review]": "Review the last modified code for bugs, security issues, and performance.",
  "[test]": "Write comprehensive unit tests for the last modified file.",
  // ... user-configurable via config.macros
};
export const macroExpansionMiddleware: MiddlewareFn<Context> = (ctx, next) => {
  if (ctx.message?.text) {
    const expanded = MACROS[ctx.message.text.trim()];
    if (expanded) ctx.message.text = expanded;
  }
  return next();
};
```
- Register before all handlers in `src/bot/index.ts`
- Macros configurable in `.env` or `settings.json`

**Files to touch**: `src/bot/middleware/macro-expansion.ts` (new), `src/bot/index.ts`

---

### 🟠 Tier 2 — High Impact / Medium Effort

---

#### Feature: Live Tool-Use Activity Feed
**Competitors with it**: Partial in most (tool call names shown in output)  
**User demand**: #2 most requested — "is it frozen?" is the #1 mobile UX complaint  

Edit a single status message in-place as OpenCode tool calls arrive via SSE:
```
⏳ Working...
🔍 Reading src/index.ts...
⚙️ Running: tsc --noEmit
✏️ Writing src/routes.ts...
✅ Done
```

**Implementation** (grammY):
- On prompt start: `const status = await ctx.reply("⏳ Working...");`
- In SSE `tool_call_start` event handler: `await status.editText(newLine)` (uses hydrate)
- Throttle edits to max 1/second via timestamp check (avoid 429)
- On completion: delete status message or replace with response
- `HIDE_TOOL_CALL_MESSAGES=true` env flag retains existing behavior for users who prefer clean output

**Files to touch**: `src/bot/streaming/`, `src/opencode/events.ts`, `src/summary/`

---

#### Feature: Human-in-the-Loop Permission Gate
**Competitors with it**: RichardAtCT (tool allowlist/denylist), multiple others  
**User demand**: #1 most requested — preventing accidental destructive operations from mobile  

Intercept dangerous operations and pause for user confirmation:
```
🚨 OpenCode wants to run:
rm -rf dist/

✅ Allow    ❌ Deny
```

**Implementation** (grammY):
- Parse OpenCode SSE `tool_call_start` events where tool name is `bash`/`shell` and command matches danger patterns (`rm`, `git push --force`, `npm publish`, `sudo`, etc.)
- Fire inline keyboard confirmation: `new InlineKeyboard().text("✅ Allow", "allow").text("❌ Deny", "deny")`
- Use `@grammyjs/conversations` `await conversation.waitForCallbackQuery(["allow", "deny"])` to suspend until user responds
- On Allow: resume SSE stream feed. On Deny: send abort signal to OpenCode
- Configurable danger pattern list in `.env`

**Files to touch**: `src/opencode/events.ts`, `src/bot/handlers/`, `src/bot/index.ts`

**Dependency**: Requires `@grammyjs/conversations` (high migration cost if refactoring existing state machines — can be added standalone for this feature only)

---

#### Feature: File Attachment Size Guard
**User demand**: Documented breaking bug — single large `.docx` inflated context to 486k tokens, crashing session  
**Effort**: Low-Medium  

```typescript
// src/bot/handlers/ — document upload handler
const MAX_INLINE_BYTES = 150_000; // ~50k tokens
if (ctx.message.document.file_size > MAX_INLINE_BYTES) {
  // Save to disk, pass path reference instead of content
  await ctx.reply(`⚠️ Large file (${formatBytes(fileSize)}). Saved as ${savedPath}. Ask me to read specific sections.`);
  promptText = `User uploaded a large file saved at ${savedPath}. Use the read tool to access it.`;
}
```
**Files to touch**: `src/bot/handlers/` (document handler)

---

### 🟢 Tier 3 — Nice to Have

| Feature | Why | Effort | Competitors |
|---------|-----|--------|-------------|
| **Verbosity dial** (`/verbose 0\|1\|2`) | Level 0 = final answer only, 1 = tool names, 2 = full tool inputs. Extends existing `HIDE_TOOL_CALL_MESSAGES` flag | Low | RichardAtCT |
| **Swipe-to-reply context** | Detect `ctx.message?.reply_to_message`, prepend replied content to prompt — natural mobile thread context | Low | General pattern |
| **Code → File attachment** | Send code blocks >60 lines as `.ts`/`.py` document instead of inline text — mobile syntax highlighting | Low | CoderBOT |
| **Sticky reaction indicator** | `bot.api.setMessageReaction()` on user's message while processing — visible when scrolled away | Low | General UX |
| **Session resume recap** | On `/new`, if previous session exists: offer short 3-line summary of where you left off | Medium | linuz90 |
| **Webhook trigger API** | HTTP endpoint for CI/CD → bot to trigger AI tasks (e.g., "test failed, fix it") | High | RichardAtCT |
| **Terminal screenshot** | `/screenshot` sends Puppeteer render of terminal state | High | CoderBOT |

---

## Part 3: Competitor Landscape

| Project | Stars | Tech | What they do better |
|---------|-------|------|-------------------|
| [RichardAtCT/claude-code-telegram](https://github.com/RichardAtCT/claude-code-telegram) | 2.3k ⭐ | Python | Cost caps, webhooks, Forum Topics, session export, verbosity dial |
| [linuz90/claude-telegram-bot](https://github.com/linuz90/claude-telegram-bot) | 408 ⭐ | TypeScript/Bun | MCP `ask_user`/`send_file` tools, extended thinking, message queuing |
| [terranc/claude-telegram-bot-bridge](https://github.com/terranc/claude-telegram-bot-bridge) | 117 ⭐ | Python | Revert/undo (5 modes), AI output → tappable buttons, TTS voice reply |
| [a5c-ai/claude-code-telegram-bot](https://github.com/a5c-ai/claude-code-telegram-bot) | 12 ⭐ | TypeScript/Telegraf | Forum Topics, session discovery from history file |
| [Tommertom/coderBOT](https://github.com/Tommertom/coderBOT) | 30 ⭐ | TypeScript | Real PTY, terminal screenshots, message macros, multi-bot orchestration |
| [ajoslin/opencode-telegram-mirror](https://github.com/ajoslin/opencode-telegram-mirror) | N/A | TypeScript/Bun | Diff viewer, plan/build toggle buttons, per-repo config |
| [Tommertom/opencoder-telegram-plugin](https://github.com/Tommertom/opencoder-telegram-plugin) | Low | TypeScript/grammY | Native OpenCode plugin (event-driven, no polling) |

**Our advantages over all of them**: grammY 1.42, BullMQ/Redis task queue, 30 commands, inline mode, 6-locale i18n, SSE streaming from local OpenCode server, systemd deployment, system health monitoring.

---

## Part 4: Architecture Patterns Worth Considering

### MCP-as-Bot-Feature (linuz90 pattern)
Instead of building bot features in TypeScript, expose them as MCP tools. The AI decides when to call `ask_user` (presents keyboard) or `send_file` (sends document). New features = new MCP servers, not new bot commands. Fits our existing OpenCode MCP integration perfectly.

### Verbosity as First-Class UX
Rather than binary `HIDE_TOOL_CALL_MESSAGES=true/false`, expose `/verbose 0|1|2`. Level 0 = only final answer + typing indicator, 1 = tool names as they execute, 2 = full tool inputs. Dramatically reduces cognitive overload. Extends our existing `HIDE_TOOL_CALL_MESSAGES` env flag with minimal code change.

### 1:1 Forum Thread → Session Mapping
Mapping `message_thread_id` to OpenCode session ID (see Forum Topic feature above) is a 5-line change that unlocks multi-project workflows inside a single Telegram group — our current per-user session model becomes per-topic session model.

---

## Implementation Order Recommendation

```
Week 1 (< 2 hours total):
  ✅ npm install @grammyjs/auto-retry    → 1 line
  ✅ HUD Footer                          → ~25 lines
  ✅ Plan mode toggle                    → ~15 lines
  ✅ Message macros                      → ~30 lines

Week 2 (< 4 hours total):
  ✅ npm install @grammyjs/hydrate       → 2 lines + type update
  ✅ npm install @grammyjs/ratelimiter   → 3 lines
  ✅ Forum Topic session routing         → ~10 lines
  ✅ Session export /share               → ~20 lines
  ✅ File attachment size guard          → ~20 lines

Week 3+ (medium effort):
  ⏳ Live tool-use activity feed
  ⏳ npm install @grammyjs/parse-mode
  ⏳ Human-in-the-loop permission gate
```

---

*Report compiled from: grammY plugin ecosystem audit (grammy.dev + awesome-grammY), 7 competitor project analyses (GitHub), user feature demand research (Reddit, Product Hunt, GitHub issues).*
