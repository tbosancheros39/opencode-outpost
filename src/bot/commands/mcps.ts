import { CommandContext, Context, InlineKeyboard } from "grammy";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentProject } from "../../settings/manager.js";
import { interactionManager } from "../../interaction/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";

const MCPS_CALLBACK_PREFIX = "mcps:";
const MCPS_RECONNECT_PREFIX = `${MCPS_CALLBACK_PREFIX}reconnect:`;
const MCPS_DISCONNECT_PREFIX = `${MCPS_CALLBACK_PREFIX}disconnect:`;
const MCPS_CONNECT_PREFIX = `${MCPS_CALLBACK_PREFIX}connect:`;
const MCPS_CANCEL = `${MCPS_CALLBACK_PREFIX}cancel`;

interface McpServerItem {
  name: string;
  status: "connected" | "disabled" | "failed" | "needs_auth" | "needs_client_registration";
  error?: string;
}

interface McpsMetadata {
  flow: "mcps";
  stage: "list";
  messageId: number;
  directory: string;
  servers: McpServerItem[];
}

function parseReconnectCallback(data: string): string | null {
  if (!data.startsWith(MCPS_RECONNECT_PREFIX)) {
    return null;
  }
  return data.slice(MCPS_RECONNECT_PREFIX.length);
}

function parseDisconnectCallback(data: string): string | null {
  if (!data.startsWith(MCPS_DISCONNECT_PREFIX)) {
    return null;
  }
  return data.slice(MCPS_DISCONNECT_PREFIX.length);
}

function parseConnectCallback(data: string): string | null {
  if (!data.startsWith(MCPS_CONNECT_PREFIX)) {
    return null;
  }
  return data.slice(MCPS_CONNECT_PREFIX.length);
}

function getStatusEmoji(status: McpServerItem["status"]): string {
  switch (status) {
    case "connected":
      return "🟢";
    case "disabled":
      return "⚪";
    case "failed":
      return "🔴";
    case "needs_auth":
      return "🔐";
    case "needs_client_registration":
      return "⚠️";
    default:
      return "❓";
  }
}

function getStatusText(status: McpServerItem["status"]): string {
  switch (status) {
    case "connected":
      return t("mcps.status.connected");
    case "disabled":
      return t("mcps.status.disabled");
    case "failed":
      return t("mcps.status.failed");
    case "needs_auth":
      return t("mcps.status.needs_auth");
    case "needs_client_registration":
      return t("mcps.status.needs_client_registration");
    default:
      return t("mcps.status.unknown");
  }
}

async function loadMcpServers(directory: string): Promise<McpServerItem[]> {
  const { data, error } = await opencodeClient.mcp.status({ directory });

  if (error || !data) {
    throw error || new Error("Failed to fetch MCP servers");
  }

  const servers: McpServerItem[] = [];
  for (const [name, statusInfo] of Object.entries(data)) {
    servers.push({
      name,
      status: statusInfo.status,
      error: "error" in statusInfo ? (statusInfo as { error: string }).error : undefined,
    });
  }

  return servers;
}

function formatMcpServerItem(index: number, server: McpServerItem): string {
  const emoji = getStatusEmoji(server.status);
  const statusText = getStatusText(server.status);
  let line = `${index + 1}. ${emoji} ${server.name}\n   └ ${statusText}`;
  if (server.status === "failed" && server.error) {
    const truncatedError = server.error.length > 50 ? `${server.error.slice(0, 47)}...` : server.error;
    line += `\n   └ Error: ${truncatedError}`;
  }
  return line;
}

function formatMcpsHeader(totalServers: number): string {
  return t("mcps.header", { total: totalServers });
}

function buildMcpsKeyboard(servers: McpServerItem[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const server of servers) {
    if (server.status === "connected") {
      keyboard
        .text(
          t("mcps.button.disconnect", { name: server.name }),
          `${MCPS_DISCONNECT_PREFIX}${server.name}`,
        )
        .row();
    } else if (
      server.status === "disabled" ||
      server.status === "failed" ||
      server.status === "needs_auth" ||
      server.status === "needs_client_registration"
    ) {
      keyboard
        .text(
          t("mcps.button.connect", { name: server.name }),
          `${MCPS_CONNECT_PREFIX}${server.name}`,
        )
        .row();
    }
  }

  keyboard.text(t("mcps.button.cancel"), MCPS_CANCEL);

  return keyboard;
}

export async function mcpsCommand(ctx: CommandContext<Context>) {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply(t("mcps.error_no_chat"));
      return;
    }

    const project = getCurrentProject(chatId);
    if (!project) {
      await ctx.reply(t("mcps.no_project"));
      return;
    }

    logger.debug(`[MCPS] Loading MCP servers for project: ${project.worktree}`);

    const servers = await loadMcpServers(project.worktree);

    if (servers.length === 0) {
      await ctx.reply(t("mcps.empty"));
      return;
    }

    const header = formatMcpsHeader(servers.length);
    const serverLines = servers.map((server, i) => formatMcpServerItem(i, server));
    const hint = t("mcps.hint");
    const text = [header, "", ...serverLines, "", hint].join("\n");

    const keyboard = buildMcpsKeyboard(servers);

    const message = await ctx.reply(text, { reply_markup: keyboard });

    interactionManager.start(chatId, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "mcps",
        stage: "list",
        messageId: message.message_id,
        directory: project.worktree,
        servers,
      },
    });

    logger.info(`[MCPS] MCP servers list shown for project: ${project.worktree}`);
  } catch (error) {
    logger.error("[MCPS] Error loading MCP servers:", error);
    await ctx.reply(t("mcps.error_load"));
  }
}

export async function handleMcpsCallback(ctx: Context): Promise<boolean> {
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery?.data || !callbackQuery.data.startsWith(MCPS_CALLBACK_PREFIX)) {
    return false;
  }

  const chatId = ctx.chat?.id ?? 0;
  const state = interactionManager.getSnapshot(chatId);

  if (!state || state.kind !== "custom" || state.metadata.flow !== "mcps") {
    await ctx.answerCallbackQuery({ text: t("mcps.inactive_callback") });
    return true;
  }

  const metadata = state.metadata as unknown as McpsMetadata;
  const callbackMessageId = (ctx.callbackQuery?.message as { message_id?: number })?.message_id;

  if (callbackMessageId !== metadata.messageId) {
    await ctx.answerCallbackQuery({ text: t("mcps.inactive_callback") });
    return true;
  }

  const data = callbackQuery.data;

  try {
    if (data === MCPS_CANCEL) {
      interactionManager.clear(chatId, "mcps_cancelled");
      await ctx.answerCallbackQuery({ text: t("mcps.cancelled_callback") });
      await ctx.deleteMessage().catch(() => {});
      return true;
    }

    const serverName = parseReconnectCallback(data) || parseDisconnectCallback(data) || parseConnectCallback(data);

    if (serverName !== null) {
      const server = metadata.servers.find((s) => s.name === serverName);
      if (!server) {
        await ctx.answerCallbackQuery({ text: t("mcps.not_found") });
        return true;
      }

      if (data.startsWith(MCPS_DISCONNECT_PREFIX)) {
        await ctx.answerCallbackQuery({ text: t("mcps.disconnecting", { name: serverName }) });

        try {
          await opencodeClient.mcp.disconnect({
            name: serverName,
            directory: metadata.directory,
          });
          await ctx.reply(t("mcps.disconnected", { name: serverName }));
          logger.info(`[MCPS] Disconnected MCP server: ${serverName}`);
        } catch (error) {
          logger.error(`[MCPS] Failed to disconnect MCP server ${serverName}:`, error);
          await ctx.reply(t("mcps.disconnect_error", { name: serverName }));
        }
      } else if (data.startsWith(MCPS_CONNECT_PREFIX) || data.startsWith(MCPS_RECONNECT_PREFIX)) {
        await ctx.answerCallbackQuery({ text: t("mcps.connecting", { name: serverName }) });

        try {
          await opencodeClient.mcp.connect({
            name: serverName,
            directory: metadata.directory,
          });
          await ctx.reply(t("mcps.connected", { name: serverName }));
          logger.info(`[MCPS] Connected MCP server: ${serverName}`);
        } catch (error) {
          logger.error(`[MCPS] Failed to connect MCP server ${serverName}:`, error);
          await ctx.reply(t("mcps.connect_error", { name: serverName }));
        }
      }

      interactionManager.clear(chatId, "mcps_action_completed");
      await ctx.deleteMessage().catch(() => {});
      return true;
    }

    await ctx.answerCallbackQuery({ text: t("callback.unknown_command") });
    return true;
  } catch (error) {
    logger.error("[MCPS] Callback error:", error);
    interactionManager.clear(chatId, "mcps_callback_error");
    await ctx.answerCallbackQuery({ text: t("callback.processing_error") });
    return true;
  }
}
