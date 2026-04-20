import { Bot, Context } from "grammy";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { processManager } from "../process/manager.js";

let botInstance: Bot<Context> | null = null;
let watchdogUserId: number | null = null;
let intervalId: NodeJS.Timeout | null = null;
let failCount = 0;
let serverWasDown = false;
let lastRestartTime = 0;

const RESTART_COOLDOWN_MS = 2 * 60 * 1000; // 2-minute cooldown after restart attempt

export function initializeWatchdog(bot: Bot<Context>, userId: number): void {
  botInstance = bot;
  watchdogUserId = userId;
  logger.info("[Watchdog] Initialized with userId=" + userId);
}

export function startWatchdog(): void {
  if (!config.watchdog.enabled) {
    logger.info("[Watchdog] Disabled via config, skipping start");
    return;
  }

  if (intervalId !== null) {
    logger.warn("[Watchdog] Already running, skipping start");
    return;
  }

  const intervalMs = config.watchdog.intervalSec * 1000;
  logger.info(
    `[Watchdog] Starting health checks every ${config.watchdog.intervalSec}s, max failures before restart: ${config.watchdog.maxRestarts}`,
  );

  intervalId = setInterval(() => {
    void runHealthCheck();
  }, intervalMs);
}

export function stopWatchdog(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("[Watchdog] Stopped");
  }
}

export function isWatchdogRunning(): boolean {
  return intervalId !== null;
}

async function runHealthCheck(): Promise<void> {
  try {
    const response = await fetch(`${config.opencode.apiUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      if (serverWasDown) {
        logger.info("[Watchdog] Server recovered after being down");
        serverWasDown = false;
        lastRestartTime = 0;
        await notifyUser("✅ OpenCode server is back online");
      }
      failCount = 0;
      return;
    }
    // Non-2xx response counts as a failure
    throw new Error(`Health check returned status ${response.status}`);
  } catch (err) {
    failCount++;
    logger.warn(`[Watchdog] Health check failed (failCount=${failCount}):`, err);

    if (failCount >= config.watchdog.maxRestarts) {
      await attemptRestart();
    }
  }
}

async function attemptRestart(): Promise<void> {
  const now = Date.now();
  if (now - lastRestartTime < RESTART_COOLDOWN_MS) {
    logger.debug("[Watchdog] Skipping restart — still in cooldown period");
    return;
  }

  logger.warn("[Watchdog] Max failures reached, attempting restart of OpenCode server");
  serverWasDown = true;
  await notifyUser("⚠️ OpenCode server appears to be down, attempting restart...");

  lastRestartTime = now;
  failCount = 0;

  const result = await processManager.start();
  if (result.success) {
    logger.info("[Watchdog] Restart successful");
  } else {
    logger.error("[Watchdog] Restart failed:", result.error);
  }
}

async function notifyUser(message: string): Promise<void> {
  if (!botInstance || !watchdogUserId) {
    logger.warn("[Watchdog] Cannot notify user — bot or userId not initialized");
    return;
  }
  try {
    await botInstance.api.sendMessage(watchdogUserId, message);
  } catch (err) {
    logger.error("[Watchdog] Failed to send notification:", err);
  }
}
