import { describe, expect, it } from "vitest";
import { renderCodeBlock, renderInlineCode } from "../../../src/telegram/render/code-block.js";

describe("telegram/render/code-block", () => {
  describe("renderCodeBlock", () => {
    it("renders code block with language", () => {
      const result = renderCodeBlock("ts", "const x = 1;");
      expect(result).toBe("```ts\nconst x = 1;\n```");
    });

    it("renders code block without language", () => {
      const result = renderCodeBlock(null, "plain code");
      expect(result).toBe("```\nplain code\n```");
    });

    it("replaces triple backticks inside code block", () => {
      const code = 'const md = "```";';
      const result = renderCodeBlock("", code);
      expect(result).toContain("'''");
      expect(result).not.toContain('const md = "```";');
      expect(result).toBe("```\nconst md = \"'''\";\n```");
    });

    it("renders empty code block", () => {
      const result = renderCodeBlock(null, "");
      expect(result).toBe("```\n\n```");
    });
  });

  describe("renderInlineCode", () => {
    it("renders inline code with no special chars", () => {
      const result = renderInlineCode("fmt.Println");
      expect(result).toBe("`fmt.Println`");
    });

    it("replaces backticks inside inline code with apostrophes", () => {
      const result = renderInlineCode("a`b");
      expect(result).toBe("`a'b`");
    });

    it("replaces multiple backticks inside inline code", () => {
      const result = renderInlineCode("`a`");
      expect(result).toBe("`'a'`");
    });

    it("handles empty inline code value", () => {
      const result = renderInlineCode("");
      expect(result).toBe("``");
    });
  });
});
