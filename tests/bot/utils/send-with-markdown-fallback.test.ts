import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/telegram/render/index.js", () => ({
  renderMarkdown: vi.fn(),
}));

import {
  editMessageWithMarkdownFallback,
  isTelegramMarkdownParseError,
  sendMessageWithMarkdownFallback,
} from "../../../src/bot/utils/send-with-markdown-fallback.js";
import { renderMarkdown } from "../../../src/telegram/render/index.js";

const mockedRenderMarkdown = vi.mocked(renderMarkdown);

describe("bot/utils/send-with-markdown-fallback", () => {
  it("sends rendered MarkdownV2 text", async () => {
    mockedRenderMarkdown.mockReturnValue([{ text: "*hello*", parseMode: "MarkdownV2" as const }]);
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const replyMarkup = { keyboard: [[{ text: "A" }]] };

    await sendMessageWithMarkdownFallback({
      api: { sendMessage },
      chatId: 123,
      text: "**hello**",
      options: { reply_markup: replyMarkup },
      parseMode: "MarkdownV2",
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 123, "*hello*", {
      reply_markup: replyMarkup,
      parse_mode: "MarkdownV2",
    });
  });

  it("sends multi-chunk rendered messages and returns last result", async () => {
    const lastResult = { message_id: 42 };
    mockedRenderMarkdown.mockReturnValue([
      { text: "part1", parseMode: "MarkdownV2" as const },
      { text: "part2", parseMode: "MarkdownV2" as const },
    ]);
    const sendMessage = vi.fn().mockResolvedValue({ message_id: 1 });

    await sendMessageWithMarkdownFallback({
      api: { sendMessage },
      chatId: 100,
      text: "long text",
      parseMode: "MarkdownV2",
    });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 100, "part1", {
      parse_mode: "MarkdownV2",
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 100, "part2", {
      parse_mode: "MarkdownV2",
    });
  });

  it("sends rendered chunk as plain text when render fallbacks to text mode", async () => {
    mockedRenderMarkdown.mockReturnValue([{ text: "plain fallback", parseMode: "text" as const }]);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await sendMessageWithMarkdownFallback({
      api: { sendMessage },
      chatId: 100,
      text: "broken input",
      parseMode: "MarkdownV2",
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 100, "plain fallback", {});
  });

  it("retries in raw mode when Telegram rejects rendered MarkdownV2", async () => {
    mockedRenderMarkdown.mockReturnValue([
      { text: "rendered<broken>", parseMode: "MarkdownV2" as const },
    ]);
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Bad Request: can't parse entities: Unsupported start tag"))
      .mockResolvedValueOnce(undefined);

    await sendMessageWithMarkdownFallback({
      api: { sendMessage },
      chatId: 123,
      text: "<broken>",
      options: { reply_markup: { keyboard: [] } },
      parseMode: "MarkdownV2",
    });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 123, "rendered<broken>", {
      reply_markup: { keyboard: [] },
      parse_mode: "MarkdownV2",
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 123, "rendered<broken>", {
      reply_markup: { keyboard: [] },
    });
  });

  it("does not swallow non-markdown Telegram errors", async () => {
    mockedRenderMarkdown.mockReturnValue([{ text: "hello", parseMode: "MarkdownV2" as const }]);
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Bad Request: message is too long"));

    await expect(
      sendMessageWithMarkdownFallback({
        api: { sendMessage },
        chatId: 123,
        text: "hello",
        parseMode: "MarkdownV2",
      }),
    ).rejects.toThrow("message is too long");

    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("detects parse errors from api error description fields", () => {
    const error = {
      description: "Bad Request: can't find end of the entity starting at byte offset 42",
    };

    expect(isTelegramMarkdownParseError(error)).toBe(true);
    expect(isTelegramMarkdownParseError(new Error("network timeout"))).toBe(false);
  });

  it("supports Markdown parse mode with fallback", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("Bad Request: can't parse entities: Character '_' is reserved"),
      )
      .mockResolvedValueOnce(undefined);

    await sendMessageWithMarkdownFallback({
      api: { sendMessage },
      chatId: 321,
      text: "*status* project_name",
      parseMode: "Markdown",
    });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 321, "*status* project_name", {
      parse_mode: "Markdown",
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 321, "*status* project_name", undefined);
  });

  it("sends plain text without rendering when parseMode is undefined", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await sendMessageWithMarkdownFallback({
      api: { sendMessage },
      chatId: 100,
      text: "hello",
      parseMode: undefined,
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(100, "hello", undefined);
    expect(mockedRenderMarkdown).not.toHaveBeenCalled();
  });

  it("edits message with rendered MarkdownV2 text", async () => {
    mockedRenderMarkdown.mockReturnValue([{ text: "*hello*", parseMode: "MarkdownV2" as const }]);
    const editMessageText = vi.fn().mockResolvedValue(undefined);

    await editMessageWithMarkdownFallback({
      api: { editMessageText, sendMessage: vi.fn().mockResolvedValue(undefined) },
      chatId: 123,
      messageId: 777,
      text: "**hello**",
      options: { reply_markup: { inline_keyboard: [] } },
      parseMode: "MarkdownV2",
    });

    expect(editMessageText).toHaveBeenCalledTimes(1);
    expect(editMessageText).toHaveBeenNthCalledWith(1, 123, 777, "*hello*", {
      reply_markup: { inline_keyboard: [] },
      parse_mode: "MarkdownV2",
    });
  });

  it("edits with first chunk and sends remaining chunks as new messages", async () => {
    mockedRenderMarkdown.mockReturnValue([
      { text: "part1", parseMode: "MarkdownV2" as const },
      { text: "part2", parseMode: "MarkdownV2" as const },
      { text: "part3", parseMode: "text" as const },
    ]);
    const editMessageText = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await editMessageWithMarkdownFallback({
      api: { editMessageText, sendMessage },
      chatId: 42,
      messageId: 8,
      text: "long text",
      options: { reply_markup: { inline_keyboard: [] } },
      parseMode: "MarkdownV2",
    });

    expect(editMessageText).toHaveBeenCalledTimes(1);
    expect(editMessageText).toHaveBeenNthCalledWith(1, 42, 8, "part1", {
      reply_markup: { inline_keyboard: [] },
      parse_mode: "MarkdownV2",
    });
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, 42, "part2", { parse_mode: "MarkdownV2" });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 42, "part3", {});
  });

  it("retries message edit in raw mode when Telegram rejects rendered entities", async () => {
    mockedRenderMarkdown.mockReturnValue([
      { text: "rendered<broken>", parseMode: "MarkdownV2" as const },
    ]);
    const editMessageText = vi
      .fn()
      .mockRejectedValueOnce(new Error("Bad Request: can't parse entities: unsupported start tag"))
      .mockResolvedValueOnce(undefined);

    await editMessageWithMarkdownFallback({
      api: { editMessageText, sendMessage: vi.fn().mockResolvedValue(undefined) },
      chatId: 42,
      messageId: 8,
      text: "<broken>",
      options: { reply_markup: { inline_keyboard: [] } },
      parseMode: "MarkdownV2",
    });

    expect(editMessageText).toHaveBeenCalledTimes(2);
    expect(editMessageText).toHaveBeenNthCalledWith(1, 42, 8, "rendered<broken>", {
      reply_markup: { inline_keyboard: [] },
      parse_mode: "MarkdownV2",
    });
    expect(editMessageText).toHaveBeenNthCalledWith(2, 42, 8, "rendered<broken>", {
      reply_markup: { inline_keyboard: [] },
    });
  });
});
