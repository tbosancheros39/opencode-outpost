import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../../src/telegram/render/index.js";

describe("telegram/render/render-pipeline", () => {
  it("renders plain text correctly", () => {
    const result = renderMarkdown("hello world");
    expect(result).toHaveLength(1);
    expect(result[0].parseMode).toBe("MarkdownV2");
    expect(result[0].text).toContain("hello");
    expect(result[0].text).toContain("world");
  });

  it("renders bold text with *...*", () => {
    const result = renderMarkdown("**bold**");
    expect(result).toHaveLength(1);
    expect(result[0].parseMode).toBe("MarkdownV2");
    expect(result[0].text).toContain("*bold*");
  });

  it("renders italic text with _..._", () => {
    const result = renderMarkdown("*italic*");
    expect(result).toHaveLength(1);
    expect(result[0].parseMode).toBe("MarkdownV2");
    expect(result[0].text).toContain("_italic_");
  });

  it("renders code block with backticks inside (triple backticks replaced)", () => {
    const md = '```js\nconst md = "```";\n```';
    const result = renderMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].parseMode).toBe("MarkdownV2");
    expect(result[0].text).toContain("'''");
    expect(result[0].text).not.toMatch(/const md = "```"/);
  });

  it("renders table input without GFM (falls back to escaped text)", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const result = renderMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].parseMode).toBe("MarkdownV2");
  });

  it("renders mixed formatting (bold + code + link)", () => {
    const md = "Use **this** `code` [link](https://example.com)";
    const result = renderMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].parseMode).toBe("MarkdownV2");
    const text = result[0].text;
    expect(text).toContain("*this*");
    expect(text).toContain("`code`");
    // URL gets MarkdownV2-escaped — . becomes \\.
    expect(text).toContain("[link](https://example\\.com)");
  });

  it("chunks overlong input", () => {
    const lines = Array.from({ length: 300 }, (_, i) => `Line ${i + 1}: some content here`);
    const md = lines.join("\n");
    const result = renderMarkdown(md);
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.parseMode).toBe("MarkdownV2");
    }
  });

  it("returns (no output) for empty input", () => {
    const result = renderMarkdown("");
    expect(result).toEqual([{ text: "(no output)", parseMode: "text" }]);
  });

  it("returns (no output) for whitespace-only input", () => {
    const result = renderMarkdown("   \n  \t  ");
    expect(result).toEqual([{ text: "(no output)", parseMode: "text" }]);
  });

  it("renders realistic agent output: code review with code blocks, bold, and lists", () => {
    const md = [
      "## Code Review",
      "",
      "I found **2 issues** in your code:",
      "",
      "1. Missing error handling in `fetchData`",
      "2. The loop is inefficient",
      "",
      "Here's the fix:",
      "",
      "```ts",
      "try {",
      "  const data = await fetchData();",
      "} catch (e) {",
      "  console.error(e);",
      "}",
      "```",
      "",
      "Also see [docs](https://example.com).",
    ].join("\n");

    const result = renderMarkdown(md);
    expect(result).toHaveLength(1);
    expect(result[0].parseMode).toBe("MarkdownV2");
    const text = result[0].text;
    expect(text).toContain("*Code Review*");
    expect(text).toContain("*2 issues*");
    expect(text).toContain("`fetchData`");
    expect(text).toContain("```ts");
    // URL gets MarkdownV2-escaped — . becomes \\.
    expect(text).toContain("[docs](https://example\\.com)");
  });

  it("renders strikethrough syntax as Telegram strikethrough with GFM plugin", () => {
    const result = renderMarkdown("~~deleted~~");
    expect(result).toHaveLength(1);
    expect(result[0].parseMode).toBe("MarkdownV2");
    expect(result[0].text).toContain("deleted");
    expect(result[0].text).toContain("~deleted~");
  });

  it("renders headings as bold", () => {
    const result = renderMarkdown("# Heading 1");
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("*Heading 1*");
  });

  it("renders blockquote with > prefix", () => {
    const result = renderMarkdown("> quote text");
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("> ");
  });

  it("renders thematic break", () => {
    const result = renderMarkdown("---");
    expect(result).toHaveLength(1);
    expect(result[0].text).toContain("───────────");
  });
});
