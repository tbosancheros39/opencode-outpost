// src/file-explorer/manager.ts

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
