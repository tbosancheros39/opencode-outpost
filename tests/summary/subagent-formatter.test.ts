import { describe, it, expect, vi } from "vitest";
import {
  formatSubagentActivity,
  formatSubagentList,
} from "../../src/summary/subagent-formatter.js";

describe("formatSubagentActivity", () => {
  it("formats activity with task", () => {
    vi.useFakeTimers();
    const now = Date.now();
    const activity = {
      agentId: "file_search",
      task: "reading src/recon/scanner.ts",
      startedAt: now - 5000,
    };
    expect(formatSubagentActivity(activity)).toBe(
      "🤖 Subagent: file_search — reading src/recon/scanner.ts (5s)",
    );
    vi.useRealTimers();
  });

  it("formats activity without task", () => {
    vi.useFakeTimers();
    const now = Date.now();
    const activity = {
      agentId: "explorer",
      task: null,
      startedAt: now - 1200,
    };
    expect(formatSubagentActivity(activity)).toBe("🤖 Subagent: explorer (1s)");
    vi.useRealTimers();
  });

  it("rounds elapsed seconds", () => {
    vi.useFakeTimers();
    const now = Date.now();
    const activity = {
      agentId: "planner",
      task: "analyzing codebase",
      startedAt: now - 15400,
    };
    expect(formatSubagentActivity(activity)).toBe(
      "🤖 Subagent: planner — analyzing codebase (15s)",
    );
    vi.useRealTimers();
  });
});

describe("formatSubagentList", () => {
  it("returns empty string for empty list", () => {
    expect(formatSubagentList([])).toBe("");
  });

  it("formats single activity", () => {
    vi.useFakeTimers();
    const now = Date.now();
    const activities = [{ agentId: "builder", task: "compiling project", startedAt: now - 3000 }];
    expect(formatSubagentList(activities)).toBe("🤖 Subagent: builder — compiling project (3s)");
    vi.useRealTimers();
  });

  it("formats multiple activities", () => {
    vi.useFakeTimers();
    const now = Date.now();
    const activities = [
      { agentId: "search", task: "finding references", startedAt: now - 10000 },
      { agentId: "writer", task: null, startedAt: now - 4000 },
    ];
    const result = formatSubagentList(activities);
    expect(result).toContain("🤖 Subagent: search — finding references (10s)");
    expect(result).toContain("🤖 Subagent: writer (4s)");
    expect(result.split("\n")).toHaveLength(2);
    vi.useRealTimers();
  });
});
