import { describe, expect, it } from "vitest";
import { transformNode, transformChildren } from "../../../src/telegram/render/transformer.js";
import type { RootContent } from "mdast";

describe("telegram/render/transformer", () => {
  describe("transformNode", () => {
    it("transforms text node to escaped text", () => {
      const node: RootContent = { type: "text", value: "hello_world" };
      expect(transformNode(node)).toBe("hello\\_world");
    });

    it("transforms strong (bold) node", () => {
      const node: RootContent = {
        type: "strong",
        children: [{ type: "text", value: "bold" }],
      };
      expect(transformNode(node)).toBe("*bold*");
    });

    it("transforms emphasis (italic) node", () => {
      const node: RootContent = {
        type: "emphasis",
        children: [{ type: "text", value: "italic" }],
      };
      expect(transformNode(node)).toBe("_italic_");
    });

    it("transforms delete (strikethrough) node", () => {
      const node: RootContent = {
        type: "delete",
        children: [{ type: "text", value: "struck" }],
      };
      expect(transformNode(node)).toBe("~struck~");
    });

    it("transforms inlineCode node", () => {
      const node: RootContent = { type: "inlineCode", value: "code" };
      expect(transformNode(node)).toBe("`code`");
    });

    it("transforms inlineCode with backticks inside", () => {
      const node: RootContent = { type: "inlineCode", value: "a`b" };
      expect(transformNode(node)).toBe("`a'b`");
    });

    it("transforms code block with language", () => {
      const node: RootContent = { type: "code", lang: "ts", value: "const x = 1;" };
      expect(transformNode(node)).toBe("```ts\nconst x = 1;\n```\n");
    });

    it("transforms code block without language", () => {
      const node: RootContent = { type: "code", lang: null, value: "plain" };
      expect(transformNode(node)).toBe("```\nplain\n```\n");
    });

    it("transforms link node", () => {
      const node: RootContent = {
        type: "link",
        url: "https://example.com",
        children: [{ type: "text", value: "click" }],
      };
      expect(transformNode(node)).toBe("[click](https://example.com)");
    });

    it("transforms paragraph node", () => {
      const node: RootContent = {
        type: "paragraph",
        children: [{ type: "text", value: "hello" }],
      };
      expect(transformNode(node)).toBe("hello\n");
    });

    it("transforms heading node", () => {
      const node: RootContent = {
        type: "heading",
        depth: 2,
        children: [{ type: "text", value: "Title" }],
      };
      expect(transformNode(node)).toBe("*Title*\n");
    });

    it("transforms blockquote node", () => {
      const node: RootContent = {
        type: "blockquote",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", value: "quoted text" }],
          },
        ],
      };
      const result = transformNode(node);
      expect(result).toContain("> ");
      expect(result).toContain("quoted text");
    });

    it("transforms unordered list node", () => {
      const node: RootContent = {
        type: "list",
        ordered: false,
        children: [
          {
            type: "listItem",
            children: [{ type: "paragraph", children: [{ type: "text", value: "one" }] }],
          },
          {
            type: "listItem",
            children: [{ type: "paragraph", children: [{ type: "text", value: "two" }] }],
          },
        ],
      };
      const result = transformNode(node);
      expect(result).toContain("• one");
      expect(result).toContain("• two");
    });

    it("transforms ordered list node", () => {
      const node: RootContent = {
        type: "list",
        ordered: true,
        start: 1,
        children: [
          {
            type: "listItem",
            children: [{ type: "paragraph", children: [{ type: "text", value: "first" }] }],
          },
          {
            type: "listItem",
            children: [{ type: "paragraph", children: [{ type: "text", value: "second" }] }],
          },
        ],
      };
      const result = transformNode(node);
      expect(result).toContain("1. first");
      expect(result).toContain("2. second");
    });

    it("transforms table node as code block", () => {
      const node: RootContent = {
        type: "table",
        children: [
          {
            type: "tableRow",
            children: [
              { type: "tableCell", children: [{ type: "text", value: "H1" }] },
              { type: "tableCell", children: [{ type: "text", value: "H2" }] },
            ],
          },
          {
            type: "tableRow",
            children: [
              { type: "tableCell", children: [{ type: "text", value: "a" }] },
              { type: "tableCell", children: [{ type: "text", value: "b" }] },
            ],
          },
        ],
      };
      const result = transformNode(node);
      expect(result).toContain("```");
      expect(result).toContain("H1");
      expect(result).toContain("H2");
      expect(result).toContain("---");
    });

    it("transforms thematicBreak node", () => {
      const node: RootContent = { type: "thematicBreak" };
      expect(transformNode(node)).toBe("───────────\n");
    });

    it("transforms break node to newline", () => {
      const node: RootContent = { type: "break" };
      expect(transformNode(node)).toBe("\n");
    });

    it("transforms html node to escaped text", () => {
      const node: RootContent = { type: "html", value: "<br>" };
      const result = transformNode(node);
      expect(result).toContain("br");
    });

    it("handles nested bold + italic", () => {
      const node: RootContent = {
        type: "strong",
        children: [
          {
            type: "emphasis",
            children: [{ type: "text", value: "bold italic" }],
          },
        ],
      };
      expect(transformNode(node)).toBe("*_bold italic_*");
    });

    it("handles mixed content in paragraph", () => {
      const node: RootContent = {
        type: "paragraph",
        children: [
          { type: "text", value: "hello " },
          { type: "strong", children: [{ type: "text", value: "world" }] },
          { type: "text", value: " end" },
        ],
      };
      const result = transformNode(node);
      expect(result).toContain("hello");
      expect(result).toContain("*world*");
      expect(result).toContain("end");
    });
  });

  describe("transformChildren", () => {
    it("joins child transformations", () => {
      const parent = {
        children: [
          { type: "text", value: "a" } as RootContent,
          { type: "text", value: "b" } as RootContent,
        ],
      };
      expect(transformChildren(parent)).toBe("ab");
    });
  });
});
