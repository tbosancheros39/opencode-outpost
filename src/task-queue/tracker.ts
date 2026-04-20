import { logger } from "../utils/logger.js";
import { updateTask, getRunningTasks } from "./store.js";
import { Bot, Context } from "grammy";
import { summaryAggregator } from "../summary/aggregator.js";
const activeTaskSessions = new Map<string, string>(); // sessionId -> taskId

export function initializeTaskTracking(_bot: Bot<Context>): void {
  
  // Hook into summary aggregator to capture task results
  const originalOnComplete = summaryAggregator.getOnComplete();
  
  summaryAggregator.setOnComplete(async (sessionId, messageId, messageText) => {
    // Check if this session has an active task
    const taskId = activeTaskSessions.get(sessionId);
    if (taskId) {
      logger.info(`[TaskTracking] Completing task ${taskId} for session ${sessionId}`);
      
      updateTask(taskId, {
        status: "completed",
        resultText: messageText,
        finishedAt: new Date().toISOString(),
      });
      
      activeTaskSessions.delete(sessionId);
    }
    
    // Call original handler if exists
    if (originalOnComplete) {
      await originalOnComplete(sessionId, messageId, messageText);
    }
  });
  
  // Hook into session error to mark tasks as failed
  const originalOnError = summaryAggregator.getOnSessionError();
  
  summaryAggregator.setOnSessionError(async (sessionId, message) => {
    const taskId = activeTaskSessions.get(sessionId);
    if (taskId) {
      logger.warn(`[TaskTracking] Marking task ${taskId} as error: ${message}`);
      
      updateTask(taskId, {
        status: "error",
        errorMessage: message,
        finishedAt: new Date().toISOString(),
      });
      
      activeTaskSessions.delete(sessionId);
    }
    
    if (originalOnError) {
      await originalOnError(sessionId, message);
    }
  });
  
  logger.info("[TaskTracking] Initialized with summary aggregator hooks");
}

export function associateSessionWithTask(sessionId: string, taskId: string): void {
  activeTaskSessions.set(sessionId, taskId);
  logger.debug(`[TaskTracking] Associated session ${sessionId} with task ${taskId}`);
}

export function disassociateSessionTask(sessionId: string): void {
  activeTaskSessions.delete(sessionId);
}

export function getActiveTaskForSession(sessionId: string): string | undefined {
  return activeTaskSessions.get(sessionId);
}

/**
 * Check for tasks that were "running" when the bot crashed
 * and mark them as error (since we lost track of them)
 */
export function recoverInterruptedTasks(): void {
  const runningTasks = getRunningTasks();
  
  if (runningTasks.length === 0) {
    return;
  }
  
  logger.warn(`[TaskTracking] Found ${runningTasks.length} interrupted tasks from previous session`);
  
  for (const task of runningTasks) {
    updateTask(task.id, {
      status: "error",
      errorMessage: "Bot was restarted during task execution. Please retry.",
      finishedAt: new Date().toISOString(),
    });
    
    logger.info(`[TaskTracking] Marked interrupted task ${task.id} as error`);
  }
}
