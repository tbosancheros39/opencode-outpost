import { CommandContext, Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { chunkOutput } from "../utils/chunk.js";
import {
  isBwrapAvailable,
  runInSandbox,
  downloadAndAnalyzeUrl,
  formatSecurityPreview,
  shouldUseSandbox,
} from "../../safety/sandbox.js";

export async function sandboxCommand(ctx: CommandContext<Context>) {
  const input = (ctx.match as string)?.trim();

  if (!input) {
    await ctx.reply(
      "🔒 <b>Sandbox Analyzer</b>\n\n" +
        "Execute scripts/URLs in an isolated bubblewrap sandbox with security analysis.\n\n" +
        "Usage:\n" +
        "<code>/sandbox curl https://example.com/script.sh | sh</code>\n" +
        "<code>/sandbox https://example.com/malware.sh</code>\n" +
        "<code>/sandbox cat /etc/passwd</code>\n\n" +
        "Network is disabled by default. Use /sandbox --network to allow network access.",
      { parse_mode: "HTML" }
    );
    return;
  }

  const allowNetwork = input.startsWith("--network ");
  const command = allowNetwork ? input.slice(10).trim() : input;

  if (!command) {
    await ctx.reply("⚠️ Please provide a command or URL to analyze.");
    return;
  }

  if (!isBwrapAvailable()) {
    await ctx.reply(
      "❌ <b>bubblewrap is not available</b>\n\n" +
        "This command requires bubblewrap (bwrap) to be installed on the system.\n" +
        "Install with: sudo apt install bubblewrap",
      { parse_mode: "HTML" }
    );
    return;
  }

  const isUrl = /^https?:\/\//i.test(command);
  const isScript = /\.sh$/i.test(command) || /\|\s*(sh|bash)/.test(command);

  const statusMsg = await ctx.reply(
    `🔒 <i>Running in sandbox${allowNetwork ? " (with network)" : ""}: <code>${escapeHtml(command.slice(0, 100))}${command.length > 100 ? "..." : ""}</code>...</i>`,
    { parse_mode: "HTML" }
  );

  const startTime = Date.now();

  try {
    let result: Awaited<ReturnType<typeof runInSandbox>>;

    if (isUrl) {
      result = await downloadAndAnalyzeUrl(command, { allowNetwork: true, timeoutMs: 30000 });
    } else if (isScript || shouldUseSandbox(command)) {
      result = await runInSandbox(command, { allowNetwork, timeoutMs: 30000 });
    } else {
      result = await runInSandbox(command, { allowNetwork, timeoutMs: 30000 });
    }

    const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
    const elapsedStr = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;

    await ctx.api.deleteMessage(ctx.chat?.id ?? 0, statusMsg.message_id).catch(() => {});

    const securityPreview = formatSecurityPreview(result.securityReport);

    const header = `🔒 <b>Sandbox Analysis</b> [${elapsedStr}]\n`;
    const cmdLine = `Command: <code>${escapeHtml(command)}</code>\n`;
    const exitLine = result.timedOut
      ? `⏱️ <i>Timed out after ${30}s</i>\n`
      : `Exit code: ${result.exitCode ?? "N/A"}\n`;

    const fullReport = `${header}${securityPreview}\n\n${cmdLine}${exitLine}`;

    if (result.stdout) {
      const chunks = chunkOutput(result.stdout);
      for (let i = 0; i < chunks.length; i++) {
        const chunkHeader =
          chunks.length > 1
            ? `📤 <b>Output (${i + 1}/${chunks.length})</b>\n<pre><code>${chunks[i]}</code></pre>\n`
            : `📤 <b>Output</b>\n<pre><code>${chunks[i]}</code></pre>\n`;
        await ctx.reply(chunkHeader, { parse_mode: "HTML" });
      }
    }

    if (result.stderr && !result.timedOut) {
      const chunks = chunkOutput(result.stderr);
      for (let i = 0; i < chunks.length; i++) {
        const chunkHeader =
          chunks.length > 1
            ? `📕 <b>Stderr (${i + 1}/${chunks.length})</b>\n<pre><code>${chunks[i]}</code></pre>\n`
            : `📕 <b>Stderr</b>\n<pre><code>${chunks[i]}</code></pre>\n`;
        await ctx.reply(chunkHeader, { parse_mode: "HTML" });
      }
    }

    await ctx.reply(fullReport, { parse_mode: "HTML" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[Sandbox] Sandbox command error:", error);
    await ctx.api
      .editMessageText(
        ctx.chat?.id ?? 0,
        statusMsg.message_id,
        `❌ <b>Sandbox Error:</b>\n<pre>${escapeHtml(message)}</pre>`,
        { parse_mode: "HTML" }
      )
      .catch(() => {});
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
