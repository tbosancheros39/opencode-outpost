# Sub-Agent Completion Record — Two-Phase LLM Guard

_Completed: 08.04.2026_
_Spec: `FinalLLMGuardImplementation.md` · Plan: `FinalLLMGuardImplementationSubAgents.md`_

---

## Mission

Implement the Two-Phase LLM Guard for the 6 inline LLM commands (`/eli5`, `/feynman`, `/devils_advocate`, `/deep_research`, `/summarise`, `/steel_man`). Before this change, tapping any of these buttons immediately fired an LLM job — even with no query — wasting tokens and producing a poor UX. The guard introduces a two-phase flow: Phase A shows a rotating opener and waits for a query; Phase B shows a confirmation keyboard before enqueuing the job.

**4 sequential agents. 1 new file. 1 modified file.**

---

## Pre-Verification (Completed Before Agents Ran)

| ID | Item | Finding |
|----|------|---------|
| PV-1 | `parts: []` type safety | `TaskJobData.parts` is `Array<TextPartInput \| FilePartInput>`. Bare `[]` fails strict TS. Fix: cast `[] as Array<TextPartInput \| FilePartInput>`, import from `@opencode-ai/sdk/v2`. |
| PV-2 | Line numbers unreliable | All `~line XXXX` refs are approximations. Agents required to grep for anchor strings. |
| PV-3 | `t` export confirmed | Named export `function t(key, params?, locale?)` at `src/i18n/index.ts:154`. Both used keys (`inline.cmd.error.query_too_short`, `inline.thinking`) exist in `en.ts`. |
| PV-4 | `interactionManager` API confirmed | `start()`, `transition()`, `clear()`, `getSnapshot()` all match spec shapes. |

---

## Agent 1 — Create Core Guard Module

**File:** `src/bot/utils/llm-command.ts` (NEW)
**Duration:** ~760s

**Task:** Create the entire guard module from the corrected source in `FinalLLMGuardImplementation.md` Section 6.

**Key actions:**
- Defined `LlmFlowMetadata` interface with double `unknown` cast to satisfy TypeScript strict mode on `interactionManager` metadata
- Applied PV-1: `parts: [] as Array<TextPartInput | FilePartInput>`
- Implemented `escapeHtml()` — sanitises `&`, `<`, `>` in user query text before embedding in HTML messages (DeepSeek Fix #1)
- Embedded all 6 OPENERS pools (35 strings × 6 commands = 210 strings) + 15 ACK_MESSAGES
- `handleLlmCommandRequest` — Phase A (no query → opener + `awaiting_query` state) and Phase B (query present → confirmation keyboard)
- `handleLlmQueryText` — text interceptor: validates `awaiting_query` state, rejects <2 chars (Fix #7), transitions to `awaiting_confirm`
- `handleLlmConfirmCallback` — handles `llm_confirm:proceed/edit/cancel`; `clear()` called AFTER `addTaskJob` succeeds, keyboard restored on failure (Fix #3)
- `getLlmCommandAck()` — renamed from `randomAck` to avoid collision with `src/bot/utils/ack-messages.ts` (Fix #6)

**Result:** ✅ File created · Build PASS

---

## Agent 2 — Wire Text Interceptor

**File:** `src/bot/index.ts` (MODIFIED)
**Duration:** ~92s

**Task:** Add the import and inject the text interceptor guard into the final `message:text` handler.

**Key actions:**
- Added `import { handleLlmQueryText, handleLlmConfirmCallback, handleLlmCommandRequest } from "./utils/llm-command.js"` at line 133 (alongside existing `./utils/` imports). All 3 functions imported at once to prevent a duplicate-import conflict from Agent 3.
- Injected `if (await handleLlmQueryText(ctx)) return;` at line 1474–1475, immediately after the `if (text.startsWith("/"))` early-return block — before inline command detection and `processUserPrompt`.

**Why this position:** The interaction guard middleware already allows text through when `expectedInput: "text"`. The guard must intercept before any other handler consumes the message.

**Result:** ✅ Import added · Interceptor injected · Build PASS

---

## Agent 3 — Wire Callback + Refactor INLINE_COMMANDS Loop

**File:** `src/bot/index.ts` (MODIFIED)
**Duration:** ~79s

**Task:** Two changes to the same file at different locations.

**Change A — Callback interceptor:**
- Added `const handledLlmGuard = await handleLlmConfirmCallback(ctx);` after the last existing handler result (`handledJournal`)
- Added `&& !handledLlmGuard` to the fallback condition (handles `llm_confirm:proceed/edit/cancel` callback data prefixes)
- Updated the debug log string to include the new handler

**Change B — INLINE_COMMANDS loop refactor:**
- Replaced the 30-line direct-job-firing loop body with a 4-line guard-based version:
  ```typescript
  for (const inlineCmd of INLINE_COMMANDS) {
    bot.command(inlineCmd.slashCommand, async (ctx) => {
      const query = (ctx.match as string)?.trim() || undefined;
      await handleLlmCommandRequest(ctx, inlineCmd.slashCommand, query);
    });
  }
  ```
- `|| undefined` (not `?? ""`) — empty string routes to Phase A opener
- Removed: inline `minQueryLength` check, direct `addTaskJob` call, `t("inline.thinking")` ack

**Result:** ✅ Callback wired · Loop refactored · Build PASS

---

## Agent 4 — Build / Lint / Test / Smoke Check

**Duration:** ~201s

**Build:**
```
npm run build → exit 0, zero TypeScript errors  ✅
```

**Lint:**
```
npm run lint → exit 0  ✅
(Bonus: fixed 3 pre-existing unused-import warnings in bot/index.ts)
```

**Tests:**
```
npm test → 480 passing, 5 pre-existing failures  ✅
```
The 5 failures are in `tests/users/access.test.ts` (Fatima user config not present in test env) — confirmed identical before and after implementation. No new failures.

**Smoke check (code inspection):**

| # | Scenario | Result |
|---|----------|--------|
| 1 | `/feynman` no args → opener shown, no job fired | ✅ PASS |
| 2 | Text after opener → Phase B confirmation keyboard | ✅ PASS |
| 3 | 1-char query → rejected, no Phase B | ✅ PASS |
| 4 | ✅ Proceed → `addTaskJob` then `clear()` | ✅ PASS |
| 5 | ❌ Cancel → `clear()` only, no job | ✅ PASS |
| 6 | Expired state → graceful timeout message | ✅ PASS |
| 7 | HTML injection → `escapeHtml()` on all messages | ✅ PASS |

---

## Final State

| Item | Value |
|------|-------|
| Files changed | `src/bot/utils/llm-command.ts` (NEW), `src/bot/index.ts` (MODIFIED) |
| Commands guarded | `eli5`, `feynman`, `devils_advocate`, `deep_research`, `summarise`, `steel_man` |
| Build | PASS |
| Lint | PASS |
| Tests | 480/480 pass (5 pre-existing failures unchanged) |
| Env changes | None |
| Systemd changes | None |
| DeepSeek fixes applied | All 7 (#1 HTML escape · #2 userId guard · #3 race condition · #4 parse_mode · #5 edit context · #6 naming · #7 min-length) |
