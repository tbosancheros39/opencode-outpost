/**
 * Path validation and canonicalization for filesystem operations.
 * Prevents path traversal attacks via .. sequences and symlink escapes.
 */

import * as path from "path";
import { promises as fs } from "fs";
import { logger } from "../utils/logger.js";

/**
 * Validates and canonicalizes a file path to ensure it stays within allowed boundaries.
 * 
 * @param userPath - User-provided path (relative or absolute)
 * @param basePath - Base directory that the resolved path must stay within
 * @returns Canonical absolute path if valid
 * @throws Error if path escapes basePath or contains suspicious patterns
 */
export async function validatePath(userPath: string, basePath: string): Promise<string> {
  if (!userPath || userPath.trim() === "") {
    throw new Error("Path cannot be empty");
  }

  // Resolve to absolute path and follow symlinks
  const absoluteBase = path.resolve(basePath);
  const resolvedPath = path.resolve(basePath, userPath);

  // Check for null bytes (path injection attempt)
  if (userPath.includes("\0")) {
    logger.warn(`[PathValidation] Null byte detected in path: ${userPath}`);
    throw new Error("Invalid path: contains null bytes");
  }

  // Follow symlinks to canonical path
  let canonicalPath: string;
  try {
    canonicalPath = await fs.realpath(resolvedPath);
  } catch {
    // If file doesn't exist yet, check parent directory
    const parentDir = path.dirname(resolvedPath);
    try {
      const canonicalParent = await fs.realpath(parentDir);
      const fileName = path.basename(resolvedPath);
      canonicalPath = path.join(canonicalParent, fileName);
    } catch {
      // Parent doesn't exist either - use resolved path but still validate prefix
      canonicalPath = resolvedPath;
    }
  }

  // Ensure canonical path is within base directory
  if (!canonicalPath.startsWith(absoluteBase + path.sep) && canonicalPath !== absoluteBase) {
    logger.warn(
      `[PathValidation] Path escape attempt: userPath=${userPath}, canonicalPath=${canonicalPath}, basePath=${absoluteBase}`
    );
    throw new Error(
      `Path traversal detected: "${userPath}" resolves outside allowed directory`
    );
  }

  logger.debug(`[PathValidation] Path OK: ${userPath} → ${canonicalPath}`);
  return canonicalPath;
}

/**
 * Validates a path for reading without canonicalizing (for cases where the file must exist).
 * 
 * @param userPath - User-provided path
 * @param basePath - Base directory
 * @returns Canonical absolute path if valid and exists
 * @throws Error if path is invalid, escapes basePath, or doesn't exist
 */
export async function validateReadPath(userPath: string, basePath: string): Promise<string> {
  const canonicalPath = await validatePath(userPath, basePath);

  // Verify file exists
  try {
    await fs.access(canonicalPath);
  } catch {
    throw new Error(`File not found: ${userPath}`);
  }

  return canonicalPath;
}
