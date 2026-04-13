import * as path from "path";
import { promises as fs } from "fs";
import { logger } from "../../utils/logger.js";

const DANGEROUS_SHELL_PATTERN = /&&|\|\||[;|`<>$]|\$\(|\$\{|\r|\n/;
const ALLOWED_PATH_PATTERN = /^[A-Za-z0-9._~\-/ ]+$/;

export function validateShellPathInput(input: string): string | null {
  const value = input.trim();

  if (!value) {
    return "Path cannot be empty.";
  }

  if (DANGEROUS_SHELL_PATTERN.test(value)) {
    return "Path contains dangerous shell characters.";
  }

  if (!ALLOWED_PATH_PATTERN.test(value)) {
    return "Path contains unsupported characters.";
  }

  return null;
}

export function quoteShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

/**
 * Validates and canonicalizes a path to ensure it stays within a base directory.
 * Prevents path traversal via ../ and symlink escapes.
 * 
 * @param userPath - User-provided path (relative or absolute)
 * @param basePath - Base directory the path must stay within
 * @returns Canonical absolute path if valid
 * @throws Error if path escapes basePath or is invalid
 */
export async function validateAndCanonicalizePath(
  userPath: string,
  basePath: string
): Promise<string> {
  if (!userPath || userPath.trim() === "") {
    throw new Error("Path cannot be empty");
  }

  // Check for null bytes (path injection)
  if (userPath.includes("\0")) {
    logger.warn(`[PathValidation] Null byte detected in path: ${userPath}`);
    throw new Error("Invalid path: contains null bytes");
  }

  // Resolve to absolute path
  const absoluteBase = path.resolve(basePath);
  const resolvedPath = path.resolve(basePath, userPath);

  // Follow symlinks to canonical path
  let canonicalPath: string;
  try {
    canonicalPath = await fs.realpath(resolvedPath);
  } catch {
    // If file doesn't exist, check parent and reconstruct
    const parentDir = path.dirname(resolvedPath);
    try {
      const canonicalParent = await fs.realpath(parentDir);
      const fileName = path.basename(resolvedPath);
      canonicalPath = path.join(canonicalParent, fileName);
    } catch {
      // Parent doesn't exist either - use resolved path but still validate
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

  logger.debug(`[PathValidation] Path validated: ${userPath} → ${canonicalPath}`);
  return canonicalPath;
}

