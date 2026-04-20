import { logger } from "../../utils/logger.js";
import { renderMarkdown } from "../../telegram/render/index.js";
import type { Api, RawApi } from "grammy";

type SendMessageApi = Pick<Api<RawApi>, "sendMessage">;
type EditMessageApi = Pick<Api<RawApi>, "editMessageText" | "sendMessage">;
type TelegramSendMessageOptions = Parameters<SendMessageApi["sendMessage"]>[2];
type TelegramEditMessageOptions = Parameters<
  Pick<Api<RawApi>, "editMessageText">["editMessageText"]
>[3];

interface SendMessageWithMarkdownFallbackParams {
  api: SendMessageApi;
  chatId: Parameters<SendMessageApi["sendMessage"]>[0];
  text: string;
  options?: TelegramSendMessageOptions;
  parseMode?: "Markdown" | "MarkdownV2";
}

interface EditMessageWithMarkdownFallbackParams {
  api: EditMessageApi;
  chatId: Parameters<EditMessageApi["editMessageText"]>[0];
  messageId: Parameters<EditMessageApi["editMessageText"]>[1];
  text: string;
  options?: TelegramEditMessageOptions;
  parseMode?: "Markdown" | "MarkdownV2";
}

const MARKDOWN_PARSE_ERROR_MARKERS = [
  "can't parse entities",
  "can't parse entity",
  "can't find end of the entity",
  "entity beginning",
  "bad request: can't parse",
];

function getErrorText(error: unknown): string {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
  }

  if (typeof error === "object" && error !== null) {
    const description = Reflect.get(error, "description");
    if (typeof description === "string") {
      parts.push(description);
    }

    const message = Reflect.get(error, "message");
    if (typeof message === "string") {
      parts.push(message);
    }
  }

  if (typeof error === "string") {
    parts.push(error);
  }

  if (parts.length === 0) {
    return "";
  }

  return parts.join("\n").toLowerCase();
}

export function isTelegramMarkdownParseError(error: unknown): boolean {
  const errorText = getErrorText(error);
  if (!errorText) {
    return false;
  }

  return MARKDOWN_PARSE_ERROR_MARKERS.some((marker) => errorText.includes(marker));
}

export async function sendMessageWithMarkdownFallback({
  api,
  chatId,
  text,
  options,
  parseMode,
}: SendMessageWithMarkdownFallbackParams): Promise<
  Awaited<ReturnType<SendMessageApi["sendMessage"]>>
> {
  if (!parseMode) {
    return api.sendMessage(chatId, text, options);
  }

  if (parseMode === "MarkdownV2") {
    const rendered = renderMarkdown(text);
    let lastResult: Awaited<ReturnType<SendMessageApi["sendMessage"]>>;

    for (const message of rendered) {
      const messageParseMode =
        message.parseMode === "MarkdownV2" ? ("MarkdownV2" as const) : undefined;
      const messageOptions: TelegramSendMessageOptions = {
        ...(options || {}),
        ...(messageParseMode ? { parse_mode: messageParseMode } : {}),
      };

      try {
        lastResult = await api.sendMessage(chatId, message.text, messageOptions);
      } catch (error) {
        if (messageParseMode && isTelegramMarkdownParseError(error)) {
          logger.warn("[Bot] Rendered MarkdownV2 still failed, retrying as plain text", error);
          lastResult = await api.sendMessage(chatId, message.text, options);
        } else {
          throw error;
        }
      }
    }

    return lastResult!;
  }

  const markdownOptions: TelegramSendMessageOptions = {
    ...(options || {}),
    parse_mode: parseMode,
  };

  try {
    return await api.sendMessage(chatId, text, markdownOptions);
  } catch (error) {
    if (!isTelegramMarkdownParseError(error)) {
      throw error;
    }

    logger.warn("[Bot] Markdown parse failed, retrying assistant message in raw mode", error);
    return api.sendMessage(chatId, text, options);
  }
}

export async function editMessageWithMarkdownFallback({
  api,
  chatId,
  messageId,
  text,
  options,
  parseMode,
}: EditMessageWithMarkdownFallbackParams): Promise<
  Awaited<ReturnType<EditMessageApi["editMessageText"]>>
> {
  if (!parseMode) {
    return api.editMessageText(chatId, messageId, text, options);
  }

  if (parseMode === "MarkdownV2") {
    const rendered = renderMarkdown(text);
    const first = rendered[0];
    const firstParseMode = first.parseMode === "MarkdownV2" ? ("MarkdownV2" as const) : undefined;
    const firstOptions: TelegramEditMessageOptions = {
      ...(options || {}),
      ...(firstParseMode ? { parse_mode: firstParseMode } : {}),
    };

    let result: Awaited<ReturnType<EditMessageApi["editMessageText"]>>;

    try {
      result = await api.editMessageText(chatId, messageId, first.text, firstOptions);
    } catch (error) {
      if (firstParseMode && isTelegramMarkdownParseError(error)) {
        logger.warn("[Bot] Rendered MarkdownV2 edit still failed, retrying as plain text", error);
        result = await api.editMessageText(chatId, messageId, first.text, options);
      } else {
        throw error;
      }
    }

    for (let i = 1; i < rendered.length; i++) {
      const message = rendered[i];
      const messageParseMode =
        message.parseMode === "MarkdownV2" ? ("MarkdownV2" as const) : undefined;
      const messageOptions: TelegramSendMessageOptions = {
        ...(messageParseMode ? { parse_mode: messageParseMode } : {}),
      };
      await api.sendMessage(chatId, message.text, messageOptions);
    }

    return result;
  }

  const markdownOptions: TelegramEditMessageOptions = {
    ...(options || {}),
    parse_mode: parseMode,
  };

  try {
    return await api.editMessageText(chatId, messageId, text, markdownOptions);
  } catch (error) {
    if (!isTelegramMarkdownParseError(error)) {
      throw error;
    }

    logger.warn("[Bot] Markdown parse failed, retrying edited message in raw mode", error);
    return api.editMessageText(chatId, messageId, text, options);
  }
}
