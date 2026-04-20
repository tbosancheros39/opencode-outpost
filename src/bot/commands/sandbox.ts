import { CommandContext, Context } from "grammy";
import { logger } from "../../utils/logger.js";
import { escapeHtml } from "../../utils/html.js";
import { t } from "../../i18n/index.js";
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
    await ctx.reply(t("sandbox.usage"), { parse_mode: "HTML" });
    return;
  }

  const allowNetwork = input.startsWith("--network ");
  const command = allowNetwork ? input.slice(10).trim() : input;

  if (!command) {
    await ctx.reply(t("sandbox.no_command"));
    return;
  }

  if (!isBwrapAvailable()) {
    await ctx.reply(t("sandbox.no_bwrap"), { parse_mode: "HTML" });
    return;
  }

  const isUrl = /^https?:\/\//i.test(command);
  const isScript = /\.sh$/i.test(command) || /\|\s*(sh|bash)/.test(command);

  const statusMsg = await ctx.reply(
    t("sandbox.running", {
      network: allowNetwork ? " (with network)" : "",
      command: `${escapeHtml(command.slice(0, 100))}${command.length > 100 ? "..." : ""}`,
    }),
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

    const header = t("sandbox.header", { elapsed: elapsedStr });
    const cmdLine = `Command: <code>${escapeHtml(command)}</code>\n`;
    const exitLine = result.timedOut
      ? t("sandbox.timed_out", { seconds: "30" }) + "\n"
      : t("sandbox.exit_code", { code: String(result.exitCode ?? "N/A") }) + "\n";

    const fullReport = `${header}\n${securityPreview}\n\n${cmdLine}${exitLine}`;

    if (result.stdout) {
      const chunks = chunkOutput(result.stdout);
      for (let i = 0; i < chunks.length; i++) {
        const chunkHeader =
          chunks.length > 1
            ? t("sandbox.output_part", { part: String(i + 1), total: String(chunks.length) })
            : t("sandbox.output");
        await ctx.reply(`${chunkHeader}\n<pre><code>${chunks[i]}</code></pre>`, { parse_mode: "HTML" });
      }
    }

    if (result.stderr && !result.timedOut) {
      const chunks = chunkOutput(result.stderr);
      for (let i = 0; i < chunks.length; i++) {
        const chunkHeader =
          chunks.length > 1
            ? t("sandbox.stderr_part", { part: String(i + 1), total: String(chunks.length) })
            : t("sandbox.stderr");
        await ctx.reply(`${chunkHeader}\n<pre><code>${chunks[i]}</code></pre>`, { parse_mode: "HTML" });
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
        t("sandbox.error", { message: escapeHtml(message) }),
        { parse_mode: "HTML" }
      )
      .catch(() => {});
  }
}
