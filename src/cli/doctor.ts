/**
 * Doctor command - diagnostic checks for configuration and environment
 * Read-only, safe to run anytime
 */

import { config } from "../config.js";
import { getRuntimePaths } from "../runtime/paths.js";
import { getRuntimeMode } from "../runtime/mode.js";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

interface DiagnosticCheck {
  name: string;
  status: "ok" | "warn" | "error";
  message: string;
}

export async function runDoctor(): Promise<void> {
  console.log("🔍 OpenCode Telegram Bot - Diagnostic Report\n");
  console.log("=".repeat(60));

  const checks: DiagnosticCheck[] = [];

  // Check runtime mode and paths
  const mode = getRuntimeMode();
  const paths = getRuntimePaths();
  console.log(`\n📋 Runtime Mode: ${mode}`);
  console.log(`📁 Config Path: ${paths.envFilePath}`);

  // Check .env file exists
  const envExists = existsSync(paths.envFilePath);
  checks.push({
    name: "Environment File",
    status: envExists ? "ok" : "error",
    message: envExists ? `Found at ${paths.envFilePath}` : `Missing: ${paths.envFilePath}`,
  });

  if (!envExists) {
    printChecks(checks);
    console.log("\n❌ Cannot proceed - .env file not found");
    console.log(`\nRun: opencode-telegram config\n`);
    process.exit(1);
  }

  // Check Telegram configuration
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  checks.push({
    name: "TELEGRAM_BOT_TOKEN",
    status: botToken && botToken.length > 0 ? "ok" : "error",
    message: botToken && botToken.length > 0 ? "Set" : "Missing or empty",
  });

  const allowedUserIds = config.telegram.allowedUserIds;
  checks.push({
    name: "TELEGRAM_ALLOWED_USER_IDS",
    status: allowedUserIds.length > 0 ? "ok" : "error",
    message:
      allowedUserIds.length > 0
        ? `${allowedUserIds.length} user(s): ${allowedUserIds.join(", ")}`
        : "Missing or empty - bot will not respond to any users",
  });

  const allowedChatIds = config.telegram.allowedChatIds;
  if (allowedChatIds.length > 0) {
    checks.push({
      name: "TELEGRAM_ALLOWED_CHAT_IDS",
      status: "ok",
      message: `${allowedChatIds.length} chat(s): ${allowedChatIds.join(", ")}`,
    });
  }

  // Check OpenCode configuration
  const apiUrl = config.opencode.apiUrl;
  const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
  checks.push({
    name: "OPENCODE_API_URL",
    status: "ok",
    message: `${apiUrl} ${isLocal ? "(local)" : "(remote)"}`,
  });

  // Check OpenCode reachability
  try {
    const healthUrl = `${apiUrl}/global/health`;
    const curlCmd = `curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${healthUrl}" 2>/dev/null`;
    const statusCode = execSync(curlCmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    if (statusCode === "200" || statusCode === "401") {
      checks.push({
        name: "OpenCode Server",
        status: "ok",
        message: `Reachable at ${apiUrl} (HTTP ${statusCode})`,
      });
    } else {
      checks.push({
        name: "OpenCode Server",
        status: "warn",
        message: `Unexpected response: HTTP ${statusCode}`,
      });
    }
  } catch {
    checks.push({
      name: "OpenCode Server",
      status: "error",
      message: `Not reachable at ${apiUrl} - is opencode serve running?`,
    });
  }

  // Check OpenCode auth if remote
  if (!isLocal) {
    const hasPassword = config.opencode.password && config.opencode.password.length > 0;
    checks.push({
      name: "OpenCode Server Auth",
      status: hasPassword ? "ok" : "warn",
      message: hasPassword
        ? "OPENCODE_SERVER_PASSWORD is set"
        : "OPENCODE_SERVER_PASSWORD not set for remote server - security risk",
    });
  }

  // Check Redis (optional)
  const redisEnabled = process.env.REDIS_ENABLED;
  if (redisEnabled !== "false" && redisEnabled !== "0" && redisEnabled !== "no") {
    try {
      const { default: Redis } = await import("ioredis");
      const redisUrl = config.redis.url;
      const testClient = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000 });

      try {
        await testClient.ping();
        await testClient.quit();
        checks.push({
          name: "Redis (BullMQ)",
          status: "ok",
          message: `Connected to ${redisUrl}`,
        });
      } catch {
        checks.push({
          name: "Redis (BullMQ)",
          status: "warn",
          message: `Configured at ${redisUrl} but not reachable - scheduled tasks will not run in background`,
        });
      }
    } catch {
      checks.push({
        name: "Redis (BullMQ)",
        status: "warn",
        message: "ioredis not installed - scheduled tasks will use SQLite only",
      });
    }
  } else {
    checks.push({
      name: "Redis (BullMQ)",
      status: "ok",
      message: "Disabled (REDIS_ENABLED=false)",
    });
  }

  // Check model configuration
  const modelProvider = config.opencode.model.provider;
  const modelId = config.opencode.model.modelId;
  checks.push({
    name: "Default Model",
    status: "ok",
    message: `${modelProvider}/${modelId}`,
  });

  // Print all checks
  printChecks(checks);

  // Summary
  const errorCount = checks.filter((c) => c.status === "error").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  console.log("\n" + "=".repeat(60));
  if (errorCount === 0 && warnCount === 0) {
    console.log("✅ All checks passed - bot is ready to start");
  } else if (errorCount === 0) {
    console.log(`⚠️  ${warnCount} warning(s) - bot should work but review warnings above`);
  } else {
    console.log(`❌ ${errorCount} error(s) - bot cannot start until errors are resolved`);
  }
  console.log("=".repeat(60) + "\n");

  if (errorCount > 0) {
    process.exit(1);
  }
}

function printChecks(checks: DiagnosticCheck[]): void {
  console.log("\n📊 Diagnostic Checks:\n");

  for (const check of checks) {
    const icon = check.status === "ok" ? "✅" : check.status === "warn" ? "⚠️ " : "❌";
    console.log(`${icon} ${check.name}`);
    console.log(`   ${check.message}`);
  }
}
