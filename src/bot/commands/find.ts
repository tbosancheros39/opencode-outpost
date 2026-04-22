import { CommandContext, Context } from "grammy";
import Fuse from "fuse.js";
import { opencodeClient } from "../../opencode/client.js";
import { getCurrentProject } from "../../settings/manager.js";
import { getCurrentSession } from "../../session/manager.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { chunkOutput } from "../utils/chunk.js";
import { sendBotText } from "../utils/telegram-text.js";

const MAX_RESULTS = 10;
const MESSAGE_CHUNK_SIZE = 4000;

interface SessionMessage {
  id: string;
  role: string;
  text: string;
  created: number;
}

/**
 * /find command — semantic search across session history
 * Uses session.messages() to fetch messages directly
 */
export async function findCommand(ctx: CommandContext<Context>): Promise<void> {
  const query = ctx.match?.toString().trim();

  if (!query) {
    await ctx.reply(t("cmd.find.usage"));
    return;
  }

  const MAX_QUERY_LEN = 500;
  if (query.length > MAX_QUERY_LEN) {
    await ctx.reply(t("cmd.find.error_query_too_long"));
    return;
  }

  const chatId = ctx.chat?.id ?? 0;
  const currentProject = getCurrentProject(chatId);

  if (!currentProject) {
    await ctx.reply(t("bot.project_not_selected"));
    return;
  }

  const currentSession = getCurrentSession(chatId);
  if (!currentSession) {
    await ctx.reply(t("cmd.find.no_session"));
    return;
  }

  try {
    await ctx.reply(t("cmd.find.searching", { query }));

    // Fetch messages using SSE events via client.session.get and event subscription
    const messages = await fetchSessionMessages(currentSession.id, currentProject.worktree);

    if (messages.length === 0) {
      await ctx.reply(t("cmd.find.no_messages"));
      return;
    }

    // Simple semantic search using keyword relevance scoring
    const results = searchMessages(messages, query);

    if (results.length === 0) {
      await ctx.reply(t("cmd.find.no_results"));
      return;
    }

    const formattedResults = formatSearchResults(results, query, MAX_RESULTS);
    const chunks = chunkOutput(formattedResults, MESSAGE_CHUNK_SIZE);

    for (let i = 0; i < chunks.length; i++) {
      const prefix = i === 0 ? t("cmd.find.results_header", { query, count: results.length }) : "";
      await sendBotText({
        api: ctx.api,
        chatId,
        text: `${prefix}${chunks[i]}`,
      });
    }
  } catch (error) {
    logger.error("[Find] Error searching session history:", error);
    await ctx.reply(t("cmd.find.error"));
  }
}

async function fetchSessionMessages(sessionId: string, directory: string): Promise<SessionMessage[]> {
  const messages: SessionMessage[] = [];

  try {
    const { data, error } = await opencodeClient.session.messages({
      sessionID: sessionId,
      directory,
    });

    if (error || !data) {
      logger.warn("[Find] Failed to get session messages:", error);
      return messages;
    }

    for (const msg of data) {
      const info = msg.info;
      const textParts = msg.parts.filter((p) => "text" in p && p.type === "text") as Array<{ text: string }>;
      const text = textParts.map((p) => p.text).join("");

      if (text.trim()) {
        messages.push({
          id: info.id,
          role: info.role,
          text,
          created: info.time.created,
        });
      }
    }

    messages.sort((a, b) => a.created - b.created);
  } catch (err) {
    logger.error("[Find] Error fetching messages:", err);
  }

  return messages;
}

/**
 * Search messages using fuse.js fuzzy matching
 */
function searchMessages(messages: SessionMessage[], query: string): SessionMessage[] {
  const fuse = new Fuse(messages, {
    keys: ["text"],
    threshold: 0.4,
    includeScore: true,
    minMatchCharLength: 2,
  });

  return fuse.search(query).map((result) => result.item);
}

function formatSearchResults(results: SessionMessage[], _query: string, maxResults: number): string {
  const lines: string[] = [];
  const toShow = results.slice(0, maxResults);

  toShow.forEach((msg, index) => {
    const role = msg.role === "user" ? "You" : "Assistant";
    const truncated = msg.text.length > 300 ? `${msg.text.slice(0, 297)}...` : msg.text;
    lines.push(`${index + 1}. **${role}**: ${truncated}`);
    lines.push("");
  });

  if (results.length > maxResults) {
    lines.push(`...and ${results.length - maxResults} more results`);
  }

  return lines.join("\n");
}
