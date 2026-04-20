import { describe, expect, it } from "vitest";
import { chunkOutput } from "../../../src/telegram/render/chunker.js";

describe("telegram/render/chunker", () => {
  it("returns single chunk for text under limit", () => {
    const result = chunkOutput("hello world", 4000);
    expect(result).toEqual(["hello world"]);
  });

  it("returns (no output) for empty string", () => {
    expect(chunkOutput("")).toEqual(["(no output)"]);
  });

  it("returns (no output) for whitespace-only string", () => {
    expect(chunkOutput("   \n  \t  ")).toEqual(["(no output)"]);
  });

  it("returns single chunk for text at exactly the limit", () => {
    const text = "a".repeat(4000);
    const result = chunkOutput(text, 4000);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text);
  });

  it("splits at newline boundaries when over limit", () => {
    const line1 = "a".repeat(100);
    const line2 = "b".repeat(100);
    const line3 = "c".repeat(100);
    const text = `${line1}\n${line2}\n${line3}`;
    const result = chunkOutput(text, 150);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("splits at max length when no newlines present", () => {
    const text = "a".repeat(300);
    const result = chunkOutput(text, 100);
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(120);
    }
  });

  it("does not split inside a code block (triple backtick count stays even)", () => {
    const codeBlock = "```ts\n" + "const x = 1;\n".repeat(50) + "```";
    const prefix = "Some text here\n\n";
    const text = prefix + codeBlock + "\nMore text after";
    const result = chunkOutput(text, 200);
    for (const chunk of result) {
      const backtickCount = (chunk.match(/```/g) ?? []).length;
      expect(backtickCount % 2).toBe(0);
    }
  });

  it("handles multiple code blocks correctly", () => {
    const block1 = "```js\n" + "line\n".repeat(20) + "```";
    const block2 = "```py\n" + "line\n".repeat(20) + "```";
    const text = `${block1}\n\n${block2}`;
    const result = chunkOutput(text, 80);
    for (const chunk of result) {
      const backtickCount = (chunk.match(/```/g) ?? []).length;
      expect(backtickCount % 2).toBe(0);
    }
  });

  it("uses default max length of 4000", () => {
    const text = "a".repeat(3999);
    const result = chunkOutput(text);
    expect(result).toHaveLength(1);
  });
});
