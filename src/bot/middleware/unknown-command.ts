import type { Context, NextFunction } from "grammy";
import { extractCommandName, isKnownCommand } from "../utils/commands.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

export async function unknownCommandMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const text = ctx.message?.text;
  const textPreview = text?.substring(0, 60) || "(no text)";
  logger.info(
    `[DIAGNOSTIC] UnknownCommandMiddleware ENTERED: text="${textPreview}"`,
  );

  if (!text) {
    logger.info(
      `[DIAGNOSTIC] UnknownCommandMiddleware: no text, calling next()`,
    );
    await next();
    return;
  }

  const commandName = extractCommandName(text);
  if (!commandName) {
    logger.info(
      `[DIAGNOSTIC] UnknownCommandMiddleware: not a command (no slash prefix), calling next()`,
    );
    await next();
    return;
  }

  if (isKnownCommand(commandName)) {
    logger.info(
      `[DIAGNOSTIC] UnknownCommandMiddleware: known command "${commandName}", calling next()`,
    );
    await next();
    return;
  }

  const commandToken = text.trim().split(/\s+/)[0];
  logger.info(`[DIAGNOSTIC] UnknownCommandMiddleware: UNKNOWN command "${commandToken}", replying with error`);
  await ctx.reply(t("bot.unknown_command", { command: commandToken }));
}
