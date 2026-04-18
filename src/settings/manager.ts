import type { ModelInfo } from "../model/types.js";
import { cloneScheduledTask, type ScheduledTask } from "../scheduled-task/types.js";
import path from "node:path";
import { getRuntimePaths } from "../runtime/paths.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface ProjectInfo {
  id: string;
  worktree: string;
  name?: string;
}

export interface SessionInfo {
  id: string;
  title: string;
  directory: string;
}

export interface ServerProcessInfo {
  pid: number;
  startTime: string;
}

export interface SessionDirectoryCacheInfo {
  version: 1;
  lastSyncedUpdatedAt: number;
  directories: Array<{
    worktree: string;
    lastUpdated: number;
  }>;
}

export interface CostEntry {
  date: string;
  sessionId: string;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export interface Settings {
  currentProject?: ProjectInfo;
  currentSession?: SessionInfo;
  currentAgent?: string;
  currentModel?: ModelInfo;
  pinnedMessageId?: number;
  serverProcess?: ServerProcessInfo;
  sessionDirectoryCache?: SessionDirectoryCacheInfo;
  scheduledTasks?: ScheduledTask[];
  costHistory?: CostEntry[];
  projectSessions?: Record<string, string>;
  ttsEnabled?: boolean;
}

const DEFAULT_CHAT_ID = 0;

function cloneScheduledTasks(tasks: ScheduledTask[] | undefined): ScheduledTask[] | undefined {
  return tasks?.map((task) => cloneScheduledTask(task));
}

function getSettingsFilePath(): string {
  return getRuntimePaths().settingsFilePath;
}

async function readSettingsFile(): Promise<Settings> {
  try {
    const fs = await import("fs/promises");
    const content = await fs.readFile(getSettingsFilePath(), "utf-8");
    return JSON.parse(content) as Settings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error("[SettingsManager] Error reading settings file:", error);
    }
    return {};
  }
}

let settingsWriteQueue: Promise<void> = Promise.resolve();

function writeSettingsFile(settings: Settings): Promise<void> {
  settingsWriteQueue = settingsWriteQueue
    .catch(() => {
      // Keep write queue alive after failed writes.
    })
    .then(async () => {
      try {
        const fs = await import("fs/promises");
        const settingsFilePath = getSettingsFilePath();
        await fs.mkdir(path.dirname(settingsFilePath), { recursive: true });
        await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
      } catch (err) {
        logger.error("[SettingsManager] Error writing settings file:", err);
      }
    });

  return settingsWriteQueue;
}

const currentSettingsByChat: Map<number, Settings> = new Map();

function getSettings(chatId: number): Settings {
  let settings = currentSettingsByChat.get(chatId);
  if (!settings) {
    settings = {};
    currentSettingsByChat.set(chatId, settings);
  }
  return settings;
}

export function getCurrentProject(chatId: number): ProjectInfo | undefined {
  return getSettings(chatId).currentProject;
}

export function setCurrentProject(chatId: number, projectInfo: ProjectInfo): void {
  const settings = getSettings(chatId);
  settings.currentProject = projectInfo;
  void writeSettingsFile(settings);
}

export function clearProject(chatId: number): void {
  const settings = getSettings(chatId);
  settings.currentProject = undefined;
  void writeSettingsFile(settings);
}

export function getCurrentSession(chatId: number): SessionInfo | undefined {
  return getSettings(chatId).currentSession;
}

export function setCurrentSession(chatId: number, sessionInfo: SessionInfo): void {
  const settings = getSettings(chatId);
  settings.currentSession = sessionInfo;
  void writeSettingsFile(settings);
}

export function clearSession(chatId: number): void {
  const settings = getSettings(chatId);
  settings.currentSession = undefined;
  void writeSettingsFile(settings);
}

export function getCurrentAgent(chatId: number): string | undefined {
  return getSettings(chatId).currentAgent;
}

export function setCurrentAgent(chatId: number, agentName: string): void {
  const settings = getSettings(chatId);
  settings.currentAgent = agentName;
  void writeSettingsFile(settings);
}

export function clearCurrentAgent(chatId: number): void {
  const settings = getSettings(chatId);
  settings.currentAgent = undefined;
  void writeSettingsFile(settings);
}

export function getCurrentModel(chatId: number): ModelInfo | undefined {
  return getSettings(chatId).currentModel;
}

export function setCurrentModel(chatId: number, modelInfo: ModelInfo): void {
  const settings = getSettings(chatId);
  settings.currentModel = modelInfo;
  void writeSettingsFile(settings);
}

export function clearCurrentModel(chatId: number): void {
  const settings = getSettings(chatId);
  settings.currentModel = undefined;
  void writeSettingsFile(settings);
}

export function getPinnedMessageId(chatId: number): number | undefined {
  return getSettings(chatId).pinnedMessageId;
}

export function setPinnedMessageId(chatId: number, messageId: number): void {
  const settings = getSettings(chatId);
  settings.pinnedMessageId = messageId;
  void writeSettingsFile(settings);
}

export function clearPinnedMessageId(chatId: number): void {
  const settings = getSettings(chatId);
  settings.pinnedMessageId = undefined;
  void writeSettingsFile(settings);
}

export function getServerProcess(chatId: number): ServerProcessInfo | undefined {
  return getSettings(chatId).serverProcess;
}

export function setServerProcess(chatId: number, processInfo: ServerProcessInfo): void {
  const settings = getSettings(chatId);
  settings.serverProcess = processInfo;
  void writeSettingsFile(settings);
}

export function clearServerProcess(chatId: number): void {
  const settings = getSettings(chatId);
  settings.serverProcess = undefined;
  void writeSettingsFile(settings);
}

export function getSessionDirectoryCache(chatId: number): SessionDirectoryCacheInfo | undefined {
  return getSettings(chatId).sessionDirectoryCache;
}

export function setSessionDirectoryCache(
  chatId: number,
  cache: SessionDirectoryCacheInfo,
): Promise<void> {
  const settings = getSettings(chatId);
  settings.sessionDirectoryCache = cache;
  return writeSettingsFile(settings);
}

export function clearSessionDirectoryCache(chatId: number): void {
  const settings = getSettings(chatId);
  settings.sessionDirectoryCache = undefined;
  void writeSettingsFile(settings);
}

export function getScheduledTasks(chatId: number): ScheduledTask[] {
  return cloneScheduledTasks(getSettings(chatId).scheduledTasks) ?? [];
}

export function setScheduledTasks(chatId: number, tasks: ScheduledTask[]): Promise<void> {
  const settings = getSettings(chatId);
  settings.scheduledTasks = cloneScheduledTasks(tasks);
  return writeSettingsFile(settings);
}

export function getCostHistory(chatId: number): CostEntry[] {
  return getSettings(chatId).costHistory ?? [];
}

export function addCostEntry(chatId: number, entry: CostEntry): void {
  const settings = getSettings(chatId);
  if (!settings.costHistory) {
    settings.costHistory = [];
  }
  settings.costHistory.push(entry);

  // Keep only last 30 days of history
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  settings.costHistory = settings.costHistory.filter((e) => e.date >= thirtyDaysAgo);

  void writeSettingsFile(settings);
}

export function clearCostHistory(chatId: number): void {
  const settings = getSettings(chatId);
  settings.costHistory = undefined;
  void writeSettingsFile(settings);
}

export function setLastSessionForProject(projectPath: string, sessionId: string): void {
  const settings = getSettings(DEFAULT_CHAT_ID);
  if (!settings.projectSessions) {
    settings.projectSessions = {};
  }
  settings.projectSessions[projectPath] = sessionId;
  void writeSettingsFile(settings);
}

export function getLastSessionForProject(projectPath: string): string | null {
  return getSettings(DEFAULT_CHAT_ID).projectSessions?.[projectPath] ?? null;
}

// TTS Settings
const TTS_ENABLED_KEY = "ttsEnabled";

export function isTtsEnabled(chatId: number): boolean {
  const settings = getSettings(chatId);
  if (settings[TTS_ENABLED_KEY] !== undefined) {
    return settings[TTS_ENABLED_KEY] === true;
  }
  return config.tts.enabled;
}

export function setTtsEnabled(chatId: number, enabled: boolean): void {
  const settings = getSettings(chatId);
  settings[TTS_ENABLED_KEY] = enabled;
  void writeSettingsFile(settings);
  logger.info(`[Settings] TTS ${enabled ? "enabled" : "disabled"} for chat ${chatId}`);
}

export function __resetSettingsForTests(): void {
  currentSettingsByChat.clear();
  settingsWriteQueue = Promise.resolve();
}

export async function loadSettings(): Promise<void> {
  const loadedSettings = (await readSettingsFile()) as Settings & {
    toolMessagesIntervalSec?: unknown;
  };

  if ("toolMessagesIntervalSec" in loadedSettings) {
    delete loadedSettings.toolMessagesIntervalSec;
    void writeSettingsFile(loadedSettings);
  }

  currentSettingsByChat.set(DEFAULT_CHAT_ID, loadedSettings);
  currentSettingsByChat.get(DEFAULT_CHAT_ID)!.scheduledTasks =
    cloneScheduledTasks(loadedSettings.scheduledTasks) ?? [];
}
