import { ingestDocument, ingestDirectory } from "./ingest.js";
import { searchKnowledgeBase, getKnowledgeBaseStats } from "./search.js";
import { deleteAllDocuments } from "./store.js";

export const knowledgeBaseManager = {
  ingestDocument,
  ingestDirectory,
  search: searchKnowledgeBase,
  getStats: getKnowledgeBaseStats,
  reset: deleteAllDocuments,
} as const;
