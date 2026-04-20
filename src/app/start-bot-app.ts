import { readFile } from "node:fs/promises";

import { createBot } from "../bot/index.js";
import { config } from "../config.js";
import { loadSettings } from "../settings/manager.js";
import { processManager } from "../process/manager.js";
import { scheduledTaskRuntime } from "../scheduled-task/runtime.js";
import { warmupSessionDirectoryCache } from "../session/cache-manager.js";
import { reconcileStoredModelSelection } from "../model/manager.js";
import { autoResumeLastSession } from "../session/manager.js";
import { getRuntimeMode } from "../runtime/mode.js";
import { getRuntimePaths } from "../runtime/paths.js";
import { logger } from "../utils/logger.js";
import { run } from "@grammyjs/runner";
import type { RunnerHandle } from "@grammyjs/runner";
import { initQueue, startWorker, setTelegramBotApi, type TelegramBotApi } from "../queue/index.js";
import { initializeWatchdog, startWatchdog, stopWatchdog } from "../monitoring/opencode-watchdog.js";

async function runStartupSecurityChecks(): Promise<void> {
  const warnings: string[] = [];

  // Warn if no allowed user IDs configured
  if (config.telegram.allowedUserIds.length === 0) {
    warnings.push("⚠️  SECURITY WARNING: TELEGRAM_ALLOWED_USER_IDS is empty - bot will not respond to any users");
  }

  // Warn if OpenCode API URL is remote without authentication
  const apiUrl = config.opencode.apiUrl;
  const isRemote = !apiUrl.includes("localhost") && !apiUrl.includes("127.0.0.1");
  const hasAuth = config.opencode.password && config.opencode.password.length > 0;

  if (isRemote && !hasAuth) {
    warnings.push(
      `⚠️  SECURITY WARNING: OPENCODE_API_URL points to remote server (${apiUrl}) but OPENCODE_SERVER_PASSWORD is not set`
    );
  }

  // Warn if Redis is configured but unavailable
  const redisEnabled = process.env.REDIS_ENABLED;
  if (redisEnabled !== "false" && redisEnabled !== "0" && redisEnabled !== "no") {
    try {
      const { Redis } = await import("ioredis");
      const redisUrl = config.redis.url;
      const testClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
      try {
        await testClient.ping();
        await testClient.quit();
      } catch {
        warnings.push(`⚠️  Redis configured at ${redisUrl} but not reachable - scheduled tasks will not run in background`);
      }
    } catch {
      // ioredis not available, skip check
    }
  }

  // Warn if watchdog is enabled but no users configured
  if (config.watchdog.enabled && config.telegram.allowedUserIds.length === 0) {
    warnings.push("⚠️  OpenCode watchdog is enabled but no allowed user IDs configured - notifications will not be sent");
  }

  // Log all warnings
  if (warnings.length > 0) {
    logger.warn("=".repeat(80));
    logger.warn("STARTUP SECURITY WARNINGS:");
    for (const warning of warnings) {
      logger.warn(warning);
    }
    logger.warn("=".repeat(80));
  }
}

async function getBotVersion(): Promise<string> {
  try {
    const packageJsonPath = new URL("../../package.json", import.meta.url);
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent) as { version?: string };

    return packageJson.version ?? "unknown";
  } catch (error) {
    logger.warn("[App] Failed to read bot version", error);
    return "unknown";
  }
}

export async function startBotApp(): Promise<void> {
  const mode = getRuntimeMode();
  const runtimePaths = getRuntimePaths();
  const version = await getBotVersion();

  logger.info(`Starting OpenCode Telegram Bot v${version}...`);
  logger.info(`Config loaded from ${runtimePaths.envFilePath}`);
  logger.info(`Allowed User IDs: ${config.telegram.allowedUserIds.join(", ")}`);
  logger.debug(`[Runtime] Application start mode: ${mode}`);

  // Security and configuration warnings
  await runStartupSecurityChecks();

  await loadSettings();
  await processManager.initialize();
  await reconcileStoredModelSelection();
  await autoResumeLastSession(0);
  await warmupSessionDirectoryCache();

  const bot = await createBot();
  await scheduledTaskRuntime.initialize(bot);

  setTelegramBotApi(bot.api as unknown as TelegramBotApi);
  await initQueue();
  await startWorker();

  const userId = config.telegram.allowedUserIds[0];
  if (userId !== undefined) {
    initializeWatchdog(bot, userId);
    startWatchdog();
  } else {
    logger.warn("[App] No allowed user IDs configured, watchdog notifications disabled");
  }

  const webhookInfo = await bot.api.getWebhookInfo();
  if (webhookInfo.url) {
    logger.info(`[Bot] Webhook detected: ${webhookInfo.url}, removing...`);
    await bot.api.deleteWebhook();
    logger.info("[Bot] Webhook removed, switching to long polling");
  }


  const botInfo = await bot.api.getMe();
  logger.info(`Bot @${botInfo.username} starting...`);

  const handle: RunnerHandle = run(bot);

  // Graceful shutdown handler
  const SHUTDOWN_TIMEOUT_MS = 15000;

  await new Promise<void>((resolve) => {
    const shutdown = async (signal: string) => {
      logger.info(`[App] Shutdown signal (${signal}) received, starting graceful shutdown...`);

      const shutdownPromise = (async () => {
        try {
          // 1. Stop accepting new work
          logger.info("[App] Stopping bot polling...");
          await handle.stop();
          logger.info("[App] Bot polling stopped");

          // 2. Stop watchdog
          stopWatchdog();

          // 3. Stop SSE event listening
          logger.info("[App] Stopping SSE event stream...");
          const { stopEventListening } = await import("../opencode/events.js");
          stopEventListening();
          logger.info("[App] SSE event stream stopped");

          // 4. Wait for BullMQ workers to finish in-progress jobs
          logger.info("[App] Draining BullMQ workers...");
          const { stopWorker, closeQueue } = await import("../queue/index.js");
          await stopWorker();
          await closeQueue();
          logger.info("[App] BullMQ workers drained");

          // 5. Close SQLite connections
          logger.info("[App] Closing SQLite connections...");
          const { closeTaskDb } = await import("../task-queue/store.js");
          closeTaskDb();
          logger.info("[App] SQLite connections closed");

          logger.info("[App] Graceful shutdown complete");
        } catch (error) {
          logger.error("[App] Error during graceful shutdown:", error);
        }
      })();

      // Force exit after timeout
      const timeoutPromise = new Promise<void>((resolveTimeout) => {
        setTimeout(() => {
          logger.warn(`[App] Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
          resolveTimeout();
        }, SHUTDOWN_TIMEOUT_MS);
      });

      await Promise.race([shutdownPromise, timeoutPromise]);
      resolve();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  });
}
