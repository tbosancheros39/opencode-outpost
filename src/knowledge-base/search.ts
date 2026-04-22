import { searchChunks, getDocumentCount, getChunkCount, getAllSourcePaths } from "./store.js";
import type { SearchOptions, SearchResult } from "./types.js";

export function searchKnowledgeBase(options: SearchOptions): SearchResult[] {
  const { query, limit = 5 } = options;

  if (!query || query.trim().length === 0) {
    return [];
  }

  return searchChunks(query.trim(), limit);
}

export function getKnowledgeBaseStats(): {
  documents: number;
  chunks: number;
  sources: string[];
} {
  return {
    documents: getDocumentCount(),
    chunks: getChunkCount(),
    sources: getAllSourcePaths(),
  };
}
