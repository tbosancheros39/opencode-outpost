import { Api, InputFile } from "grammy";
import { isTtsConfigured, synthesizeSpeech } from "../../tts/client.js";
import { isTtsEnabled } from "../../settings/manager.js";
import { t } from "../../i18n/index.js";
import { logger } from "../../utils/logger.js";

const MAX_TTS_INPUT_CHARS = 4000;

export async function sendTtsResponse(api: Api, chatId: number, text: string): Promise<void> {
  if (!isTtsConfigured()) {
    return;
  }

  if (!isTtsEnabled(chatId)) {
    return;
  }

  const input = text.trim();
  if (!input) {
    return;
  }

  if (input.length > MAX_TTS_INPUT_CHARS) {
    logger.warn(
      `[TTS] Text too long for TTS: ${input.length} chars (max ${MAX_TTS_INPUT_CHARS}), chatId=${chatId}`,
    );
    await api
      .sendMessage(chatId, t("tts.text_too_long", { max: String(MAX_TTS_INPUT_CHARS) }))
      .catch(() => {});
    return;
  }

  try {
    const result = await synthesizeSpeech(input);
    await api.sendVoice(chatId, new InputFile(result.buffer, result.filename), {
      caption: input.length > 200 ? `${input.slice(0, 197)}...` : undefined,
    });
  } catch (err) {
    logger.error("[TTS] Failed to send auto-reply:", err);
    await api.sendMessage(chatId, t("tts.error")).catch(() => {});
  }
}
