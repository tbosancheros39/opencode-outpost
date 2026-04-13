import { mkdir } from "node:fs/promises";
import { logger } from "../utils/logger.js";
import type { ProjectInfo } from "../settings/manager.js";
import { SUPER_USER_IDS } from "../constants.js";

export interface UserProjectRestriction {
  projectPath: string;
  projectName: string;
  /** Custom system prompt injected into every message for this user. */
  systemPrompt?: string;
  /** Model variant to auto-apply for this user (e.g. "high" for high temperature). */
  modelVariant?: string;
}

/**
 * Maps Telegram user IDs to their dedicated project restriction.
 * Users listed here can only see and interact with their assigned project.
 * Super users (in SUPER_USER_IDS) are NOT listed here - they have full access.
 *
 * NOTE: User 7917752417 (Fatima) was previously listed here but has been
 * moved to SUPER_USER_IDS for full access. Do NOT re-add super users here.
 */
export const USER_PROJECT_RESTRICTIONS = new Map<number, UserProjectRestriction>([
  [
    5359512671,
    {
      projectPath: "/tmp/opencode-user-5359512671",
      projectName: "User 5359512671",
    },
  ],
]);

export function getUserProjectRestriction(userId: number): UserProjectRestriction | undefined {
  return USER_PROJECT_RESTRICTIONS.get(userId);
}

export function filterProjectsForUser(userId: number, projects: ProjectInfo[]): ProjectInfo[] {
  const restriction = getUserProjectRestriction(userId);
  if (!restriction) {
    return projects;
  }

  const normalizedRestricted = restriction.projectPath.toLowerCase().replace(/[\\/]+$/g, "");

  return projects.filter(
    (p) => p.worktree.toLowerCase().replace(/[\\/]+$/g, "") === normalizedRestricted,
  );
}

/**
 * Returns a fallback ProjectInfo for a restricted user when their project
 * is not yet listed in OpenCode (e.g. first time before any session has been run).
 */
export function createFallbackProjectInfo(userId: number): ProjectInfo | undefined {
  const restriction = getUserProjectRestriction(userId);
  if (!restriction) return undefined;

  return {
    id: `user-${userId}-dedicated`,
    worktree: restriction.projectPath,
    name: restriction.projectName,
  };
}

/**
 * Ensures the dedicated project directory for a restricted user exists on disk.
 */
export async function ensureUserProjectDirectory(userId: number): Promise<void> {
  const restriction = getUserProjectRestriction(userId);
  if (!restriction) return;

  try {
    await mkdir(restriction.projectPath, { recursive: true });
    logger.info(`[UserAccess] Ensured project directory exists: ${restriction.projectPath}`);
  } catch (err) {
    logger.error(
      `[UserAccess] Failed to create project directory: ${restriction.projectPath}`,
      err,
    );
  }
}

/** Returns the custom system prompt for a restricted user, if defined. */
export function getUserSystemPrompt(userId: number): string | undefined {
  return USER_PROJECT_RESTRICTIONS.get(userId)?.systemPrompt;
}

/** Returns the preferred model variant for a restricted user, if defined. */
export function getUserModelVariant(userId: number): string | undefined {
  return USER_PROJECT_RESTRICTIONS.get(userId)?.modelVariant;
}

/**
 * Returns true when a user should receive a simplified chat-only interface.
 * Super users always get full interface regardless of project restrictions.
 */
export function isSimpleUser(userId: number): boolean {
  if (SUPER_USER_IDS.has(userId)) {
    return false; // Super users always get full interface
  }
  return USER_PROJECT_RESTRICTIONS.has(userId);
}
