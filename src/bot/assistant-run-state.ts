export interface AssistantRunState {
  sessionId: string;
  agentId: string | null;
  modelId: string | null;
  provider: string | null;
  startedAt: number;
}

const runStates = new Map<string, AssistantRunState>();

export function setAssistantRunState(sessionId: string, state: Partial<AssistantRunState>): void {
  const existing = runStates.get(sessionId) ?? {
    sessionId,
    agentId: null,
    modelId: null,
    provider: null,
    startedAt: Date.now(),
  };
  runStates.set(sessionId, { ...existing, ...state });
}

export function getAssistantRunState(sessionId: string): AssistantRunState | null {
  return runStates.get(sessionId) ?? null;
}

export function clearAssistantRunState(sessionId: string): void {
  runStates.delete(sessionId);
}
