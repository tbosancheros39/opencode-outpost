import { logger } from "../utils/logger.js";

const MAX_FILES_PER_DIRECTORY = 20;
const DEFAULT_LIMIT = 10;

/**
 * Tools that work with files — their input contains path/filePath
 */
const FILE_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "apply_patch",
  "grep",
  "glob",
]);

/**
 * Tracks recently-accessed file paths per project directory.
 * Populated from SSE tool events and file-change callbacks.
 * Used by /pin to offer recently-worked-on files as tappable buttons.
 */
class RecentFilesTracker {
  private recentFiles: Map<string, string[]> = new Map();

  /**
   * Add a file path to the recent list for a directory.
   * Deduplicates (moves to front if already present) and enforces the max limit.
   */
  addFile(worktree: string, filePath: string): void {
    if (!worktree || !filePath) return;

    const normalized = filePath.replace(/\\/g, "/");
    const files = this.recentFiles.get(worktree) ?? [];

    // Deduplicate: remove existing entry
    const existingIndex = files.indexOf(normalized);
    if (existingIndex !== -1) {
      files.splice(existingIndex, 1);
    }

    // Add to front
    files.unshift(normalized);

    // Enforce limit
    if (files.length > MAX_FILES_PER_DIRECTORY) {
      files.length = MAX_FILES_PER_DIRECTORY;
    }

    this.recentFiles.set(worktree, files);
    logger.debug(`[RecentFiles] Added ${normalized} to ${worktree} (${files.length} files)`);
  }

  /**
   * Get recent files for a directory, up to `limit`.
   * Returns a shallow copy.
   */
  getRecentFiles(worktree: string, limit: number = DEFAULT_LIMIT): string[] {
    const files = this.recentFiles.get(worktree);
    if (!files) return [];
    return files.slice(0, limit);
  }

  /**
   * Clear recent files for a specific directory, or all directories.
   */
  clear(worktree?: string): void {
    if (worktree) {
      this.recentFiles.delete(worktree);
    } else {
      this.recentFiles.clear();
    }
  }

  /**
   * Extract a file path from a tool call's input.
   * Returns the path if found, null otherwise.
   */
  extractFilePath(tool: string, input?: { [key: string]: unknown }): string | null {
    if (!FILE_TOOLS.has(tool) || !input) return null;

    // Check common path fields
    const pathFields = ["filePath", "path", "file"];
    for (const field of pathFields) {
      const value = input[field];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }

    return null;
  }

  /**
   * Process a completed tool call and track file paths.
   * Call this from the tool callback in bot/index.ts.
   */
  processToolCall(
    worktree: string,
    tool: string,
    input?: { [key: string]: unknown },
  ): void {
    const filePath = this.extractFilePath(tool, input);
    if (filePath) {
      this.addFile(worktree, filePath);
    }
  }

  /**
   * Process a file change event and track the file path.
   * Call this from the file-change callback.
   */
  processFileChange(worktree: string, file: string): void {
    this.addFile(worktree, file);
  }

  /**
   * Reset all state (for testing).
   */
  reset(): void {
    this.recentFiles.clear();
  }
}

export const recentFilesTracker = new RecentFilesTracker();