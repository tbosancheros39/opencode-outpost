export interface KnowledgeBaseDocument {
  id: string;
  sourcePath: string;
  title: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseChunk {
  id: string;
  documentId: string;
  sourcePath: string;
  title: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface SearchResult {
  chunk: KnowledgeBaseChunk;
  rank: number;
  snippet: string;
}

export interface IngestOptions {
  sourcePath: string;
  title?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface SearchOptions {
  query: string;
  limit?: number;
}
