import { spawn, execSync } from "child_process";
import type { ChildProcess } from "child_process";
import { Bot, Context, InlineKeyboard } from "grammy";
import { logger } from "../utils/logger.js";
import { escapeHtml } from "../utils/html.js";

interface JournalEntry {
  timestamp: string;
  message: string;
  unit?: string;
  priority?: number;
}

interface JournalMonitorOptions {
  userId: number;
  enabled?: boolean;
  pollIntervalSec?: number;
}

// fingerprint → timestamp of last alert (ms)
const seenFingerprints = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

let botInstance: Bot<Context> | null = null;
let userId: number | null = null;
let isMonitoring = false;
let journalProc: ChildProcess | null = null;
let restartTimer: ReturnType<typeof setTimeout> | null = null;

export function initializeJournalMonitoring(bot: Bot<Context>, uid?: number): void {
  botInstance = bot;
  if (uid !== undefined) {
    userId = uid;
  }
  logger.info("[JournalMonitor] Initialized");
}

export function startJournalMonitoring(options: JournalMonitorOptions): void {
  if (isMonitoring) {
    logger.warn("[JournalMonitor] Already running");
    return;
  }

  userId = options.userId;
  isMonitoring = true;
  logger.info("[JournalMonitor] Started monitoring systemd journal for errors");

  spawnJournalProcess();
}

export function stopJournalMonitoring(): void {
  isMonitoring = false;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (journalProc) {
    try {
      journalProc.kill();
    } catch (err) {
      logger.warn("[JournalMonitor] Failed to stop journalctl process cleanly:", err);
    }
    journalProc = null;
  }
  logger.info("[JournalMonitor] Stopped");
}

export function isJournalMonitoringRunning(): boolean {
  return isMonitoring;
}

function spawnJournalProcess(): void {
  if (!isMonitoring) return;

  let proc: ChildProcess;
  try {
    proc = spawn("journalctl", ["--follow", "--no-tail", "--output=json", "--priority=err"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      logger.warn("[JournalMonitor] journalctl not found — systemd not available on this system");
    } else {
      logger.error("[JournalMonitor] Failed to spawn journalctl:", err);
    }
    return;
  }

  journalProc = proc;

  let buffer = "";

  proc.stdout!.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    // last element may be an incomplete line
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) {
        handleJournalLine(line);
      }
    }
  });

  proc.stderr!.on("data", (chunk: Buffer) => {
    logger.warn("[JournalMonitor] journalctl stderr:", chunk.toString("utf8").trim());
  });

  proc.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") {
      logger.warn("[JournalMonitor] journalctl not found — systemd not available on this system");
      isMonitoring = false;
    } else {
      logger.error("[JournalMonitor] journalctl process error:", err);
    }
    journalProc = null;
  });

  proc.on("exit", (code) => {
    journalProc = null;
    if (!isMonitoring) return;
    logger.warn(`[JournalMonitor] journalctl exited (code ${code}), restarting in 10s`);
    restartTimer = setTimeout(() => {
      restartTimer = null;
      spawnJournalProcess();
    }, 10000);
  });
}

function handleJournalLine(line: string): void {
  let entry: Record<string, string>;
  try {
    entry = JSON.parse(line) as Record<string, string>;
  } catch {
    return; // ignore malformed lines
  }

  const message = entry["MESSAGE"] ?? "";
  const unit = entry["_SYSTEMD_UNIT"] ?? entry["SYSLOG_IDENTIFIER"] ?? "";
  const realtimeUs = entry["__REALTIME_TIMESTAMP"] ?? "";
  const timestamp = realtimeUs
    ? new Date(Number(realtimeUs) / 1000).toISOString()
    : new Date().toISOString();
  const priority = parseInt(entry["PRIORITY"] ?? "3", 10);

  if (!message.trim()) return;

  // Check unit mute
  if (unit) {
    const muteKey = `mute:${unit}`;
    const muteUntil = seenFingerprints.get(muteKey);
    if (muteUntil !== undefined && Date.now() < muteUntil) return;
  }

  const fingerprint = `${unit}:${message.slice(0, 80)}`;
  const now = Date.now();

  // Purge expired entries
  for (const [key, ts] of seenFingerprints) {
    if (now - ts > DEDUP_TTL_MS) seenFingerprints.delete(key);
  }

  if (seenFingerprints.has(fingerprint)) return;
  seenFingerprints.set(fingerprint, now);

  const journalEntry: JournalEntry = { timestamp, message, unit: unit || undefined, priority };
  sendJournalAlert(journalEntry).catch((err) => {
    logger.error("[JournalMonitor] Failed to send alert:", err);
  });
}

async function sendJournalAlert(entry: JournalEntry): Promise<void> {
  if (!botInstance || !userId) {
    return;
  }

  const unitName = entry.unit ?? "system";
  const safeUnitName = unitName.replace(/[.\-]/g, "_");
  const escapedUnit = escapeHtml(unitName);
  const escapedMessage = escapeHtml(entry.message);

  const text =
    `⚠️ <b>${escapedUnit}</b> — systemd error\n\n` +
    `<blockquote expandable>${escapedMessage}</blockquote>\n\n` +
    `#JournalAlert #${safeUnitName}`;

  const priority = entry.priority ?? 3;
  const disableNotification = priority >= 3;

  // Send with a placeholder ack button first, then update with real message ID
  const initialKeyboard = new InlineKeyboard()
    .text("✅ Acknowledge", "journal_ack:pending")
    .text("🔕 Mute 1h", `journal_mute:${unitName}`);

  try {
    const sent = await botInstance.api.sendMessage(userId, text, {
      parse_mode: "HTML",
      disable_notification: disableNotification,
      reply_markup: initialKeyboard,
    });

    // Update the keyboard to include the real chat/message ID in the ack button
    const updatedKeyboard = new InlineKeyboard()
      .text("✅ Acknowledge", `journal_ack:${userId}:${sent.message_id}`)
      .text("🔕 Mute 1h", `journal_mute:${unitName}`);

    await botInstance.api.editMessageReplyMarkup(userId, sent.message_id, {
      reply_markup: updatedKeyboard,
    });

    logger.info(`[JournalMonitor] Sent journal alert: ${entry.message.slice(0, 50)}...`);
  } catch (err) {
    logger.error("[JournalMonitor] Failed to send alert:", err);
  }
}

export async function handleJournalCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data) return false;

  if (data.startsWith("journal_ack:")) {
    try {
      await ctx.editMessageText("✅ Acknowledged", {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard(),
      });
    } catch (err) {
      logger.warn("[JournalMonitor] Failed to edit message for ack:", err);
    }
    await ctx.answerCallbackQuery({ text: "✅ Acknowledged" });
    return true;
  }

  if (data.startsWith("journal_mute:")) {
    const unit = data.slice("journal_mute:".length);
    const muteKey = `mute:${unit}`;
    seenFingerprints.set(muteKey, Date.now() + 60 * 60 * 1000);
    await ctx.answerCallbackQuery({ text: `🔕 ${unit} muted for 1 hour` });
    return true;
  }

  return false;
}

export async function getJournalErrors(limit: number = 20): Promise<string> {
  try {
    let output: string;
    try {
      output = execSync(
        `journalctl -p err -n ${limit} --no-pager --output=short-iso`,
        { encoding: "utf8" }
      );
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return "⚠️ <b>journalctl not available</b>\n\nsystemd is not present on this system.";
      }
      throw err;
    }

    const lines = output.split("\n").filter((l) => l.trim());
    if (lines.length === 0) {
      return "✅ <b>No recent journal errors</b>\n\nNo error entries found in the system journal.";
    }

    const result = ["📋 <b>Recent System Errors</b>", ""];
    for (const line of lines.slice(0, limit)) {
      result.push(escapeHtml(line));
    }
    return result.join("\n");
  } catch (err) {
    logger.error("[JournalMonitor] Failed to get journal errors:", err);
    return "❌ <b>Error</b>\n\nFailed to retrieve journal errors. Make sure you have permission to access journalctl.";
  }
}
