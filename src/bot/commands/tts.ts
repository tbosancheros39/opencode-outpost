import { CommandContext, Context } from "grammy";
import { isTtsConfigured } from "../../tts/client.js";
import { isTtsEnabled, setTtsEnabled } from "../../settings/manager.js";
import { t } from "../../i18n/index.js";
import { logger } from "../../utils/logger.js";

export async function ttsCommand(ctx: CommandContext<Context>): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    logger.warn("[TTS] Command received without chatId");
    return;
  }

  if (!isTtsConfigured()) {
    await ctx.reply(t("tts.not_configured")).catch(() => {});
    return;
  }

  const enabled = !isTtsEnabled(chatId);
  setTtsEnabled(chatId, enabled);

  const message = enabled ? t("tts.enabled") : t("tts.disabled");
  await ctx.reply(message).catch(() => {});

  logger.info(`[TTS] TTS ${enabled ? "enabled" : "disabled"} for chat ${chatId}`);
}
