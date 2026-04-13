# LLM Guard — i18n + Minor Fixes

_Created: 08.04.2026_
_Audits: sub-agent implementation of Two-Phase LLM Guard_

---

## Issues to Fix

| # | Severity | Issue | Impact |
|---|----------|-------|--------|
| 1 | 🟠 Medium | Hardcoded English strings in `llm-command.ts` | Not localizable — breaks i18n convention |
| 2 | 🟡 Minor | Redundant `interactionManager.clear()` in `handleLlmQueryText` | Harmless double-clear, minor code smell |
| 3 | 🟡 Minor | `awaiting_confirm` + typed text behavior undocumented | Edge case not in state machine docs |

---

## Fix 1: i18n Keys for LLM Guard Messages

### Problem

`src/bot/utils/llm-command.ts` has ~8 hardcoded English strings. The project convention (AGENTS.md) requires user-facing strings through `t()`. Currently these strings are not localizable:

| Location | Hardcoded String |
|----------|-----------------|
| `handleLlmQueryText` timeout | `"⏱ Request timed out. Please try the command again."` |
| `handleLlmQueryText` min-length | `"Please provide a query of at least 2 characters."` |
| `handleLlmConfirmCallback` timeout | `"⏱ Request timed out."` |
| `handleLlmConfirmCallback` cancel | `"❌ Command cancelled."` |
| `handleLlmConfirmCallback` nothing pending | `"Nothing pending."` |
| `handleLlmConfirmCallback` edit prompt | `"Command: <b>/{command}</b>\nPrevious: ...\nSend your updated query (expires in 5m):"` |
| `handleLlmConfirmCallback` queue fail | `"<b>/{command}</b>: ...\n\n⚠️ Failed to queue. Try again?"` |
| `getRandomOpener` fallback | `"What is your query?"` |

### Solution

#### Step 1 — Add i18n keys to `src/i18n/en.ts`

Add before the closing `} as const;` (before line 548):

```typescript
  // ── LLM Guard (Two-Phase) ──────────────────────────────────────────────
  "llm.guard.query_timeout": "⏱ Request timed out. Please try the command again.",
  "llm.guard.confirm_timeout": "⏱ Request timed out.",
  "llm.guard.cancelled": "❌ Command cancelled.",
  "llm.guard.nothing_pending": "Nothing pending.",
  "llm.guard.query_too_short": "Please provide a query of at least 2 characters.",
  "llm.guard.edit_prompt":
    'Command: <b>/{command}</b>\nPrevious: "{query}"\n\n<i>Send your updated query (expires in 5m):</i>',
  "llm.guard.queue_failed":
    '<b>/{command}</b>: "{query}"\n\n⚠️ Failed to queue. Try again?',
  "llm.guard.fallback_query": "What is your query?",
```

**Note:** `{command}` and `{query}` are interpolation params. The `t()` function in `index.ts` handles `{key}` replacement via `interpolate()`. The leading `/` on `{command}` is in the template so callers pass just the command name (e.g. `"eli5"`).

#### Step 2 — Add Bosnian translations to `src/i18n/bs.ts`

Add before the closing `} as const;`:

```typescript
  // ── LLM Guard (Two-Phase) ──────────────────────────────────────────────
  "llm.guard.query_timeout": "⏱ Vrijeme je isteklo. Molim pokušajte ponovo.",
  "llm.guard.confirm_timeout": "⏱ Vrijeme je isteklo.",
  "llm.guard.cancelled": "❌ Komanda otkazana.",
  "llm.guard.nothing_pending": "Ništa na čekanju.",
  "llm.guard.query_too_short": "Molim unesite upit od najmanje 2 karaktera.",
  "llm.guard.edit_prompt":
    'Komanda: <b>/{command}</b>\nPrethodno: "{query}"\n\n<i>Pošaljite ažurirani upit (ističe za 5 min):</i>',
  "llm.guard.queue_failed":
    '<b>/{command}</b>: "{query}"\n\n⚠️ Neuspješno dodavanje u red. Pokušati ponovo?',
  "llm.guard.fallback_query": "Koji je vaš upit?",
```

#### Step 3 — Add translations to remaining locale files

**`src/i18n/de.ts`** (German):
```typescript
  "llm.guard.query_timeout": "⏱ Zeit abgelaufen. Bitte versuchen Sie es erneut.",
  "llm.guard.confirm_timeout": "⏱ Zeit abgelaufen.",
  "llm.guard.cancelled": "❌ Befehl abgebrochen.",
  "llm.guard.nothing_pending": "Nichts ausstehend.",
  "llm.guard.query_too_short": "Bitte geben Sie eine Anfrage mit mindestens 2 Zeichen ein.",
  "llm.guard.edit_prompt":
    'Befehl: <b>/{command}</b>\nVorher: "{query}"\n\n<i>Senden Sie Ihre aktualisierte Anfrage (Läuft in 5 Min. ab):</i>',
  "llm.guard.queue_failed":
    '<b>/{command}</b>: "{query}"\n\n⚠️ Warteschlange fehlgeschlagen. Erneut versuchen?',
  "llm.guard.fallback_query": "Was ist Ihre Anfrage?",
```

**`src/i18n/es.ts`** (Spanish):
```typescript
  "llm.guard.query_timeout": "⏱ Tiempo agotado. Por favor, inténtelo de nuevo.",
  "llm.guard.confirm_timeout": "⏱ Tiempo agotado.",
  "llm.guard.cancelled": "❌ Comando cancelado.",
  "llm.guard.nothing_pending": "Nada pendiente.",
  "llm.guard.query_too_short": "Por favor, proporcione una consulta de al menos 2 caracteres.",
  "llm.guard.edit_prompt":
    'Comando: <b>/{command}</b>\nAnterior: "{query}"\n\n<i>Envíe su consulta actualizada (expira en 5 min):</i>',
  "llm.guard.queue_failed":
    '<b>/{command}</b>: "{query}"\n\n⚠️ Error al encolar. ¿Intentar de nuevo?',
  "llm.guard.fallback_query": "¿Cuál es su consulta?",
```

**`src/i18n/fr.ts`** (French):
```typescript
  "llm.guard.query_timeout": "⏱ Temps écoulé. Veuillez réessayer.",
  "llm.guard.confirm_timeout": "⏱ Temps écoulé.",
  "llm.guard.cancelled": "❌ Commande annulée.",
  "llm.guard.nothing_pending": "Rien en attente.",
  "llm.guard.query_too_short": "Veuillez fournir une requête d'au moins 2 caractères.",
  "llm.guard.edit_prompt":
    'Commande : <b>/{command}</b>\nPrécédent : "{query}"\n\n<i>Envoyez votre requête mise à jour (expire dans 5 min) :</i>',
  "llm.guard.queue_failed":
    '<b>/{command}</b> : "{query}"\n\n⚠️ Échec de la mise en file. Réessayer ?',
  "llm.guard.fallback_query": "Quelle est votre requête ?",
```

**`src/i18n/ru.ts`** (Russian):
```typescript
  "llm.guard.query_timeout": "⏱ Время истекло. Пожалуйста, попробуйте снова.",
  "llm.guard.confirm_timeout": "⏱ Время истекло.",
  "llm.guard.cancelled": "❌ Команда отменена.",
  "llm.guard.nothing_pending": "Нет ожидающих запросов.",
  "llm.guard.query_too_short": "Пожалуйста, введите запрос не менее 2 символов.",
  "llm.guard.edit_prompt":
    'Команда: <b>/{command}</b>\nПредыдущий: "{query}"\n\n<i>Отправьте обновлённый запрос (истекает через 5 мин):</i>',
  "llm.guard.queue_failed":
    '<b>/{command}</b>: "{query}"\n\n⚠️ Не удалось поставить в очередь. Повторить?',
  "llm.guard.fallback_query": "Какой у вас запрос?",
```

**`src/i18n/zh.ts`** (Chinese):
```typescript
  "llm.guard.query_timeout": "⏱ 请求超时。请重试。",
  "llm.guard.confirm_timeout": "⏱ 请求超时。",
  "llm.guard.cancelled": "❌ 命令已取消。",
  "llm.guard.nothing_pending": "没有待处理的请求。",
  "llm.guard.query_too_short": "请输入至少 2 个字符的查询。",
  "llm.guard.edit_prompt":
    '命令: <b>/{command}</b>\n之前: "{query}"\n\n<i>发送更新后的查询（5 分钟后过期）:</i>',
  "llm.guard.queue_failed":
    '<b>/{command}</b>: "{query}"\n\n⚠️ 加入队列失败。重试？',
  "llm.guard.fallback_query": "您的查询是什么？",
```

#### Step 4 — Update `src/bot/utils/llm-command.ts`

**Add import** at top of file:
```typescript
import { t } from "../../i18n/index.js";
```

**Replace hardcoded strings** with `t()` calls:

| Line | Before | After |
|------|--------|-------|
| 282 | `return "What is your query?";` | `return t("llm.guard.fallback_query");` |
| 359 | `"⏱ Request timed out. Please try the command again."` | `t("llm.guard.query_timeout")` |
| 365 | `"Please provide a query of at least 2 characters."` | `t("llm.guard.query_too_short")` |
| 390 | `"Nothing pending."` | `t("llm.guard.nothing_pending")` |
| 403 | `"⏱ Request timed out."` | `t("llm.guard.confirm_timeout")` |
| 413 | `"❌ Command cancelled."` | `t("llm.guard.cancelled")` |
| 434 | hardcoded edit prompt string | `t("llm.guard.edit_prompt", { command: snap.command, query: escapeHtml(snap.query) })` |
| 482 | hardcoded queue failed string | `t("llm.guard.queue_failed", { command: snap.command, query: escapeHtml(snap.query) })` |

**Important:** The `escapeHtml()` calls for `query` param must happen BEFORE passing to `t()`, since the template contains HTML and the query is user-supplied. The `t()` function does `{key}` interpolation but does NOT escape HTML.

---

## Fix 2: Remove Redundant `interactionManager.clear()`

### Problem

In `handleLlmQueryText` (line 369 of `llm-command.ts`):
```typescript
interactionManager.clear(chatId, "llm_query_received");  // ← clears state
await handleLlmCommandRequest(ctx, snap.command, text);   // ← start() also clears
```

`handleLlmCommandRequest` calls `interactionManager.start()` which internally calls `this.clear(chatId, "state_replaced")` (see `manager.ts` line 64). So the clear on line 369 is redundant.

### Solution

Remove line 369. The `start()` call in `handleLlmCommandRequest` will handle the state replacement:

```typescript
  // Remove this line:
  // interactionManager.clear(chatId, "llm_query_received");

  await handleLlmCommandRequest(ctx, snap.command, text);
  return true;
```

This is a zero-impact change — same behavior, one fewer call.

---

## Fix 3: Document `awaiting_confirm` + Typed Text Behavior

### Problem

When the user is in `awaiting_confirm` state (Phase B keyboard visible) and types text instead of pressing a button:

1. Interaction guard allows it through (`expectedInput: "mixed"` matches `inputType: "text"`)
2. `handleLlmQueryText` returns `false` (stage is `awaiting_confirm`, not `awaiting_query`)
3. Text goes to normal prompt processing via `processUserPrompt`
4. `processUserPrompt` calls `interactionManager.start()` which clears the `awaiting_confirm` state
5. The LLM command confirmation is abandoned

This is **acceptable behavior** — new text takes priority over a pending confirmation. But it's undocumented.

### Solution

Add a comment in `llm-command.ts` above `handleLlmConfirmCallback` explaining this edge case:

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

No code change needed — just documentation for future maintainers.

---

## Implementation Order

```
1. Add i18n keys to en.ts (defines I18nKey type)
2. Add translations to bs.ts, de.ts, es.ts, fr.ts, ru.ts, zh.ts
3. Update llm-command.ts: add t() import, replace hardcoded strings
4. Remove redundant clear in handleLlmQueryText
5. Add edge-case comment in handleLlmConfirmCallback
6. npm run build && npm run lint && npm test
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/i18n/en.ts` | ADD 8 keys (`llm.guard.*`) |
| `src/i18n/bs.ts` | ADD 8 Bosnian translations |
| `src/i18n/de.ts` | ADD 8 German translations |
| `src/i18n/es.ts` | ADD 8 Spanish translations |
| `src/i18n/fr.ts` | ADD 8 French translations |
| `src/i18n/ru.ts` | ADD 8 Russian translations |
| `src/i18n/zh.ts` | ADD 8 Chinese translations |
| `src/bot/utils/llm-command.ts` | ADD `t` import, REPLACE 8 hardcoded strings, REMOVE 1 redundant clear, ADD 1 comment |

---

## Verification

After implementation:

```bash
cd /media/ext4_storage/workspace/OpenCodeTelegramBot/opencode-telegram-bot
npm run build   # Must pass — new I18nKey type includes llm.guard.* keys
npm run lint    # Must pass — no unused imports
npm test        # 480/480 — no regressions
```

**Manual check:** Set `BOT_LOCALE=bs` in `.env`, trigger `/eli5` with no args → opener should appear (still English, openers are not i18n'd). Then type a query → confirmation keyboard appears. Press Proceed → ack message appears (still English, acks are not i18n'd). Press Cancel → should see "❌ Komanda otkazana." in Bosnian.

---

## Note: Openers and Acks Are NOT i18n'd

The 210 OPENERS strings and 15 ACK_MESSAGES are intentionally left as hardcoded English. These are personality/brand strings that don't need translation — they give the bot its voice. If you want them translated in the future, they'd need a separate i18n key system (e.g. `llm.opener.eli5.0` through `llm.opener.eli5.34`), which is a much larger undertaking.

Only the **system messages** (timeouts, errors, prompts) are being i18n'd in this fix.
