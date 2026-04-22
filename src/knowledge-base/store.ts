import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import { getRuntimePaths } from "../runtime/paths.js";
import type { KnowledgeBaseChunk, SearchResult } from "./types.js";

let db: Database.Database | null = null;

function getDbPath(): string {
  const { appHome } = getRuntimePaths();
  return path.join(appHome, ".data", "knowledge-base.db");
}

function ensureDataDir(): void {
  const { appHome } = getRuntimePaths();
  const dataDir = path.join(appHome, ".data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function getKbDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(getDbPath());
    db.pragma("journal_mode = WAL");
    initKbSchema();
  }
  return db;
}

function initKbSchema(): void {
  const dbInstance = db!;

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      source_path TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      total_chunks INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_source_path ON documents(source_path);
    CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);

    -- FTS5 virtual table for full-text search
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      content,
      title,
      source_path,
      content='documents',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS index in sync
    CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, content, title, source_path)
      VALUES (new.rowid, new.content, new.title, new.source_path);
    END;

    CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, content, title, source_path)
      VALUES ('delete', old.rowid, old.content, old.title, old.source_path);
    END;

    CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, content, title, source_path)
      VALUES ('delete', old.rowid, old.content, old.title, old.source_path);
      INSERT INTO documents_fts(rowid, content, title, source_path)
      VALUES (new.rowid, new.content, new.title, new.source_path);
    END;
  `);

  logger.info("[KnowledgeBase] Database schema initialized");
}

export function deleteAllDocuments(): void {
  const db = getKbDb();
  db.exec("DELETE FROM documents");
  logger.info("[KnowledgeBase] All documents deleted");
}

export function deleteDocumentsByPath(sourcePath: string): void {
  const db = getKbDb();
  const stmt = db.prepare("DELETE FROM documents WHERE source_path = ?");
  const result = stmt.run(sourcePath);
  logger.info(`[KnowledgeBase] Deleted ${result.changes} chunks for ${sourcePath}`);
}

export function insertChunk(chunk: KnowledgeBaseChunk, createdAt: string): void {
  const db = getKbDb();
  const stmt = db.prepare(`
    INSERT INTO documents (
      id, source_path, title, content, chunk_index, total_chunks,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    chunk.id,
    chunk.sourcePath,
    chunk.title,
    chunk.content,
    chunk.chunkIndex,
    chunk.totalChunks,
    createdAt,
    createdAt,
  );
}

export function getDocumentCount(): number {
  const db = getKbDb();
  const result = db.prepare("SELECT COUNT(DISTINCT source_path) as count FROM documents").get() as {
    count: number;
  };
  return result.count;
}

export function getChunkCount(): number {
  const db = getKbDb();
  const result = db.prepare("SELECT COUNT(*) as count FROM documents").get() as {
    count: number;
  };
  return result.count;
}

export function getAllSourcePaths(): string[] {
  const db = getKbDb();
  const rows = db.prepare("SELECT DISTINCT source_path FROM documents ORDER BY source_path").all() as Array<{
    source_path: string;
  }>;
  return rows.map((r) => r.source_path);
}

export function searchChunks(query: string, limit: number): SearchResult[] {
  const db = getKbDb();

  // Use FTS5 bm25 ranking with title boost
  const stmt = db.prepare(`
    SELECT
      d.id,
      d.id as document_id,
      d.source_path,
      d.title,
      d.content,
      d.chunk_index,
      d.total_chunks,
      rank
    FROM documents_fts
    JOIN documents d ON d.rowid = documents_fts.rowid
    WHERE documents_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  // Escape special FTS5 characters
  const escapedQuery = query
    .replace(/"/g, '""')
    .replace(/'/g, "''")
    .split(/\s+/)
    .map((term) => `"${term}"`)
    .join(" ");

  const rows = stmt.all(escapedQuery, limit) as Array<{
    id: string;
    document_id: string;
    source_path: string;
    title: string;
    content: string;
    chunk_index: number;
    total_chunks: number;
    rank: number;
  }>;

  return rows.map((row) => ({
    chunk: {
      id: row.id,
      documentId: row.document_id,
      sourcePath: row.source_path,
      title: row.title,
      content: row.content,
      chunkIndex: row.chunk_index,
      totalChunks: row.total_chunks,
    },
    rank: row.rank,
    snippet: generateSnippet(row.content, query),
  }));
}

function generateSnippet(content: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) {
    return content.slice(0, 200);
  }

  const lowerContent = content.toLowerCase();
  let bestIndex = 0;
  let bestScore = -1;

  // Sliding window to find best snippet
  const windowSize = 240;
  for (let i = 0; i <= lowerContent.length - windowSize; i += 60) {
    const window = lowerContent.slice(i, i + windowSize);
    const score = terms.filter((term) => window.includes(term)).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  let snippet = content.slice(bestIndex, bestIndex + windowSize);
  if (bestIndex > 0) snippet = "..." + snippet;
  if (bestIndex + windowSize < content.length) snippet = snippet + "...";

  return snippet;
}

export function __resetKbForTests(): void {
  if (db) {
    db.exec("DELETE FROM documents");
    db.close();
    db = null;
  }
}
