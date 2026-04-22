import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";
import { insertChunk, deleteDocumentsByPath } from "./store.js";
import type { IngestOptions, KnowledgeBaseChunk } from "./types.js";

const DEFAULT_CHUNK_SIZE = 1500;
const DEFAULT_CHUNK_OVERLAP = 200;

export async function ingestDocument(options: IngestOptions): Promise<number> {
  const {
    sourcePath,
    title: explicitTitle,
    chunkSize = DEFAULT_CHUNK_SIZE,
    chunkOverlap = DEFAULT_CHUNK_OVERLAP,
  } = options;

  const absolutePath = path.resolve(sourcePath);
  const content = await fs.readFile(absolutePath, "utf-8");

  // Use filename as title if not provided
  const title = explicitTitle || path.basename(sourcePath);

  // Delete existing document with same path
  deleteDocumentsByPath(sourcePath);

  // Chunk the content
  const chunks = createChunks(content, chunkSize, chunkOverlap);
  const now = new Date().toISOString();
  const documentId = randomUUID();

  for (let i = 0; i < chunks.length; i++) {
    const chunk: KnowledgeBaseChunk = {
      id: `${documentId}_${i}`,
      documentId,
      sourcePath,
      title,
      content: chunks[i],
      chunkIndex: i,
      totalChunks: chunks.length,
    };

    insertChunk(chunk, now);
  }

  logger.info(`[KnowledgeBase] Ingested ${chunks.length} chunks from ${sourcePath}`);
  return chunks.length;
}

export async function ingestDirectory(
  dirPath: string,
  pattern: RegExp = /\.(md|txt|mdx)$/i,
): Promise<{ path: string; chunks: number }[]> {
  const absoluteDir = path.resolve(dirPath);
  const entries = await fs.readdir(absoluteDir, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(entry.parentPath || absoluteDir, entry.name));

  const results: { path: string; chunks: number }[] = [];

  for (const filePath of files) {
    try {
      const relativePath = path.relative(process.cwd(), filePath);
      const chunks = await ingestDocument({ sourcePath: relativePath });
      results.push({ path: relativePath, chunks });
    } catch (error) {
      logger.error(`[KnowledgeBase] Failed to ingest ${filePath}:`, error);
    }
  }

  return results;
}

function createChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const chunks: string[] = [];

  if (text.length <= chunkSize) {
    return [text];
  }

  // Try to split on paragraph boundaries first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= chunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If paragraph itself is too long, split on sentences
      if (paragraph.length > chunkSize) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        currentChunk = "";
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= chunkSize) {
            currentChunk += (currentChunk ? " " : "") + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            // If sentence is still too long, force split
            if (sentence.length > chunkSize) {
              for (let i = 0; i < sentence.length; i += chunkSize - chunkOverlap) {
                chunks.push(sentence.slice(i, i + chunkSize));
              }
              currentChunk = "";
            } else {
              currentChunk = sentence;
            }
          }
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
