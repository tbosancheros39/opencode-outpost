import { describe, expect, it } from "vitest";
import {
  setAssistantRunState,
  getAssistantRunState,
  clearAssistantRunState,
} from "../../src/bot/assistant-run-state.js";

describe("bot/assistant-run-state", () => {
  it("creates new state with setAssistantRunState", () => {
    setAssistantRunState("session-1", { agentId: "plan", modelId: "gpt-4", provider: "openai" });

    const state = getAssistantRunState("session-1");
    expect(state).not.toBeNull();
    expect(state!.sessionId).toBe("session-1");
    expect(state!.agentId).toBe("plan");
    expect(state!.modelId).toBe("gpt-4");
    expect(state!.provider).toBe("openai");
    expect(typeof state!.startedAt).toBe("number");
    expect(state!.startedAt).toBeGreaterThan(0);

    clearAssistantRunState("session-1");
  });

  it("merges with existing state on update", () => {
    setAssistantRunState("session-2", { agentId: "build" });
    const originalStartedAt = getAssistantRunState("session-2")!.startedAt;

    setAssistantRunState("session-2", { modelId: "claude-3", provider: "anthropic" });

    const state = getAssistantRunState("session-2");
    expect(state).not.toBeNull();
    expect(state!.agentId).toBe("build");
    expect(state!.modelId).toBe("claude-3");
    expect(state!.provider).toBe("anthropic");
    expect(state!.startedAt).toBe(originalStartedAt);

    clearAssistantRunState("session-2");
  });

  it("returns null for unknown session", () => {
    const state = getAssistantRunState("unknown-session");
    expect(state).toBeNull();
  });

  it("returns state for known session", () => {
    setAssistantRunState("session-3", { agentId: "code" });

    const state = getAssistantRunState("session-3");
    expect(state).not.toBeNull();
    expect(state!.sessionId).toBe("session-3");
    expect(state!.agentId).toBe("code");

    clearAssistantRunState("session-3");
  });

  it("removes state with clearAssistantRunState", () => {
    setAssistantRunState("session-4", { agentId: "explore" });
    expect(getAssistantRunState("session-4")).not.toBeNull();

    clearAssistantRunState("session-4");
    expect(getAssistantRunState("session-4")).toBeNull();
  });
});
