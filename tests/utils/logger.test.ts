import { describe, expect, it, vi } from "vitest";
import { setRuntimeMode } from "../../src/runtime/mode.js";
import { logger } from "../../src/utils/logger.js";

const { configMock } = vi.hoisted(() => ({
  configMock: {
    server: {
      logLevel: "info",
    },
    opencode: {
      apiUrl: "http://localhost:4096",
      password: "",
    },
  },
}));

vi.mock("../../src/config.js", () => ({
  config: configMock,
}));

describe("utils/logger", () => {
  it("uses info level by default and respects config.server.logLevel", () => {
    const consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // The logger should be available and functional
    expect(typeof logger).toBe("object");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");

    // Debug should not log when level is info
    logger.debug("debug message");
    expect(consoleLogMock).not.toHaveBeenCalled();

    // Info should log
    logger.info("info message");
    expect(consoleLogMock).toHaveBeenCalled();
  });
});
