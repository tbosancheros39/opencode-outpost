import { getScheduledTasks, setScheduledTasks } from "../settings/manager.js";
import { logger } from "../utils/logger.js";
import type { ScheduledTask } from "./types.js";
import { cloneScheduledTask } from "./types.js";

let scheduledTaskMutationQueue: Promise<unknown> = Promise.resolve();

async function mutateScheduledTasks<T>(chatId: number,
  mutator: (tasks: ScheduledTask[]) =>
    | Promise<{ tasks: ScheduledTask[]; result: T }>
    | {
        tasks: ScheduledTask[];
        result: T;
      },
): Promise<T> {
  const runMutation = async (): Promise<T> => {
    const currentTasks = listScheduledTasks(chatId);
    const { tasks, result } = await mutator(currentTasks);
    await setScheduledTasks(chatId, tasks.map((task) => cloneScheduledTask(task)));
    return result;
  };

  const mutationPromise = scheduledTaskMutationQueue.then(runMutation, runMutation);
  scheduledTaskMutationQueue = mutationPromise.catch(() => undefined);
  return mutationPromise;
}

export function listScheduledTasks(chatId: number = 0): ScheduledTask[] {
  return getScheduledTasks(chatId).map((task) => cloneScheduledTask(task));
}

export function getScheduledTask(taskId: string, chatId: number = 0): ScheduledTask | null {
  const task = listScheduledTasks(chatId).find((item) => item.id === taskId);
  return task ? cloneScheduledTask(task) : null;
}

export async function addScheduledTask(chatId: number, task: ScheduledTask): Promise<void> {
  await mutateScheduledTasks(chatId, (tasks) => ({
    tasks: [...tasks, cloneScheduledTask(task)],
    result: undefined,
  }));
  logger.info(`[ScheduledTaskStore] Added scheduled task: id=${task.id}, kind=${task.kind}`);
}

export async function replaceScheduledTasks(chatId: number, tasks: ScheduledTask[]): Promise<void> {
  await mutateScheduledTasks(chatId, () => ({
    tasks: tasks.map((task) => cloneScheduledTask(task)),
    result: undefined,
  }));
  logger.info(`[ScheduledTaskStore] Replaced scheduled task collection: count=${tasks.length}`);
}

export async function removeScheduledTask(taskId: string, chatId: number = 0): Promise<boolean> {
  const removed = await mutateScheduledTasks(chatId, (tasks) => {
    const nextTasks = tasks.filter((task) => task.id !== taskId);
    return {
      tasks: nextTasks,
      result: nextTasks.length !== tasks.length,
    };
  });

  if (!removed) {
    return false;
  }

  logger.info(`[ScheduledTaskStore] Removed scheduled task: id=${taskId}`);
  return true;
}

export async function updateScheduledTask(chatId: number = 0, 
  taskId: string,
  updater: (task: ScheduledTask) => ScheduledTask,
): Promise<ScheduledTask | null> {
  return mutateScheduledTasks(chatId, (tasks) => {
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index < 0) {
      return { tasks, result: null };
    }

    const nextTask = cloneScheduledTask(updater(cloneScheduledTask(tasks[index])));
    const nextTasks = [...tasks];
    nextTasks[index] = nextTask;

    return {
      tasks: nextTasks,
      result: cloneScheduledTask(nextTask),
    };
  });
}
