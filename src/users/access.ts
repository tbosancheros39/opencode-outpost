import { config } from "../config.js";
import type { ProjectInfo } from "../settings/manager.js";

export interface UserProjectRestriction {
  projectPath: string;
  projectName: string;
  systemPrompt?: string;
  modelVariant?: string;
}

export function getUserProjectRestriction(_userId: number): UserProjectRestriction | undefined {
  return undefined;
}

export function filterProjectsForUser(_userId: number, projects: ProjectInfo[]): ProjectInfo[] {
  return projects;
}

export function createFallbackProjectInfo(_userId: number): ProjectInfo | undefined {
  return undefined;
}

export async function ensureUserProjectDirectory(_userId: number): Promise<void> {
  return;
}

export function getUserSystemPrompt(_userId: number): string | undefined {
  return undefined;
}

export function getUserModelVariant(_userId: number): string | undefined {
  return undefined;
}

export function isSimpleUser(userId: number): boolean {
  if (config.superUserIds.has(userId)) {
    return false;
  }
  return false;
}
