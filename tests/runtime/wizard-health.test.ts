import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type HealthCheck } from "../../src/monitoring/health-probes.js";

const mockState = vi.hoisted(() => {
  let visibleIdx = 0;
  let hiddenIdx = 0;
  const visibleAnswers = ["1", "111", "", "opencode"];
  const hiddenAnswers = ["token:abc", ""];
  return {
    redisHealth: vi.fn<() => HealthCheck>(),
    opencodeHealth: vi.fn<() => HealthCheck>(),
    stdoutLines: [] as string[],
    reset: () => {
      visibleIdx = 0;
      hiddenIdx = 0;
      mockState.stdoutLines.length = 0;
    },
    nextVisible: () => {
      const answer = visibleAnswers[visibleIdx] ?? "";
      visibleIdx += 1;
      return answer;
    },
    nextHidden: () => {
      const answer = hiddenAnswers[hiddenIdx] ?? "";
      hiddenIdx += 1;
      return answer;
    },
  };
});

vi.mock("../../src/monitoring/health-probes.js", () => ({
  checkRedisHealth: mockState.redisHealth,
  checkOpencodeHealth: mockState.opencodeHealth,
}));

vi.mock("../../src/runtime/paths.js", () => ({
  getRuntimePaths: vi.fn(() => ({
    mode: "installed" as const,
    appHome: "/tmp/test",
    envFilePath: "/tmp/test/.env",
    settingsFilePath: "/tmp/test/settings.json",
    logsDirPath: "/tmp/test/logs",
    runDirPath: "/tmp/test/run",
    dataDirPath: "/tmp/test/.data",
  })),
}));

vi.mock("../../src/i18n/index.js", () => ({
  t: vi.fn(() => "mock-i18n-string"),
  getLocale: vi.fn(() => "en" as const),
  getLocaleOptions: vi.fn(() => [{ code: "en" as const, label: "English" }]),
  resolveSupportedLocale: vi.fn(() => "en" as const),
  setRuntimeLocale: vi.fn(),
}));

const rlPromisesMock = vi.hoisted(() => ({
  createInterface: vi.fn(() => ({
    question: vi.fn(() => Promise.resolve(mockState.nextVisible())),
    close: vi.fn(),
  })),
}));

const rlMock = vi.hoisted(() => ({
  createInterface: vi.fn(() => ({
    close: vi.fn(),
    question: vi.fn((_q: string, cb: (a: string) => void) => {
      cb(mockState.nextHidden());
    }),
  })),
  Interface: class {},
}));

vi.mock("node:readline/promises", () => ({
  default: rlPromisesMock,
  ...rlPromisesMock,
}));

vi.mock("node:readline", () => ({
  default: rlMock,
  ...rlMock,
}));

const fsMock = vi.hoisted(() => ({
  readFile: vi.fn((filePath: string) => {
    if (filePath.includes(".env") && !filePath.includes(".env.example")) {
      return Promise.resolve("TELEGRAM_BOT_TOKEN=old\n");
    }
    return Promise.reject(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
  }),
  writeFile: vi.fn(() => Promise.resolve()),
  mkdir: vi.fn(() => Promise.resolve()),
  rename: vi.fn(() => Promise.resolve()),
  access: vi.fn(() =>
    Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
  ),
}));

vi.mock("node:fs/promises", () => ({
  default: fsMock,
  ...fsMock,
}));

vi.mock("../../src/config.js", () => ({
  config: {
    telegram: {
      token: "test",
      allowedUserIds: [777],
      allowedChatIds: [],
      proxyUrl: "",
    },
    redis: { url: "" },
    superUserIds: new Set<number>(),
    opencode: {
      apiUrl: "http://localhost:4097",
      apiKey: "",
      username: "opencode",
      password: "",
      model: { provider: "opencode", modelId: "big-pickle" },
    },
    server: { logLevel: "error" },
    bot: {
      sessionsListLimit: 10,
      projectsListLimit: 10,
      commandsListLimit: 10,
      taskLimit: 10,
      locale: "en",
      serviceMessagesIntervalSec: 5,
      hideThinkingMessages: false,
      hideToolCallMessages: false,
      hideToolFileMessages: false,
      responseStreaming: false,
      messageFormatMode: "markdown",
      maxConcurrentChats: 3,
      rateLimitWindowMs: 60000,
      rateLimitMessages: 30,
    },
    files: { maxFileSizeKb: 100 },
    stt: { apiUrl: "", apiKey: "", model: "", language: "" },
    tts: { enabled: false, apiUrl: "", apiKey: "", model: "", voice: "" },
    journal: { pollIntervalSec: 10 },
    watchdog: { enabled: false, intervalSec: 30, maxRestarts: 3 },
  },
}));

vi.mock("dotenv", () => ({
  default: { parse: vi.fn(() => ({})) },
  parse: vi.fn(() => ({})),
}));

async function runWizard(): Promise<void> {
  const { runConfigWizardCommand } = await import(
    "../../src/runtime/bootstrap.js"
  );
  await runConfigWizardCommand();
}

describe("wizard health check step", () => {
  beforeEach(() => {
    mockState.reset();
    Object.defineProperty(process.stdin, "isTTY", {
      value: true,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });
    vi.spyOn(process.stdout, "write").mockImplementation(
      (chunk: string) => {
        mockState.stdoutLines.push(chunk);
        return true;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redis probe fails -> wizard warns, does NOT crash, continues", async () => {
    mockState.redisHealth.mockResolvedValue({ ok: false });
    mockState.opencodeHealth.mockResolvedValue({ ok: true });

    await runWizard();

    const joined = mockState.stdoutLines.join("");
    expect(joined).toContain("[WARN] Redis: not running");
    expect(joined).toContain("[OK] OpenCode: running");
  });

  it("opencode probe fails -> wizard warns, does NOT crash, continues", async () => {
    mockState.redisHealth.mockResolvedValue({ ok: true, latencyMs: 3 });
    mockState.opencodeHealth.mockResolvedValue({ ok: false });

    await runWizard();

    const joined = mockState.stdoutLines.join("");
    expect(joined).toContain("[OK] Redis: connected (3ms)");
    expect(joined).toContain("[WARN] OpenCode: not reachable");
  });

  it("both probes fail -> wizard shows warnings for both, still completes", async () => {
    mockState.redisHealth.mockResolvedValue({ ok: false });
    mockState.opencodeHealth.mockResolvedValue({ ok: false });

    await runWizard();

    const joined = mockState.stdoutLines.join("");
    expect(joined).toContain("[WARN] Redis: not running");
    expect(joined).toContain("[WARN] OpenCode: not reachable");
    expect(joined).toContain(
      "Both checks failed",
    );
  });

  it("both probes succeed -> wizard shows OK messages with latency", async () => {
    mockState.redisHealth.mockResolvedValue({ ok: true, latencyMs: 5 });
    mockState.opencodeHealth.mockResolvedValue({ ok: true });

    await runWizard();

    const joined = mockState.stdoutLines.join("");
    expect(joined).toContain("[OK] Redis: connected (5ms)");
    expect(joined).toContain("[OK] OpenCode: running");
  });

  it("redis skipped (REDIS_ENABLED=false) -> wizard shows skipped message", async () => {
    mockState.redisHealth.mockResolvedValue({
      ok: false,
      skipped: true,
    });
    mockState.opencodeHealth.mockResolvedValue({ ok: true });

    await runWizard();

    const joined = mockState.stdoutLines.join("");
    expect(joined).toContain("[OK] Redis: skipped (disabled)");
    expect(joined).toContain("[OK] OpenCode: running");
  });
});
