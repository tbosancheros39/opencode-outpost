import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../../src/telegram/render/parser.js";

describe("telegram/render/parser", () => {
  it("parses plain text to a paragraph", () => {
    const ast = parseMarkdown("hello world");
    expect(ast.type).toBe("root");
    expect(ast.children).toHaveLength(1);
    expect(ast.children[0].type).toBe("paragraph");
  });

  it("parses heading correctly", () => {
    const ast = parseMarkdown("# Heading");
    const heading = ast.children[0];
    expect(heading.type).toBe("heading");
    if (heading.type === "heading") {
      expect(heading.depth).toBe(1);
    }
  });

  it("parses code block with language and value", () => {
    const ast = parseMarkdown("```ts\nconst x = 1;\n```");
    const code = ast.children[0];
    expect(code.type).toBe("code");
    if (code.type === "code") {
      expect(code.lang).toBe("ts");
      expect(code.value).toBe("const x = 1;");
    }
  });

  it("parses code block without language", () => {
    const ast = parseMarkdown("```\nplain code\n```");
    const code = ast.children[0];
    expect(code.type).toBe("code");
    if (code.type === "code") {
      expect(code.lang).toBeNull();
      expect(code.value).toBe("plain code");
    }
  });

  it("parses inline code", () => {
    const ast = parseMarkdown("use `fmt.Println` here");
    const para = ast.children[0];
    expect(para.type).toBe("paragraph");
    if (para.type === "paragraph") {
      const inlineCode = para.children.find((c) => c.type === "inlineCode");
      expect(inlineCode).toBeDefined();
      if (inlineCode && inlineCode.type === "inlineCode") {
        expect(inlineCode.value).toBe("fmt.Println");
      }
    }
  });

  it("parses bold text", () => {
    const ast = parseMarkdown("**bold**");
    const para = ast.children[0];
    expect(para.type).toBe("paragraph");
    if (para.type === "paragraph") {
      const strong = para.children.find((c) => c.type === "strong");
      expect(strong).toBeDefined();
    }
  });

  it("parses italic text", () => {
    const ast = parseMarkdown("*italic*");
    const para = ast.children[0];
    expect(para.type).toBe("paragraph");
    if (para.type === "paragraph") {
      const em = para.children.find((c) => c.type === "emphasis");
      expect(em).toBeDefined();
    }
  });

  it("parses strikethrough text as text without GFM plugin", () => {
    const ast = parseMarkdown("~~deleted~~");
    const para = ast.children[0];
    expect(para.type).toBe("paragraph");
  });

  it("parses link with url and text", () => {
    const ast = parseMarkdown("[example](https://example.com)");
    const para = ast.children[0];
    expect(para.type).toBe("paragraph");
    if (para.type === "paragraph") {
      const link = para.children.find((c) => c.type === "link");
      expect(link).toBeDefined();
      if (link && link.type === "link") {
        expect(link.url).toBe("https://example.com");
      }
    }
  });

  it("parses unordered list", () => {
    const ast = parseMarkdown("- one\n- two\n- three");
    const list = ast.children[0];
    expect(list.type).toBe("list");
    if (list.type === "list") {
      expect(list.ordered).toBe(false);
      expect(list.children).toHaveLength(3);
    }
  });

  it("parses ordered list", () => {
    const ast = parseMarkdown("1. first\n2. second");
    const list = ast.children[0];
    expect(list.type).toBe("list");
    if (list.type === "list") {
      expect(list.ordered).toBe(true);
      expect(list.children).toHaveLength(2);
    }
  });

  it("parses table as paragraph without GFM plugin", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const ast = parseMarkdown(md);
    expect(ast.children.length).toBeGreaterThanOrEqual(1);
  });

  it("parses empty string to empty root", () => {
    const ast = parseMarkdown("");
    expect(ast.type).toBe("root");
    expect(ast.children).toHaveLength(0);
  });

  it("parses complex nested markdown without errors", () => {
    const md = [
      "# Title",
      "",
      "This has **bold and _italic_** inside.",
      "",
      "```js",
      "console.log();",
      "```",
      "",
      "- item one",
      "- item two",
      "",
      "> a quote",
      "",
      "| H1 | H2 |",
      "| --- | --- |",
      "| a | b |",
    ].join("\n");

    const ast = parseMarkdown(md);
    expect(ast.type).toBe("root");
    expect(ast.children.length).toBeGreaterThan(0);
  });
});
