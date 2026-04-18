import { Bot, Context } from "grammy";
import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import { opencodeClient } from "../../opencode/client.js";
import { clearSession, getCurrentSession, setCurrentSession } from "../../session/manager.js";
import { ingestSessionInfoForCache } from "../../session/cache-manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getStoredModel } from "../../model/manager.js";
import { formatVariantForButton } from "../../variant/manager.js";
import { createMainKeyboard } from "../utils/keyboard.js";
import { keyboardManager } from "../../keyboard/manager.js";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { summaryAggregator } from "../../summary/aggregator.js";
import { stopEventListening } from "../../opencode/events.js";
import { interactionManager } from "../../interaction/manager.js";
import { clearAllInteractionState } from "../../interaction/cleanup.js";
import { createTask } from "../../task-queue/store.js";
import { associateSessionWithTask } from "../../task-queue/tracker.js";
import { addTaskJob } from "../../queue/index.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { foregroundSessionState } from "../../scheduled-task/foreground-state.js";
import { getUserSystemPrompt, getUserModelVariant } from "../../users/access.js";
import { getOrCreateGlobalDirectory } from "../utils/global-mode.js";

/** Module-level references for async callbacks that don't have ctx. */
let botInstance: Bot<Context> | null = null;
let chatIdInstance: number | null = null;

export function getPromptBotInstance(): Bot<Context> | null {
  return botInstance;
}

export function getPromptChatId(): number | null {
  return chatIdInstance;
}

async function isSessionBusy(sessionId: string, directory: string): Promise<boolean> {
  try {
    const { data, error } = await opencodeClient.session.status({ directory });

    if (error || !data) {
      logger.warn("[Bot] Failed to check session status before prompt:", error);
      return false;
    }

    const sessionStatus = (data as Record<string, { type?: string }>)[sessionId];
    if (!sessionStatus) {
      return false;
    }

    logger.debug(`[Bot] Current session status before prompt: ${sessionStatus.type || "unknown"}`);
    return sessionStatus.type === "busy";
  } catch (err) {
    logger.warn("[Bot] Error checking session status before prompt:", err);
    return false;
  }
}

async function resetMismatchedSessionContext(chatId: number): Promise<void> {
  stopEventListening();
  summaryAggregator.clear();
  foregroundSessionState.clearAll("session_mismatch_reset");
  clearAllInteractionState(chatId, "session_mismatch_reset");
  clearSession(chatId);
  keyboardManager.clearContext(chatId);

  if (!pinnedMessageManager.isInitialized(chatId)) {
    return;
  }

  try {
    await pinnedMessageManager.clear(chatId);
  } catch (err) {
    logger.error("[Bot] Failed to clear pinned message during session reset:", err);
  }
}

export interface ProcessPromptDeps {
  bot: Bot<Context>;
  ensureEventSubscription: (directory: string) => Promise<void>;
}

/**
 * Processes a user prompt: ensures project/session, subscribes to events, and sends
 * the prompt to OpenCode. Used by text, voice, and photo message handlers.
 *
 * @param ctx - Grammy context
 * @param text - Text content of the prompt
 * @param deps - Dependencies (bot and event subscription)
 * @param fileParts - Optional file parts (for photo/document attachments)
 * @returns true if the prompt was dispatched, false if it was blocked/failed early.
 */
export async function processUserPrompt(
  ctx: Context,
  text: string,
  deps: ProcessPromptDeps,
  fileParts: FilePartInput[] = [],
): Promise<boolean> {
  const { bot, ensureEventSubscription } = deps;

  if (!ctx.chat) return false;
  const chatId = ctx.chat.id;

  // Send acknowledgment immediately before any network calls
  const ackMsg = await ctx.reply(t("bot.working_on_it"));
  const ackMessageId = ackMsg.message_id;

  const currentProject = getCurrentProject(chatId);
  const isGlobalMode = !currentProject;

  let workingDirectory: string;
  if (isGlobalMode) {
    // Global/Scratchpad mode — use a per-chat temporary directory so the user
    // can send prompts without selecting a project first.
    workingDirectory = await getOrCreateGlobalDirectory(chatId);
    logger.info(`[Bot] Using Global Mode: chatId=${chatId}, directory=${workingDirectory}`);
  } else {
    // Project mode — use the worktree of the selected project.
    workingDirectory = currentProject.worktree;
    logger.info(
      `[Bot] Using Project Mode: chatId=${chatId}, project=${currentProject.name ?? workingDirectory}`,
    );
  }

  botInstance = bot;
  chatIdInstance = chatId;

  // Initialize pinned message manager if not already
  if (!pinnedMessageManager.isInitialized(chatId)) {
    pinnedMessageManager.initialize(bot.api, chatId);
  }

  // Initialize keyboard manager if not already
  keyboardManager.initialize(bot.api, chatId);

  let currentSession = getCurrentSession(chatId);

  if (currentSession && currentSession.directory !== workingDirectory) {
    logger.warn(
      `[Bot] Session/mode mismatch detected. sessionDirectory=${currentSession.directory}, expectedDirectory=${workingDirectory}. Resetting session context.`,
    );
    await resetMismatchedSessionContext(chatId);

    const mismatchMsg = isGlobalMode
      ? t("bot.session_reset_to_global")
      : t("bot.session_reset_project_mismatch");

    await ctx.reply(mismatchMsg);
    return false;
  }

  if (!currentSession) {
    await ctx.reply(t("bot.creating_session"));

    const { data: session, error } = await opencodeClient.session.create({
      directory: workingDirectory,
    });

    if (error || !session) {
      await ctx.reply(t("bot.create_session_error"));
      return false;
    }

    logger.info(
      `[Bot] Created new session: id=${session.id}, title="${session.title}", directory=${workingDirectory}`,
    );

    currentSession = {
      id: session.id,
      title: session.title,
      directory: workingDirectory,
    };

    setCurrentSession(chatId, currentSession);
    await ingestSessionInfoForCache(session);

    // Create pinned message for new session
    try {
      await pinnedMessageManager.onSessionChange(chatId, session.id, session.title);
    } catch (err) {
      logger.error("[Bot] Error creating pinned message for new session:", err);
    }

    const currentAgent = getStoredAgent(chatId);
    const currentModel = getStoredModel(chatId);
    const contextInfo = pinnedMessageManager.getContextInfo(chatId);
    const variantName = formatVariantForButton(currentModel.variant || "default");
    const keyboard = createMainKeyboard(
      currentAgent,
      currentModel,
      contextInfo ?? undefined,
      variantName,
    );

    await ctx.reply(t("bot.session_created", { title: session.title }), {
      reply_markup: keyboard,
    });
  } else {
    logger.info(
      `[Bot] Using existing session: id=${currentSession.id}, title="${currentSession.title}"`,
    );

    // Ensure pinned message exists for existing session
    if (!pinnedMessageManager.getState(chatId).messageId) {
      try {
        await pinnedMessageManager.onSessionChange(chatId, currentSession.id, currentSession.title);
      } catch (err) {
        logger.error("[Bot] Error creating pinned message for existing session:", err);
      }
    }
  }

  await ensureEventSubscription(currentSession.directory);

  summaryAggregator.setSession(currentSession.id);
  summaryAggregator.setBotAndChatId(bot, chatId);

  const sessionIsBusy = await isSessionBusy(currentSession.id, currentSession.directory);
  if (sessionIsBusy) {
    logger.info(`[Bot] Ignoring new prompt: session ${currentSession.id} is busy`);
    await ctx.reply(t("bot.session_busy"));
    return false;
  }

  try {
    const currentAgent = getStoredAgent(chatId);
    const storedModel = getStoredModel(chatId);

    // Build parts array with text and files
    const parts: Array<TextPartInput | FilePartInput> = [];

    // Add text part if present
    if (text.trim().length > 0) {
      parts.push({ type: "text", text });
    }

    // Add file parts
    parts.push(...fileParts);

    // If no text and files exist, use a placeholder
    if (parts.length === 0 || (parts.length > 0 && parts.every((p) => p.type === "file"))) {
      if (fileParts.length > 0) {
        // Files without text - add a minimal system prompt
        parts.unshift({ type: "text", text: "See attached file" });
      }
    }

    const promptOptions: {
      sessionID: string;
      directory: string;
      parts: Array<TextPartInput | FilePartInput>;
      model?: { providerID: string; modelID: string };
      agent?: string;
      variant?: string;
      system?: string;
    } = {
      sessionID: currentSession.id,
      directory: currentSession.directory,
      parts,
      agent: currentAgent,
    };

    // Use stored model (from settings or config)
    if (storedModel.providerID && storedModel.modelID) {
      promptOptions.model = {
        providerID: storedModel.providerID,
        modelID: storedModel.modelID,
      };

      // Add variant if specified; fall back to user-level restriction variant
      const variantOverride = getUserModelVariant(ctx.from!.id);
      promptOptions.variant = storedModel.variant || variantOverride;
    }

    // Inject per-user system prompt if defined
    const userSystemPrompt = getUserSystemPrompt(ctx.from!.id);
    if (userSystemPrompt) {
      promptOptions.system = userSystemPrompt;
    }

    logger.info(
      `[Bot] Calling session.prompt (fire-and-forget) with agent=${currentAgent}, fileCount=${fileParts.length}...`,
    );

    // Resolve the effective variant for task records
    const effectiveVariant = promptOptions.variant ?? storedModel.variant ?? null;

    // Create a task record for persistence
    const task = createTask({
      userId: ctx.from!.id,
      chatId: chatId,
      promptText: text,
      sessionId: currentSession.id,
      directory: currentSession.directory,
      notificationMessageId: 0, // Will be updated if needed
      agent: currentAgent || "default",
      modelProvider: storedModel.providerID || "opencode",
      modelId: storedModel.modelID || "default",
      variant: effectiveVariant,
    });

    // Associate session with task for result tracking
    associateSessionWithTask(currentSession.id, task.id);

    foregroundSessionState.markBusy(currentSession.id);

    // Enqueue task to BullMQ for async processing with progress heartbeats
    // The worker will call session.prompt() and send progress updates via Telegram
    const job = await addTaskJob({
      taskId: task.id,
      userId: ctx.from!.id,
      chatId: chatId,
      ackMessageId,
      promptText: text,
      sessionId: currentSession.id,
      directory: currentSession.directory,
      agent: currentAgent || "default",
      modelProvider: storedModel.providerID || "opencode",
      modelId: storedModel.modelID || "default",
      variant: effectiveVariant,
      system: userSystemPrompt,
      parts,
      jobType: "opencode",
    });

    logger.info(`[Bot] Task ${task.id} enqueued (job ${job.id})`);

    return true;
  } catch (err) {
    if (currentSession) {
      foregroundSessionState.markIdle(currentSession.id);
    }
    logger.error("Error in prompt handler:", err);
    if (interactionManager.getSnapshot(chatId)) {
      clearAllInteractionState(chatId, "message_handler_error");
    }
    await ctx.reply(t("error.generic"));
    return false;
  }
}
