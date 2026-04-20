/**
 * Smart Defaults System
 *
 * Automatically detects environment and provides sensible defaults.
 * Goal: Reduce required configuration from 10+ vars to 3 vars.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { platform, homedir, cpus, totalmem } from "os";
import path from "path";

export interface DetectedEnvironment {
  platform: "macos" | "linux" | "windows" | "wsl";
  hasDocker: boolean;
  hasRedis: boolean;
  redisUrl: string | null;
  opencodePath: string | null;
  nodeVersion: string;
  shell: string;
  locale: string;
  cpuCores: number;
  totalMemoryGB: number;
}

export interface SmartDefaults {
  redis: {
    url: string;
    enabled: boolean;
  };
  bot: {
    locale: string;
    maxConcurrentChats: number;
    taskLimit: number;
  };
  security: {
    sandbox: "bubblewrap" | "docker" | "none";
    commandWarnings: boolean;
  };
  features: {
    scheduledTasks: boolean;
    voiceTranscription: boolean;
    tts: boolean;
    progressHeartbeat: boolean;
  };
  performance: {
    useInMemoryQueue: boolean;
    maxFileSizeKb: number;
  };
}

/**
 * Detect the current runtime environment
 */
export function detectEnvironment(): DetectedEnvironment {
  const plat = platform();
  let isWsl = false;

  try {
    if (existsSync("/proc/version")) {
      const version = execSync("cat /proc/version", { encoding: "utf-8" });
      isWsl = version.toLowerCase().includes("microsoft");
    }
  } catch {
    // ignore
  }

  return {
    platform: isWsl ? "wsl" : plat === "darwin" ? "macos" : plat === "win32" ? "windows" : "linux",
    hasDocker: checkDocker(),
    hasRedis: checkRedis(),
    redisUrl: detectRedisUrl(),
    opencodePath: detectOpencode(),
    nodeVersion: process.version,
    shell: detectShell(),
    locale: detectLocale(),
    cpuCores: cpus().length,
    totalMemoryGB: Math.round(totalmem() / 1024 / 1024 / 1024),
  };
}

/**
 * Generate smart defaults based on detected environment
 */
export function generateSmartDefaults(
  env: DetectedEnvironment = detectEnvironment(),
): SmartDefaults {
  const hasRedis = env.hasRedis || env.hasDocker;
  const hasBubblewrap = checkBubblewrap();

  // Scale limits based on resources
  const maxConcurrentChats = env.cpuCores > 2 ? 5 : 2;
  const taskLimit = env.totalMemoryGB > 4 ? 20 : 10;

  return {
    redis: {
      url: env.redisUrl || "redis://localhost:6379",
      enabled: hasRedis,
    },
    bot: {
      locale: env.locale,
      maxConcurrentChats,
      taskLimit,
    },
    security: {
      sandbox: hasBubblewrap ? "bubblewrap" : env.hasDocker ? "docker" : "none",
      commandWarnings: true,
    },
    features: {
      scheduledTasks: hasRedis,
      voiceTranscription: false, // Requires STT config
      tts: false, // Requires TTS config
      progressHeartbeat: hasRedis,
    },
    performance: {
      useInMemoryQueue: !hasRedis,
      maxFileSizeKb: env.totalMemoryGB > 8 ? 500 : 100,
    },
  };
}

/**
 * Check if Docker is available
 */
function checkDocker(): boolean {
  try {
    execSync("docker --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Redis is running
 */
function checkRedis(): boolean {
  try {
    execSync("redis-cli ping", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect Redis URL from various sources
 */
function detectRedisUrl(): string | null {
  // Check environment
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  // Default assumption - will be validated later
  return "redis://localhost:6379";
}

/**
 * Detect OpenCode installation
 */
function detectOpencode(): string | null {
  try {
    const opencodePath = execSync("which opencode", { stdio: "pipe", encoding: "utf-8" }).trim();
    return opencodePath;
  } catch {
    // Check common locations
    const commonPaths = [
      path.join(homedir(), ".opencode", "bin", "opencode"),
      "/usr/local/bin/opencode",
      "/usr/bin/opencode",
      path.join(homedir(), ".local", "bin", "opencode"),
    ];

    for (const p of commonPaths) {
      if (existsSync(p)) {
        return p;
      }
    }

    return null;
  }
}

/**
 * Detect user's shell
 */
function detectShell(): string {
  return process.env.SHELL || process.env.ComSpec || "bash";
}

/**
 * Detect system locale
 */
function detectLocale(): string {
  const envLocale = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || "en";

  // Extract language code (e.g., "en_US.UTF-8" -> "en")
  const lang = envLocale.split(/[_.]/)[0].toLowerCase();

  // Map to supported locales
  const supported = ["en", "de", "es", "fr", "ru", "zh", "bs"];
  return supported.includes(lang) ? lang : "en";
}

/**
 * Check if bubblewrap is available
 */
function checkBubblewrap(): boolean {
  try {
    execSync("which bwrap", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Print a friendly summary of detected environment
 */
export function printEnvironmentSummary(env: DetectedEnvironment = detectEnvironment()): void {
  console.log("\n🔍 Detected Environment:\n");
  console.log(`  Platform:      ${env.platform}`);
  console.log(`  Node.js:       ${env.nodeVersion}`);
  console.log(`  Docker:        ${env.hasDocker ? "✅" : "❌"}`);
  console.log(`  Redis:         ${env.hasRedis ? "✅" : "❌"}`);
  console.log(`  OpenCode:      ${env.opencodePath || "❌ (not found)"}`);
  console.log(`  CPU Cores:     ${env.cpuCores}`);
  console.log(`  Memory:        ${env.totalMemoryGB} GB`);
  console.log(`  Locale:        ${env.locale}`);
  console.log("");
}

/**
 * Get recommended setup based on environment
 */
export function getSetupRecommendation(env: DetectedEnvironment = detectEnvironment()): string {
  if (!env.opencodePath) {
    return "⚠️  OpenCode not found. Install it first: npm install -g @opencode-ai/cli";
  }

  if (!env.hasRedis && !env.hasDocker) {
    return `
💡 Recommendation: Install Redis for full functionality

   Option 1 - Docker (easiest):
   docker run -d --name redis -p 6379:6379 redis:alpine

   Option 2 - Native:
   • macOS: brew install redis && brew services start redis
   • Ubuntu: sudo apt install redis-server
   • Or continue without Redis (SQLite mode)
`;
  }

  if (env.hasRedis) {
    return "✅ Redis detected - all features will be available!";
  }

  return "✅ Environment looks good!";
}
