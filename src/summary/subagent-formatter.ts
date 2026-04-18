export interface SubagentActivity {
  agentId: string;
  task: string | null;
  startedAt: number;
}

export function formatSubagentActivity(activity: SubagentActivity): string {
  const elapsed = Math.round((Date.now() - activity.startedAt) / 1000);
  const taskLabel = activity.task ? ` — ${activity.task}` : "";
  return `🤖 Subagent: ${activity.agentId}${taskLabel} (${elapsed}s)`;
}

export function formatSubagentList(activities: SubagentActivity[]): string {
  if (activities.length === 0) return "";
  return activities.map(formatSubagentActivity).join("\n");
}
