import { opencodeClient } from "../opencode/client.js";
import { getCurrentProject } from "../settings/manager.js";
import { getCurrentSession } from "../session/manager.js";
import { getCurrentAgent, setCurrentAgent } from "../settings/manager.js";
import { logger } from "../utils/logger.js";
import type { AgentInfo } from "./types.js";

export async function getAvailableAgents(chatId: number): Promise<AgentInfo[]> {
  try {
    const project = getCurrentProject(chatId);
    const { data: agents, error } = await opencodeClient.app.agents(
      project ? { directory: project.worktree } : undefined,
    );

    if (error) {
      logger.error("[AgentManager] Failed to fetch agents:", error);
      return [];
    }

    if (!agents) {
      return [];
    }

    const filtered = agents.filter(
      (agent) => !agent.hidden && (agent.mode === "primary" || agent.mode === "all"),
    );

    logger.debug(`[AgentManager] Fetched ${filtered.length} available agents`);
    return filtered;
  } catch (err) {
    logger.error("[AgentManager] Error fetching agents:", err);
    return [];
  }
}

const DEFAULT_AGENT = "build";

export async function fetchCurrentAgent(chatId: number): Promise<string> {
  const storedAgent = getCurrentAgent(chatId);
  const session = getCurrentSession(chatId);
  const project = getCurrentProject(chatId);

  if (!session || !project) {
    return storedAgent ?? DEFAULT_AGENT;
  }

  try {
    const { data: messages, error } = await opencodeClient.session.messages({
      sessionID: session.id,
      directory: project.worktree,
      limit: 1,
    });

    if (error || !messages || messages.length === 0) {
      logger.debug("[AgentManager] No messages found, using stored agent");
      return storedAgent ?? DEFAULT_AGENT;
    }

    const lastAgent = messages[0].info.agent;
    logger.debug(`[AgentManager] Current agent from session: ${lastAgent}`);

    if (storedAgent && lastAgent !== storedAgent) {
      logger.debug(
        `[AgentManager] Using stored agent "${storedAgent}" instead of session agent "${lastAgent}"`,
      );
      return storedAgent;
    }

    if (lastAgent && lastAgent !== storedAgent) {
      setCurrentAgent(chatId, lastAgent);
    }

    return lastAgent || storedAgent || DEFAULT_AGENT;
  } catch (err) {
    logger.error("[AgentManager] Error fetching current agent:", err);
    return storedAgent ?? DEFAULT_AGENT;
  }
}

export function selectAgent(chatId: number, agentName: string): void {
  logger.info(`[AgentManager] Selected agent: ${agentName}`);
  setCurrentAgent(chatId, agentName);
}

export function getStoredAgent(chatId: number): string {
  return getCurrentAgent(chatId) ?? "build";
}
