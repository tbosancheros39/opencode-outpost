import { logger } from "./logger.js";

const MAX_RETRIES = 5;

interface TelegramError {
  error_code?: number;
  parameters?: {
    retry_after?: number;
  };
  description?: string;
}

function isTelegramError(error: unknown): error is TelegramError {
  return typeof error === "object" && error !== null && "error_code" in error;
}

export async function withTelegramRateLimitRetry<T>(
  operation: () => Promise<T>,
  label: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (isTelegramError(error) && error.error_code === 429) {
        const retryAfter = (error.parameters?.retry_after ?? 5) * 1000;
        logger.warn(
          `[RateLimit] ${label} hit 429, retrying after ${retryAfter}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfter));
        lastError = error;
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}
