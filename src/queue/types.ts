/**
 * Types for the BullMQ-based task queue
 * Provides asynchronous orchestration with progress heartbeats for long-running workflows
 */

import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";

export interface TaskJobData {
  taskId: string;
  userId: number;
  chatId: number;
  ackMessageId: number;
  promptText: string;
  sessionId: string | null;
  directory: string;
  agent: string;
  modelProvider: string;
  modelId: string;
  variant: string | null;
  system?: string;
  parts: Array<TextPartInput | FilePartInput>;
  jobType: "opencode" | "llm_direct";
  command?: string;
  query?: string;
  inlineMessageId?: string;
}

export interface TaskJobProgress {
  percent: number;
  message: string;
}

export interface TaskJobResult {
  success: boolean;
  error?: string;
}

export const QUEUE_NAME = "task-queue";
export const JOB_NAME = "process-task";

export const JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "custom" as const,
  },
  removeOnComplete: {
    count: 100,
    age: 24 * 60 * 60,
  },
  removeOnFail: {
    count: 500,
    age: 7 * 24 * 60 * 60,
  },
};
