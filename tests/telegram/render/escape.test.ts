import { describe, expect, it } from "vitest";
import { escapeMd, escapeCode } from "../../../src/telegram/render/escape.js";

describe("telegram/render/escape", () => {
  describe("escapeMd", () => {
    it("passes plain text through unchanged", () => {
      expect(escapeMd("hello world")).toBe("hello world");
      expect(escapeMd("abc123")).toBe("abc123");
    });

    it("escapes all MarkdownV2 special characters", () => {
      const allSpecial = "_*[]()~`>#+=|{}.!\\-";
      const escaped = escapeMd(allSpecial);
      for (const ch of allSpecial) {
        expect(escaped).toContain(`\\${ch}`);
      }
    });

    it("escapes underscore", () => {
      expect(escapeMd("hello_world")).toBe("hello\\_world");
    });

    it("escapes asterisk", () => {
      expect(escapeMd("hello*world")).toBe("hello\\*world");
    });

    it("escapes brackets", () => {
      expect(escapeMd("a[b]c")).toBe("a\\[b\\]c");
    });

    it("escapes parentheses", () => {
      expect(escapeMd("a(b)c")).toBe("a\\(b\\)c");
    });

    it("escapes tilde", () => {
      expect(escapeMd("a~b")).toBe("a\\~b");
    });

    it("escapes backtick", () => {
      expect(escapeMd("a`b")).toBe("a\\`b");
    });

    it("escapes greater-than", () => {
      expect(escapeMd("a>b")).toBe("a\\>b");
    });

    it("escapes hash", () => {
      expect(escapeMd("#heading")).toBe("\\#heading");
    });

    it("escapes plus", () => {
      expect(escapeMd("a+b")).toBe("a\\+b");
    });

    it("escapes equals", () => {
      expect(escapeMd("a=b")).toBe("a\\=b");
    });

    it("escapes pipe", () => {
      expect(escapeMd("a|b")).toBe("a\\|b");
    });

    it("escapes curly braces", () => {
      expect(escapeMd("{x}")).toBe("\\{x\\}");
    });

    it("escapes dot", () => {
      expect(escapeMd("a.b")).toBe("a\\.b");
    });

    it("escapes exclamation mark", () => {
      expect(escapeMd("a!b")).toBe("a\\!b");
    });

    it("escapes backslash", () => {
      expect(escapeMd("a\\b")).toBe("a\\\\b");
    });

    it("escapes hyphen", () => {
      expect(escapeMd("a-b")).toBe("a\\-b");
    });

    it("handles mixed text with special chars", () => {
      expect(escapeMd("Hello, *world*!")).toBe("Hello, \\*world\\*\\!");
    });

    it("returns empty string for empty input", () => {
      expect(escapeMd("")).toBe("");
    });

    it("handles string of all special chars", () => {
      const input = "_*[]()~`>#+=|{}.!\\-";
      const result = escapeMd(input);
      expect(result).toBe("\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\=\\|\\{\\}\\.\\!\\\\\\-");
    });
  });

  describe("escapeCode", () => {
    it("passes text without backticks unchanged", () => {
      expect(escapeCode("const x = 1;")).toBe("const x = 1;");
    });

    it("replaces backtick with apostrophe", () => {
      expect(escapeCode("a`b")).toBe("a'b");
    });

    it("replaces multiple backticks", () => {
      expect(escapeCode("`a`b`")).toBe("'a'b'");
    });

    it("returns empty string for empty input", () => {
      expect(escapeCode("")).toBe("");
    });
  });
});
