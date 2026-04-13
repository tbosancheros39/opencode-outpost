# Models Command Inline Menu Bug — Fix Guide

## Symptom

When a user sends `/models` in Telegram, the inline keyboard with model buttons appears correctly. However, when the user clicks on any model button to select it, nothing happens — the model is not changed, and the bot shows a "stale callback" alert: "This menu is no longer active."

## Expected Behavior

Clicking a model button should:

1. Update the selected model
2. Show a confirmation message
3. Refresh the main keyboard with the new model

## Root Cause

**File:** `src/bot/commands/models.ts`
**Line:** 111

The `/models` command implementation has a critical bug in the order of operations:

```typescript
// Line 105-106: Creates inline menu and stores state via interactionManager.start()
await replyWithInlineMenu(ctx, {
  menuKind: "model",
  text: message,
  keyboard,
});

// Line 111: IMMEDIATELY destroys the state that was just created
clearActiveInlineMenu(chatId, "models_command");
```

When `replyWithInlineMenu()` is called, it:

1. Sends the reply message with the inline keyboard
2. Stores interaction state via `interactionManager.start(chatId, { kind: "inline", metadata: { menuKind: "model", messageId: <id> } })`

When `clearActiveInlineMenu()` is called immediately after, it:

1. Retrieves the current interaction state
2. Calls `interactionManager.clear(chatId, reason)` which destroys the state

### Why model selection fails

When a user clicks a model button, `handleModelSelect()` in `src/bot/handlers/model.ts` calls:

```typescript
const isActiveMenu = await ensureActiveInlineMenu(ctx, "model");
if (!isActiveMenu) {
  return true; // Callback rejected as stale
}
```

`ensureActiveInlineMenu()` checks if `interactionManager` has an active inline state with:

- `menuKind === "model"`
- `messageId` matching the callback's message ID

Since `clearActiveInlineMenu()` was already called, no active state exists. The callback is rejected as stale.

## Why Other Commands Work

Commands like `/projects` and `/sessions` correctly do NOT call `clearActiveInlineMenu` after `replyWithInlineMenu`:

```typescript
// projects.ts line 194-198 — CORRECT
await replyWithInlineMenu(ctx, {
  menuKind: "project",
  text,
  keyboard,
});
// No clearActiveInlineMenu call here

// sessions.ts line 168-172 — CORRECT
await replyWithInlineMenu(ctx, {
  menuKind: "session",
  text: formatSessionsSelectText(firstPage.page),
  keyboard,
});
// No clearActiveInlineMenu call here
```

---

## Fix

**Action:** Remove line 111 from `src/bot/commands/models.ts`

```typescript
// DELETE this line:
clearActiveInlineMenu(chatId, "models_command");
```

The `replyWithInlineMenu()` function already handles creating the interaction state correctly. The `clearActiveInlineMenu()` call was either:

- A copy-paste error from legacy code
- An incorrect attempt to "clean up" before showing the menu

The menu should remain active until the user explicitly cancels it or selects an option.

---

## Files to Modify

| File                         | Change                                                              |
| ---------------------------- | ------------------------------------------------------------------- |
| `src/bot/commands/models.ts` | Remove line 111: `clearActiveInlineMenu(chatId, "models_command");` |

---

## Build and Restart

```bash
cd /media/ext4_storage/workspace/OpenCodeTelegramBot/opencode-telegram-bot
npm run build
sudo systemctl stop opencode-telegram-bot
sleep 25
sudo systemctl start opencode-telegram-bot
```

---

## Verification

After applying the fix:

1. Send `/models` in Telegram
2. Verify the inline keyboard with model buttons appears
3. Click any model button
4. Model should be selected and confirmation message shown
5. Main keyboard should update to reflect the new model

---

## Related Files

| File                              | Purpose                                                                  |
| --------------------------------- | ------------------------------------------------------------------------ |
| `src/bot/commands/models.ts`      | `/models` command handler — **bug location**                             |
| `src/bot/handlers/model.ts`       | Model selection callback — calls `ensureActiveInlineMenu`                |
| `src/bot/handlers/inline-menu.ts` | `replyWithInlineMenu`, `clearActiveInlineMenu`, `ensureActiveInlineMenu` |
| `src/interaction/manager.ts`      | Interaction state management                                             |
