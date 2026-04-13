I agree with the proposed fix. Adding the explicit `clear` call ensures that we don't hit any state collision or overwrite protection issues in `interactionManager` when transitioning from Phase A to Phase B.

I've updated the Canvas with the `interactionManager.clear` call added right before `handleLlmCommandRequest`.
---

import { randomUUID } from "node:crypto";
import { Context, InlineKeyboard } from "grammy";
import { interactionManager } from "../../interaction/manager.js";
import { isForegroundBusy, replyBusyBlocked } from "../utils/busy-guard.js";
import { addTaskJob } from "../../queue/index.js";
import { t } from "../../i18n/index.js";
import { logger } from "../../utils/logger.js";
import { randomAck } from "./ack-messages.js";

// Rotating generic openers
const OPENERS: Record<string, string[]> = {
  eli5: [
    "What topic would you like me to explain simply?",
    "I'm ready to simplify! What's the subject?",
  ],
  feynman: [
    "Please elaborate on what you'd like me to use the /feynman technique on?",
    "What complex topic should we break down?",
  ],
  devils_advocate: [
    "You want me to play Devil's Advocate for what exactly? Please elaborate.",
    "Give me a statement or proposition to argue against!",
  ],
  deep_research: [
    "You want what to be deep-researched?",
    "What topic needs a deep dive today?",
  ],
  summarise: [
    "What text or topic would you like me to summarize?",
  ],
  steel_man: [
    "What argument would you like me to steel-man for you?",
  ]
};

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

  const sent = await ctx.reply(
    `*${command}*: "${query.trim()}"\n\nShall I proceed?`,
    { parse_mode: "Markdown", reply_markup: keyboard },
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
      kind: "custom", // Fixed: Added missing kind
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
      `Previous: "${snap.query}"\n\nSend your updated query:`
    ).catch(() => {});
    return true;
  }

  if (action === "proceed") {
    if (isForegroundBusy()) {
      await replyBusyBlocked(ctx);
      return true;
    }

    // 1. Edit to "Got it!" placeholder instantly
    const ackText = randomAck();
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
