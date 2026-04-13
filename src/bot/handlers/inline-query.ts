import type { Context } from "grammy";
import type { InlineQueryResult } from "@grammyjs/types";
import { randomUUID } from "crypto";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import type { I18nKey } from "../../i18n/index.js";
import { isSuperUser } from "../utils/user-tracker.js";
import { addTaskJob } from "../../queue/index.js";
import { isForegroundBusy, replyBusyBlocked } from "../utils/busy-guard.js";

const INLINE_DESCRIPTION_LIMIT = 180;
const INLINE_CACHE_SECONDS = 0; // 0 = always fresh results (recommended for debugging)
const INLINE_RUN_CALLBACK_PREFIX = "inln_run:";
const INLINE_RUN_CACHE_TTL_MS = 5 * 60 * 1000;
const INLINE_RUN_CACHE_MAX_SIZE = 512;
const INLINE_SWITCH_QUERY_MAX_LENGTH = 240;

interface InlineRunCacheEntry {
  command: string;
  query: string;
  userId: number;
  createdAt: number;
}

const inlineRunCache = new Map<string, InlineRunCacheEntry>();

export interface InlineCommand {
  prefix: string;
  slashCommand: string;
  titleKey: I18nKey;
  descriptionKey: I18nKey;
  promptTemplate: string;
  minQueryLength: number;
}

function pruneInlineRunCache(now: number = Date.now()): void {
  for (const [cacheId, entry] of inlineRunCache.entries()) {
    if (now - entry.createdAt > INLINE_RUN_CACHE_TTL_MS) {
      inlineRunCache.delete(cacheId);
    }
  }

  if (inlineRunCache.size <= INLINE_RUN_CACHE_MAX_SIZE) {
    return;
  }

  const overflowCount = inlineRunCache.size - INLINE_RUN_CACHE_MAX_SIZE;
  const oldestFirst = Array.from(inlineRunCache.entries()).sort(
    (left, right) => left[1].createdAt - right[1].createdAt,
  );

  for (let index = 0; index < overflowCount; index += 1) {
    const candidate = oldestFirst[index];
    if (!candidate) {
      return;
    }
    inlineRunCache.delete(candidate[0]);
  }
}

function cacheInlineRun(command: string, query: string, userId: number): string {
  pruneInlineRunCache();
  const cacheId = randomUUID();
  inlineRunCache.set(cacheId, {
    command,
    query,
    userId,
    createdAt: Date.now(),
  });
  return cacheId;
}

function isInlineRunExpired(entry: InlineRunCacheEntry, now: number = Date.now()): boolean {
  return now - entry.createdAt > INLINE_RUN_CACHE_TTL_MS;
}

function buildSwitchInlineQuery(prefix: string, query?: string): string {
  const normalizedPrefix = prefix.trim();
  const base = query?.trim()
    ? `${normalizedPrefix} ${query.trim()}`
    : `${normalizedPrefix} `;
  return base.slice(0, INLINE_SWITCH_QUERY_MAX_LENGTH);
}

// For deterministic tests.
export function clearInlineRunCacheForTests(): void {
  inlineRunCache.clear();
}

export const INLINE_COMMANDS: InlineCommand[] = [
  {
    prefix: "summarise:",
    slashCommand: "summarise",
    titleKey: "inline.cmd.summarise.title",
    descriptionKey: "inline.cmd.summarise.description",
    promptTemplate: `You are a summarization expert. Condense the user's text into clear, actionable bullet points. Focus on the 3-5 most important takeaways. Be concise but comprehensive. Return only the summary, no preamble.`,
    minQueryLength: 20,
  },
  {
    prefix: "eli5:",
    slashCommand: "eli5",
    titleKey: "inline.cmd.eli5.title",
    descriptionKey: "inline.cmd.eli5.description",
    promptTemplate: `Explain this concept as if talking to a 5-year-old. Rules:
1. Use words with maximum 2 syllables
2. Keep sentences very short (under 10 words)
3. Include a fun example or analogy
4. Be playful and friendly
5. No jargon or technical terms`,
    minQueryLength: 10,
  },
  {
    prefix: "deep-research:",
    slashCommand: "deep_research",
    titleKey: "inline.cmd.deep_research.title",
    descriptionKey: "inline.cmd.deep_research.description",
    promptTemplate: `You are a research expert conducting thorough investigation. Use available search tools to find comprehensive information. Structure your response with:
1. Executive summary
2. Key findings (with sources)
3. Supporting evidence
4. Conclusions
5. Areas of uncertainty

Be thorough and cite sources where possible.`,
    minQueryLength: 15,
  },
  {
    prefix: "steel-man:",
    slashCommand: "steel_man",
    titleKey: "inline.cmd.steel_man.title",
    descriptionKey: "inline.cmd.steel_man.description",
    promptTemplate: `You are presenting the strongest possible argument FOR the given position. Your job:
1. Ignore all weaknesses and counterarguments
2. Focus ONLY on the best reasons supporting this view
3. Make the strongest case possible
4. Use compelling logic and evidence
5. Acknowledge the opposing view exists but don't dwell on it

Present the most persuasive version of this argument.`,
    minQueryLength: 10,
  },
  {
    prefix: "feynman:",
    slashCommand: "feynman",
    titleKey: "inline.cmd.feynman.title",
    descriptionKey: "inline.cmd.feynman.description",
    promptTemplate: `Use the Feynman technique to teach this concept:

Step 1 - Simple Explanation: Explain it in the simplest terms possible, as if teaching to a curious teenager.

Step 2 - Analogy: Use a relatable analogy or real-world example that makes it click.

Step 3 - Identify Gaps: If you were asked to explain this to a child and got stuck, note where the gaps in understanding would be.

Make it memorable and clear.`,
    minQueryLength: 10,
  },
  {
    prefix: "devil's-advocate:",
    slashCommand: "devils_advocate",
    titleKey: "inline.cmd.devils_advocate.title",
    descriptionKey: "inline.cmd.devils_advocate.description",
    promptTemplate: `Play devil's advocate. Argue the OPPOSITE position to what the user presented. Your job:
1. Give the strongest arguments for the opposing view
2. Point out flaws in the original position
3. Make the opposing side seem more reasonable
4. Use logical reasoning and evidence
5. Be intellectually honest but persuasive

Challenge the user's assumption and present the best counter-argument.`,
    minQueryLength: 10,
  },
];

export function detectInlineCommand(
  query: string,
): { command: InlineCommand; actualQuery: string } | null {
  const lowerQuery = query.toLowerCase().trim();
  for (const cmd of INLINE_COMMANDS) {
    if (lowerQuery.startsWith(cmd.prefix)) {
      return {
        command: cmd,
        actualQuery: query.slice(cmd.prefix.length).trim(),
      };
    }
  }
  return null;
}

export function detectInlineCommandWithoutColon(
  query: string,
): { command: InlineCommand; actualQuery: string } | null {
  const lowerQuery = query.toLowerCase().trim();
  for (const cmd of INLINE_COMMANDS) {
    const prefixWithoutColon = cmd.prefix.replace(/:$/, "");
    if (lowerQuery.startsWith(prefixWithoutColon + " ") || lowerQuery === prefixWithoutColon) {
      const actualQuery = query.slice(prefixWithoutColon.length).trim();
      if (actualQuery.length > 0) {
        return {
          command: cmd,
          actualQuery,
        };
      }
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectInlineCommandFlexible(
  query: string,
): { command: InlineCommand; actualQuery: string } | null {
  const directMatch = detectInlineCommand(query);
  if (directMatch) {
    return directMatch;
  }

  const trimmed = query.trim();
  for (const cmd of INLINE_COMMANDS) {
    const prefixWithoutColon = cmd.prefix.replace(/:$/, "");
    const aliases = new Set<string>([
      prefixWithoutColon,
      cmd.slashCommand,
      prefixWithoutColon.replace(/'/g, ""),
      cmd.slashCommand.replace(/_/g, "-"),
    ]);

    for (const alias of aliases) {
      const escapedAlias = escapeRegExp(alias);

      const spacedColonMatch = trimmed.match(new RegExp(`^${escapedAlias}\\s*:\\s*(.*)$`, "i"));
      if (spacedColonMatch) {
        return {
          command: cmd,
          actualQuery: spacedColonMatch[1]?.trim() ?? "",
        };
      }

      const noColonMatch = trimmed.match(new RegExp(`^${escapedAlias}\\s+(.+)$`, "i"));
      if (noColonMatch) {
        const actualQuery = noColonMatch[1]?.trim() ?? "";
        if (actualQuery.length > 0) {
          return {
            command: cmd,
            actualQuery,
          };
        }
      }
    }
  }

  return null;
}

export function buildCommandPrompt(command: InlineCommand, userQuery: string): string {
  return `${command.promptTemplate}\n\n---\n\nUSER'S QUESTION/CONTENT:\n${userQuery}`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const clipped = text.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  return `${clipped}...`;
}

/**
 * For command discovery: sends the description card AND attaches a button
 * that prefills "@botname <prefix>" in the input field (standard telegram UX).
 */
function buildSuggestionResult(
  id: string,
  title: string,
  descriptionText: string,
  switchQueryTo: string,
): InlineQueryResult {
  const description = truncateText(descriptionText, INLINE_DESCRIPTION_LIMIT);
  return {
    type: "article" as const,
    id,
    title,
    description,
    input_message_content: {
      message_text: `${title}\n\n${description}`,
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `✏️ Type your question: ${switchQueryTo}`,
            switch_inline_query_current_chat: buildSwitchInlineQuery(switchQueryTo),
          },
        ],
      ],
    },
  };
}

function buildRunCallbackResult(
  id: string,
  title: string,
  commandPrefix: string,
  query: string,
  cacheId: string,
): InlineQueryResult {
  const queryPreview = truncateText(query, INLINE_DESCRIPTION_LIMIT);
  return {
    type: "article" as const,
    id,
    title,
    description: queryPreview,
    input_message_content: {
      message_text: `${title}\n\n${query}`,
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: t("inline.cmd.button.generate"),
            callback_data: `${INLINE_RUN_CALLBACK_PREFIX}${cacheId}`,
          },
        ],
        [
          {
            text: t("inline.cmd.button.edit"),
            switch_inline_query_current_chat: buildSwitchInlineQuery(commandPrefix, query),
          },
        ],
      ],
    },
  };
}

async function safeAnswerInlineQuery(
  ctx: Context,
  results: InlineQueryResult[],
  options: { cache_time: number; is_personal: boolean },
  label: string,
): Promise<void> {
  try {
    logger.info(`[InlineQuery] Calling answerInlineQuery: label=${label}, resultCount=${results.length}, cache_time=${options.cache_time}`);
    await ctx.answerInlineQuery(results, options);
    logger.info(`[InlineQuery] answerInlineQuery SUCCESS: label=${label}, sent ${results.length} results`);
  } catch (err) {
    logger.error(`[InlineQuery] answerInlineQuery ERROR (${label}):`, err);
  }
}

function buildCommandSuggestions(): InlineQueryResult[] {
  return INLINE_COMMANDS.map((cmd, idx) => {
    const title = t(cmd.titleKey);
    const description = t(cmd.descriptionKey);
    const usageHint = t("inline.cmd.suggestion.usage", { prefix: cmd.prefix });
    return buildSuggestionResult(
      `suggestion:${idx}`,
      title,
      `${description}\n\n${usageHint}`,
      cmd.prefix,
    );
  });
}

export async function handleInlineQuery(ctx: Context): Promise<void> {
  const inlineQuery = ctx.inlineQuery;
  if (!inlineQuery) {
    return;
  }

  logger.info(`[InlineQuery] Received inline query: id=${inlineQuery.id}, query="${inlineQuery.query}", from=${ctx.from?.id}`);

  const userId = ctx.from?.id;
  if (!userId || !isSuperUser(userId)) {
    logger.warn(`[InlineQuery] Unauthorized user: ${userId}`);
    await safeAnswerInlineQuery(
      ctx,
      [],
      {
        cache_time: INLINE_CACHE_SECONDS,
        is_personal: true,
      },
      "unauthorized",
    );
    return;
  }

  const trimmedQuery = inlineQuery.query?.trim() ?? "";

  // Empty query: show all command suggestions with prefill buttons
  if (!trimmedQuery) {
    await safeAnswerInlineQuery(
      ctx,
      buildCommandSuggestions(),
      {
        cache_time: INLINE_CACHE_SECONDS,
        is_personal: true,
      },
      "suggestions",
    );
    return;
  }

  // Non-empty query: support both "eli5: question" and "eli5 question"
  const commandMatch = detectInlineCommandFlexible(trimmedQuery);
  logger.info(`[InlineQuery] Query="${trimmedQuery}", commandMatch=${commandMatch ? commandMatch.command.prefix : "null"}`);

  if (commandMatch) {
    const { command, actualQuery } = commandMatch;

    // Validate minimum query length
    if (actualQuery.length < command.minQueryLength) {
      const errorResult = buildSuggestionResult(
        `cmd:${command.prefix}:error`,
        t(command.titleKey),
        t("inline.cmd.error.query_too_short", { min: String(command.minQueryLength) }),
        command.prefix,
      );
      await safeAnswerInlineQuery(
        ctx,
        [errorResult],
        {
          cache_time: INLINE_CACHE_SECONDS,
          is_personal: true,
        },
        "query_too_short",
      );
      return;
    }

    // Inline run flow: return a callback button and execute only after explicit confirmation.
    const cacheId = cacheInlineRun(command.slashCommand, actualQuery, userId);
    const result = buildRunCallbackResult(
      randomUUID(),
      t(command.titleKey),
      command.prefix,
      actualQuery,
      cacheId,
    );

    // DEBUG: Log the exact result being sent
    const debugResult = result as { id: string; type: string; title?: string; input_message_content?: { message_text?: string } };
    logger.debug(`[InlineQuery] Result detail: id=${debugResult.id}, type=${debugResult.type}, title="${debugResult.title ?? "N/A"}", message_text="${debugResult.input_message_content?.message_text ?? "N/A"}"`);

    await safeAnswerInlineQuery(
      ctx,
      [result],
      {
        cache_time: INLINE_CACHE_SECONDS,
        is_personal: true,
      },
      "run_callback_ready",
    );
    return;
  }

  // No recognized command prefix — return suggestions instead of an empty list
  // so the user always gets guidance in inline mode.
  logger.debug(`[InlineQuery] No command prefix matched for query: "${trimmedQuery}", returning suggestions`);
  await safeAnswerInlineQuery(
    ctx,
    buildCommandSuggestions(),
    {
      cache_time: INLINE_CACHE_SECONDS,
      is_personal: true,
    },
    "no_match_suggestions",
  );
}

export async function handleInlineRunCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith(INLINE_RUN_CALLBACK_PREFIX)) {
    return false;
  }

  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.answerCallbackQuery({ text: t("inline.cmd.error.callback_invalid"), show_alert: true });
    return true;
  }

  pruneInlineRunCache();

  const cacheId = data.slice(INLINE_RUN_CALLBACK_PREFIX.length);
  const cached = inlineRunCache.get(cacheId);
  if (!cached) {
    await ctx.answerCallbackQuery({ text: t("inline.cmd.error.callback_expired"), show_alert: true });
    return true;
  }

  if (cached.userId !== userId) {
    await ctx.answerCallbackQuery({ text: t("inline.cmd.error.callback_invalid"), show_alert: true });
    return true;
  }

  if (isInlineRunExpired(cached)) {
    inlineRunCache.delete(cacheId);
    await ctx.answerCallbackQuery({ text: t("inline.cmd.error.callback_expired"), show_alert: true });
    return true;
  }

  if (isForegroundBusy()) {
    await replyBusyBlocked(ctx);
    return true;
  }

  await ctx.answerCallbackQuery();

  const targetChatId = userId;
  const inlineMessageId = ctx.callbackQuery?.inline_message_id;
  const callbackMessageId = ctx.callbackQuery?.message?.message_id;
  let ackMessageId: number;

  if (inlineMessageId) {
    // Inline result callback — edit the card in-place in the source chat (wife's chat, group, etc.)
    try {
      await ctx.api.raw.editMessageText({
        inline_message_id: inlineMessageId,
        text: t("inline.thinking"),
      });
    } catch (err) {
      logger.warn("[InlineQuery] Failed to edit inline message for thinking ACK:", err);
    }
    ackMessageId = 0; // not used when inlineMessageId is set
  } else if (ctx.chat?.id && callbackMessageId) {
    try {
      await ctx.api.editMessageText(ctx.chat.id, callbackMessageId, t("inline.thinking"));
      ackMessageId = callbackMessageId;
    } catch (err) {
      logger.warn("[InlineQuery] Failed to edit callback source message, sending fallback ACK:", err);
      const ackMessage = await ctx.api.sendMessage(targetChatId, t("inline.thinking"));
      ackMessageId = ackMessage.message_id;
    }
  } else {
    const ackMessage = await ctx.api.sendMessage(targetChatId, t("inline.thinking"));
    ackMessageId = ackMessage.message_id;
  }

  inlineRunCache.delete(cacheId);

  try {
    await addTaskJob({
      jobType: "llm_direct",
      command: cached.command,
      query: cached.query,
      chatId: targetChatId,
      ackMessageId,
      inlineMessageId: inlineMessageId ?? undefined,
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
    logger.info(
      `[InlineQuery] Enqueued callback run: cacheId=${cacheId}, command=${cached.command}, userId=${userId}, inlineMessageId=${inlineMessageId ?? "none"}`,
    );
  } catch (err) {
    logger.error("[InlineQuery] addTaskJob failed for callback run:", err);
    inlineRunCache.set(cacheId, {
      ...cached,
      createdAt: Date.now(),
    });
    try {
      if (inlineMessageId) {
        await ctx.api.raw.editMessageText({
          inline_message_id: inlineMessageId,
          text: t("inline.cmd.error.resolution_failed"),
        });
      } else {
        await ctx.api.editMessageText(targetChatId, ackMessageId, t("inline.cmd.error.resolution_failed"));
      }
    } catch (editErr) {
      logger.warn("[InlineQuery] Failed to update ACK message after queue error:", editErr);
    }
  }

  return true;
}
