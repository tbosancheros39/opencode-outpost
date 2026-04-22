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
 * Uses SSE event aggregation to fetch messages (session.messages() doesn't exist on v2 SDK)
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

/**
 * Fetch session messages using client.session.get and aggregating from SSE events
 * (session.messages() doesn't exist on v2 SDK)
 */
async function fetchSessionMessages(sessionId: string, directory: string): Promise<SessionMessage[]> {
  const messages: SessionMessage[] = [];

  try {
    // Use session.get to get session details
    const { data: session, error } = await opencodeClient.session.get({
      sessionID: sessionId,
      directory,
    });

    if (error || !session) {
      logger.warn("[Find] Failed to get session:", error);
      return messages;
    }

    // Subscribe to events and collect messages via SSE
    const abortController = new AbortController();
    const eventStream = await opencodeClient.event.subscribe({ directory }, { signal: abortController.signal });

    if (!eventStream.stream) {
      logger.warn("[Find] No event stream available");
      return messages;
    }

    // Collect message events for a limited time
    const collectDurationMs = 5000;
    const collectedMessages = new Map<string, SessionMessage>();

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, collectDurationMs);
    });

    const streamPromise = (async () => {
      try {
        for await (const event of eventStream.stream!) {
          if (event.type === "message.updated" || event.type === "message.part.updated") {
            const properties = event.properties as {
              info?: { id?: string; role?: string; time?: { created?: number } };
              part?: { sessionID?: string; messageID?: string; text?: string; type?: string };
            };

            const messageId = properties.info?.id || properties.part?.messageID;
            const role = properties.info?.role;
            const created = properties.info?.time?.created;

            if (messageId && role) {
              const existing = collectedMessages.get(messageId) || {
                id: messageId,
                role,
                text: "",
                created: created || Date.now(),
              };
              existing.role = role;
              if (created) existing.created = created;

              // Append text from part updates
              if (properties.part?.type === "text" && properties.part.text) {
                existing.text += properties.part.text;
              }

              collectedMessages.set(messageId, existing);
            }
          }
        }
      } catch (err) {
        logger.debug("[Find] Event stream ended:", err);
      }
    })();

    await Promise.race([timeoutPromise, streamPromise]);
    abortController.abort();

    // Convert collected messages to array
    for (const msg of collectedMessages.values()) {
      if (msg.text.trim()) {
        messages.push(msg);
      }
    }

    // Sort by creation time
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
