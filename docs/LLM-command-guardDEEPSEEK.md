## 🔍 FinalLLMGuardImplementation.md — Code Review & Issues

The document is thorough and well‑structured. However, several issues need fixing **before implementation** to avoid runtime crashes, security holes, or UX confusion.

---

### 🔴 Critical Issues (Must Fix)

#### 1. **Markdown injection / parsing crash**
**Location:** `handleLlmCommandRequest` Phase B
```ts
await ctx.reply(
  `*${command}*: "${query.trim()}"\n\nShall I proceed?`,
  { parse_mode: "Markdown", reply_markup: keyboard },
);
```
**Problem:** If `query` contains any Markdown special characters (`*`, `_`, `[`, `]`, `(`, `)`, `~`, `` ` ``, `>`, `#`, `+`, `-`, `=`, `|`, `{`, `}`, `.`, `!`), Telegram will return **400: can’t parse entities**. The bot will crash the command.

**Fix:** Escape the query for Markdown (or MarkdownV2). Use your existing `escapeMarkdownV2` utility (if available) or a simple escape function.
**Suggestion:** Switch to `parse_mode: "MarkdownV2"` and escape all special characters in the query.

---

#### 2. **Missing `userId` guard**
**Location:** `handleLlmConfirmCallback` → `addTaskJob` call
```ts
await addTaskJob({
  // ...
  userId,  // ← may be undefined
});
```
`TaskJobData.userId` is typed as `number`. If `ctx.from` is missing (e.g., callback from a channel or deleted user), `userId` becomes `undefined` and the job will **fail silently** (or throw at runtime).

**Fix:**
```ts
if (!userId) {
  await ctx.answerCallbackQuery("User identity missing.");
  await ctx.api.editMessageText(chatId, snap.messageId, "❌ Cannot proceed without user ID.");
  return true;
}
```

---

#### 3. **Race condition on `interactionManager.clear`**
**Location:** `handleLlmConfirmCallback` → `proceed` branch
```ts
await ctx.api.editMessageText(chatId, snap.messageId, ackText);
interactionManager.clear(chatId, "llm_confirm_proceed");
await addTaskJob(...); // if this throws, state is already cleared
```
If `addTaskJob` fails (Redis down, queue error, etc.), the user sees the ack message but the job never runs, and there’s no way to retry because the interaction state is gone.

**Fix:** Clear **after** successful enqueue, or add a recovery path:
```ts
try {
  await addTaskJob(...);
  interactionManager.clear(chatId, "llm_confirm_proceed");
} catch (err) {
  // revert the edited message back to the confirmation keyboard
  await ctx.api.editMessageText(chatId, snap.messageId,
    `*${snap.command}*: "${snap.query}"\n\nShall I proceed?`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
  // keep interaction state so user can retry
  throw err; // or log and notify user
}
```

---

### 🟠 Medium Issues (Should Fix)

#### 4. **`parse_mode` inconsistency**
- Phase B uses `parse_mode: "Markdown"` (legacy)
- The rest of your bot (and the `resolveInlineQuery` output) likely uses `MarkdownV2`
- The `randomAck()` messages are plain text, but the final answer from `resolveInlineQuery` will be formatted with `MarkdownV2` (as per worker).

**Fix:** Use `MarkdownV2` throughout and escape the query properly.
**Note:** `MarkdownV2` requires escaping even more characters (`!`, `.`, `-`, etc.). Use a dedicated escape function.

---

#### 5. **Edit branch loses command context**
After clicking ✏️ Edit, the user sees:
```
Previous: "gravity"
Send your updated query:
```
They no longer know which command they are editing (`/feynman`, `/eli5`, etc.). If they have multiple pending commands, confusion may arise.

**Suggestion:** Include the command name:
```ts
await ctx.api.editMessageText(
  chatId,
  snap.messageId,
  `Command: *${snap.command}*\nPrevious: "${snap.query}"\n\nSend your updated query:`,
  { parse_mode: "MarkdownV2" }
);
```

---

#### 6. **TTL not enforced after Edit on the user side**
The interaction state TTL is refreshed, but the message says nothing about expiration. A user might see “Send your updated query” and return 6 minutes later – their message will be ignored with a timeout reply, but the message still looks active.

**Fix:** Add a small note: `(expires in 5 minutes)` to the edited message.

---

### 🟡 Minor Nits & Improvements

#### 7. **Potential import path mistake**
`logger` import in `llm-command.ts`:
```ts
import { logger } from "../../utils/logger.js";
```
From `src/bot/utils/llm-command.ts`, `../../` goes to `src/`, then `utils/logger.js` – **correct**. ✅

#### 8. **`randomAck` collision with existing `ack-messages.ts`**
The document notes that `randomAck` in `llm-command.ts` is separate from `src/bot/utils/ack-messages.ts`. That’s fine, but ensure **no other part of the code imports the old `randomAck`** expecting the emoji‑heavy version. Consider renaming the new one to `llmRandomAck` or delete the old file.

#### 9. **Text‑prefix paths (colon & DM) left unchanged**
The document recommends keeping them as direct `addTaskJob` (no confirmation). This creates **two different UX flows** for the same commands (tap button → confirmation; typed shortcut → instant). That may be intentional for power users, but document it clearly.
**Potential issue:** Users who type `@bot eli5 gravity` in inline mode will go through the guard (since inline mode is separate). That’s fine.

#### 10. **No handling of empty query after Edit**
The `handleLlmQueryText` function accepts any non‑empty text. A user could send whitespace or a single character, which will go to Phase B and then to the LLM. Add a minimum length check (e.g., 2 chars) to avoid pointless API calls.

---

### ✅ What’s Good

- TTL checks are present and prevent stale interactions.
- Busy guard (`isForegroundBusy`) prevents job enqueue when OpenCode is active.
- The `interactionManager` is used correctly with per‑chat isolation (multi‑user safe).
- The `INLINE_COMMANDS` loop is cleanly refactored.
- The guard is wired **at the top** of `prompt.ts`, ensuring it captures text before any other logic.
- The document clearly separates the two-phase flow and provides a state machine.

---

### 📋 Final Checklist Before Implementation

- [ ] **Escape query** in Phase B confirmation message.
- [ ] **Guard `userId`** before `addTaskJob`.
- [ ] **Move `interactionManager.clear`** after successful job enqueue (or add recovery).
- [ ] **Switch to `MarkdownV2`** or use legacy `Markdown` with proper escaping.
- [ ] **Add command name** to the edit prompt.
- [ ] **Add TTL reminder** to the edit message.
- [ ] **Consider minimum query length** in `handleLlmQueryText`.
- [ ] **Decide on text‑prefix paths** (colon & DM) – either document the inconsistency or route them through the guard as well.
- [ ] **Run `npm run build && npm run lint`** – zero errors expected.

The architecture is solid; these fixes will make it production‑ready.

-------
GEMINI ANALYSIS OF DEEPSEEK statement below
---------------------
---------------------import { randomUUID } from "node:crypto";
import { Context, InlineKeyboard } from "grammy";
import { interactionManager } from "../../interaction/manager.js";
import { isForegroundBusy, replyBusyBlocked } from "../utils/busy-guard.js";
import { addTaskJob } from "../../queue/index.js";
import { t } from "../../i18n/index.js";
import { logger } from "../../utils/logger.js";

// Utility to safely escape HTML to prevent Telegram 400 Bad Request crashes
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Rotating generic openers
const OPENERS: Record<string, string[]> = {
  eli5: [
    "What complex thing needs a simple spin?",
    "Got a brain-twister you'd like dumbed down?",
    "What topic should we make 5-year-old friendly?",
    "Bring me your grown-up problem, I'll break it.",
    "What's something that sounds like magic to you?",
    "Which mystery needs a no-jargon answer?",
    "Hand me the weirdest thing you can't explain.",
    "What's too big to wrap your head around?",
    "Give me a word that makes you go 'huh?'",
    "What would you ask if you were five again?",
    "Which concept feels like adult gibberish?",
    "Throw me a puzzle that needs a toy-sized solution.",
    "What jargon-heavy topic needs translating?",
    "Which big idea wants a small explanation?",
    "Got something complicated to untangle?",
    "What academic maze should we exit together?",
    "Which expert talk needs subtitles?",
    "Hand me a concept wrapped in fog.",
    "What theory needs a bedtime story version?",
    "Which puzzle piece feels out of reach?",
    "Got a topic that makes eyes glaze over?",
    "What sophisticated thing needs plain English?",
    "Which rabbit hole should we explore simply?",
    "Hand me the confusing, I'll return clarity.",
    "What buzzword actually means something?",
    "Which complex beast needs taming?",
    "Got a head-scratcher for me?",
    "What topic deserves the ELI5 treatment?",
    "Which maze of jargon should we escape?",
    "Hand me something that sounds smarter than it is.",
    "What concept needs unwrapping like a gift?",
    "Which technical tangle wants untying?",
    "Got a topic hiding behind big words?",
    "What should we decode together?",
    "Which explanation left you hanging?",
    "Hand me the abstract, I'll make it concrete."
  ],
  feynman: [
    "What idea needs to be stripped to the studs?",
    "Which concept hides too many layers?",
    "Give me a thick topic for first-principles surgery.",
    "What's something you kind of get but not really?",
    "Bring me a claim you'd like to fully deconstruct.",
    "Which hard thing should we melt down to basics?",
    "What's a 'simple' thing nobody actually explains?",
    "Hand me a concept you fake understanding of.",
    "What's a textbook page you'd like to rewrite?",
    "Which argument feels wobbly at its foundation?",
    "Give me a subject that needs to be rebuilt from zero.",
    "What's something everyone repeats but nobody dissects?",
    "Which topic wants the full teardown treatment?",
    "What assumption needs questioning from the ground up?",
    "Got a concept that feels like a house of cards?",
    "Which principle should we interrogate deeply?",
    "Hand me a belief built on shaky ground.",
    "What knowledge gap needs filling from scratch?",
    "Which explanation skips too many steps?",
    "Got a topic that crumbles under scrutiny?",
    "What should we rebuild brick by brick?",
    "Which concept wears emperor's new clothes?",
    "Hand me something that sounds true but isn't proven.",
    "What foundation needs inspection today?",
    "Which understanding feels borrowed, not owned?",
    "Got a topic hiding behind authority?",
    "What should we question until it makes sense?",
    "Which explanation accepts too much on faith?",
    "Hand me a concept that needs stress-testing.",
    "What idea deserves the microscope treatment?",
    "Which truth wants unpacking layer by layer?",
    "Got something that feels true but can't be explained?",
    "What should we interrogate like a detective?",
    "Which topic needs building from first bricks?",
    "Hand me a concept begging for deconstruction."
  ],
  devils_advocate: [
    "What statement would you like me to fight?",
    "Give me a claim you want pressure-tested.",
    "Which opinion should I tear apart nicely?",
    "Bring me a belief you're tired of hearing unchallenged.",
    "What's a 'truth' that might have a flip side?",
    "Hand me an argument you'd like roasted from the other side.",
    "Which hot take deserves a cold shower?",
    "Give me a proposal I can argue against for you.",
    "What's something you wish someone would push back on?",
    "Which idea would crumble under a good cross-examination?",
    "Bring me a statement that sounds too neat to be true.",
    "What's a rule you'd like to see broken logically?",
    "Which assumption needs its opposite explored?",
    "What consensus deserves some healthy skepticism?",
    "Hand me a position to attack with respect.",
    "Which popular opinion wants questioning?",
    "Got a viewpoint that feels too comfortable?",
    "What belief should we turn inside out?",
    "Which side of the story remains untold?",
    "Hand me a sacred cow for gentle tipping.",
    "What position needs its weak points exposed?",
    "Which argument wins too easily?",
    "Got a claim that accepts no challengers?",
    "What should we play contrarian with today?",
    "Which certainty wants some doubt sprinkled in?",
    "Hand me a one-sided debate to balance.",
    "What opinion floats unopposed?",
    "Which truth claims exclusive rights?",
    "Got a stance that needs opposition?",
    "What should we argue against for practice?",
    "Which perspective dominates unfairly?",
    "Hand me a position to poke holes in.",
    "What assumption walks unchallenged?",
    "Which viewpoint needs its shadow side?",
    "Got a belief that fears questions?"
  ],
  deep_research: [
    "What topic deserves a full-bore investigation?",
    "Which subject needs a structured deep dive?",
    "Give me something you'd like thoroughly mapped.",
    "What's a question too big for a quick answer?",
    "Hand me a rabbit hole you want explored.",
    "Which niche should we excavate properly?",
    "Bring me a theme for a mini research paper.",
    "What's a mystery that needs layers peeled back?",
    "Give me a domain you'd like systematically broken down.",
    "Which field has more depth than surface shows?",
    "What's a 'simple' thing with hidden complexity?",
    "Hand me a topic for a no-stone-unturned analysis.",
    "What subject wants the full treatment?",
    "Which area needs comprehensive exploration?",
    "Got a topic buried under surface knowledge?",
    "What deserves the deep-dive spotlight today?",
    "Which question opens doors to many rooms?",
    "Hand me something that rewards thoroughness.",
    "What field begs for systematic mapping?",
    "Which topic hides treasures in its depths?",
    "Got a subject that quick searches betray?",
    "What should we research without shortcuts?",
    "Which domain wants patient excavation?",
    "Hand me a theme for scholarly treatment.",
    "What topic rewards going the extra mile?",
    "Which area needs its corners explored?",
    "Got a question that deserves dedication?",
    "What subject wants the microscope and the telescope?",
    "Which field needs connecting its dots?",
    "Hand me something worth the deep look.",
    "What topic hides patterns in its details?",
    "Which mystery calls for methodical pursuit?",
    "Got a subject that surface skimming misses?",
    "What should we investigate properly today?",
    "Which area wants its layers revealed?"
  ],
  summarise: [
    "What text or topic needs a tight summary?",
    "Give me something long you want made short.",
    "Which wall of text should I condense for you?",
    "Bring me a message you'd like the gist of.",
    "What's a ramble you'd like turned into bullets?",
    "Hand me a lecture or article to compress.",
    "Which conversation needs a two-sentence version?",
    "Give me a news story you want the core of.",
    "What's a dense paragraph crying for a TL;DR?",
    "Bring me notes you'd like extracted into highlights.",
    "Which email or post needs a crisp digest?",
    "Hand me a chapter you'd prefer as a blurb.",
    "What document wants the executive treatment?",
    "Which report needs distilling to essence?",
    "Got a verbose piece wanting brevity?",
    "What should we shrink without losing meaning?",
    "Which lengthy thing deserves the short version?",
    "Hand me something wordy for trimming.",
    "What content needs its wheat separated?",
    "Which article wants its skeleton revealed?",
    "Got a document hiding its own point?",
    "What should we compress to clarity?",
    "Which message needs its noise removed?",
    "Hand me a text for the essence extraction.",
    "What rambling wants structure imposed?",
    "Which content deserves the highlight reel?",
    "Got something that takes too long to read?",
    "What should we boil down to the good stuff?",
    "Which lengthy explanation wants brevity?",
    "Hand me a verbose thing for tightening.",
    "What document needs its point sharpened?",
    "Which wall of words should we scale?",
    "Got a text that buries its headline?",
    "What should we summarize smartly today?",
    "Which content wants its signal amplified?"
  ],
  steel_man: [
    "What argument should I make bulletproof for you?",
    "Give me a position you want the strongest version of.",
    "Which side of a debate needs a champion?",
    "Bring me a claim I can fortify to its best form.",
    "What's a belief you'd like to see fully armed?",
    "Hand me an idea that deserves a fair, powerful case.",
    "Which opinion usually gets straw-manned?",
    "Give me a premise you want built like a fortress.",
    "What's a take you wish defenders could argue better?",
    "Bring me a proposition I can upgrade to titanium.",
    "Which argument deserves a no-weak-spots rewrite?",
    "Hand me a viewpoint you'd like to see win on merit.",
    "What position needs its best self presented?",
    "Which argument wants strengthening, not weakening?",
    "Got a case that deserves better advocacy?",
    "What belief should we armor-plate today?",
    "Which viewpoint needs its strongest voice?",
    "Hand me a position to build up, not tear down.",
    "What argument wants its steel showing?",
    "Which side needs its champion moment?",
    "Got a stance that deserves robust defense?",
    "What should we fortify against all attacks?",
    "Which opinion wants its merit highlighted?",
    "Hand me a view to reinforce properly.",
    "What position needs its steel framework?",
    "Which argument deserves the best possible case?",
    "Got a belief that merits strong representation?",
    "What should we strengthen to its peak form?",
    "Which viewpoint wants its power unleashed?",
    "Hand me a stance for the full armor treatment.",
    "What argument needs its merit maximized?",
    "Which position deserves champion-level defense?",
    "Got a case that wants winning fairly?",
    "What should we steel-man with conviction today?",
    "Which viewpoint needs its strongest iteration?"
  ]
};

const ACK_MESSAGES: string[] = [
  "Got it, spinning up the engines.",
  "On it, give me a moment.",
  "Digging in, hang tight.",
  "Already working on it.",
  "Fetching the answer now.",
  "Cranking the gears, be right back.",
  "Processing your request.",
  "Boots on the ground, standby.",
  "Let me cook that up for you.",
  "Rolling up my sleeves now.",
  "Crunching the numbers.",
  "Assembling the response.",
  "Task received, moving fast.",
  "Spooling up the LLM.",
  "Working on your command."
];

export function getLlmCommandAck(): string {
  return ACK_MESSAGES[Math.floor(Math.random() * ACK_MESSAGES.length)];
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes expiration

function getRandomOpener(command: string): string {
  const pool = OPENERS[command];
  if (!pool || pool.length === 0) return "What is your query?";
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function handleLlmCommandRequest(
  ctx: Context,
  command: string,
  query?: string,
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Phase A: No query provided, ask for context
  if (!query || !query.trim()) {
    const sent = await ctx.reply(getRandomOpener(command));

    interactionManager.start(chatId, {
      kind: "custom",
      expectedInput: "text",
      metadata: {
        flow: "llm_direct",
        stage: "awaiting_query",
        command,
        messageId: sent.message_id,
        expiresAt: Date.now() + TTL_MS
      }
    });
    return;
  }

  // Phase B: Query provided, ask for confirmation
  const keyboard = new InlineKeyboard()
    .text("✅ Proceed", "llm_confirm:proceed")
    .text("✏️ Edit", "llm_confirm:edit")
    .text("❌ Cancel", "llm_confirm:cancel");

  // Use HTML to prevent crash on unescaped markdown characters in the query
  const sent = await ctx.reply(
    `<b>/${command}</b>: "${escapeHtml(query.trim())}"\n\nShall I proceed?`,
    { parse_mode: "HTML", reply_markup: keyboard },
  );

  interactionManager.start(chatId, {
    kind: "custom",
    expectedInput: "mixed",
    metadata: {
      flow: "llm_direct",
      stage: "awaiting_confirm",
      command,
      query: query.trim(),
      messageId: sent.message_id,
      expiresAt: Date.now() + TTL_MS
    }
  });
}

// Wire this into your main text message handler (e.g., prompt.ts)
export async function handleLlmQueryText(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;

  if (!chatId || !text || text.startsWith("/")) return false;

  const state = interactionManager.getSnapshot(chatId);
  if (state?.kind !== "custom" || state.metadata.flow !== "llm_direct" || state.metadata.stage !== "awaiting_query") {
    return false;
  }

  const snap = state.metadata;

  // TTL Expiry Check
  if (snap.expiresAt && Date.now() > snap.expiresAt) {
    interactionManager.clear(chatId, "llm_query_timeout");
    await ctx.reply("⏱ Request timed out. Please try the command again.");
    return true;
  }

  // Proceed to Phase B (Confirmation)
  interactionManager.clear(chatId, "llm_query_received");
  await handleLlmCommandRequest(ctx, snap.command, text);
  return true;
}

// Wire this into your bot callback query handler
export async function handleLlmConfirmCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith("llm_confirm:")) return false;

  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return true;

  const state = interactionManager.getSnapshot(chatId);
  if (state?.kind !== "custom" || state.metadata.flow !== "llm_direct" || state.metadata.stage !== "awaiting_confirm") {
    await ctx.answerCallbackQuery({ text: "Nothing pending.", show_alert: true });
    return true;
  }

  const snap = state.metadata;

  if (ctx.callbackQuery?.message?.message_id !== snap.messageId) {
    await ctx.answerCallbackQuery();
    return true;
  }

  // TTL Expiry Check
  if (snap.expiresAt && Date.now() > snap.expiresAt) {
    interactionManager.clear(chatId, "llm_confirm_timeout");
    await ctx.api.editMessageText(chatId, snap.messageId, "⏱ Request timed out.").catch(() => {});
    await ctx.answerCallbackQuery();
    return true;
  }

  const action = data.split(":")[1];
  await ctx.answerCallbackQuery();

  if (action === "cancel") {
    interactionManager.clear(chatId, "llm_confirm_cancelled");
    await ctx.api.editMessageText(chatId, snap.messageId, "❌ Command cancelled.").catch(() => {});
    return true;
  }

  if (action === "edit") {
    interactionManager.transition(chatId, {
      kind: "custom",
      expectedInput: "text",
      metadata: {
        flow: "llm_direct",
        stage: "awaiting_query",
        command: snap.command,
        messageId: snap.messageId,
        expiresAt: Date.now() + TTL_MS // Refresh TTL
      }
    });

    await ctx.api.editMessageText(
      chatId,
      snap.messageId,
      `Command: <b>/${snap.command}</b>\nPrevious: "${escapeHtml(snap.query)}"\n\n<i>Send your updated query (expires in 5m):</i>`,
      { parse_mode: "HTML" }
    ).catch(() => {});
    return true;
  }

  if (action === "proceed") {
    if (isForegroundBusy()) {
      await replyBusyBlocked(ctx);
      return true;
    }

    // 1. Edit to "Got it!" placeholder instantly
    const ackText = getLlmCommandAck();
    await ctx.api.editMessageText(chatId, snap.messageId, ackText).catch(() => {});
    interactionManager.clear(chatId, "llm_confirm_proceed");

    // 2. Fire the background job using the edited message's ID
    try {
      await addTaskJob({
        jobType: "llm_direct",
        command: snap.command,
        query: snap.query,
        chatId,
        ackMessageId: snap.messageId,
        taskId: randomUUID(),
        userId,
        promptText: "",
        sessionId: null,
        directory: "",
        agent: "",
        modelProvider: "",
        modelId: "",
        variant: null,
        parts: [],
      });
    } catch (err) {
      logger.error("[LlmCommand] addTaskJob failed:", err);
      await ctx.api.editMessageText(chatId, snap.messageId, t("inline.cmd.error.resolution_failed")).catch(() => {});
    }
    return true;
  }

  return true;
}
