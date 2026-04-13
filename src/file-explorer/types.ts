// src/file-explorer/types.ts

export interface FileExplorerItem {
  name: string;
  path: string;
  type: "directory" | "file" | "symlink" | "executable";
  size?: string;
  modified?: string;
  permissions?: string;
}

export interface FileExplorerPage {
  items: FileExplorerItem[];
  currentPath: string;
  parentPath: string | null;
  projectRoot: string;
  page: number;
  totalPages: number;
  totalItems: number;
}

export interface FileExplorerMetadata {
  flow: "file_explorer";
  stage: "browse" | "select";
  messageId: number;
  sessionId: string;
  currentPath: string;
  parentPath: string | null;
  projectRoot: string;
  items: FileExplorerItem[];
  page: number;
  totalItems: number;
}
