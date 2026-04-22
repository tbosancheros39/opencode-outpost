/**
 * BullMQ worker for processing long-running tasks with progress heartbeat
 * Sends silent Telegram updates every ~10% progress
 */

import { Worker, type Job } from "bullmq";
import type { TaskJobData, TaskJobResult } from "./types.js";
import { QUEUE_NAME } from "./types.js";
import { getRedisConnection, isRedisAvailable } from "./queue.js";
import { memoryQueue } from "./memory-queue.js";
import { opencodeClient } from "../opencode/client.js";
import { updateTask } from "../task-queue/store.js";
import { resolveInlineQuery } from "../services/inline-llm.js";
import { getStoredModel } from "../model/manager.js";
import { logger } from "../utils/logger.js";
import { t } from "../i18n/index.js";

let workerInstance: Worker<TaskJobData, TaskJobResult, string> | null = null;

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 5000;
const taskRetries = new Map<string, number>();

function getBackoffMs(attempt: number): number {
  return INITIAL_BACKOFF_MS * Math.pow(3, attempt - 1);
}

export interface TelegramBotApi {
  sendMessage(chatId: number, text: string, extra?: Record<string, unknown>): Promise<{ message_id: number }>;
  editMessageText(chatId: number, messageId: number, text: string, extra?: Record<string, unknown>): Promise<true>;
  raw: {
    editMessageText(params: Record<string, unknown>): Promise<unknown>;
  };
}

let telegramBotApi: TelegramBotApi | null = null;

export function setTelegramBotApi(api: TelegramBotApi): void {
  telegramBotApi = api;
}

async function sendProgressHeartbeat(
  chatId: number,
  messageId: number | null,
  percent: number,
  message: string,
): Promise<number | null> {
  if (!telegramBotApi) {
    logger.warn("[Worker] Telegram API not set, skipping heartbeat");
    return messageId;
  }

  const progressBar = getProgressBar(percent);
  const text = `${progressBar} ${percent}%\n\n${message}`;

  try {
    if (messageId) {
      await telegramBotApi.editMessageText(chatId, messageId, text);
      return messageId;
    } else {
      const result = await telegramBotApi.sendMessage(chatId, text);
      return result.message_id;
    }
  } catch (error) {
    logger.warn("[Worker] Failed to send progress heartbeat:", error);
    return messageId;
  }
}

function getProgressBar(percent: number): string {
  const filled = Math.round(percent / 5);
  const empty = 20 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

export async function startWorker(): Promise<Worker<TaskJobData, TaskJobResult, string> | null> {
  if (workerInstance) {
    logger.warn("[Worker] Worker already running");
    return workerInstance;
  }

  if (!isRedisAvailable()) {
    logger.warn("[Worker] Redis not available, BullMQ worker disabled");
    memoryQueue.setProcessor((data) => processJob({ data } as Job<TaskJobData, TaskJobResult, string>));
    return null;
  }

  const connection = getRedisConnection();
  if (!connection) {
    logger.warn("[Worker] Redis connection not available");
    memoryQueue.setProcessor((data) => processJob({ data } as Job<TaskJobData, TaskJobResult, string>));
    return null;
  }

  try {
    workerInstance = new Worker<TaskJobData, TaskJobResult, string>(
      QUEUE_NAME,
      async (job: Job<TaskJobData, TaskJobResult, string>) => {
        return processJob(job);
      },
      {
        connection,
        concurrency: 1,
        settings: {
          backoffStrategy: (attempts: number) => getBackoffMs(attempts),
        },
      },
    );

    workerInstance.on("completed", (job) => {
      logger.info(`[Worker] Job ${job.id} completed`);
    });

    workerInstance.on("failed", (job, error) => {
      logger.error(`[Worker] Job ${job?.id} failed:`, error);
    });

    workerInstance.on("error", (error) => {
      logger.error("[Worker] Worker error:", error);
    });

    logger.info("[Worker] BullMQ worker started");
    memoryQueue.setProcessor((data) => processJob({ data } as Job<TaskJobData, TaskJobResult, string>));
    return workerInstance;
  } catch (error) {
    logger.warn("[Worker] Redis not available, BullMQ worker disabled:", error);
    memoryQueue.setProcessor((data) => processJob({ data } as Job<TaskJobData, TaskJobResult, string>));
    return null;
  }
}

async function processJob(job: Job<TaskJobData, TaskJobResult, string>): Promise<TaskJobResult> {
  if (job.data.jobType === "llm_direct") {
    return processLlmDirectJob(job.data);
  }
  return processOpencodeJob(job);
}

async function processLlmDirectJob(data: TaskJobData): Promise<TaskJobResult> {
  const { command, query, chatId, ackMessageId, inlineMessageId } = data;
  if (!command || !query || !telegramBotApi) {
    logger.warn("[Worker] llm_direct job missing command/query/telegramBotApi");
    return { success: false, error: "missing fields" };
  }
  try {
    // Get the stored model for this chat/user so inline queries use the right provider
    const storedModel = getStoredModel(chatId);
    const result = await resolveInlineQuery(
      command,
      query,
      storedModel.providerID || undefined,
      storedModel.modelID || undefined,
    );

    if (inlineMessageId) {
      await telegramBotApi.raw.editMessageText({
        inline_message_id: inlineMessageId,
        text: result,
      });
    } else {
      await telegramBotApi.editMessageText(chatId, ackMessageId, result);
    }
    return { success: true };
  } catch (err) {
    logger.error("[Worker] llm_direct job failed:", err);
    if (telegramBotApi) {
      try {
        if (inlineMessageId) {
          await telegramBotApi.raw.editMessageText({
            inline_message_id: inlineMessageId,
            text: t("inline.cmd.error.resolution_failed"),
          });
        } else {
          await telegramBotApi.editMessageText(
            chatId,
            ackMessageId,
            t("inline.cmd.error.resolution_failed"),
          );
        }
      } catch {}
    }
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function processOpencodeJob(job: Job<TaskJobData, TaskJobResult, string>): Promise<TaskJobResult> {
  const { taskId, chatId, sessionId, directory, agent, modelProvider, modelId, variant, system, parts } = job.data;

  if (!sessionId) {
    logger.error(`[Worker] opencode job ${job.id} missing sessionId`);
    return { success: false, error: "sessionId is required for opencode jobs" };
  }

  let progressMessageId: number | null = null;

  logger.info(`[Worker] Processing job ${job.id} for task ${taskId}`);

  try {
    updateTask(taskId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    await sendProgressHeartbeat(chatId, progressMessageId, 5, "Starting task...");
    progressMessageId = await sendProgressHeartbeat(chatId, null, 5, "Starting task...");

    const promptOptions: {
      sessionID: string;
      directory: string;
      parts: typeof parts;
      model?: { providerID: string; modelID: string };
      agent?: string;
      variant?: string;
      system?: string;
    } = {
      sessionID: sessionId,
      directory,
      parts,
      agent: agent || undefined,
    };

    if (modelProvider && modelId) {
      promptOptions.model = {
        providerID: modelProvider,
        modelID: modelId,
      };
    }

    if (variant) {
      promptOptions.variant = variant;
    }

    if (system) {
      promptOptions.system = system;
    }

    await sendProgressHeartbeat(chatId, progressMessageId, 10, "Sending prompt to OpenCode...");
    progressMessageId = await sendProgressHeartbeat(chatId, progressMessageId, 10, "Sending prompt to OpenCode...");

    const result = await opencodeClient.session.prompt(promptOptions);

    if (result.error) {
      const errorMessage = result.error.toString();
      logger.error(`[Worker] Prompt error for task ${taskId}:`, errorMessage);

      updateTask(taskId, {
        status: "error",
        errorMessage,
        finishedAt: new Date().toISOString(),
      });

      await sendProgressHeartbeat(chatId, progressMessageId, 0, `Error: ${errorMessage}`);

      return { success: false, error: errorMessage };
    }

    logger.info(`[Worker] Prompt completed for task ${taskId}`);

    updateTask(taskId, {
      status: "completed",
      finishedAt: new Date().toISOString(),
    });

    await sendProgressHeartbeat(chatId, progressMessageId, 100, "Task completed!");

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const attempts = (taskRetries.get(job.id!) || 0) + 1;
    taskRetries.set(job.id!, attempts);

    logger.error(`[Worker] Job ${job.id} failed (attempt ${attempts}/${MAX_RETRIES}):`, error);

    if (attempts < MAX_RETRIES) {
      const backoffMs = getBackoffMs(attempts);
      logger.info(`[Worker] Job ${job.id} will retry in ${backoffMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      taskRetries.delete(job.id!);
      throw error;
    }

    taskRetries.delete(job.id!);

    updateTask(taskId, {
      status: "error",
      errorMessage,
      finishedAt: new Date().toISOString(),
    });

    await sendProgressHeartbeat(chatId, progressMessageId, 0, `Error: ${errorMessage}`);

    return { success: false, error: errorMessage };
  }
}

export async function stopWorker(): Promise<void> {
  if (workerInstance) {
    logger.info("[Worker] Gracefully closing worker (waiting for active jobs to complete)...");
    await workerInstance.close();
    workerInstance = null;
    logger.info("[Worker] Worker stopped gracefully");
  }
}

export function getWorker(): Worker<TaskJobData, TaskJobResult, string> | null {
  return workerInstance;
}
