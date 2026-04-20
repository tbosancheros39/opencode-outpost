/**
 * In-memory FIFO queue used as a fallback when Redis/BullMQ is unavailable.
 * Processes jobs sequentially using whichever processor is registered.
 */

import { logger } from "../utils/logger.js";
import type { TaskJobData } from "./types.js";

type JobProcessor = (data: TaskJobData) => Promise<unknown>;

class MemoryQueue {
  private queue: TaskJobData[] = [];
  private processing = false;
  private processor: JobProcessor | null = null;

  setProcessor(fn: JobProcessor): void {
    this.processor = fn;
  }

  async enqueue(data: TaskJobData): Promise<void> {
    this.queue.push(data);
    if (!this.processing) {
      void this.drain();
    }
  }

  private async drain(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0 && this.processor) {
      const job = this.queue.shift()!;
      try {
        await this.processor(job);
      } catch (err) {
        logger.error("[MemoryQueue] Job processing failed:", err);
      }
    }
    this.processing = false;
  }
}

export const memoryQueue = new MemoryQueue();
