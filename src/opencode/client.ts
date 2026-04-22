import { createOpencodeClient } from "@opencode-ai/sdk/v2";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export const opencodeClient = createOpencodeClient({
  baseUrl: config.opencode.apiUrl,
  auth: config.opencode.apiKey,
});

// Log masked API key on startup for debugging auth issues (Problem #1 prevention)
const apiKey = config.opencode.apiKey;
if (apiKey) {
  const masked = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
  logger.info(`[OpenCode] Using API key: ${masked}`);
} else {
  logger.warn("[OpenCode] No API key configured — requests may fail");
}

// Validate API key on startup (non-blocking, don't crash if server is down)
opencodeClient.global
  .health()
  .then(() => {
    logger.info("[OpenCode] API key validated, server healthy");
  })
  .catch((err: unknown) => {
    logger.warn(
      "[OpenCode] Health check failed on startup (server may not be running yet):",
      err instanceof Error ? err.message : String(err),
    );
  });
