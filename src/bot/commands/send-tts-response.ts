import { InputFile } from "grammy";
import { isTtsConfigured, synthesizeSpeech, type TtsResult } from "../../tts/client.js";
import { isTtsEnabled as getTtsEnabled } from "../../settings/manager.js";
import { t } from "../../i18n/index.js";
import { logger } from "../../utils/logger.js";

const MAX_TTS_INPUT_CHARS = 4_000;

interface TelegramAudioApi {
  sendAudio: (chatId: number, audio: InputFile) => Promise<unknown>;
  sendMessage: (chatId: number, text: string) => Promise<unknown>;
}

interface SendTtsResponseParams {
  api: TelegramAudioApi;
  sessionId: string;
  chatId: number;
  text: string;
  isTtsEnabledCheck?: (chatId: number) => boolean;
  isTtsConfiguredCheck?: () => boolean;
  synthesizeSpeechImpl?: (text: string) => Promise<TtsResult>;
}

export async function sendTtsResponseForSession({
  api,
  sessionId,
  chatId,
  text,
  isTtsEnabledCheck = getTtsEnabled,
  isTtsConfiguredCheck = isTtsConfigured,
  synthesizeSpeechImpl = synthesizeSpeech,
}: SendTtsResponseParams): Promise<boolean> {
  if (!isTtsEnabledCheck(chatId)) {
    return false;
  }

  const normalizedText = text.trim();
  if (!normalizedText) {
    return false;
  }

  if (!isTtsConfiguredCheck()) {
    logger.info(`[TTS] Skipping audio reply for session ${sessionId}: TTS is not configured`);
    return false;
  }

  if (normalizedText.length > MAX_TTS_INPUT_CHARS) {
    logger.warn(
      `[TTS] Skipping audio reply for session ${sessionId}: text length ${normalizedText.length} exceeds limit ${MAX_TTS_INPUT_CHARS}`,
    );
    return false;
  }

  try {
    const speech = await synthesizeSpeechImpl(normalizedText);
    await api.sendAudio(chatId, new InputFile(speech.buffer, speech.filename));
    logger.info(`[TTS] Sent audio reply for session ${sessionId}`);
    return true;
  } catch (error) {
    logger.warn(`[TTS] Failed to send audio reply for session ${sessionId}`, error);

    await api.sendMessage(chatId, t("tts.failed")).catch((sendError) => {
      logger.warn(`[TTS] Failed to send audio error message for session ${sessionId}`, sendError);
    });

    return false;
  }
}
