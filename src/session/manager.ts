import {
  getCurrentSession as getSettingsSession,
  setCurrentSession as setSettingsSession,
  clearSession as clearSettingsSession,
  getCurrentProject,
  setLastSessionForProject,
  getLastSessionForProject,
  SessionInfo,
} from "../settings/manager.js";
import { opencodeClient } from "../opencode/client.js";
import { logger } from "../utils/logger.js";

export type { SessionInfo };

export function setCurrentSession(chatId: number, sessionInfo: SessionInfo): void {
  setSettingsSession(chatId, sessionInfo);
  setLastSessionForProject(sessionInfo.directory, sessionInfo.id);
}

export function getCurrentSession(chatId: number): SessionInfo | null {
  return getSettingsSession(chatId) ?? null;
}

export function clearSession(chatId: number): void {
  clearSettingsSession(chatId);
}

export async function autoResumeLastSession(chatId: number): Promise<void> {
  const currentProject = getCurrentProject(chatId);
  if (!currentProject) return;

  const lastSessionId = getLastSessionForProject(currentProject.worktree);
  if (!lastSessionId) return;

  try {
    const { data: session, error } = await opencodeClient.session.get({
      sessionID: lastSessionId,
      directory: currentProject.worktree,
    });
    if (error || !session) {
      logger.info(`[Session] Previous session ${lastSessionId} no longer exists, skipping`);
      return;
    }
    setSettingsSession(chatId, {
      id: session.id,
      title: session.title,
      directory: currentProject.worktree,
    });
    logger.info(`[Session] Auto-resumed session ${lastSessionId}`);
  } catch {
    logger.info(`[Session] Previous session ${lastSessionId} no longer exists, skipping`);
  }
}
