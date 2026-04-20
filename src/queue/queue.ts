/**
 * Redis + BullMQ queue for asynchronous task orchestration
 * Provides progress heartbeat support for long-running workflows
 */

import { Queue, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { TaskJobData, TaskJobProgress, TaskJobResult } from "./types.js";
import { QUEUE_NAME, JOB_NAME, JOB_OPTIONS } from "./types.js";
import { logger } from "../utils/logger.js";
import { memoryQueue } from "./memory-queue.js";

let queueInstance: Queue<TaskJobData, TaskJobResult, string> | null = null;
let redisAvailable = false;

async function testRedisConnection(): Promise<boolean> {
  const redisEnabled = process.env.REDIS_ENABLED;
  if (redisEnabled === "false" || redisEnabled === "0" || redisEnabled === "no") {
    logger.info("[Queue] Redis is disabled via REDIS_ENABLED env var");
    return false;
  }
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  try {
    const testClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
    await testClient.ping();
    await testClient.quit();
    logger.info("[Queue] Redis connection verified");
    return true;
  } catch (error) {
    logger.warn("[Queue] Redis not available:", error);
    return false;
  }
}

export function getRedisConnection(): Record<string, unknown> | null {
  if (!redisAvailable) {
    return null;
  }
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  return {
    url: redisUrl,
    maxRetriesPerRequest: null,
  };
}

export async function initQueue(): Promise<void> {
  redisAvailable = await testRedisConnection();
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export function getQueue(): Queue<TaskJobData, TaskJobResult, string> | null {
  if (!queueInstance && redisAvailable) {
    const connection = getRedisConnection();
    if (!connection) {
      logger.warn("[Queue] Redis connection not available");
      return null;
    }
    try {
      queueInstance = new Queue<TaskJobData, TaskJobResult, string>(QUEUE_NAME, {
        connection,
        defaultJobOptions: JOB_OPTIONS,
      });

      queueInstance.on("error", (error: Error) => {
        logger.warn("[Queue] Queue error:", error);
        redisAvailable = false;
      });

      logger.info("[Queue] BullMQ queue initialized");
    } catch (error) {
      logger.warn("[Queue] Redis not available, BullMQ queue disabled:", error);
      redisAvailable = false;
      return null;
    }
  }

  return queueInstance;
}

export async function addTaskJob(data: TaskJobData): Promise<Job<TaskJobData, TaskJobResult, string>> {
  const queue = getQueue();
  if (!queue) {
    logger.warn("[Queue] BullMQ unavailable, routing job to in-memory queue");
    await memoryQueue.enqueue(data);
    return { id: data.taskId, data } as unknown as Job<TaskJobData, TaskJobResult, string>;
  }
  const job = await queue.add(JOB_NAME, data, {
    jobId: data.taskId,
  });

  logger.info(`[Queue] Added job ${job.id} for task ${data.taskId}`);
  return job;
}

export async function getJob(jobId: string): Promise<Job<TaskJobData, TaskJobResult, string> | undefined> {
  const queue = getQueue();
  if (!queue) return undefined;
  return queue.getJob(jobId);
}

export async function getJobProgress(jobId: string): Promise<TaskJobProgress | null> {
  const job = await getJob(jobId);
  if (!job) {
    return null;
  }
  return job.progress as TaskJobProgress;
}

export async function closeQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
    logger.info("[Queue] Queue connection closed");
  }
}

export { type Job };