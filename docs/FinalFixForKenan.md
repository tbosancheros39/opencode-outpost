# Final Fix for Kenan — Inline Query Response Goes to Wrong Chat

## Problem Summary

When the user taps "✅ Generate" on an inline query result from a **group chat**, the response (and any error messages including "⚠️ Failed to generate response") appear in the **group** instead of the user's **private chat**.

## Root Cause Analysis

### The Data Flow

```
1. User in GROUP types: @OCTelegrambotLocalbot eli5: why is the sky blue
2. Bot shows inline results in the GROUP with "✅ Generate" button
3. User taps "✅ Generate" button
4. handleInlineRunCallback fires:
   ├── ctx.chat?.id      = GROUP_ID     (the group where inline results were shown)
   ├── ctx.from?.id      = USER_ID      (the user's Telegram ID)
   └── ctx.callbackQuery?.message?.message_id = message ID in the GROUP
5. Bot sends "thinking" message to targetChatId = ctx.chat?.id ?? userId → GROUP_ID
6. Job enqueued to worker
7. Worker calls resolveInlineQuery() → LLM timeout/stream error
8. Worker sends "⚠️ Failed to generate response" to GROUP (via editMessageText)
```

### The Bug (Inline Query Handler — Line 512)

```typescript
// src/bot/handlers/inline-query.ts — line 512
const targetChatId = ctx.chat?.id ?? userId;
```

**Problem:** When the inline button is tapped from a group:
- `ctx.chat?.id` = GROUP_ID (the group where the inline result message lives)
- `targetChatId` = GROUP_ID
- ALL subsequent messages go to the GROUP, not the user's private chat

**Additionally (lines 516–528):** The code tries to edit the original callback message in the group, which Telegram may reject because the edit context has changed.

### The Flow That Should Happen

```
1. User taps "✅ Generate" from GROUP
2. Bot sends a NEW "thinking" message to USER's private chat (NOT the group)
3. Worker processes the LLM job
4. Worker sends the LLM response to USER's private chat (via editMessageText)
5. If LLM fails, error goes to USER's private chat (via editMessageText)
```

The response should ALWAYS go to the user's private chat, regardless of where the inline button was tapped.

## Fix (1-line change)

### File: `src/bot/handlers/inline-query.ts`

**Before (line 512):**
```typescript
const targetChatId = ctx.chat?.id ?? userId;
```

**After (line 512):**
```typescript
const targetChatId = userId;
```

### Explanation

- `userId` (`ctx.from?.id`) is ALWAYS the user's Telegram ID, which resolves to their private chat
- `ctx.chat?.id` is the chat where the inline message was shown (group or private)
- By using `userId` unconditionally, we ensure all messages go to the user's private chat

### Why this fix is correct

1. **Private chat tap:** `ctx.chat?.id === userId`, so behavior is identical (no regression)
2. **Group tap:** `ctx.chat?.id !== userId`, so response now goes to private chat (bug fixed)
3. **editMessageText compatibility:** We send a new "thinking" message to `userId` and store its `message_id` as `ackMessageId`. The worker then edits that private message — which works because both send and edit are in the same private chat.
4. **Error handling:** Errors also go to private chat — correct and consistent

## No Other Changes Needed

The following files need NO changes:

| File | Reason |
|------|--------|
| `src/services/inline-llm.ts` | Works fine — LLM call, SSE streaming, timeout handling |
| `src/queue/worker.ts` | Uses `chatId` from job data, sends to that chat — already correct |
| `src/queue/types.ts` | Job data structure unchanged |
| `src/bot/index.ts` | Handler registration unchanged |
| `src/i18n/` | Error messages unchanged |

## Testing Plan

1. **From private chat:** Send `@OCTelegrambotLocalbot eli5: quantum computing` → tap "✅ Generate" → response appears in same private chat ✅
2. **From group:** Send same from a group → tap "✅ Generate" → response appears in **private DM** (not the group) ✅
3. **Error case:** With broken LLM → "⚠️ Failed to generate response" should appear in private DM ✅

## Files to Modify

| File | Change | Lines |
|------|--------|-------|
| `src/bot/handlers/inline-query.ts` | Change `ctx.chat?.id ?? userId` to `userId` on line 512 | 1 line |

## Build & Deploy

```bash
# 1. Build
npm run build

# 2. Stop services
sudo systemctl stop opencode-telegram-bot
sleep 25
sudo systemctl stop opencode-serve

# 3. Verify stopped
sudo systemctl status opencode-telegram-bot
sudo systemctl status opencode-serve

# 4. Start services
sudo systemctl start opencode-serve
sudo systemctl start opencode-telegram-bot

# 5. Verify running
sudo systemctl status opencode-telegram-bot
sudo systemctl status opencode-serve
```

## Why This Wasn't Obvious Before

The bug is subtle because:
1. It only manifests when using inline mode from a **group** (most users use private chat with bots)
2. The code `ctx.chat?.id ?? userId` looks reasonable — "use the chat we're in, fall back to userId"
3. In a private chat, `ctx.chat?.id === userId`, so the bug is invisible
4. Only in a group does `ctx.chat?.id` become a different (wrong) value

The fix is minimal and surgical — one line, no refactoring, no new dependencies, no behavioral changes for the private chat case.
