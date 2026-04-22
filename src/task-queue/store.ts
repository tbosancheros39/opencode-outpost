import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import { getRuntimePaths } from "../runtime/paths.js";
import type { QueuedTask, TaskCreationOptions, TaskUpdateOptions, TaskStatus } from "./types.js";

let db: Database.Database | null = null;

function getDbPath(): string {
  const { appHome } = getRuntimePaths();
  return path.join(appHome, ".data", "tasks.db");
}

function ensureDataDir(): void {
  const { appHome } = getRuntimePaths();
  const dataDir = path.join(appHome, ".data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    initSchema();
  }
  return db;
}

function initSchema(): void {
  const dbInstance = db!;
  
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      chat_id INTEGER NOT NULL,
      prompt_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      result_text TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      session_id TEXT NOT NULL,
      directory TEXT NOT NULL,
      notification_message_id INTEGER,
      agent TEXT NOT NULL,
      model_provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      variant TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

    CREATE TABLE IF NOT EXISTS session_snapshots (
      id TEXT PRIMARY KEY,
      chat_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      session_title TEXT NOT NULL,
      directory TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_session_id ON session_snapshots(session_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_chat_id ON session_snapshots(chat_id);
  `);

  logger.info("[TaskQueue] Database schema initialized");
}

export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createTask(options: TaskCreationOptions): QueuedTask {
  const db = getDb();
  const id = generateTaskId();
  const now = new Date().toISOString();
  
  const task: QueuedTask = {
    id,
    userId: options.userId,
    chatId: options.chatId,
    promptText: options.promptText,
    status: "queued",
    resultText: null,
    errorMessage: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    sessionId: options.sessionId,
    directory: options.directory,
    notificationMessageId: options.notificationMessageId,
    agent: options.agent,
    modelProvider: options.modelProvider,
    modelId: options.modelId,
    variant: options.variant,
  };
  
  const stmt = db.prepare(`
    INSERT INTO tasks (
      id, user_id, chat_id, prompt_text, status, result_text, error_message,
      created_at, started_at, finished_at, session_id, directory, 
      notification_message_id, agent, model_provider, model_id, variant
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    task.id,
    task.userId,
    task.chatId,
    task.promptText,
    task.status,
    task.resultText,
    task.errorMessage,
    task.createdAt,
    task.startedAt,
    task.finishedAt,
    task.sessionId,
    task.directory,
    task.notificationMessageId,
    task.agent,
    task.modelProvider,
    task.modelId,
    task.variant
  );
  
  logger.info(`[TaskQueue] Created task ${id} for user ${options.userId}`);
  return task;
}

export function updateTask(taskId: string, updates: TaskUpdateOptions): QueuedTask | null {
  const db = getDb();
  
  const sets: string[] = [];
  const values: (string | null)[] = [];
  
  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.resultText !== undefined) {
    sets.push("result_text = ?");
    values.push(updates.resultText);
  }
  if (updates.errorMessage !== undefined) {
    sets.push("error_message = ?");
    values.push(updates.errorMessage);
  }
  if (updates.startedAt !== undefined) {
    sets.push("started_at = ?");
    values.push(updates.startedAt);
  }
  if (updates.finishedAt !== undefined) {
    sets.push("finished_at = ?");
    values.push(updates.finishedAt);
  }
  
  if (sets.length === 0) {
    return getTask(taskId);
  }
  
  values.push(taskId);
  
  const stmt = db.prepare(`
    UPDATE tasks SET ${sets.join(", ")} WHERE id = ?
  `);
  
  const result = stmt.run(...values);
  
  if (result.changes === 0) {
    return null;
  }
  
  logger.debug(`[TaskQueue] Updated task ${taskId}: ${sets.join(", ")}`);
  return getTask(taskId);
}

export function getTask(taskId: string): QueuedTask | null {
  const db = getDb();
  
  const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
  const row = stmt.get(taskId) as Record<string, unknown> | undefined;
  
  if (!row) {
    return null;
  }
  
  return rowToTask(row);
}

export function getPendingTasks(limit: number = 10): QueuedTask[] {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE status = 'queued' 
    ORDER BY created_at ASC 
    LIMIT ?
  `);
  
  const rows = stmt.all(limit) as Record<string, unknown>[];
  return rows.map(rowToTask);
}

export function getTasksByUser(userId: number, limit: number = 20): QueuedTask[] {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  
  const rows = stmt.all(userId, limit) as Record<string, unknown>[];
  return rows.map(rowToTask);
}

export function getRunningTasks(): QueuedTask[] {
  const db = getDb();
  
  const stmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE status = 'running'
  `);
  
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(rowToTask);
}

export function deleteOldTasks(olderThanDays: number = 7): number {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  const stmt = db.prepare(`
    DELETE FROM tasks 
    WHERE created_at < ? 
    AND status IN ('completed', 'error')
  `);
  
  const result = stmt.run(cutoffDate.toISOString());
  logger.info(`[TaskQueue] Deleted ${result.changes} old tasks`);
  return result.changes;
}

function rowToTask(row: Record<string, unknown>): QueuedTask {
  return {
    id: row.id as string,
    userId: row.user_id as number,
    chatId: row.chat_id as number,
    promptText: row.prompt_text as string,
    status: row.status as TaskStatus,
    resultText: row.result_text as string | null,
    errorMessage: row.error_message as string | null,
    createdAt: row.created_at as string,
    startedAt: row.started_at as string | null,
    finishedAt: row.finished_at as string | null,
    sessionId: row.session_id as string,
    directory: row.directory as string,
    notificationMessageId: row.notification_message_id as number | null,
    agent: row.agent as string,
    modelProvider: row.model_provider as string,
    modelId: row.model_id as string,
    variant: row.variant as string | null,
  };
}

// === Session Snapshot Operations ===

export interface SessionSnapshot {
  id: string;
  chatId: number;
  sessionId: string;
  sessionTitle: string;
  directory: string;
  name: string;
  createdAt: string;
}

export interface SnapshotCreationOptions {
  chatId: number;
  sessionId: string;
  sessionTitle: string;
  directory: string;
  name: string;
}

function generateSnapshotId(): string {
  return `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function rowToSnapshot(row: Record<string, unknown>): SessionSnapshot {
  return {
    id: row.id as string,
    chatId: row.chat_id as number,
    sessionId: row.session_id as string,
    sessionTitle: row.session_title as string,
    directory: row.directory as string,
    name: row.name as string,
    createdAt: row.created_at as string,
  };
}

export function createSnapshot(options: SnapshotCreationOptions): SessionSnapshot {
  const db = getDb();
  const id = generateSnapshotId();
  const now = new Date().toISOString();

  const snapshot: SessionSnapshot = {
    id,
    chatId: options.chatId,
    sessionId: options.sessionId,
    sessionTitle: options.sessionTitle,
    directory: options.directory,
    name: options.name,
    createdAt: now,
  };

  const stmt = db.prepare(`
    INSERT INTO session_snapshots (
      id, chat_id, session_id, session_title, directory, name, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    snapshot.id,
    snapshot.chatId,
    snapshot.sessionId,
    snapshot.sessionTitle,
    snapshot.directory,
    snapshot.name,
    snapshot.createdAt,
  );

  logger.info(`[TaskQueue] Created snapshot ${id} for session ${options.sessionId}`);
  return snapshot;
}

export function getSnapshot(snapshotId: string): SessionSnapshot | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM session_snapshots WHERE id = ?");
  const row = stmt.get(snapshotId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }
  return rowToSnapshot(row);
}

export function listSnapshots(sessionId?: string): SessionSnapshot[] {
  const db = getDb();
  if (sessionId) {
    const stmt = db.prepare(`
      SELECT * FROM session_snapshots
      WHERE session_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(sessionId) as Record<string, unknown>[];
    return rows.map(rowToSnapshot);
  }
  const stmt = db.prepare(`
    SELECT * FROM session_snapshots
    ORDER BY created_at DESC
  `);
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(rowToSnapshot);
}

export function deleteSnapshot(snapshotId: string): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM session_snapshots WHERE id = ?");
  const result = stmt.run(snapshotId);
  if (result.changes > 0) {
    logger.info(`[TaskQueue] Deleted snapshot ${snapshotId}`);
    return true;
  }
  return false;
}

export function deleteOldSnapshots(olderThanDays: number = 30): number {
  const db = getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const stmt = db.prepare(`
    DELETE FROM session_snapshots
    WHERE created_at < ?
  `);
  const result = stmt.run(cutoffDate.toISOString());
  logger.info(`[TaskQueue] Deleted ${result.changes} old snapshots`);
  return result.changes;
}

export function closeTaskDb(): void {
  if (db) {
    db.close();
    db = null;
    logger.info("[TaskQueue] Database connection closed");
  }
}
