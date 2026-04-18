import { parseMarkdown } from "./parser.js";
import { transformNode } from "./transformer.js";
import { chunkOutput } from "./chunker.js";

export interface RenderedMessage {
  text: string;
  parseMode: "MarkdownV2" | "text";
}

export function renderMarkdown(input: string): RenderedMessage[] {
  if (!input || input.trim() === "") {
    return [{ text: "(no output)", parseMode: "text" }];
  }

  try {
    const ast = parseMarkdown(input);
    const rendered = ast.children.map(transformNode).join("");
    const chunks = chunkOutput(rendered.trim());
    return chunks.map((text) => ({
      text,
      parseMode: "MarkdownV2" as const,
    }));
  } catch {
    return chunkOutput(input.trim()).map((text) => ({
      text,
      parseMode: "text" as const,
    }));
  }
}

export { escapeMd, escapeCode } from "./escape.js";
export { parseMarkdown } from "./parser.js";
export { renderCodeBlock, renderInlineCode } from "./code-block.js";
export { transformNode, transformChildren } from "./transformer.js";
export { chunkOutput } from "./chunker.js";
