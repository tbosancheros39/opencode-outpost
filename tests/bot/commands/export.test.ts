import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { exportCommand } from "../../../src/bot/commands/export.js";

const mocked = vi.hoisted(() => ({
  currentSession: null as { id: string; title: string; directory: string } | null,
  messagesMock: vi.fn(),
  fs: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
  },
}));

vi.mock("../../../src/session/manager.js", () => ({
  getCurrentSession: vi.fn(() => mocked.currentSession),
}));

vi.mock("../../../src/opencode/client.js", () => ({
  opencodeClient: {
    session: {
      messages: mocked.messagesMock,
    },
  },
}));

vi.mock("node:fs", () => ({
  promises: mocked.fs,
}));

describe("bot/commands/export", () => {
  beforeEach(() => {
    mocked.currentSession = null;
    mocked.messagesMock.mockReset();
    mocked.fs.mkdir.mockReset();
    mocked.fs.writeFile.mockReset();
    mocked.fs.unlink.mockReset();
  });

  it("replies no_session when there is no active session", async () => {
    const replyMock = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      chat: { id: 777 },
      reply: replyMock,
    } as unknown as Context;

    await exportCommand(ctx as never);

    expect(replyMock).toHaveBeenCalledWith(
      expect.stringContaining("No active session"),
    );
    expect(mocked.messagesMock).not.toHaveBeenCalled();
  });

  it("exports session and sends document when session exists", async () => {
    mocked.currentSession = {
      id: "session-123",
      title: "Test Session",
      directory: "/test/project",
    };

    mocked.messagesMock.mockResolvedValue({
      data: [
        {
          info: {
            id: "msg-1",
            sessionID: "session-123",
            role: "user" as const,
            time: { created: 1709308800000 },
            agent: "test-agent",
          },
          parts: [
            {
              id: "part-1",
              sessionID: "session-123",
              messageID: "msg-1",
              type: "text",
              text: "Hello, world!",
            },
          ],
        },
        {
          info: {
            id: "msg-2",
            sessionID: "session-123",
            role: "assistant" as const,
            time: { created: 1709308860000, completed: 1709308900000 },
            agent: "test-agent",
            model: { providerID: "opencode-go", modelID: "minimax-m2.7" },
            cost: 0.0025,
            tokens: {
              input: 100,
              output: 200,
              reasoning: 50,
              cache: { read: 0, write: 0 },
            },
          },
          parts: [
            {
              id: "part-2",
              sessionID: "session-123",
              messageID: "msg-2",
              type: "text",
              text: "Hello! How can I help you?",
            },
          ],
        },
      ],
      error: null,
    });

    mocked.fs.mkdir.mockResolvedValue(undefined);
    mocked.fs.writeFile.mockResolvedValue(undefined);
    mocked.fs.unlink.mockResolvedValue(undefined);

    const deleteMessageMock = vi.fn().mockResolvedValue(undefined);
    const replyWithDocumentMock = vi.fn().mockResolvedValue(undefined);

    const ctx = {
      chat: { id: 777 },
      reply: vi.fn().mockResolvedValue({ message_id: 1 }),
      replyWithDocument: replyWithDocumentMock,
      api: {
        deleteMessage: deleteMessageMock,
        editMessageText: vi.fn(),
      },
    } as unknown as Context;

    await exportCommand(ctx as never);

    expect(mocked.fs.mkdir).toHaveBeenCalled();
    expect(mocked.fs.writeFile).toHaveBeenCalled();
    expect(deleteMessageMock).toHaveBeenCalledWith(777, 1);
    expect(replyWithDocumentMock).toHaveBeenCalled();
    expect(mocked.fs.unlink).toHaveBeenCalled();
  });

  it("handles messages with no content gracefully", async () => {
    mocked.currentSession = {
      id: "session-456",
      title: "Empty Session",
      directory: "/test/project",
    };

    mocked.messagesMock.mockResolvedValue({
      data: [
        {
          info: {
            id: "msg-1",
            sessionID: "session-456",
            role: "user" as const,
            time: { created: 1709308800000 },
            agent: "test-agent",
          },
          parts: [],
        },
      ],
      error: null,
    });

    mocked.fs.mkdir.mockResolvedValue(undefined);
    mocked.fs.writeFile.mockResolvedValue(undefined);
    mocked.fs.unlink.mockResolvedValue(undefined);

    const deleteMessageMock = vi.fn().mockResolvedValue(undefined);

    const ctx = {
      chat: { id: 777 },
      reply: vi.fn().mockResolvedValue({ message_id: 1 }),
      replyWithDocument: vi.fn(),
      api: {
        deleteMessage: deleteMessageMock,
        editMessageText: vi.fn(),
      },
    } as unknown as Context;

    await exportCommand(ctx as never);

    expect(mocked.fs.writeFile).toHaveBeenCalled();
    const writeCall = mocked.fs.writeFile.mock.calls[0];
    const content = writeCall[1] as string;
    expect(content).toContain("# Empty Session");
    expect(content).toContain("User");
  });

  it("handles API errors gracefully", async () => {
    mocked.currentSession = {
      id: "session-789",
      title: "Error Session",
      directory: "/test/project",
    };

    mocked.messagesMock.mockResolvedValue({
      data: null,
      error: new Error("API Error"),
    });

    mocked.fs.mkdir.mockResolvedValue(undefined);

    const editMessageTextMock = vi.fn().mockResolvedValue(undefined);

    const ctx = {
      chat: { id: 777 },
      reply: vi.fn().mockResolvedValue({ message_id: 1 }),
      api: {
        deleteMessage: vi.fn(),
        editMessageText: editMessageTextMock,
      },
    } as unknown as Context;

    await exportCommand(ctx as never);

    expect(editMessageTextMock).toHaveBeenCalledWith(
      777,
      1,
      expect.stringContaining("Export failed"),
      expect.any(Object),
    );
  });
});
