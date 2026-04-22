import { knowledgeBaseManager } from "../knowledge-base/manager.js";

function writeStdout(message: string): void {
  process.stdout.write(`${message}\n`);
}

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`);
}

function printKbUsage(): void {
  writeStdout(`Knowledge Base CLI

Usage: opencode-outpost kb <subcommand> [options]

Subcommands:
  ingest <path>       Ingest a file or directory into the knowledge base
  search <query>      Search the knowledge base
  list                List all ingested documents
  reset               Delete all documents from the knowledge base

Examples:
  opencode-outpost kb ingest README.md
  opencode-outpost kb ingest docs/
  opencode-outpost kb search "session management"
  opencode-outpost kb list
  opencode-outpost kb reset
`);
}

async function runIngest(args: string[]): Promise<number> {
  const target = args[0];
  if (!target) {
    writeStderr("Error: Please provide a file or directory path to ingest.");
    return 1;
  }

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const absolutePath = path.resolve(target);

  let stats;
  try {
    stats = await fs.stat(absolutePath);
  } catch {
    writeStderr(`Error: Path not found: ${target}`);
    return 1;
  }

  if (stats.isFile()) {
    const chunks = await knowledgeBaseManager.ingestDocument({ sourcePath: target });
    writeStdout(`✅ Ingested file: ${target} (${chunks} chunks)`);
  } else if (stats.isDirectory()) {
    writeStdout(`📁 Ingesting directory: ${target}...`);
    const results = await knowledgeBaseManager.ingestDirectory(target);
    const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);
    writeStdout(`✅ Ingested ${results.length} files (${totalChunks} chunks):`);
    for (const result of results) {
      writeStdout(`  - ${result.path} (${result.chunks} chunks)`);
    }
  } else {
    writeStderr("Error: Path is neither a file nor a directory.");
    return 1;
  }

  return 0;
}

async function runSearch(args: string[]): Promise<number> {
  const query = args.join(" ");
  if (!query) {
    writeStderr("Error: Please provide a search query.");
    return 1;
  }

  writeStdout(`🔍 Searching for: "${query}"...\n`);
  const results = knowledgeBaseManager.search({ query, limit: 10 });

  if (results.length === 0) {
    writeStdout("No results found.");
    return 0;
  }

  writeStdout(`Found ${results.length} result(s):\n`);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    writeStdout(`\n--- Result ${i + 1} ---`);
    writeStdout(`Source: ${result.chunk.sourcePath}`);
    writeStdout(`Title: ${result.chunk.title}`);
    writeStdout(`Chunk: ${result.chunk.chunkIndex + 1}/${result.chunk.totalChunks}`);
    writeStdout(`Rank: ${result.rank.toFixed(4)}`);
    writeStdout(`Snippet: ${result.snippet}`);
  }

  return 0;
}

async function runList(): Promise<number> {
  const stats = knowledgeBaseManager.getStats();

  writeStdout(`Knowledge Base Stats`);
  writeStdout(`====================`);
  writeStdout(`Documents: ${stats.documents}`);
  writeStdout(`Chunks: ${stats.chunks}`);

  if (stats.sources.length > 0) {
    writeStdout(`\nSources:`);
    for (const source of stats.sources) {
      writeStdout(`  - ${source}`);
    }
  }

  return 0;
}

async function runReset(): Promise<number> {
  knowledgeBaseManager.reset();
  writeStdout("✅ Knowledge base reset. All documents deleted.");
  return 0;
}

export async function runKbCommand(args: string[]): Promise<number> {
  const subcommand = args[0];

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printKbUsage();
    return 0;
  }

  const remainingArgs = args.slice(1);

  switch (subcommand) {
    case "ingest":
      return runIngest(remainingArgs);
    case "search":
      return runSearch(remainingArgs);
    case "list":
      return runList();
    case "reset":
      return runReset();
    default:
      writeStderr(`Unknown subcommand: ${subcommand}`);
      printKbUsage();
      return 1;
  }
}
