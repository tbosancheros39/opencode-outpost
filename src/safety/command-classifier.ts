/**
 * Command safety classifier
 * Detects potentially destructive shell commands
 */

export type CommandRiskLevel = "safe" | "warning" | "dangerous";

export interface CommandClassification {
  level: CommandRiskLevel;
  reason: string;
  patterns: string[];
}

// Destructive command patterns
const DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /rm\s+-rf/i, reason: "Recursive force delete" },
  { pattern: /rm\s+.*\*/i, reason: "Delete with wildcards" },
  { pattern: /rm\s+-r/i, reason: "Recursive delete" },
  { pattern: /mkfs/i, reason: "Format filesystem" },
  { pattern: /dd\s+if=/i, reason: "Disk write operation" },
  { pattern: />:\s*\/dev\/null/i, reason: "Redirect to null (data loss)" },
  { pattern: /chmod\s+777/i, reason: "World-writable permissions" },
  { pattern: /chmod\s+-R/i, reason: "Recursive permission change" },
  { pattern: /mv\s+.*\/dev\/null/i, reason: "Move to null (data loss)" },
  { pattern: /shutdown/i, reason: "System shutdown" },
  { pattern: /reboot/i, reason: "System reboot" },
  { pattern: /halt/i, reason: "System halt" },
  { pattern: /systemctl\s+(stop|restart|disable)/i, reason: "System service control" },
  { pattern: /apt\s+(remove|purge|autoremove)/i, reason: "Package removal" },
  { pattern: /npm\s+uninstall/i, reason: "Package removal" },
  { pattern: /pip\s+uninstall/i, reason: "Package removal" },
  { pattern: /docker\s+(rm|rmi|stop|kill)/i, reason: "Docker destructive operation" },
  { pattern: /kubectl\s+delete/i, reason: "Kubernetes resource deletion" },
];

// Warning patterns - less dangerous but worth noting
const WARNING_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /rm\s+/i, reason: "File deletion" },
  { pattern: /rmdir/i, reason: "Directory removal" },
  { pattern: /git\s+(reset|clean)/i, reason: "Git destructive operation" },
  { pattern: /git\s+checkout\s+-f/i, reason: "Force checkout" },
  { pattern: /git\s+revert/i, reason: "Git revert" },
  { pattern: /sudo/i, reason: "Elevated privileges" },
  { pattern: /su\s+-/i, reason: "Switch user" },
  { pattern: /chown/i, reason: "Change ownership" },
  { pattern: /chmod/i, reason: "Change permissions" },
];

export function classifyCommand(command: string): CommandClassification {
  const matchedPatterns: string[] = [];
  
  // Check dangerous patterns first
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      matchedPatterns.push(reason);
    }
  }
  
  if (matchedPatterns.length > 0) {
    return {
      level: "dangerous",
      reason: matchedPatterns.join("; "),
      patterns: matchedPatterns,
    };
  }
  
  // Check warning patterns
  for (const { pattern, reason } of WARNING_PATTERNS) {
    if (pattern.test(command)) {
      matchedPatterns.push(reason);
    }
  }
  
  if (matchedPatterns.length > 0) {
    return {
      level: "warning",
      reason: matchedPatterns.join("; "),
      patterns: matchedPatterns,
    };
  }
  
  return {
    level: "safe",
    reason: "No dangerous patterns detected",
    patterns: [],
  };
}

export function requiresConfirmation(classification: CommandClassification): boolean {
  return classification.level === "dangerous";
}

export function formatWarningMessage(command: string, classification: CommandClassification): string {
  const emoji = classification.level === "dangerous" ? "🚨" : "⚠️";
  const title = classification.level === "dangerous" ? "DANGEROUS COMMAND" : "WARNING";
  
  return [
    `${emoji} <b>${title}</b>`,
    ``,
    `<code>${command.replace(/[<>&]/g, "").substring(0, 100)}</code>`,
    ``,
    `<b>Risks:</b> ${classification.reason}`,
    ``,
    `Are you sure you want to execute this command?`,
  ].join("\n");
}
