import { InlineKeyboard } from "grammy";
import { t } from "../../i18n/index.js";

const MAX_BUTTON_TEXT_LENGTH = 40;

/**
 * Make a relative path from an absolute path using the worktree.
 */
export function makeRelativePath(filePath: string, worktree: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const normalizedWorktree = worktree.replace(/\\/g, "/").replace(/\/+$/, "");

  if (!normalizedWorktree) return normalized;

  const prefix = `${normalizedWorktree}/`;
  if (normalized.startsWith(prefix)) {
    return normalized.slice(prefix.length);
  }

  if (normalized === normalizedWorktree) return ".";

  return normalized;
}

/**
 * Make a short label for a button from a file path.
 * Shows just the filename, or a shortened path if ambiguous.
 */
function makeShortLabel(filePath: string, worktree: string): string {
  const relative = makeRelativePath(filePath, worktree);
  const parts = relative.split("/");

  // If the path is short enough, use it as-is
  if (relative.length <= MAX_BUTTON_TEXT_LENGTH) {
    return relative;
  }

  // Otherwise, use just the filename
  return parts[parts.length - 1] || relative;
}

/**
 * Build the inline keyboard for the pin menu.
 */
export function buildPinKeyboard(
  recentFiles: string[],
  pinnedFiles: string[],
  worktree: string,
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  // Recent files section — tap to pin
  if (recentFiles.length > 0) {
    for (let i = 0; i < recentFiles.length; i++) {
      const label = makeShortLabel(recentFiles[i], worktree);
      keyboard.text(`📄 ${label}`, `pin:r:${i}`);
      // Two buttons per row
      if (i % 2 === 0 && i < recentFiles.length - 1) {
        // Will be paired with next button
      } else {
        keyboard.row();
      }
    }
  }

  // Pinned files section — tap to unpin
  if (pinnedFiles.length > 0) {
    for (let i = 0; i < pinnedFiles.length; i++) {
      const label = makeShortLabel(pinnedFiles[i], worktree);
      keyboard.text(`📌 ${label}`, `pin:u:${i}`);
      if (i % 2 === 0 && i < pinnedFiles.length - 1) {
        // Will be paired with next button
      } else {
        keyboard.row();
      }
    }
  }

  // Bottom row: clear all + refresh
  if (pinnedFiles.length > 0) {
    keyboard.text(t("cmd.pin.button_clear_all"), "pin:clear").row();
  }

  keyboard.text(t("cmd.pin.button_refresh"), "pin:refresh");

  return keyboard;
}

/**
 * Build the message text for the pin menu.
 */
export function buildPinMenuText(
  recentFiles: string[],
  pinnedFiles: string[],
  worktree: string,
): string {
  const lines: string[] = [];

  lines.push(t("cmd.pin.menu_title"));
  lines.push("");

  if (recentFiles.length > 0) {
    lines.push(t("cmd.pin.recent_header"));
    lines.push("");
    for (let i = 0; i < recentFiles.length; i++) {
      const relative = makeRelativePath(recentFiles[i], worktree);
      lines.push(`${i + 1}. ${relative}`);
    }
    lines.push("");
  }

  if (pinnedFiles.length > 0) {
    lines.push(t("cmd.pin.pinned_header"));
    lines.push("");
    for (let i = 0; i < pinnedFiles.length; i++) {
      const relative = makeRelativePath(pinnedFiles[i], worktree);
      lines.push(`${i + 1}. ${relative}`);
    }
    lines.push("");
  }

  if (recentFiles.length === 0 && pinnedFiles.length === 0) {
    lines.push(t("cmd.pin.no_files"));
  }

  return lines.join("\n");
}
