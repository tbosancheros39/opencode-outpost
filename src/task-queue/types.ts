/**
 * Types for the ad-hoc task queue system
 * Allows prompts to survive disconnections and be processed asynchronously
 */

export type TaskStatus = "queued" | "running" | "completed" | "error";

export interface QueuedTask {
  id: string;
  userId: number;
  chatId: number;
  promptText: string;
  status: TaskStatus;
  resultText: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  sessionId: string;
  directory: string;
  notificationMessageId: number | null;
  agent: string;
  modelProvider: string;
  modelId: string;
  variant: string | null;
}

export interface TaskCreationOptions {
  userId: number;
  chatId: number;
  promptText: string;
  sessionId: string;
  directory: string;
  notificationMessageId: number;
  agent: string;
  modelProvider: string;
  modelId: string;
  variant: string | null;
}

export interface TaskUpdateOptions {
  status?: TaskStatus;
  resultText?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
}
