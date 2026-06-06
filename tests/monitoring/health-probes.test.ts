import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedisInfo = vi.hoisted(() => {
  const mockInstance = {
    connect: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  };
  const MockRedis = vi.fn(function redisMock() {
    return mockInstance;
  });
  return { mockInstance, MockRedis };
});

vi.mock("ioredis", () => ({
  Redis: mockRedisInfo.MockRedis,
}));

const mockRedisUrl = vi.hoisted(() => ({ value: "redis://localhost:6379" }));

vi.mock("../../src/config.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../src/config.js")>();
  return {
    ...mod,
    config: new Proxy(mod.config, {
      get(target, prop) {
        if (prop === "redis") {
          return { url: mockRedisUrl.value };
        }
        return Reflect.get(target, prop);
      },
    }),
  };
});

vi.mock("../../src/opencode/client.js", () => ({
  opencodeClient: {
    global: {
      health: vi.fn(),
    },
  },
}));

import { Redis } from "ioredis";
import { opencodeClient } from "../../src/opencode/client.js";
import {
  checkRedisHealth,
  checkOpencodeHealth,
} from "../../src/monitoring/health-probes.js";

describe("checkRedisHealth", () => {
  beforeEach(() => {
    mockRedisInfo.mockInstance.connect.mockReset();
    mockRedisInfo.mockInstance.ping.mockReset();
    mockRedisInfo.mockInstance.quit.mockReset();
    mockRedisInfo.mockInstance.connect.mockResolvedValue(undefined);
    mockRedisInfo.mockInstance.ping.mockResolvedValue("PONG");
    mockRedisInfo.mockInstance.quit.mockResolvedValue(undefined);
    mockRedisUrl.value = "redis://localhost:6379";
  });

  it("returns ok true with latencyMs when Redis responds", async () => {
    const result = await checkRedisHealth();

    expect(result.ok).toBe(true);
    expect(result.skipped).toBeUndefined();
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(Redis).toHaveBeenCalledWith(
      expect.stringContaining("redis://"),
      expect.objectContaining({ lazyConnect: true }),
    );
  });

  it("returns ok false with error when Redis connection fails", async () => {
    mockRedisInfo.mockInstance.connect.mockRejectedValue(
      new Error("Connection refused"),
    );

    const result = await checkRedisHealth();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Connection refused");
  });

  it("returns skipped when REDIS_ENABLED is false", async () => {
    vi.stubEnv("REDIS_ENABLED", "false");

    const result = await checkRedisHealth();

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(Redis).not.toHaveBeenCalled();
  });

  it("returns skipped when REDIS_ENABLED is 0", async () => {
    vi.stubEnv("REDIS_ENABLED", "0");

    const result = await checkRedisHealth();

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it("returns skipped when no Redis URL configured", async () => {
    mockRedisUrl.value = "";

    const result = await checkRedisHealth();

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(Redis).not.toHaveBeenCalled();
  });
});

describe("checkOpencodeHealth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok true when OpenCode reports healthy", async () => {
    vi.mocked(opencodeClient.global.health).mockResolvedValue({
      data: { healthy: true },
      error: null,
    });

    const result = await checkOpencodeHealth();

    expect(result.ok).toBe(true);
  });

  it("returns ok false with error when OpenCode health call throws", async () => {
    vi.mocked(opencodeClient.global.health).mockRejectedValue(
      new Error("Server unreachable"),
    );

    const result = await checkOpencodeHealth();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Server unreachable");
  });

  it("returns ok false when OpenCode reports unhealthy", async () => {
    vi.mocked(opencodeClient.global.health).mockResolvedValue({
      data: { healthy: false },
      error: null,
    });

    const result = await checkOpencodeHealth();

    expect(result.ok).toBe(false);
  });
});
