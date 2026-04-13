import { randomUUID } from "node:crypto";
import { Context, InlineKeyboard } from "grammy";
import type { TextPartInput, FilePartInput } from "@opencode-ai/sdk/v2";
import { interactionManager } from "../../interaction/manager.js";
import { isForegroundBusy, replyBusyBlocked } from "../utils/busy-guard.js";
import { addTaskJob } from "../../queue/index.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

interface LlmFlowMetadata {
  flow: string;
  stage: string;
  command: string;
  query: string;
  messageId: number;
  expiresAt: number;
}

// HTML escape — prevents Telegram 400 on user-supplied query text (Fix #1)
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Phase A: Rotating openers per command ───────────────────────────────────
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
    "Hand me the abstract, I'll make it concrete.",
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
    "Hand me a concept begging for deconstruction.",
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
    "Got a belief that fears questions?",
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
    "Which area wants its layers revealed?",
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
    "Which content wants its signal amplified?",
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
    "Which viewpoint needs its strongest iteration?",
  ],
};

// ─── Phase B → Execute: Rotating ack messages ────────────────────────────────
// These replace the confirmation message the instant user presses ✅ Proceed,
// making the transition feel instant before the LLM answer arrives.
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
  "Working on your command.",
];

export function getLlmCommandAck(): string {
  return ACK_MESSAGES[Math.floor(Math.random() * ACK_MESSAGES.length)];
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes

function getRandomOpener(command: string): string {
  const pool = OPENERS[command];
  if (!pool || pool.length === 0) return t("llm.guard.fallback_query");
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Entry point for all 6 slash commands ────────────────────────────────────
export async function handleLlmCommandRequest(
  ctx: Context,
  command: string,
  query?: string,
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  if (!query || !query.trim()) {
    // Phase A — no query: ask for one with a rotating opener
    const sent = await ctx.reply(getRandomOpener(command));
    interactionManager.start(chatId, {
      kind: "custom",
      expectedInput: "text",
      metadata: {
        flow: "llm_direct",
        stage: "awaiting_query",
        command,
        messageId: sent.message_id,
        expiresAt: Date.now() + TTL_MS,
      },
    });
    return;
  }

  // Phase B — query present: ask for confirmation before spending tokens
  const keyboard = new InlineKeyboard()
    .text("✅ Proceed", "llm_confirm:proceed")
    .text("✏️ Edit", "llm_confirm:edit")
    .text("❌ Cancel", "llm_confirm:cancel");

  // HTML parse_mode + escapeHtml prevents Telegram 400 on special chars in query (Fix #1)
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
      expiresAt: Date.now() + TTL_MS,
    },
  });
}

// ─── Text interceptor — inject at TOP of prompt.ts handler ───────────────────
// Returns true if this message was consumed by the guard (caller must return).
export async function handleLlmQueryText(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;

  if (!chatId || !text || text.startsWith("/")) return false;

  const state = interactionManager.getSnapshot(chatId);
  if (
    state?.kind !== "custom" ||
    state.metadata.flow !== "llm_direct" ||
    state.metadata.stage !== "awaiting_query"
  ) {
    return false;
  }

  const snap = state.metadata as unknown as LlmFlowMetadata;

  if (snap.expiresAt && Date.now() > snap.expiresAt) {
    interactionManager.clear(chatId, "llm_query_timeout");
    await ctx.reply(t("llm.guard.query_timeout"));
    return true;
  }

  // Minimum length guard — avoids pointless LLM calls on whitespace/1-char (Fix #7)
  if (text.trim().length < 2) {
    await ctx.reply(t("llm.guard.query_too_short"));
    return true;
  }

  await handleLlmCommandRequest(ctx, snap.command, text);
  return true;
}

// ─── Callback interceptor — inject in bot/index.ts callback_query:data ───────
// Returns true if this callback was consumed by the guard (caller must return).
//
// Edge case: If the user types text while in awaiting_confirm state, the
// interaction guard allows it (expectedInput: "mixed"), but this handler
// returns false (wrong stage). The text flows to processUserPrompt, which
// starts a new interaction and clears the awaiting_confirm state. This is
// intentional — new text takes priority over a pending LLM confirmation.
export async function handleLlmConfirmCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith("llm_confirm:")) return false;

  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return true;

  const state = interactionManager.getSnapshot(chatId);
  if (
    state?.kind !== "custom" ||
    state.metadata.flow !== "llm_direct" ||
    state.metadata.stage !== "awaiting_confirm"
  ) {
    await ctx.answerCallbackQuery({ text: t("llm.guard.nothing_pending"), show_alert: true });
    return true;
  }

  const snap = state.metadata as unknown as LlmFlowMetadata;

  if (ctx.callbackQuery?.message?.message_id !== snap.messageId) {
    await ctx.answerCallbackQuery();
    return true;
  }

  if (snap.expiresAt && Date.now() > snap.expiresAt) {
    interactionManager.clear(chatId, "llm_confirm_timeout");
    await ctx.api.editMessageText(chatId, snap.messageId, t("llm.guard.confirm_timeout")).catch(() => {});
    await ctx.answerCallbackQuery();
    return true;
  }

  const action = data.split(":")[1];
  await ctx.answerCallbackQuery();

  if (action === "cancel") {
    interactionManager.clear(chatId, "llm_confirm_cancelled");
    await ctx.api.editMessageText(chatId, snap.messageId, t("llm.guard.cancelled")).catch(() => {});
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
        expiresAt: Date.now() + TTL_MS, // refresh TTL
      },
    });
    // Show command name + TTL note so user knows context (Fix #5 + #6)
    await ctx.api
      .editMessageText(
        chatId,
        snap.messageId,
        t("llm.guard.edit_prompt", { command: snap.command, query: escapeHtml(snap.query) }),
        { parse_mode: "HTML" },
      )
      .catch(() => {});
    return true;
  }

  if (action === "proceed") {
    if (isForegroundBusy()) {
      await replyBusyBlocked(ctx);
      return true;
    }

    // Edit confirmation message to ack text instantly — gives user immediate feedback
    const ackText = getLlmCommandAck();
    await ctx.api.editMessageText(chatId, snap.messageId, ackText).catch(() => {});

    // Clear state AFTER successful enqueue — if addTaskJob throws, keyboard is restored (Fix #3)
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
        parts: [] as Array<TextPartInput | FilePartInput>,
      });
      interactionManager.clear(chatId, "llm_confirm_proceed"); // only clear on success
    } catch (err) {
      logger.error("[LlmCommand] addTaskJob failed:", err);
      // Restore confirmation keyboard so user can retry without re-typing the query
      const retryKeyboard = new InlineKeyboard()
        .text("✅ Proceed", "llm_confirm:proceed")
        .text("✏️ Edit", "llm_confirm:edit")
        .text("❌ Cancel", "llm_confirm:cancel");
      await ctx.api
        .editMessageText(
          chatId,
          snap.messageId,
          t("llm.guard.queue_failed", { command: snap.command, query: escapeHtml(snap.query) }),
          { parse_mode: "HTML", reply_markup: retryKeyboard },
        )
        .catch(() => {});
      // Interaction state is preserved — user can press Proceed again
    }
    return true;
  }

  return true;
}
