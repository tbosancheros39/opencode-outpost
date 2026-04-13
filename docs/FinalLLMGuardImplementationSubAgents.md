# LLM Guard Implementation — Sub-Agent Plan

_Created: 08.04.2026_
_Based on: `FinalLLMGuardImplementation.md` (authoritative spec)_

---

## Confirmation: Does the Plan Make Sense?

**YES.** After thorough codebase analysis, the FinalLLMGuardImplementation.md plan is sound:

### Problem Validation
- The 6 direct-LLM commands (`/eli5`, `/feynman`, `/devils_advocate`, `/deep_research`, `/summarise`, `/steel_man`) currently fire LLM jobs immediately on button tap — even with no query — wasting tokens and producing a static error message with poor UX.
- The Two-Phase Guard correctly addresses both scenarios: empty query (Phase A → rotating opener) and accidental tap (Phase B → confirmation keyboard before enqueue).

### Architecture Validation
- **State machine** (IDLE → AWAITING_QUERY → AWAITING_CONFIRM → IDLE) is clean and correctly maps to the existing `interactionManager` API (`start`/`transition`/`clear`/`getSnapshot`).
- **Interaction guard middleware** (line 1033 in `bot/index.ts`) will correctly allow text through when in `awaiting_query` state (`expectedInput: "text"` matches `inputType: "text"`) and callbacks through when in `awaiting_confirm` state (`expectedInput: "mixed"` matches `inputType: "callback"`).
- **Race condition fix** (DeepSeek issue #3) is correctly addressed: `interactionManager.clear()` is called AFTER successful `addTaskJob()`, with keyboard restoration on failure.
- **HTML escaping** (DeepSeek issue #1) correctly prevents Telegram 400 errors on user-supplied query text.
- **All 7 DeepSeek issues** are resolved in the final code in Section 6.

### Integration Points Confirmed
| Integration | File | Line/Area | Status |
|-------------|------|-----------|--------|
| Text interceptor injection | `src/bot/index.ts` | ~line 1612 (before `processUserPrompt`) | Guard must go here, NOT inside `processUserPrompt` |
| Callback interceptor injection | `src/bot/index.ts` | ~line 1185 (callback_query:data handler) | Insert before unknown-callback fallback (~line 1238) |
| INLINE_COMMANDS loop refactor | `src/bot/index.ts` | ~line 1150 | Replace body with `handleLlmCommandRequest` call |
| `interactionManager` API | `src/interaction/manager.ts` | `start()`, `transition()`, `clear()`, `getSnapshot()` | All exist and match spec |
| `isForegroundBusy()` | `src/bot/utils/busy-guard.ts` | line 5 | Exists |
| `addTaskJob` | `src/queue/index.ts` | exported | Exists, same job shape used |

### Text-Prefix Paths Decision (Section 10)
The colon-prefix (`eli5: gravity`) and DM no-prefix (`eli5 gravity`) paths already have queries by definition. The doc recommends keeping them as direct `addTaskJob` for power-user speed. **This is the correct call** — the guard targets accidental button taps, not deliberate typed commands.

---

## Pre-Verification Results (Confirmed 08.04.2026)

These two items were verified against the actual codebase before deploying agents.

### PV-1: `parts: []` Requires Type Cast

**Finding:** `TaskJobData.parts` is typed as `Array<TextPartInput | FilePartInput>` (from `@opencode-ai/sdk/v2`). TypeScript strict mode rejects a bare `[]` literal as `never[]`.

**Required fix in `llm-command.ts`:**
```typescript
import type { TextPartInput, FilePartInput } from "@opencode-ai/sdk/v2";

// In the addTaskJob call:
parts: [] as Array<TextPartInput | FilePartInput>,
```

### PV-2: Line Numbers Are Approximate — Agents Must Grep

**Finding:** All `~line XXXX` references in this doc are approximations from a prior codebase snapshot. `bot/index.ts` is ~1600 lines and changes frequently.

**Required behaviour for Agents 2 & 3:** Use `grep` to find exact anchor strings before editing. Never rely on hardcoded line numbers.

**Anchor strings to grep for:**
| Change | Grep anchor |
|--------|------------|
| Import block | `from "./handlers/prompt.js"` (nearby import to add after) |
| Text interceptor position | `if (text.startsWith("/"))` (inject guard immediately after this block) |
| Callback fallback condition | `!handledJournal` (add `!handledLlmGuard` alongside) |
| INLINE_COMMANDS loop body | `for (const inlineCmd of INLINE_COMMANDS)` |

### PV-3: Confirmed APIs (No Changes Needed)

| Item | Status |
|------|--------|
| `t` export from `src/i18n/index.ts` | ✅ `export function t(key, params?, locale?)` — named export confirmed |
| `interactionManager.start(chatId, opts)` | ✅ Accepts `{ kind, expectedInput, allowedCommands?, metadata? }` |
| `interactionManager.transition(chatId, opts)` | ✅ Same shape, all fields optional |
| `interactionManager.clear(chatId)` | ✅ Works |
| `interactionManager.getSnapshot(chatId)` | ✅ Returns `InteractionState \| null` |
| `addTaskJob(data: TaskJobData)` | ✅ Exported from `src/queue/index.ts` |

---

## Sub-Agent Execution Plan

**4 sequential agents** (implementation is contained: 1 new file + 2 modifications).

> **⚠️ MANDATORY: Each sub-agent MUST load `telegram-OC` AND `continuous-learning-v2` skills as the VERY FIRST action before any other work. No exceptions.**

---

### Agent 1: Create Core Guard Module

**Load skills:** `telegram-OC` + `continuous-learning-v2`

**Task:** Create `src/bot/utils/llm-command.ts` with the full Two-Phase Guard implementation.

**Source:** Section 6 of `FinalLLMGuardImplementation.md` — copy the complete code block verbatim.

**What the file contains:**
- `escapeHtml()` — prevents Telegram 400 on user query text (Fix #1)
- `OPENERS` — 35 rotating openers per command (6 commands × 35 = 210 strings)
- `ACK_MESSAGES` — 15 rotating ack strings
- `getLlmCommandAck()` — renamed from `randomAck` to avoid collision (Fix #6)
- `handleLlmCommandRequest()` — Phase A (no query → opener) + Phase B (query → confirmation keyboard)
- `handleLlmQueryText()` — text interceptor for `awaiting_query` state, with 2-char minimum (Fix #7)
- `handleLlmConfirmCallback()` — callback handler for Proceed/Edit/Cancel, with race condition fix (Fix #3: clear AFTER successful enqueue)

**Key imports to verify exist:**
```typescript
import { interactionManager } from "../../interaction/manager.js";
import { isForegroundBusy, replyBusyBlocked } from "../utils/busy-guard.js";
import { addTaskJob } from "../../queue/index.js";
import { t } from "../../i18n/index.js";
import { logger } from "../../utils/logger.js";
```

**Deliverable:** New file `src/bot/utils/llm-command.ts` created.

**Verification:** `npx tsc --noEmit src/bot/utils/llm-command.ts` — no type errors.

---

### Agent 2: Wire Text Interceptor

**Load skills:** `telegram-OC` + `continuous-learning-v2`

**Task:** Inject `handleLlmQueryText` check in `src/bot/index.ts` at the correct position in the final `message:text` handler.

**File:** `src/bot/index.ts`

**Step 1 — Add import** (near top, alongside other handler imports ~line 94):
```typescript
import { handleLlmQueryText, handleLlmConfirmCallback, handleLlmCommandRequest } from "./utils/llm-command.js";
```

**Step 2 — Inject guard** in the final `bot.on("message:text", ...)` handler (~line 1455).

The guard must go AFTER the slash-command check (line 1468-1471) and BEFORE the inline command detection (line 1491). Specifically, inject right after:
```typescript
    if (text.startsWith("/")) {
      logger.info(`[DIAGNOSTIC] Final_message:text handler: starts with /, returning`);
      return;
    }
```

Add:
```typescript
    // ── LLM Guard: capture query input if we are in awaiting_query state ──
    if (await handleLlmQueryText(ctx)) return;
```

**Why here?** The interaction guard middleware (line 1033) already allows text through when in `awaiting_query` state (`expectedInput: "text"` matches). The guard must intercept before inline command detection or `processUserPrompt` runs.

**Deliverable:** `src/bot/index.ts` modified — import added + guard injected in final message:text handler.

---

### Agent 3: Wire Callback + Refactor INLINE_COMMANDS

**Load skills:** `telegram-OC` + `continuous-learning-v2`

**Task:** Two changes in `src/bot/index.ts`:

**Change A — Wire callback interceptor** in the `bot.on("callback_query:data", ...)` handler (~line 1185).

Insert `handleLlmConfirmCallback` BEFORE the unknown-callback fallback check (~line 1218). Add after the existing callback handlers (line 1212):
```typescript
      const handledLlmGuard = await handleLlmConfirmCallback(ctx);
```

Then add `!handledLlmGuard` to the fallback condition (line 1218-1237):
```typescript
      if (
        !handledShell &&
        !handledInlineCancel &&
        // ... existing checks ...
        !handledJournal &&
        !handledLlmGuard    // ← ADD THIS
      ) {
```

**Change B — Refactor INLINE_COMMANDS loop** (~line 1150-1181).

Replace the entire loop body with:
```typescript
  for (const inlineCmd of INLINE_COMMANDS) {
    bot.command(inlineCmd.slashCommand, async (ctx) => {
      const query = (ctx.match as string)?.trim() || undefined;
      await handleLlmCommandRequest(ctx, inlineCmd.slashCommand, query);
    });
  }
```

**What changes:**
- `query ?? ""` → `query || undefined` so empty string routes to Phase A
- Removed inline `minQueryLength` check — Phase A handles empty queries
- Removed direct `addTaskJob` call — only fires after Phase B Proceed
- Removed `t("inline.thinking")` ack — replaced by `getLlmCommandAck()` inside callback

**Deliverable:** `src/bot/index.ts` modified — callback wired + INLINE_COMMANDS loop refactored.

---

### Agent 4: Build Verification + Functional Check

**Load skills:** `telegram-OC` + `continuous-learning-v2`

**Task:** Verify the implementation compiles, lints, and passes tests.

**Step 1 — Build:**
```bash
cd /media/ext4_storage/workspace/OpenCodeTelegramBot/opencode-telegram-bot && npm run build
```
Expected: Zero errors. If errors exist, fix them (likely import path issues).

**Step 2 — Lint:**
```bash
npm run lint
```
Expected: Zero warnings. Fix any ESLint/Prettier issues.

**Step 3 — Tests:**
```bash
npm test
```
Expected: All existing tests pass. The guard doesn't break existing flows.

**Step 4 — Functional smoke check** (manual verification checklist from Section 13):

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| 1 | Tap `/feynman` with no args | Random opener from feynman pool appears; no LLM job fired |
| 2 | Type text after opener | Phase B confirmation keyboard with command name appears |
| 3 | Type 1 char after opener | "Please provide a query of at least 2 characters." — no Phase B |
| 4 | Press ✅ Proceed | Message edits to random ack; LLM job fires |
| 5 | Press ✏️ Edit | Shows command name + previous query + "Send updated query (expires in 5m)" |
| 6 | Press ❌ Cancel | "❌ Command cancelled." — no job fired |
| 7 | Wait 5+ min, press Proceed | "⏱ Request timed out." — no job fired |
| 8 | `/eli5 what is gravity` (direct) | Skips Phase A, shows Phase B confirmation immediately |
| 9 | `/eli5 what is *bold*` | HTML-escaped query in confirmation — no Telegram 400 |

**Deliverable:** Build/lint/test all pass. Functional checklist documented.

---

## Execution Order

```
Agent 1 (create llm-command.ts)
    │
    ▼
Agent 2 (wire text interceptor in index.ts)
    │
    ▼
Agent 3 (wire callback + refactor INLINE_COMMANDS in index.ts)
    │
    ▼
Agent 4 (build + lint + test verification)
```

**Sequential dependency:** Each agent depends on the previous. Agent 2 and 3 both modify `bot/index.ts` but at different locations — they must be sequential to avoid merge conflicts.

---

## Files Modified Summary

| File | Agent | Action |
|------|-------|--------|
| `src/bot/utils/llm-command.ts` | Agent 1 | **CREATE** — full guard module |
| `src/bot/index.ts` | Agent 2 | **MODIFY** — add import + text interceptor |
| `src/bot/index.ts` | Agent 3 | **MODIFY** — callback interceptor + INLINE_COMMANDS refactor |
| (all files) | Agent 4 | **VERIFY** — build + lint + test |

---

## Critical Notes for Agents

1. **Do NOT modify `src/bot/handlers/prompt.ts`** — despite the doc mentioning it, the actual injection point is in `src/bot/index.ts`'s final `message:text` handler (line ~1455). The `processUserPrompt` function in prompt.ts is called FROM index.ts, so the guard must intercept BEFORE that call.

2. **Import paths use `.js` extensions** — this is an ESM project. All imports must use `.js` extensions (e.g., `"./utils/llm-command.js"`).

3. **The `interactionManager.start()` call uses `kind: "custom"`** — this is intentional. The interaction guard middleware allows text/callback through for `custom` kind when `expectedInput` matches.

4. **Race condition fix is critical** — `interactionManager.clear()` must be called AFTER `addTaskJob()` succeeds, not before. On failure, restore the keyboard so the user can retry.

5. **HTML parse_mode throughout** — all guard messages use `parse_mode: "HTML"` with `escapeHtml()`. Do NOT use Markdown or MarkdownV2.

6. **`getLlmCommandAck()` not `randomAck()`** — the function is renamed to avoid collision with `src/bot/utils/ack-messages.ts`'s `randomAck()`.

7. **`t` import is confirmed** — `src/i18n/index.ts` exports `t` as a named function. Use `import { t } from "../../i18n/index.js"` directly. ✅ Pre-verified.

8. **`parts: []` MUST be cast** — `TaskJobData.parts` is `Array<TextPartInput | FilePartInput>` (from `@opencode-ai/sdk/v2`). A bare `[]` fails strict TypeScript. Agent 1 MUST:
   ```typescript
   import type { TextPartInput, FilePartInput } from "@opencode-ai/sdk/v2";
   // then in addTaskJob call:
   parts: [] as Array<TextPartInput | FilePartInput>,
   ```

9. **Grep for anchor strings, never use hardcoded line numbers** — All `~line XXXX` references in this doc are approximations. See Pre-Verification section PV-2 for the exact grep anchors to use.

10. **Skills FIRST, always** — Before any file read or code change, every agent MUST invoke `telegram-OC` and `continuous-learning-v2` skills. This is non-negotiable.

---

## Post-Implementation

After all 4 agents complete:
1. Compact the session
2. Report final status:
   ```
   COMMANDS_MODIFIED: eli5, feynman, devils_advocate, deep_research, summarise, steel_man
   FILES_CHANGED: src/bot/utils/llm-command.ts (NEW), src/bot/index.ts (MODIFIED)
   BUILD_STATUS: PASS/FAIL
   LINT_STATUS: PASS/FAIL
   TEST_STATUS: PASS/FAIL
   DEPLOYMENT_NOTES: No env changes needed. No systemd changes needed.
   ```
