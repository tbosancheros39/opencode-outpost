import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTelegramRateLimitRetry } from "../../src/utils/telegram-rate-limit-retry.js";

vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createTelegram429Error(retryAfter?: number) {
  const error: Record<string, unknown> = {
    error_code: 429,
    description: "Too Many Requests",
  };
  if (retryAfter !== undefined) {
    error.parameters = { retry_after: retryAfter };
  }
  return error;
}

describe("withTelegramRateLimitRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result when operation succeeds on first try", async () => {
    const operation = vi.fn().mockResolvedValue("success");

    const result = await withTelegramRateLimitRetry(operation, "test");

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledOnce();
  });

  it("rethrows immediately when error is not 429", async () => {
    const error = { error_code: 400, description: "Bad Request" };
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withTelegramRateLimitRetry(operation, "test")).rejects.toEqual(error);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("rethrows immediately when error is not a Telegram error", async () => {
    const error = new Error("network error");
    const operation = vi.fn().mockRejectedValue(error);

    await expect(withTelegramRateLimitRetry(operation, "test")).rejects.toThrow("network error");
    expect(operation).toHaveBeenCalledOnce();
  });

  it("retries after delay when 429 with retry_after", async () => {
    const telegramError = createTelegram429Error(2);
    const operation = vi.fn();
    operation.mockRejectedValueOnce(telegramError);
    operation.mockResolvedValueOnce("recovered");

    const promise = withTelegramRateLimitRetry(operation, "test.429");
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result).toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("retries with default 5s delay when 429 without retry_after", async () => {
    const telegramError = createTelegram429Error();
    const operation = vi.fn();
    operation.mockRejectedValueOnce(telegramError);
    operation.mockResolvedValueOnce("recovered");

    const promise = withTelegramRateLimitRetry(operation, "test.noRetryAfter");
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("throws last error after MAX_RETRIES (5) consecutive 429s", async () => {
    const telegramError = createTelegram429Error(1);
    const operation = vi.fn().mockRejectedValue(telegramError);

    let caughtError: unknown;
    const promise = withTelegramRateLimitRetry(operation, "test.maxRetries");
    promise.catch((e) => {
      caughtError = e;
    });

    await vi.runAllTimersAsync();

    expect(caughtError).toEqual(telegramError);
    expect(operation).toHaveBeenCalledTimes(5);
  });

  it("returns result when 429 then succeeds on retry", async () => {
    const telegramError = createTelegram429Error(1);
    const operation = vi.fn();
    operation.mockRejectedValueOnce(telegramError);
    operation.mockResolvedValueOnce("ok");

    const promise = withTelegramRateLimitRetry(operation, "test.retryThenOk");
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
