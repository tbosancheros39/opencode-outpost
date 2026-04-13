// src/bot/commands/fe.ts

import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getCurrentSession } from "../../session/manager.js";
import { opencodeClient } from "../../opencode/client.js";
import { quoteShellArg } from "../utils/shell-security.js";
import { getCurrentProject } from "../../settings/manager.js";
import { interactionManager } from "../../interaction/manager.js";
import { listDirectory } from "../../file-explorer/manager.js";
import type { FileExplorerItem, FileExplorerMetadata } from "../../file-explorer/types.js";
import type { InteractionMetadata } from "../../interaction/types.js";
import { logger } from "../../utils/logger.js";
import { t } from "../../i18n/index.js";
import { escapeHtml } from "../../utils/html.js";

const FE_CALLBACK_PREFIX = "fe:";
const FE_NAV_PREFIX = `${FE_CALLBACK_PREFIX}nav:`;
const FE_READ_PREFIX = `${FE_CALLBACK_PREFIX}read:`;
const FE_SELECT_PREFIX = `${FE_CALLBACK_PREFIX}select:`;
const FE_UP = `${FE_CALLBACK_PREFIX}up`;
const FE_HOME = `${FE_CALLBACK_PREFIX}home`;
const FE_REFRESH = `${FE_CALLBACK_PREFIX}refresh`;
const FE_PAGE_PREFIX = `${FE_CALLBACK_PREFIX}page:`;
const FE_CANCEL = `${FE_CALLBACK_PREFIX}cancel`;

const ITEMS_PER_PAGE = 15;

function getItemIcon(item: FileExplorerItem): string {
  switch (item.type) {
    case "directory":
      return "📁";
    case "symlink":
      return "🔗";
    case "executable":
      return "⚙️";
    default:
      return "📄";
  }
}

function buildFilesKeyboard(
  items: FileExplorerItem[],
  currentPath: string,
  parentPath: string | null,
  page: number,
  totalPages: number,
  projectRoot: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const start = page * ITEMS_PER_PAGE;
  const pageItems = items.slice(start, start + ITEMS_PER_PAGE);

  // Directory navigation buttons (2 per row)
  for (const item of pageItems.filter((i) => i.type === "directory")) {
    const encodedPath = Buffer.from(item.path).toString("base64url");
    keyboard.text(`${getItemIcon(item)} ${item.name}`, `${FE_NAV_PREFIX}${encodedPath}`).row();
  }

  // File buttons (2 per row)
  const files = pageItems.filter((i) => i.type !== "directory");
  for (let i = 0; i < files.length; i += 2) {
    const encodedPath1 = Buffer.from(files[i].path).toString("base64url");
    keyboard.text(
      `${getItemIcon(files[i])} ${files[i].name}`,
      `${FE_SELECT_PREFIX}${encodedPath1}`,
    );
    if (files[i + 1]) {
      const encodedPath2 = Buffer.from(files[i + 1].path).toString("base64url");
      keyboard.text(
        `${getItemIcon(files[i + 1])} ${files[i + 1].name}`,
        `${FE_SELECT_PREFIX}${encodedPath2}`,
      );
    }
    keyboard.row();
  }

  // Pagination
  if (totalPages > 1) {
    if (page > 0) {
      keyboard.text("⬅️ Prev", `${FE_PAGE_PREFIX}${page - 1}`);
    }
    if (page < totalPages - 1) {
      keyboard.text("➡️ Next", `${FE_PAGE_PREFIX}${page + 1}`);
    }
    keyboard.row();
  }

  // Navigation buttons
  if (parentPath && parentPath !== currentPath) {
    keyboard.text("⬆️ Up", FE_UP);
  }
  if (currentPath !== projectRoot) {
    keyboard.text("🏠 Home", FE_HOME);
  }
  keyboard.text("🔄 Refresh", FE_REFRESH).text("❌ Close", FE_CANCEL);

  return keyboard;
}

export async function feCommand(ctx: CommandContext<Context>) {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  const session = getCurrentSession(chatId);
  if (!session) {
    await ctx.reply(t("fe.error_no_session"));
    return;
  }

  const project = getCurrentProject(chatId);
  if (!project) {
    await ctx.reply(t("fe.error_no_project"));
    return;
  }

  const targetPath = (ctx.match as string)?.trim() || project.worktree || ".";
  logger.info(`[FE] Starting file explorer at: ${targetPath}`);

  try {
    const pageData = await listDirectory(session.id, targetPath);
    if (pageData.items.length === 0) {
      await ctx.reply(t("fe.empty_directory"));
      return;
    }

    const text = `📁 <b>${escapeHtml(pageData.currentPath)}</b>\n\n${t("fe.select_hint")}`;
    const keyboard = buildFilesKeyboard(
      pageData.items,
      pageData.currentPath,
      pageData.parentPath,
      0,
      pageData.totalPages,
      project.worktree,
    );

    const message = await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });

    interactionManager.start(chatId, {
      kind: "custom",
      expectedInput: "callback",
      metadata: {
        flow: "file_explorer",
        stage: "browse",
        messageId: message.message_id,
        sessionId: session.id,
        currentPath: pageData.currentPath,
        parentPath: pageData.parentPath,
        projectRoot: project.worktree,
        items: pageData.items,
        page: 0,
        totalItems: pageData.totalItems,
      } as InteractionMetadata,
    });

    logger.info(`[FE] File explorer started for session: ${session.id}`);
  } catch (error) {
    logger.error("[FE] Error starting file explorer:", error);
    await ctx.reply(
      t("fe.error_listing", { error: error instanceof Error ? error.message : String(error) }),
    );
  }
}

export async function handleFeCallback(ctx: Context): Promise<boolean> {
  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData?.startsWith(FE_CALLBACK_PREFIX)) {
    return false;
  }

  const chatId = ctx.chat?.id ?? 0;
  const state = interactionManager.getSnapshot(chatId);

  if (
    !state ||
    state.kind !== "custom" ||
    (state.metadata as { flow?: string })?.flow !== "file_explorer"
  ) {
    await ctx.answerCallbackQuery({ text: t("fe.inactive_callback") });
    return true;
  }

  const metadata = state.metadata as unknown as FileExplorerMetadata;

  try {
    // Navigation: Enter directory
    if (callbackData.startsWith(FE_NAV_PREFIX)) {
      const encodedPath = callbackData.slice(FE_NAV_PREFIX.length);
      const path = Buffer.from(encodedPath, "base64url").toString();

      await ctx.answerCallbackQuery();

      const pageData = await listDirectory(metadata.sessionId, path);

      const text = `📁 <b>${escapeHtml(pageData.currentPath)}</b>\n\n${t("fe.select_hint")}`;
      const keyboard = buildFilesKeyboard(
        pageData.items,
        pageData.currentPath,
        pageData.parentPath,
        0,
        pageData.totalPages,
        metadata.projectRoot,
      );

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });

      interactionManager.transition(chatId, {
        expectedInput: "callback",
        metadata: {
          ...metadata,
          currentPath: pageData.currentPath,
          parentPath: pageData.parentPath,
          items: pageData.items,
          page: 0,
          totalItems: pageData.totalItems,
        },
      });
      return true;
    }

    // Navigation: Pagination
    if (callbackData.startsWith(FE_PAGE_PREFIX)) {
      const page = Number(callbackData.slice(FE_PAGE_PREFIX.length));

      await ctx.answerCallbackQuery();

      const itemsPerPage = ITEMS_PER_PAGE;
      const totalPages = Math.ceil(metadata.totalItems / itemsPerPage);

      const text = `📁 <b>${escapeHtml(metadata.currentPath)}</b>\n\n${t("fe.select_hint")}`;
      const keyboard = buildFilesKeyboard(
        metadata.items,
        metadata.currentPath,
        metadata.parentPath ? Buffer.from(metadata.parentPath).toString("base64url") : "",
        page,
        totalPages,
        metadata.projectRoot,
      );

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });

      interactionManager.transition(chatId, {
        expectedInput: "callback",
        metadata: {
          ...metadata,
          page,
        },
      });
      return true;
    }

    // Navigation: Go up
    if (callbackData === FE_UP) {
      await ctx.answerCallbackQuery();

      const parentPath = metadata.parentPath;
      if (!parentPath) return true;

      const pageData = await listDirectory(metadata.sessionId, parentPath);

      const text = `📁 <b>${escapeHtml(pageData.currentPath)}</b>\n\n${t("fe.select_hint")}`;
      const keyboard = buildFilesKeyboard(
        pageData.items,
        pageData.currentPath,
        pageData.parentPath,
        0,
        pageData.totalPages,
        metadata.projectRoot,
      );

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });

      interactionManager.transition(chatId, {
        expectedInput: "callback",
        metadata: {
          ...metadata,
          currentPath: pageData.currentPath,
          parentPath: pageData.parentPath,
          items: pageData.items,
          page: 0,
          totalItems: pageData.totalItems,
        },
      });
      return true;
    }

    // Navigation: Go home
    if (callbackData === FE_HOME) {
      await ctx.answerCallbackQuery();

      const pageData = await listDirectory(metadata.sessionId, metadata.projectRoot);

      const text = `📁 <b>${escapeHtml(pageData.currentPath)}</b>\n\n${t("fe.select_hint")}`;
      const keyboard = buildFilesKeyboard(
        pageData.items,
        pageData.currentPath,
        pageData.parentPath,
        0,
        pageData.totalPages,
        metadata.projectRoot,
      );

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });

      interactionManager.transition(chatId, {
        expectedInput: "callback",
        metadata: {
          ...metadata,
          currentPath: pageData.currentPath,
          parentPath: pageData.parentPath,
          items: pageData.items,
          page: 0,
          totalItems: pageData.totalItems,
        },
      });
      return true;
    }

    // Navigation: Refresh
    if (callbackData === FE_REFRESH) {
      await ctx.answerCallbackQuery();

      const pageData = await listDirectory(metadata.sessionId, metadata.currentPath);

      const text = `📁 <b>${escapeHtml(pageData.currentPath)}</b>\n\n${t("fe.select_hint")}`;
      const keyboard = buildFilesKeyboard(
        pageData.items,
        pageData.currentPath,
        pageData.parentPath,
        0,
        pageData.totalPages,
        metadata.projectRoot,
      );

      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });

      interactionManager.transition(chatId, {
        expectedInput: "callback",
        metadata: {
          ...metadata,
          currentPath: pageData.currentPath,
          parentPath: pageData.parentPath,
          items: pageData.items,
          totalItems: pageData.totalItems,
        },
      });
      return true;
    }

    // Navigation: Cancel
    if (callbackData === FE_CANCEL) {
      await ctx.answerCallbackQuery({ text: t("fe.closed") });
      interactionManager.clear(chatId, "fe_cancelled");
      await ctx.deleteMessage().catch(() => {});
      return true;
    }

    // File Selection: Read file content
    if (callbackData.startsWith(FE_READ_PREFIX)) {
      const encodedPath = callbackData.slice(FE_READ_PREFIX.length);
      const filePath = Buffer.from(encodedPath, "base64url").toString();

      await ctx.answerCallbackQuery(t("fe.reading_file", { path: escapeHtml(filePath) }));

      try {
        const { data, error } = await opencodeClient.session.shell({
          sessionID: metadata.sessionId,
          command: `cat ${quoteShellArg(filePath)}`,
        });

        if (error) {
          let errorMessage: string;
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === "object" && error !== null && "data" in error) {
            const err = error as { data?: { message?: string } };
            errorMessage = err.data?.message || JSON.stringify(error);
          } else {
            errorMessage = String(error);
          }
          await ctx.reply(
            t("fe.error_reading", { error: errorMessage, path: escapeHtml(filePath) }),
          );
          return true;
        }

        const content = (data as { stdout?: string })?.stdout || "(empty file)";
        const maxLength = 3500; // Telegram message limit

        if (content.length > maxLength) {
          await ctx.reply(
            `<b>📄 File: ${escapeHtml(filePath)} (truncated)</b>\n<pre>${escapeHtml(content.slice(0, maxLength))}...</pre>`,
            { parse_mode: "HTML" },
          );
        } else {
          await ctx.reply(
            `<b>📄 File: ${escapeHtml(filePath)}</b>\n<pre>${escapeHtml(content)}</pre>`,
            { parse_mode: "HTML" },
          );
        }
      } catch (error) {
        logger.error("[FE] Error reading file:", error);
        await ctx.reply(
          t("fe.error_reading", { error: String(error), path: escapeHtml(filePath) }),
        );
      }

      return true;
    }

    // File Selection: Copy path to clipboard (simulated by sending message)
    if (callbackData.startsWith(FE_SELECT_PREFIX)) {
      const encodedPath = callbackData.slice(FE_SELECT_PREFIX.length);
      const filePath = Buffer.from(encodedPath, "base64url").toString();

      await ctx.answerCallbackQuery(t("fe.selected_path", { path: escapeHtml(filePath) }));

      // Send the path as a separate message for easy copying
      await ctx.reply(`<code>${escapeHtml(filePath)}</code>`, { parse_mode: "HTML" });

      return true;
    }

    await ctx.answerCallbackQuery({ text: t("callback.unknown_command") });
    return true;
  } catch (error) {
    logger.error("[FE] Callback error:", error);
    interactionManager.clear(chatId, "fe_callback_error");
    await ctx.answerCallbackQuery({ text: t("callback.processing_error") });
    return true;
  }
}
