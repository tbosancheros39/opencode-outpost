import { describe, expect, it, vi } from "vitest";
import { getToolStreamKey } from "../../src/bot/streaming/tool-call-streamer.js";

const mockConfig = vi.hoisted(() => ({
  bot: { hideToolFileMessages: false },
  opencode: {
    apiUrl: "http://localhost:4096",
    username: "opencode",
    password: "",
    model: { provider: "test", modelId: "test" },
  },
  telegram: { token: "test", allowedUserIds: [], allowedChatIds: [], proxyUrl: "" },
  server: { logLevel: "error" },
  superUserIds: new Set(),
  redis: { url: "redis://localhost:6379" },
  files: { maxFileSizeKb: 100 },
  stt: { apiUrl: "", apiKey: "", model: "whisper-large-v3-turbo", language: "" },
  tts: { enabled: false, apiUrl: "", apiKey: "", model: "gpt-4o-mini-tts", voice: "alloy" },
  journal: { pollIntervalSec: 10 },
  watchdog: { enabled: true, intervalSec: 30, maxRestarts: 3 },
}));

vi.mock("../../src/config.js", () => ({
  config: mockConfig,
}));

vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@opencode-ai/sdk", () => ({
  createOpencodeClient: vi.fn(() => ({})),
}));

import { shouldDisplayToolMessage } from "../../src/summary/tool-message-batcher.js";

describe("shouldDisplayToolMessage", () => {
  it("returns true for file tool when config is false", () => {
    mockConfig.bot.hideToolFileMessages = false;
    expect(shouldDisplayToolMessage("write_file")).toBe(true);
    expect(shouldDisplayToolMessage("edit_file")).toBe(true);
    expect(shouldDisplayToolMessage("create_file")).toBe(true);
    expect(shouldDisplayToolMessage("patch_file")).toBe(true);
  });

  it("returns false for file tool when config is true", () => {
    mockConfig.bot.hideToolFileMessages = true;
    expect(shouldDisplayToolMessage("write_file")).toBe(false);
    expect(shouldDisplayToolMessage("edit_file")).toBe(false);
    expect(shouldDisplayToolMessage("create_file")).toBe(false);
    expect(shouldDisplayToolMessage("patch_file")).toBe(false);
  });

  it("returns true for non-file tools regardless of config", () => {
    mockConfig.bot.hideToolFileMessages = true;
    expect(shouldDisplayToolMessage("bash")).toBe(true);
    expect(shouldDisplayToolMessage("grep")).toBe(true);
    expect(shouldDisplayToolMessage("search")).toBe(true);
    expect(shouldDisplayToolMessage("unknown_tool")).toBe(true);
  });
});

describe("getToolStreamKey", () => {
  it("maps file tools to 'files'", () => {
    expect(getToolStreamKey("write_file")).toBe("files");
    expect(getToolStreamKey("edit_file")).toBe("files");
    expect(getToolStreamKey("create_file")).toBe("files");
    expect(getToolStreamKey("patch_file")).toBe("files");
  });

  it("maps command tools to 'commands'", () => {
    expect(getToolStreamKey("bash")).toBe("commands");
    expect(getToolStreamKey("shell")).toBe("commands");
    expect(getToolStreamKey("run_command")).toBe("commands");
  });

  it("maps search tools to 'search'", () => {
    expect(getToolStreamKey("search")).toBe("search");
    expect(getToolStreamKey("grep")).toBe("search");
    expect(getToolStreamKey("find")).toBe("search");
    expect(getToolStreamKey("glob")).toBe("search");
  });

  it("maps unknown tools to 'other'", () => {
    expect(getToolStreamKey("unknown_tool")).toBe("other");
    expect(getToolStreamKey("todowrite")).toBe("other");
    expect(getToolStreamKey("apply_patch")).toBe("other");
  });
});
