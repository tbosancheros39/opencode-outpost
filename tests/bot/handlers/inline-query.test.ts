import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";

// Mock all external dependencies
vi.mock("../../../src/opencode/client.js", () => ({
  opencodeClient: {
    session: {
      create: vi.fn(),
      prompt: vi.fn(),
      delete: vi.fn(),
    },
    event: {
      subscribe: vi.fn(),
    },
  },
}));

vi.mock("../../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../../src/bot/utils/user-tracker.js", () => ({
  isSuperUser: vi.fn(),
}));

vi.mock("../../../src/users/access.js", () => ({
  createFallbackProjectInfo: vi.fn(),
  ensureUserProjectDirectory: vi.fn(),
  getUserModelVariant: vi.fn(),
  getUserProjectRestriction: vi.fn(),
  getUserSystemPrompt: vi.fn(),
}));

vi.mock("../../../src/project/manager.js", () => ({
  getProjectsForUser: vi.fn(),
}));

vi.mock("../../../src/queue/index.js", () => ({
  addTaskJob: vi.fn(),
}));

vi.mock("../../../src/bot/utils/busy-guard.js", () => ({
  isForegroundBusy: vi.fn(),
  replyBusyBlocked: vi.fn(),
}));

import { opencodeClient } from "../../../src/opencode/client.js";
import { isSuperUser } from "../../../src/bot/utils/user-tracker.js";
import {
  createFallbackProjectInfo,
  getUserModelVariant,
  getUserProjectRestriction,
  getUserSystemPrompt,
} from "../../../src/users/access.js";
import { getProjectsForUser } from "../../../src/project/manager.js";
import { addTaskJob } from "../../../src/queue/index.js";
import { isForegroundBusy, replyBusyBlocked } from "../../../src/bot/utils/busy-guard.js";
import {
  detectInlineCommand,
  buildCommandPrompt,
  clearInlineRunCacheForTests,
  handleInlineQuery,
  handleInlineRunCallback,
} from "../../../src/bot/handlers/inline-query.js";

const mockGetProjectsForUser = vi.mocked(getProjectsForUser);

function createInlineContext(query: string, fromId: number = 123): Context {
  return {
    inlineQuery: {
      id: "test-query-id",
      query,
    },
    from: { id: fromId },
    answerInlineQuery: vi.fn().mockResolvedValue(undefined),
  } as unknown as Context;
}

function createInlineRunCallbackContext(
  data: string,
  options?: {
    fromId?: number;
    chatId?: number;
    messageId?: number;
    includeChat?: boolean;
    includeMessage?: boolean;
  },
): Context {
  const fromId = options?.fromId ?? 123;
  const chatId = options?.chatId ?? 777;
  const messageId = options?.messageId ?? 42;
  const includeChat = options?.includeChat ?? true;
  const includeMessage = options?.includeMessage ?? true;

  const callbackQuery: Record<string, unknown> = { data };
  if (includeMessage) {
    callbackQuery.message = {
      message_id: messageId,
    };
  }

  return {
    from: { id: fromId },
    chat: includeChat ? { id: chatId } : undefined,
    callbackQuery: callbackQuery as Context["callbackQuery"],
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    api: {
      editMessageText: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockResolvedValue({ message_id: 77 }),
    } as unknown as Context["api"],
  } as unknown as Context;
}

function createMockEventStream(events: AsyncGenerator<any> | { stream: AsyncGenerator<any> }): any {
  return events;
}

describe("detectInlineCommand", () => {
  it("detects summarise: prefix", () => {
    const result = detectInlineCommand("summarise: some long text here to summarize");
    expect(result).not.toBeNull();
    expect(result?.command.prefix).toBe("summarise:");
    expect(result?.actualQuery).toBe("some long text here to summarize");
  });

  it("detects eli5: prefix", () => {
    const result = detectInlineCommand("eli5: quantum physics");
    expect(result).not.toBeNull();
    expect(result?.command.prefix).toBe("eli5:");
  });

  it("detects deep-research: prefix", () => {
    const result = detectInlineCommand("deep-research: climate change solutions");
    expect(result).not.toBeNull();
    expect(result?.command.prefix).toBe("deep-research:");
  });

  it("detects steel-man: prefix", () => {
    const result = detectInlineCommand("steel-man: solar energy adoption");
    expect(result).not.toBeNull();
    expect(result?.command.prefix).toBe("steel-man:");
  });

  it("detects feynman: prefix", () => {
    const result = detectInlineCommand("feynman: machine learning");
    expect(result).not.toBeNull();
    expect(result?.command.prefix).toBe("feynman:");
  });

  it("detects devil's-advocate: prefix", () => {
    const result = detectInlineCommand("devil's-advocate: remote work is productive");
    expect(result).not.toBeNull();
    expect(result?.command.prefix).toBe("devil's-advocate:");
  });

  it("is case-insensitive for prefix detection", () => {
    const result = detectInlineCommand("ELI5: quantum computing");
    expect(result).not.toBeNull();
    expect(result?.command.prefix).toBe("eli5:");
  });

  it("returns null for unknown prefix", () => {
    const result = detectInlineCommand("translate: hello world");
    expect(result).toBeNull();
  });

  it("returns null for general query with no prefix", () => {
    const result = detectInlineCommand("what is the meaning of life?");
    expect(result).toBeNull();
  });

  it("strips prefix from actualQuery correctly", () => {
    const result = detectInlineCommand("summarise:   text with spaces   ");
    expect(result?.actualQuery).toBe("text with spaces");
  });
});

describe("buildCommandPrompt", () => {
  it("combines prompt template with user query", () => {
    const match = detectInlineCommand("eli5: quantum entanglement");
    expect(match).not.toBeNull();
    if (!match) return;

    const prompt = buildCommandPrompt(match.command, match.actualQuery);

    expect(prompt).toContain(match.command.promptTemplate);
    expect(prompt).toContain("quantum entanglement");
    expect(prompt).toContain("USER'S QUESTION/CONTENT:");
  });

  it("includes separator between template and query", () => {
    const match = detectInlineCommand("feynman: neural networks");
    expect(match).not.toBeNull();
    if (!match) return;

    const prompt = buildCommandPrompt(match.command, match.actualQuery);

    expect(prompt).toContain("---");
  });
});

describe("handleInlineQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInlineRunCacheForTests();
    vi.mocked(isForegroundBusy).mockReturnValue(false);
    vi.mocked(replyBusyBlocked).mockResolvedValue(undefined);
    vi.mocked(addTaskJob).mockResolvedValue({} as never);
  });

  it("returns empty results for non-super users", async () => {
    vi.mocked(isSuperUser).mockReturnValue(false);
    const ctx = createInlineContext("hello world");

    await handleInlineQuery(ctx);

    expect(ctx.answerInlineQuery).toHaveBeenCalledWith([], expect.any(Object));
  });

  it("returns empty results when userId is missing", async () => {
    const ctx = {
      inlineQuery: { id: "q1", query: "hello" },
      from: undefined,
      answerInlineQuery: vi.fn().mockResolvedValue(undefined),
    } as unknown as Context;

    await handleInlineQuery(ctx);

    expect(ctx.answerInlineQuery).toHaveBeenCalledWith([], expect.any(Object));
  });

  it("shows 6 command suggestions on empty query", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);
    const ctx = createInlineContext("");

    await handleInlineQuery(ctx);

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(6);
    for (const result of results) {
      expect(result.type).toBe("article");
      expect(result.id).toMatch(/^suggestion:\d+$/);
      expect(result.input_message_content.message_text).not.toMatch(/^\/[a-z0-9_]+$/);
      expect(
        result.reply_markup?.inline_keyboard?.[0]?.[0]?.switch_inline_query_current_chat,
      ).toBeTruthy();
    }
  });

  it("returns error result when command query is too short", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);
    const ctx = createInlineContext("eli5: hi"); // "hi" is 2 chars, min is 10

    await handleInlineQuery(ctx);

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(1);
    expect(results[0].id).toMatch(/error/);
    expect(results[0].input_message_content.message_text).toContain("Explain Like I'm 5");
    expect(
      results[0].reply_markup?.inline_keyboard?.[0]?.[0]?.switch_inline_query_current_chat,
    ).toBeTruthy();
  });

  it("returns callback-driven run result for recognized command prefix", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);

    const ctx = createInlineContext("eli5: what is gravity and how does it work");

    await handleInlineQuery(ctx);

    // Should NOT call any session lifecycle — the slash command handler does that
    expect(opencodeClient.session.create).not.toHaveBeenCalled();
    expect(opencodeClient.session.prompt).not.toHaveBeenCalled();
    expect(opencodeClient.session.delete).not.toHaveBeenCalled();

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(1);
    expect(results[0].input_message_content.message_text).toContain(
      "what is gravity and how does it work",
    );
    expect(results[0].input_message_content.message_text).not.toMatch(/^\/eli5/);
    expect(results[0].input_message_content.parse_mode).toBeUndefined();
    expect(results[0].reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data).toMatch(/^inln_run:/);
    expect(results[0].title).toBeTruthy();
  });

  it("returns callback run result for command prefix without colon", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);
    const ctx = createInlineContext("eli5 what is gravity and how does it work");

    await handleInlineQuery(ctx);

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(1);
    expect(results[0].reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data).toMatch(/^inln_run:/);
  });

  it("returns callback run result for command prefix with spaces around colon", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);
    const ctx = createInlineContext("eli5 : what is gravity and how does it work");

    await handleInlineQuery(ctx);

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(1);
    expect(results[0].reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data).toMatch(/^inln_run:/);
  });

  it("accepts slash-style aliases in inline query input", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);
    const ctx = createInlineContext(
      "deep_research: climate adaptation strategies in coastal cities",
    );

    await handleInlineQuery(ctx);

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(1);
    expect(results[0].reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data).toMatch(/^inln_run:/);
  });

  it("returns callback run result even without inline LLM work", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);

    const ctx = createInlineContext("eli5: what is gravity and how does it work");

    await handleInlineQuery(ctx);

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(1);
    expect(results[0].reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data).toMatch(/^inln_run:/);
  });

  it("returns suggestions for general query (no prefix)", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);

    const ctx = createInlineContext("what is the meaning of life?");

    await handleInlineQuery(ctx);

    // Should NOT call session.prompt — general queries return suggestions only
    expect(opencodeClient.session.prompt).not.toHaveBeenCalled();

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(6);
    for (const result of results) {
      expect(result.id).toMatch(/^suggestion:\d+$/);
      expect(result.input_message_content.message_text).not.toMatch(/^\/[a-z0-9_]+$/);
      expect(
        result.reply_markup?.inline_keyboard?.[0]?.[0]?.switch_inline_query_current_chat,
      ).toBeTruthy();
    }
  });

  it("does NOT create or delete session for command queries (callback deferred)", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);

    const ctx = createInlineContext("eli5: what is photosynthesis and why does it matter here");

    await handleInlineQuery(ctx);

    // Session lifecycle is deferred to the slash command handler, not triggered here
    expect(opencodeClient.session.create).not.toHaveBeenCalled();
    expect(opencodeClient.session.delete).not.toHaveBeenCalled();
    expect(opencodeClient.session.prompt).not.toHaveBeenCalled();

    const calls = (ctx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [results] = calls[0];
    expect(results).toHaveLength(1);
    expect(results[0].reply_markup?.inline_keyboard?.[0]?.[0]?.callback_data).toMatch(/^inln_run:/);
  });

  it("returns no results when no inlineQuery on context", async () => {
    const ctx = {
      inlineQuery: undefined,
      from: { id: 123 },
      answerInlineQuery: vi.fn(),
    } as unknown as Context;

    await handleInlineQuery(ctx);

    expect(ctx.answerInlineQuery).not.toHaveBeenCalled();
  });
});

describe("handleInlineRunCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearInlineRunCacheForTests();
    vi.mocked(isForegroundBusy).mockReturnValue(false);
    vi.mocked(replyBusyBlocked).mockResolvedValue(undefined);
    vi.mocked(addTaskJob).mockResolvedValue({} as never);
  });

  it("returns false for unrelated callback data", async () => {
    const ctx = createInlineRunCallbackContext("other:callback");

    const handled = await handleInlineRunCallback(ctx);

    expect(handled).toBe(false);
    expect(ctx.answerCallbackQuery).not.toHaveBeenCalled();
  });

  it("queues llm_direct job when callback token is valid", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);

    const inlineCtx = createInlineContext("eli5: why is sea water salty");
    await handleInlineQuery(inlineCtx);
    const [results] = (inlineCtx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls[0];
    const callbackData = results[0].reply_markup.inline_keyboard[0][0].callback_data as string;

    const callbackCtx = createInlineRunCallbackContext(callbackData, {
      fromId: 123,
      chatId: 777,
      messageId: 42,
    });

    const handled = await handleInlineRunCallback(callbackCtx);

    expect(handled).toBe(true);
    expect(callbackCtx.answerCallbackQuery).toHaveBeenCalledTimes(1);
    expect(callbackCtx.api.editMessageText).toHaveBeenCalledWith(777, 42, expect.any(String));
    expect(addTaskJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobType: "llm_direct",
        command: "eli5",
        query: "why is sea water salty",
        chatId: 123, // targetChatId = userId
        ackMessageId: 42,
        userId: 123,
      }),
    );
  });

  it("falls back to DM ack message when callback has no chat/message", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);

    const inlineCtx = createInlineContext("eli5: why is sea water salty");
    await handleInlineQuery(inlineCtx);
    const [results] = (inlineCtx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls[0];
    const callbackData = results[0].reply_markup.inline_keyboard[0][0].callback_data as string;

    const callbackCtx = createInlineRunCallbackContext(callbackData, {
      fromId: 123,
      includeChat: false,
      includeMessage: false,
    });

    const handled = await handleInlineRunCallback(callbackCtx);

    expect(handled).toBe(true);
    expect(callbackCtx.api.sendMessage).toHaveBeenCalledWith(123, expect.any(String));
    expect(addTaskJob).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 123,
        ackMessageId: 77,
      }),
    );
  });

  it("returns alert for expired or unknown callback token", async () => {
    const callbackCtx = createInlineRunCallbackContext("inln_run:missing-token");

    const handled = await handleInlineRunCallback(callbackCtx);

    expect(handled).toBe(true);
    expect(callbackCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        show_alert: true,
      }),
    );
    expect(addTaskJob).not.toHaveBeenCalled();
  });

  it("rejects callback token owned by another user", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);

    const inlineCtx = createInlineContext("eli5: why is sea water salty", 123);
    await handleInlineQuery(inlineCtx);
    const [results] = (inlineCtx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls[0];
    const callbackData = results[0].reply_markup.inline_keyboard[0][0].callback_data as string;

    const callbackCtx = createInlineRunCallbackContext(callbackData, {
      fromId: 999,
      chatId: 777,
      messageId: 42,
    });

    const handled = await handleInlineRunCallback(callbackCtx);

    expect(handled).toBe(true);
    expect(callbackCtx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        show_alert: true,
      }),
    );
    expect(addTaskJob).not.toHaveBeenCalled();
  });

  it("respects foreground busy guard", async () => {
    vi.mocked(isSuperUser).mockReturnValue(true);
    vi.mocked(isForegroundBusy).mockReturnValue(true);

    const inlineCtx = createInlineContext("eli5: why is sea water salty");
    await handleInlineQuery(inlineCtx);
    const [results] = (inlineCtx.answerInlineQuery as ReturnType<typeof vi.fn>).mock.calls[0];
    const callbackData = results[0].reply_markup.inline_keyboard[0][0].callback_data as string;

    const callbackCtx = createInlineRunCallbackContext(callbackData);
    const handled = await handleInlineRunCallback(callbackCtx);

    expect(handled).toBe(true);
    expect(replyBusyBlocked).toHaveBeenCalledWith(callbackCtx);
    expect(addTaskJob).not.toHaveBeenCalled();
  });
});
