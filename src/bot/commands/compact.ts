import { CommandContext, Context } from "grammy";
import { handleContextButtonPress } from "../handlers/context.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

/**
 * /compact — Compact the current session's context
 * Triggers the same flow as the 📊 reply keyboard button:
 * shows a confirmation menu, then calls the OpenCode summarize API.
 */
export async function compactCommand(ctx: CommandContext<Context>): Promise<void> {
  logger.debug("[Bot] /compact command received");

  try {
    await handleContextButtonPress(ctx);
  } catch (err) {
    logger.error("[Bot] Error handling /compact command:", err);
    await ctx.reply(t("error.context_button"));
  }
}
