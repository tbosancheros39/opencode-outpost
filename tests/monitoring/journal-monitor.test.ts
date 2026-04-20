import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Variables starting with "mock" are hoisted alongside vi.mock factories by vitest.
const mockCaptures = {
  stdout: null as ((chunk: Buffer) => void) | null,
  stderr: null as ((chunk: Buffer) => void) | null,
  exit: null as ((code: number | null) => void) | null,
};

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    spawn: vi.fn(() => ({
      stdout: {
        on: vi.fn((evt: string, cb: (chunk: Buffer) => void) => {
          if (evt === "data") mockCaptures.stdout = cb;
        }),
      },
      stderr: {
        on: vi.fn((evt: string, cb: (chunk: Buffer) => void) => {
          if (evt === "data") mockCaptures.stderr = cb;
        }),
      },
      on: vi.fn((evt: string, cb: (code: number | null) => void) => {
        if (evt === "exit") mockCaptures.exit = cb;
      }),
      kill: vi.fn(),
    })),
    execSync: vi.fn(),
  };
});

vi.mock("../../src/utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { spawn, execSync } from "child_process";
import { logger } from "../../src/utils/logger.js";
import {
  getJournalErrors,
  initializeJournalMonitoring,
  isJournalMonitoringRunning,
  startJournalMonitoring,
  stopJournalMonitoring,
} from "../../src/monitoring/journal-monitor.js";

const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockBot = { api: { sendMessage: mockSendMessage } } as any;

/** Flush the microtask queue so fire-and-forget async calls complete. */
async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("journal-monitor", () => {
  beforeEach(() => {
    mockCaptures.stdout = null;
    mockCaptures.stderr = null;
    mockCaptures.exit = null;
    mockSendMessage.mockReset();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(spawn).mockClear();
    initializeJournalMonitoring(mockBot, 123);
  });

  afterEach(() => {
    stopJournalMonitoring();
    vi.useRealTimers();
  });

  it("isJournalMonitoringRunning returns false initially", () => {
    expect(isJournalMonitoringRunning()).toBe(false);
  });

  it("isJournalMonitoringRunning is true after start and false after stop", () => {
    startJournalMonitoring({ userId: 777 });
    expect(isJournalMonitoringRunning()).toBe(true);
    stopJournalMonitoring();
    expect(isJournalMonitoringRunning()).toBe(false);
  });

  it("double startJournalMonitoring logs warning and doesn't duplicate", () => {
    startJournalMonitoring({ userId: 777 });
    startJournalMonitoring({ userId: 777 });
    expect(logger.warn).toHaveBeenCalledWith("[JournalMonitor] Already running");
  });

  it("getJournalErrors returns formatted HTML output for journal lines", async () => {
    vi.mocked(execSync).mockReturnValue(
      "2024-01-01T00:00:00+0000 hostname myapp[123]: Some error occurred\n2024-01-01T00:00:01+0000 hostname myapp[124]: Another error\n" as any,
    );
    const result = await getJournalErrors(20);
    expect(result).toContain("📋 <b>Recent System Errors</b>");
    expect(result).toContain("Some error occurred");
    expect(result).toContain("Another error");
  });

  it("getJournalErrors returns not-available message when execSync throws ENOENT", async () => {
    const err = Object.assign(new Error("journalctl not found"), { code: "ENOENT" });
    vi.mocked(execSync).mockImplementation(() => {
      throw err;
    });
    const result = await getJournalErrors();
    expect(result).toContain("journalctl not available");
    expect(result).toContain("systemd is not present");
  });

  it("getJournalErrors returns no-errors message when output is empty", async () => {
    vi.mocked(execSync).mockReturnValue("" as any);
    const result = await getJournalErrors();
    expect(result).toContain("No recent journal errors");
  });

  it("alert on valid line - sends message with unit and content", async () => {
    startJournalMonitoring({ userId: 123 });
    expect(mockCaptures.stdout).not.toBeNull();
    mockCaptures.stdout?.(
      Buffer.from('{"_SYSTEMD_UNIT":"svc-alert1.service","MESSAGE":"error occurred alert1","PRIORITY":"3"}\n'),
    );
    await flushPromises();
    expect(mockSendMessage).toHaveBeenCalledOnce();
    const msg = mockSendMessage.mock.calls[0][1] as string;
    expect(msg).toContain("svc-alert1.service");
    expect(msg).toContain("error occurred alert1");
  });

  it("dedup suppresses duplicate messages within TTL window", async () => {
    startJournalMonitoring({ userId: 123 });
    expect(mockCaptures.stdout).not.toBeNull();
    const line = Buffer.from(
      '{"_SYSTEMD_UNIT":"svc-dedup2.service","MESSAGE":"duplicate error dedup2","PRIORITY":"3"}\n',
    );
    mockCaptures.stdout?.(line);
    mockCaptures.stdout?.(line);
    await flushPromises();
    expect(mockSendMessage).toHaveBeenCalledOnce();
  });

  it("dedup allows different messages from the same unit", async () => {
    startJournalMonitoring({ userId: 123 });
    expect(mockCaptures.stdout).not.toBeNull();
    mockCaptures.stdout?.(
      Buffer.from('{"_SYSTEMD_UNIT":"svc-multi3.service","MESSAGE":"error alpha multi3","PRIORITY":"3"}\n'),
    );
    mockCaptures.stdout?.(
      Buffer.from('{"_SYSTEMD_UNIT":"svc-multi3.service","MESSAGE":"error beta multi3","PRIORITY":"3"}\n'),
    );
    await flushPromises();
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it("invalid JSON on stdout is ignored without throwing", async () => {
    startJournalMonitoring({ userId: 123 });
    expect(mockCaptures.stdout).not.toBeNull();
    expect(() => {
      mockCaptures.stdout?.(Buffer.from("not json\n"));
    }).not.toThrow();
    await flushPromises();
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("auto-restart on exit - respawns journalctl after 10 seconds", async () => {
    vi.useFakeTimers();
    startJournalMonitoring({ userId: 123 });
    expect(mockCaptures.exit).not.toBeNull();
    mockCaptures.exit?.(0);
    await vi.advanceTimersByTimeAsync(10001);
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(2);
  });

  it("stop cancels pending restart timer", async () => {
    vi.useFakeTimers();
    startJournalMonitoring({ userId: 123 });
    const spawnCallsBefore = vi.mocked(spawn).mock.calls.length;
    expect(mockCaptures.exit).not.toBeNull();
    mockCaptures.exit?.(0);

    stopJournalMonitoring();
    await vi.advanceTimersByTimeAsync(15000);

    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(spawnCallsBefore);
  });

  it("handles process.kill() throwing without crashing", () => {
    startJournalMonitoring({ userId: 123 });
    const spawnResult = vi.mocked(spawn).mock.results[0]?.value as { kill?: () => void };
    expect(spawnResult).toBeTruthy();
    spawnResult.kill = vi.fn(() => {
      throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    });

    expect(() => stopJournalMonitoring()).not.toThrow();
  });
});
