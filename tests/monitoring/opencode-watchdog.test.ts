import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockConfigObj = {
  watchdog: { enabled: true, intervalSec: 30, maxRestarts: 3 },
  opencode: { apiUrl: "http://localhost:4097" },
};

describe("opencode-watchdog", () => {
  let startWatchdog: () => void;
  let stopWatchdog: () => void;
  let isWatchdogRunning: () => boolean;
  let initializeWatchdog: (bot: any, userId: number) => void;
  let mockStart: ReturnType<typeof vi.fn>;
  let mockSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();

    mockConfigObj.watchdog.enabled = true;

    mockStart = vi.fn(() => Promise.resolve({ success: true }));
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../../src/config.js", () => ({ config: mockConfigObj }));
    vi.doMock("../../src/process/manager.js", () => ({
      processManager: { start: mockStart },
    }));
    vi.doMock("../../src/utils/logger.js", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));

    global.fetch = vi.fn();

    const watchdogMod = await import("../../src/monitoring/opencode-watchdog.js");
    startWatchdog = watchdogMod.startWatchdog;
    stopWatchdog = watchdogMod.stopWatchdog;
    isWatchdogRunning = watchdogMod.isWatchdogRunning;
    initializeWatchdog = watchdogMod.initializeWatchdog;

    const mockBot = { api: { sendMessage: mockSendMessage } } as any;
    initializeWatchdog(mockBot, 123);
  });

  afterEach(async () => {
    stopWatchdog();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("isWatchdogRunning returns false initially", () => {
    expect(isWatchdogRunning()).toBe(false);
  });

  it("isWatchdogRunning is true after start and false after stop", () => {
    startWatchdog();
    expect(isWatchdogRunning()).toBe(true);
    stopWatchdog();
    expect(isWatchdogRunning()).toBe(false);
  });

  it("double startWatchdog logs warning and doesn't start again", async () => {
    const { logger } = await import("../../src/utils/logger.js");
    startWatchdog();
    startWatchdog();
    expect(logger.warn).toHaveBeenCalledWith("[Watchdog] Already running, skipping start");
  });

  it("does nothing when config.watchdog.enabled is false", () => {
    mockConfigObj.watchdog.enabled = false;
    startWatchdog();
    expect(isWatchdogRunning()).toBe(false);
  });

  it("health check success - no restart triggered", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ healthy: true }) });
    startWatchdog();
    await vi.advanceTimersByTimeAsync(30000);
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("health check fails 3 times - triggers processManager.start once", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));
    startWatchdog();
    await vi.advanceTimersByTimeAsync(90000);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("cooldown - second batch of 3 failures does not trigger another restart", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));
    startWatchdog();

    // First 3 failures → restart triggered, lastRestartTime set, failCount reset to 0
    await vi.advanceTimersByTimeAsync(90000);
    expect(mockStart).toHaveBeenCalledTimes(1);

    // 3 more failures within cooldown window (90s elapsed < 120s cooldown)
    await vi.advanceTimersByTimeAsync(90000);
    // Still only 1 restart — cooldown prevented the second
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("notifies user when server goes down - sends ⚠️ message", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));
    startWatchdog();
    // 3 failures trigger attemptRestart which calls notifyUser
    await vi.advanceTimersByTimeAsync(90000);
    expect(mockSendMessage).toHaveBeenCalledWith(123, expect.stringContaining("⚠️"));
  });

  it("recovery notification - sends ✅ message after server comes back online", async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error("Connection refused"));
    startWatchdog();
    // 3 failures → serverWasDown = true
    await vi.advanceTimersByTimeAsync(90000);
    // Server recovers
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ healthy: true }) });
    await vi.advanceTimersByTimeAsync(30000);
    expect(mockSendMessage).toHaveBeenCalledWith(123, expect.stringContaining("✅"));
  });

  it("cooldown expiry allows second restart after 2 minutes", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));
    startWatchdog();
    // First 3 failures → restart at t=90s
    await vi.advanceTimersByTimeAsync(90000);
    expect(mockStart).toHaveBeenCalledTimes(1);
    // Advance past the 2-minute cooldown (120000ms from last restart at t=90s → need t=210s)
    await vi.advanceTimersByTimeAsync(120000);
    expect(mockStart).toHaveBeenCalledTimes(2);
  });
});
