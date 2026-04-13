# Inline Query Response Destination Bug — Fix Guide

## Symptom

When invoking an inline query (e.g. `eli5: why is the sky blue?`) in a group or private chat with another user, the bot:
1. Sends a **new private DM** to the bot owner saying "Thinking..."
2. Streams the response into that **private DM** instead of the chat where the inline query was invoked.

Expected behavior: Bot should reply **in the same chat** where the inline query was sent.

---

## Root Cause

**File:** `src/bot/handlers/inline-query.ts`
**Function:** `handleInlineRunCallback` (around line 512)

The bug is in how the handler determines where to send the "Thinking..." message and where to stream the final response.

```typescript
// Line 512 — ALWAYS the user's private ID, regardless of where inline query was invoked
const targetChatId = userId;

// Line 513-528 — Condition always falls to ELSE for inline query callbacks
const callbackMessageId = ctx.callbackQuery?.message?.message_id;
let ackMessageId: number;

if (ctx.chat?.id && callbackMessageId) {
    // Tries to edit the inline message in the original chat
    await ctx.api.editMessageText(ctx.chat.id, callbackMessageId, t("inline.thinking"));
    ackMessageId = callbackMessageId;
} else {
    // FALLBACK: sends NEW "Thinking" message to user's PRIVATE chat (THE BUG)
    const ackMessage = await ctx.api.sendMessage(targetChatId, t("inline.thinking"));
    ackMessageId = ackMessage.message_id;
}
```

### Why the `if` condition always fails for inline queries

grammY's `ctx.chat` getter chains through: `msg` → `myChatMember` → `chatJoinRequest` → `chatBoost` → `removedChatBoost`. **It does NOT include `callbackQuery`**. 

For inline query callback updates, `ctx.chat` is `undefined`. Therefore `ctx.chat?.id` is falsy, the `if` branch never executes, and the code always falls to `else` — sending a new DM instead of editing the inline message.

### Why the response also goes to the wrong place

The queue job receives `chatId: targetChatId` (= `userId` = private DM ID). The worker sends all progress updates and the final response to that private chat ID.

---

## Two Problems to Fix

1. **"Thinking..." message** goes to wrong place → fix the `if/else` to use `ctx.inlineMessageId`
2. **Final response** goes to wrong place → fix the `chatId` passed to the queue job

---

## Fix Plan

### Step 1 — Fix `handleInlineRunCallback` in `src/bot/handlers/inline-query.ts`

**Problem 1:** Replace the `if (ctx.chat?.id && callbackMessageId)` logic with a check for `ctx.inlineMessageId`.

For inline query callbacks, Telegram provides `callbackQuery.inline_message_id` — the ID of the inline message the button belongs to. grammY exposes this as `ctx.inlineMessageId`. We can use this to edit the message directly via `ctx.editMessageText(text)` (grammY's context-aware method automatically uses `inlineMessageId` when available).

```typescript
// Replace lines 512-528 with:
const callbackInlineMessageId = ctx.inlineMessageId;
let ackMessageId: number | null = null;

if (callbackInlineMessageId) {
    // Edit the inline message directly — no chat_id needed
    await ctx.editMessageText(t("inline.thinking"));
    ackMessageId = null; // We use inline_message_id, not a numeric message_id
} else {
    // Fallback for regular callback queries (non-inline)
    const callbackMessageId = ctx.callbackQuery?.message?.message_id;
    if (ctx.chat?.id && callbackMessageId) {
        await ctx.api.editMessageText(ctx.chat.id, callbackMessageId, t("inline.thinking"));
        ackMessageId = callbackMessageId;
    } else {
        const ackMessage = await ctx.api.sendMessage(userId, t("inline.thinking"));
        ackMessageId = ackMessage.message_id;
    }
}
```

**Problem 2:** Change `targetChatId` from `userId` to the chat where the inline query was invoked. For inline queries, the chat ID is not directly available from grammY's context. Two options:

**Option A (recommended):** Pass `inline_message_id` to the queue job instead of `chatId`. The worker can then use `editMessageText` with `inline_message_id` directly, bypassing the need for a numeric chat ID.

**Option B (simpler):** Keep `chatId: userId` in the queue job. The "Thinking" edit works correctly (Option 1), but the final response still goes to DM. Responses stream to `chatId` in the job. This only partially fixes the issue.

### Step 2 — Option A: Update queue job to support `inline_message_id`

**File:** `src/queue/types.ts`

Add `inlineMessageId?: string` to `TaskJobData`.

**File:** `src/bot/handlers/inline-query.ts` (continuing the fix)

In `handleInlineRunCallback`, pass `inlineMessageId` to the job:

```typescript
await addTaskJob({
    // ... existing fields ...
    chatId: targetChatId,
    inlineMessageId: callbackInlineMessageId ?? null,  // NEW
    // ...
});
```

**File:** `src/queue/worker.ts`

Update `processLlmDirectJob` to accept and handle `inlineMessageId`. When provided:
- Use `ctx.api.editMessageTextInline(inlineMessageId, text)` instead of `sendMessage(chatId, text)`
- Use `ctx.api.editMessageTextInline(inlineMessageId, text, { parse_mode: ..., reply_markup: ... })` for the final response

The `TelegramBotApi` interface at the top of `worker.ts` needs a new method:

```typescript
interface TelegramBotApi {
    sendMessage(chatId: number, text: string, extra?: Record<string, unknown>): Promise<{ message_id: number }>;
    editMessageText(chatId: number, messageId: number, text: string, extra?: Record<string, unknown>): Promise<true>;
    editMessageTextInline(inlineMessageId: string, text: string, extra?: Record<string, unknown>): Promise<true>;  // NEW
}
```

And the `sendProgressHeartbeat` / final response functions need to branch: if `inlineMessageId` is set, use `editMessageTextInline`; otherwise use `sendMessage`.

### Step 3 — i18n (if needed)

No new i18n keys needed — the fix reuses existing keys.

### Step 4 — Build and restart

```bash
cd /media/ext4_storage/workspace/OpenCodeTelegramBot/opencode-telegram-bot
npm run build
sudo systemctl stop opencode-telegram-bot
sleep 25
sudo systemctl start opencode-telegram-bot
```

---

## Key Telegram API Reference

| Field | Source | Purpose |
|---|---|---|
| `callbackQuery.inline_message_id` | grammY: `ctx.inlineMessageId` | ID of inline message to edit |
| `callbackQuery.from.id` | grammY: `ctx.from?.id` | User who pressed the button |
| `callbackQuery.chat_instance` | grammY: not exposed | Global chat identifier |

grammY's `ctx.editMessageText(text)` automatically uses `inlineMessageId` when available, so no explicit chat_id is needed for inline message edits.

---

## Files to Modify

1. `src/bot/handlers/inline-query.ts` — fix `handleInlineRunCallback` to use `ctx.inlineMessageId`, pass `inlineMessageId` to queue job
2. `src/queue/types.ts` — add `inlineMessageId?: string` to job data
3. `src/queue/worker.ts` — handle `inlineMessageId` in `processLlmDirectJob`, add `editMessageTextInline` to `TelegramBotApi` interface
