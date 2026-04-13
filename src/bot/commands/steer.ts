import { CommandContext, Context } from "grammy";
import { abortCurrentOperation } from "./abort.js";
import { processUserPrompt, type ProcessPromptDeps } from "../handlers/prompt.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

export async function steerCommand(
  ctx: CommandContext<Context>,
  promptDeps: ProcessPromptDeps,
): Promise<void> {
  const chatId = ctx.chat?.id ?? null;
  const newPrompt = (ctx.match as string)?.trim();

  if (!chatId) {
    logger.warn("[Steer] Chat context is missing");
    return;
  }

  if (!newPrompt) {
    await ctx.reply(t("steer.usage"));
    return;
  }

  logger.info(`[Steer] Redirecting agent with: "${newPrompt}"`);

  const aborted = await abortCurrentOperation(ctx, { notifyUser: true });

  if (!aborted) {
    await ctx.reply(t("steer.abort_failed"));
    return;
  }

  await processUserPrompt(ctx, newPrompt, promptDeps);
}
