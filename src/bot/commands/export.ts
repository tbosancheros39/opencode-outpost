import { CommandContext, Context, InputFile } from "grammy";
import { fileURLToPath } from "url";
import * as path from "path";
import { promises as fs } from "fs";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentSession } from "../../session/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, "..", "..", ".tmp");

interface SessionMessage {
  info: {
    id: string;
    sessionID: string;
    role: "user" | "assistant";
    time: {
      created: number;
      completed?: number;
    };
    agent: string;
    model?: {
      providerID: string;
      modelID: string;
    };
    modelID?: string;
    providerID?: string;
    cost?: number;
    tokens?: {
      input: number;
      output: number;
      reasoning: number;
      cache: {
        read: number;
        write: number;
      };
    };
  };
  parts: Array<{
    id: string;
    sessionID: string;
    messageID: string;
    type: string;
    text?: string;
  }>;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function formatRole(role: "user" | "assistant"): string {
  return role === "user" ? "User" : "Assistant";
}

function formatContent(parts: SessionMessage["parts"]): string {
  const lines: string[] = [];

  for (const part of parts) {
    if (part.type === "text" && part.text) {
      lines.push(part.text);
    }
  }

  return lines.join("\n\n");
}

function formatCost(cost?: number): string {
  if (cost === undefined || cost === 0) {
    return "";
  }
  return ` [Cost: $${cost.toFixed(4)}]`;
}

function formatTokens(tokens?: SessionMessage["info"]["tokens"]): string {
  if (!tokens) {
    return "";
  }
  return ` [Tokens: ${tokens.input} in / ${tokens.output} out]`;
}

export async function exportCommand(ctx: CommandContext<Context>) {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply(t("export.error_no_session"));
    return;
  }

  const session = getCurrentSession(chatId);
  if (!session) {
    await ctx.reply(t("export.no_session"));
    return;
  }

  const statusMsg = await ctx.reply(t("export.exporting"), { parse_mode: "HTML" });

  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const { data: messages, error } = await opencodeClient.session.messages({
      sessionID: session.id,
      limit: 1000,
    });

    if (error || !messages) {
      throw error || new Error("Failed to fetch session messages");
    }

    const now = new Date().toISOString();
    const sessionDateRange =
      messages.length > 0
        ? `${formatTimestamp(messages[0].info.time.created)} → ${formatTimestamp(messages[messages.length - 1].info.time.created)}`
        : "No messages";

    const lines: string[] = [
      `# ${session.title}`,
      "",
      "## Session Export",
      "",
      `**Export Date:** ${now}`,
      `**Session ID:** ${session.id}`,
      `**Project:** ${session.directory}`,
      `**Date Range:** ${sessionDateRange}`,
      "",
      "---",
      "",
      "## Conversation History",
      "",
    ];

    for (const msg of messages as unknown as SessionMessage[]) {
      const role = formatRole(msg.info.role);
      const timestamp = formatTimestamp(msg.info.time.created);
      const model = msg.info.model
        ? `${msg.info.model.providerID}/${msg.info.model.modelID}`
        : msg.info.modelID || "unknown";
      const costStr = formatCost(msg.info.cost);
      const tokensStr = formatTokens(msg.info.tokens);

      lines.push(`### ${role} — ${timestamp}`);
      if (msg.info.role === "assistant") {
        lines.push(`**Model:** ${model}${costStr}${tokensStr}`);
      }
      lines.push("");
      lines.push(formatContent(msg.parts));
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    const filename = `session-${session.id.slice(0, 8)}-export-${new Date().toISOString().slice(0, 10)}.md`;
    const filePath = path.join(TEMP_DIR, filename);

    await fs.writeFile(filePath, lines.join("\n"), "utf-8");

    await ctx.api.deleteMessage(chatId, statusMsg.message_id);

    await ctx.replyWithDocument(new InputFile(filePath), {
      caption: t("export.success", { title: session.title }),
      parse_mode: "HTML",
    });

    logger.info(`[Export] Session exported: ${session.id} (${messages.length} messages)`);

    await fs.unlink(filePath).catch(() => {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("[Bot] Export command error:", error);

    await ctx.api
      .editMessageText(chatId, statusMsg.message_id, t("export.error", { message }), {
        parse_mode: "HTML",
      })
      .catch(() => {});
  }
}
