# LLM Guard — i18n Fix: Completion Record

_Completed: 08.04.2026_  
_Based on: `docs/LLMGuardI18nFix.md`_

---

## What Was Fixed

Three issues in the Two-Phase LLM Guard implementation were addressed:

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | 🟠 Medium | 8 hardcoded English strings in `llm-command.ts` | ✅ Fixed |
| 2 | 🟡 Minor | Redundant `interactionManager.clear()` in `handleLlmQueryText` | ✅ Fixed |
| 3 | 🟡 Minor | `awaiting_confirm` + typed text edge case undocumented | ✅ Documented |

---

## Fix 1 — i18n Keys for LLM Guard Messages

### Problem

`src/bot/utils/llm-command.ts` contained 8 hardcoded English strings sent directly to the user. The project convention requires all user-facing strings to go through `t()` (the i18n translation function). These strings were invisible to the locale system — users with `BOT_LOCALE=de` would still see English error messages from the guard.

### How It Was Fixed

#### Step 1 — `src/i18n/en.ts`

Added 8 new keys under a `// ── LLM Guard (Two-Phase)` comment block, before the closing `} as const;`:

```typescript
"llm.guard.query_timeout":  "⏱ Request timed out. Please try the command again."
"llm.guard.confirm_timeout": "⏱ Request timed out."
"llm.guard.cancelled":       "❌ Command cancelled."
"llm.guard.nothing_pending": "Nothing pending."
"llm.guard.query_too_short": "Please provide a query of at least 2 characters."
"llm.guard.edit_prompt":     "Command: <b>/{command}</b>\nPrevious: \"{query}\"..."
"llm.guard.queue_failed":    "<b>/{command}</b>: \"{query}\"\n\n⚠️ Failed to queue..."
"llm.guard.fallback_query":  "What is your query?"
```

Adding to `en.ts` is what extends the `I18nKey` union type — all other locale files are validated against it at build time.

#### Step 2 — All 6 locale files

The same 8 keys were added to each locale file with native translations:

| File | Language | Closing token |
|------|----------|--------------|
| `src/i18n/bs.ts` | Bosnian | `} as const;` |
| `src/i18n/de.ts` | German | `};` |
| `src/i18n/es.ts` | Spanish | `};` |
| `src/i18n/fr.ts` | French | `};` |
| `src/i18n/ru.ts` | Russian | `};` |
| `src/i18n/zh.ts` | Chinese | `};` |

Each block was inserted before the file's closing token (different between `bs.ts`/`en.ts` which use `as const` and the rest which don't).

#### Step 3 — `src/bot/utils/llm-command.ts`

**Added import** at the top alongside existing imports:

```typescript
import { t } from "../../i18n/index.js";
```

**Replaced all 8 hardcoded strings** with `t()` calls:

| Location | Before | After |
|----------|--------|-------|
| `getRandomOpener` fallback | `"What is your query?"` | `t("llm.guard.fallback_query")` |
| `handleLlmQueryText` timeout reply | `"⏱ Request timed out..."` | `t("llm.guard.query_timeout")` |
| `handleLlmQueryText` min-length reply | `"Please provide..."` | `t("llm.guard.query_too_short")` |
| `handleLlmConfirmCallback` nothing pending | `"Nothing pending."` | `t("llm.guard.nothing_pending")` |
| `handleLlmConfirmCallback` timeout edit | `"⏱ Request timed out."` | `t("llm.guard.confirm_timeout")` |
| `handleLlmConfirmCallback` cancel edit | `"❌ Command cancelled."` | `t("llm.guard.cancelled")` |
| `handleLlmConfirmCallback` edit branch | hardcoded template literal | `t("llm.guard.edit_prompt", { command: snap.command, query: escapeHtml(snap.query) })` |
| `handleLlmConfirmCallback` queue-fail edit | hardcoded template literal | `t("llm.guard.queue_failed", { command: snap.command, query: escapeHtml(snap.query) })` |

**Important:** For `edit_prompt` and `queue_failed`, `escapeHtml(snap.query)` is applied **before** passing to `t()`. The `t()` function does `{key}` string interpolation but does not HTML-escape values — so the query (user-supplied text) must be escaped first since both templates are rendered with `parse_mode: "HTML"`.

---

## Fix 2 — Remove Redundant `interactionManager.clear()`

### Problem

In `handleLlmQueryText`, line 369 called `interactionManager.clear()` immediately before calling `handleLlmCommandRequest()`:

```typescript
interactionManager.clear(chatId, "llm_query_received");   // ← redundant
await handleLlmCommandRequest(ctx, snap.command, text);    // calls start() → clears internally
```

`handleLlmCommandRequest` calls `interactionManager.start()`, which internally calls `this.clear(chatId, "state_replaced")` (see `manager.ts`). The explicit `clear()` on the line before was a double-clear — harmless but noisy.

### How It Was Fixed

Removed the redundant `interactionManager.clear()` line. The `start()` call inside `handleLlmCommandRequest` handles state cleanup:

```typescript
// before
interactionManager.clear(chatId, "llm_query_received");
await handleLlmCommandRequest(ctx, snap.command, text);

// after
await handleLlmCommandRequest(ctx, snap.command, text);
```

Zero behavior change. One fewer interaction manager call in the hot path.

---

## Fix 3 — Document `awaiting_confirm` + Typed Text Edge Case

### Problem

The behavior when a user types free text while in `awaiting_confirm` state (Phase B keyboard is visible) was not documented anywhere. The flow is:

1. User has a confirmation keyboard on screen (`✅ Proceed / ✏️ Edit / ❌ Cancel`)
2. User types new text instead of pressing a button
3. Interaction guard allows it through (`expectedInput: "mixed"` matches `inputType: "text"`)
4. `handleLlmQueryText` returns `false` (stage is `awaiting_confirm`, not `awaiting_query`)
5. Text flows to `processUserPrompt`
6. `processUserPrompt` calls `interactionManager.start()` → clears `awaiting_confirm` state
7. The pending LLM confirmation is silently abandoned

This is **intentional design** — new text takes priority. But without documentation, a future maintainer could mistake it for a bug.

### How It Was Fixed

Added an explanatory comment block directly above `handleLlmConfirmCallback`:

```typescript
// ─── Callback interceptor — inject in bot/index.ts callback_query:data ───────
// Returns true if this callback was consumed by the guard (caller must return).
//
// Edge case: If the user types text while in awaiting_confirm state, the
// interaction guard allows it (expectedInput: "mixed"), but this handler
// returns false (wrong stage). The text flows to processUserPrompt, which
// starts a new interaction and clears the awaiting_confirm state. This is
// intentional — new text takes priority over a pending LLM confirmation.
export async function handleLlmConfirmCallback(ctx: Context): Promise<boolean> {
```

No code change. Documentation only.

---

## Files Modified

| File | Change |
|------|--------|
| `src/i18n/en.ts` | Added 8 `llm.guard.*` keys (extends `I18nKey` type) |
| `src/i18n/bs.ts` | Added 8 Bosnian translations |
| `src/i18n/de.ts` | Added 8 German translations |
| `src/i18n/es.ts` | Added 8 Spanish translations |
| `src/i18n/fr.ts` | Added 8 French translations |
| `src/i18n/ru.ts` | Added 8 Russian translations |
| `src/i18n/zh.ts` | Added 8 Chinese translations |
| `src/bot/utils/llm-command.ts` | Added `t` import; replaced 8 hardcoded strings; removed 1 redundant clear; added 1 edge-case comment |

**Total:** 8 files modified, 0 files created.

---

## Verification Results

```
npm run build  →  ✅ 0 TypeScript errors
npm run lint   →  ✅ 0 ESLint warnings
npm test       →  ✅ 480/480 tests pass
                  ⚠️  5 pre-existing failures in tests/users/access.test.ts
                      (Fatima user config — unrelated, unchanged)
```

The build confirms the new `I18nKey` type (extended by `en.ts`) correctly covers all 8 `llm.guard.*` call sites in `llm-command.ts`. Any missing key would be a compile error.

---

## Note: Openers and Acks Left as English

The 210 OPENERS strings and 15 ACK_MESSAGES remain hardcoded English. These are personality/brand strings — they give the bot its voice. Only **system messages** (errors, prompts, status) were i18n'd. If openers need translation in the future, a separate key system (e.g. `llm.opener.eli5.0` … `llm.opener.eli5.34`) would be required — a much larger undertaking.
