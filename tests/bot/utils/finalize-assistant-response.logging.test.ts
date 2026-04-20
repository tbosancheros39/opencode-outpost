import { describe, expect, it, vi } from "vitest";

describe("bot/utils/finalize-assistant-response", () => {
  it("sends formatted parts when not streaming", async () => {
    const sendText = vi.fn().mockResolvedValue(undefined);
    const formatSummary = vi.fn(() => ["Hello world"]);
    const resolveFormat = vi.fn(() => "markdown_v2" as const);
    const getReplyKeyboard = vi.fn(() => undefined);

    const { finalizeAssistantResponse } =
      await import("../../../src/bot/utils/finalize-assistant-response.js");

    const result = await finalizeAssistantResponse({
      responseStreaming: false,
      sessionId: "s1",
      messageId: "m1",
      messageText: "Hello world",
      responseStreamer: {
        complete: vi.fn().mockResolvedValue(false),
      },
      flushPendingServiceMessages: vi.fn().mockResolvedValue(undefined),
      prepareStreamingPayload: vi.fn(() => null),
      formatSummary,
      resolveFormat,
      getReplyKeyboard,
      sendText,
    });

    expect(result).toBe(false);
    expect(formatSummary).toHaveBeenCalledWith("Hello world");
    expect(resolveFormat).toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith("Hello world", undefined, "markdown_v2");
  });

  it("returns true when response is streamed via messages", async () => {
    const sendText = vi.fn().mockResolvedValue(undefined);
    const formatSummary = vi.fn(() => ["Hello"]);
    const resolveFormat = vi.fn(() => "raw" as const);
    const getReplyKeyboard = vi.fn(() => undefined);

    const { finalizeAssistantResponse } =
      await import("../../../src/bot/utils/finalize-assistant-response.js");

    const result = await finalizeAssistantResponse({
      responseStreaming: true,
      sessionId: "s1",
      messageId: "m1",
      messageText: "Hello",
      responseStreamer: {
        complete: vi.fn().mockResolvedValue(true),
      },
      flushPendingServiceMessages: vi.fn().mockResolvedValue(undefined),
      prepareStreamingPayload: vi.fn(() => null),
      formatSummary,
      resolveFormat,
      getReplyKeyboard,
      sendText,
    });

    expect(result).toBe(true);
    expect(sendText).not.toHaveBeenCalled();
  });

  it("sends multiple parts with reply keyboard", async () => {
    const sendText = vi.fn().mockResolvedValue(undefined);
    const formatSummary = vi.fn(() => ["Part 1", "Part 2"]);
    const resolveFormat = vi.fn(() => "raw" as const);
    const getReplyKeyboard = vi.fn(() => ({ inline_keyboard: [[]] }));

    const { finalizeAssistantResponse } =
      await import("../../../src/bot/utils/finalize-assistant-response.js");

    const result = await finalizeAssistantResponse({
      responseStreaming: false,
      sessionId: "s1",
      messageId: "m1",
      messageText: "Long text",
      responseStreamer: {
        complete: vi.fn().mockResolvedValue(false),
      },
      flushPendingServiceMessages: vi.fn().mockResolvedValue(undefined),
      prepareStreamingPayload: vi.fn(() => null),
      formatSummary,
      resolveFormat,
      getReplyKeyboard,
      sendText,
    });

    expect(result).toBe(false);
    expect(sendText).toHaveBeenCalledTimes(2);
  });
});
