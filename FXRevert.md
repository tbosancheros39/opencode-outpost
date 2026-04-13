# FXRevert Integration Guide

This document explains how to integrate two proposed features into opencode-telegram-bot:

1. **`/fe`** - Interactive File Explorer for browsing project directories
2. **`/revert`** - Message revert functionality (clarification needed)

---

## Part 1: File Explorer (`/fe`) Implementation

### Purpose

Provide an interactive file browser that allows users to:

- Navigate project directories with inline keyboard buttons
- View file listings with icons and metadata
- Select files to get exact paths for prompts
- Read file contents directly from the browser

### Architecture

```
src/
├── file-explorer/
│   ├── types.ts          # FileExplorerItem, FileExplorerState interfaces
│   ├── manager.ts         # State management, path utilities
│   └── parser.ts         # Parse ls -la output into structured data
├── bot/
│   └── commands/
│       └── fe.ts          # Command handler and callbacks
└── i18n/
    ├── en.ts              # English translations
    ├── de.ts              # German translations
    ├── es.ts              # Spanish translations
    ├── fr.ts              # French translations
    ├── ru.ts              # Russian translations
    └── zh.ts              # Chinese translations
```

### Type Definitions

```typescript
// src/file-explorer/types.ts

export interface FileExplorerItem {
  name: string;
  path: string;
  type: "directory" | "file" | "symlink" | "executable";
  size?: string;
  modified?: string;
  permissions?: string;
}

export interface FileExplorerPage {
  items: FileExplorerItem[];
  currentPath: string;
  parentPath: string | null;
  projectRoot: string;
  page: number;
  totalPages: number;
  totalItems: number;
}

export interface FileExplorerMetadata {
  flow: "file_explorer";
  stage: "browse" | "select";
  messageId: number;
  sessionId: string;
  currentPath: string;
  projectRoot: string;
  items: FileExplorerItem[];
  page: number;
  totalItems: number;
}
```

### State Manager

```typescript
// src/file-explorer/manager.ts

import { getCurrentSession } from "../session/manager.js";
import { getCurrentProject } from "../settings/manager.js";
import { opencodeClient } from "../opencode/client.js";
import { quoteShellArg, validateShellPathInput } from "../bot/utils/shell-security.js";
import type { FileExplorerItem, FileExplorerPage } from "./types.js";

const EXPLORER_ITEMS_PER_PAGE = 15;

/**
 * Parse ls -la output into structured file items
 */
export function parseLsOutput(output: string, basePath: string): FileExplorerItem[] {
  const lines = output.split("\n").filter((line) => line.trim());
  const items: FileExplorerItem[] = [];

  for (const line of lines.slice(1)) {
    // Skip "total X" line
    const match = line.match(
      /^([bcdlsp-])([rwx-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+(\S+\s+\d+\s+\d+:?\d*)\s+(.+)$/,
    );
    if (!match) continue;

    const [, type, permissions, , , size, , name] = match;
    const isDirectory = type === "d";
    const isSymlink = type === "l";
    const isExecutable = permissions.includes("x") && !isDirectory;

    items.push({
      name: name.split(" -> ")[0], // Handle symlinks
      path: `${basePath}/${name.split(" -> ")[0]}`.replace(/\/+/g, "/"),
      type: isSymlink
        ? "symlink"
        : isDirectory
          ? "directory"
          : isExecutable
            ? "executable"
            : "file",
      size: formatSize(parseInt(size, 10)),
    });
  }

  return items;
}

/**
 * List directory contents via session shell
 */
export async function listDirectory(
  sessionId: string,
  directory: string,
): Promise<FileExplorerPage> {
  const validationError = validateShellPathInput(directory);
  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await opencodeClient.session.shell({
    sessionID: sessionId,
    command: `ls -la ${quoteShellArg(directory)}`,
  });

  if (error) {
    throw error;
  }

  const stdout = (data as { stdout?: string })?.stdout || "";
  const items = parseLsOutput(stdout, directory);
  const normalized = normalizePath(directory);

  return {
    items,
    currentPath: normalized,
    parentPath: getParentPath(normalized),
    projectRoot: normalized,
    page: 0,
    totalPages: Math.ceil(items.length / EXPLORER_ITEMS_PER_PAGE),
    totalItems: items.length,
  };
}

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function normalizePath(path: string): string {
  return path.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function getParentPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  return "/" + parts.slice(0, -1).join("/");
}
```

### Command Handler

```typescript
// src/bot/commands/fe.ts

import { CommandContext, Context, InlineKeyboard } from "grammy";
import { getCurrentSession, setCurrentSession, type SessionInfo } from "../../session/manager.js";
import { getCurrentProject } from "../../settings/manager.js";
import { interactionManager } from "../../interaction/manager.js";
import { listDirectory, parseLsOutput } from "../../file-explorer/manager.js";
import type { FileExplorerItem, FileExplorerMetadata } from "../../file-explorer/types.js";
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
  projectRoot: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const start = page * ITEMS_PER_PAGE;
  const pageItems = items.slice(start, start + ITEMS_PER_PAGE);

  // Directory navigation buttons (2 per row)
  for (const item of pageItems.filter(i => i.type === "directory")) {
    const encodedPath = Buffer.from(item.path).toString("base64url");
    keyboard.text(`${getItemIcon(item)} ${item.name}`, `${FE_NAV_PREFIX}${encodedPath}`).row();
  }

  // File buttons (2 per row)
  const files = pageItems.filter(i => i.type !== "directory");
  for (let i = 0; i < files.length; i += 2) {
    const encodedPath1 = Buffer.from(files[i].path).toString("base64url");
    keyboard.text(`${getItemIcon(files[i])} ${files[i].name}`, `${FE_SELECT_PREFIX}${encodedPath1}`);
    if (files[i + 1]) {
      const encodedPath2 = Buffer.from(files[i + 1].path).toString("base64url");
      keyboard.text(`${getItemIcon(files[i + 1])} ${files[i + 1].name}`, `${FE_SELECT_PREFIX}${encodedPath2}`);
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
      project.worktree
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
        projectRoot: project.worktree,
        items: pageData.items,
        page: 0,
        totalItems: pageData.totalItems,
      } as FileExplorerMetadata,
    });

    logger.info(`[FE] File explorer started for session: ${session.id}`);
  } catch (error) {
    logger.error("[FE] Error starting file explorer:", error);
    await ctx.reply(t("fe.error_listing", { error: error instanceof Error ? error.message : String(error) }));
  }
}

export async function handleFeCallback(ctx: Context): Promise<boolean> {
  const callbackData = ctx.callbackQuery?.data;
  if (!callbackData?.startsWith(FE_CALLBACK_PREFIX)) {
    return false;
  }

  const chatId = ctx.chat?.id ?? 0;
  const state = interactionManager.getSnapshot(chatId);

  if (!state || state.kind !== "custom" || (state.metadata as { flow?: string })?.flow !== "file_explorer") {
    await ctx.answerCallbackQuery({ text: t("fe.inactive_callback") });
    return true;
  }

  const metadata = state.metadata as FileExplorerMetadata;... // Handle each callback type
  // Implementation continues...
}
```

### i18n Keys

```typescript
// Add to src/i18n/en.ts

export const en = {
  // ... existing keys
  fe: {
    error_no_session: "⚠️ No active session. Start a task first.",
    error_no_project: "⚠️ No project selected. Use /projects to select one.",
    empty_directory: "📂 Empty directory.",
    select_hint: "Select a file to copy its path, or navigate into a directory.",
    selected_path:
      "📋 <b>Selected file:</b>\n<code>{path}</code>\n\nUse this path in your next prompt.",
    reading_file: "📄 Reading: {path}...",
    error_listing: "❌ Error listing directory:\n{error}",
    inactive_callback: "File explorer closed. Use /fe to start again.",
    // ... more keys
  },
};
```

### Command Registration

```typescript
// Add to src/bot/commands/definitions.ts

{ command: "fe", descriptionKey: "cmd.description.fe" },

// Add to src/bot/index.ts
import { feCommand, handleFeCallback } from "./commands/fe.js";
bot.command("fe", feCommand);
// Add callback handler in the appropriate place
```

---

## Part 2: Revert Command - Clarification Needed

### Current Status

The project **already implements message revert functionality** via the `/messages` command:

- **Location:** `src/bot/commands/messages.ts`
- **API:** `opencodeClient.session.revert()`
- **Workflow:** Browse session messages → Select message → Click "Revert" button

```typescript
// From messages.ts (lines 358-378)
const revertMsgId = parseRevertCallback(data);
if (revertMsgId !== null) {
  const { data: revertResult, error } = await opencodeClient.session.revert({
    sessionID: metadata.sessionId,
    directory: metadata.directory,
    messageID: revertMsgId,
  });
  // ...
}
```

### Two Interpretations

#### Interpretation 1: Session Message Revert (Already Exists)

If you want to revert conversation history (undo agent messages), this is **already available**:

1. Use `/messages` command
2. Browse the message history
3. Click "Revert" button on any message
4. Session history is rolled back to that point

**No new implementation needed.**

#### Interpretation 2: Git Revert (New Feature)

If you want to revert code changes (git operations), this is a **new feature** related to:

- TODO item in PRODUCT.md: "Git tree support"
- Would require new command `/git` or `/revert` with git-specific functionality

**Proposed implementation for git revert:**

```typescript
// src/bot/commands/git.ts

export async function gitCommand(ctx: CommandContext<Context>) {
  const subcommand = (ctx.match as string)?.trim()?.split(" ")[0];

  switch (subcommand) {
    case "status":
      return gitStatus(ctx);
    case "diff":
      return gitDiff(ctx);
    case "revert":
      return gitRevert(ctx);
    case "log":
      return gitLog(ctx);
    default:
      await ctx.reply(`git <command>

Commands:
  status - Show working tree status
  diff   - Show changes
  revert - Undo changes
  log    - Show commit history`);
  }
}

async function gitRevert(ctx: CommandContext<Context>) {
  const args = (ctx.match as string)?.trim().split(" ").slice(1);

  if (args.length === 0) {
    // Interactive revert menu
    // Show recent changes with inline keyboard
    // User selects what to revert
  } else if (args[0] === "--hard") {
    // git reset --hard HEAD
  } else {
    // git revert <commit>
  }
}
```

---

## Clarification Questions

Please clarify which `revert` functionality you need:

1. **Session Message Revert** - Already implemented via `/messages` command
   - Reverts conversation history
   - Undo agent responses
   - Available now

2. **Git Revert** - New feature needed
   - Undo code changes (git restore)
   - Revert commits (git revert)
   - Related to "Git tree support" TODO
   - Would require separate `/git` command

---

## Summary

### Ready to Implement

- ✅ `/fe` File Explorer - Full architecture documented above
- ⏳ `/revert` - Awaiting clarification (session revert exists, git revert needs implementation)

### Implementation Order

1. Create `src/file-explorer/types.ts`
2. Create `src/file-explorer/manager.ts`
3. Create `src/file-explorer/parser.ts`
4. Create `src/bot/commands/fe.ts`
5. Add i18n keys to all locale files
6. Register command in `definitions.ts`
7. Add command handler in `bot/index.ts`
8. Write tests in `tests/bot/commands/fe.test.ts`
9. Run `npm run build && npm run lint && npm test`

### Estimated Effort

- File Explorer: ~4-6 hours (new feature, multiple files)
- Git Revert: ~2-3 hours (if needed, similar to `/shell` command)

---

## References

- Existing `/ls` command: `src/bot/commands/ls.ts`
- Existing `/read` command: `src/bot/commands/read.ts`
- Existing `/messages` command with revert: `src/bot/commands/messages.ts`
- Existing `/shell` command with safety checks: `src/bot/commands/shell.ts`
- Shell security utilities: `src/bot/utils/shell-security.ts`
- Interaction manager: `src/interaction/manager.ts`
