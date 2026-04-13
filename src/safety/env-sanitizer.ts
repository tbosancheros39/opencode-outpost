/**
 * Environment sanitization for child processes.
 * Strips sensitive credentials from the environment before spawning children.
 */

const SENSITIVE_ENV_VARS = [
  "TELEGRAM_BOT_TOKEN",
  "STT_API_KEY",
  "OPENCODE_SERVER_PASSWORD",
  "OPENCODE_API_KEY",
  "REDIS_PASSWORD",
  "GROQ_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  // Add other API keys/secrets as needed
];

const ALLOWED_ENV_VARS = [
  "PATH",
  "HOME",
  "USER",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SHELL",
  "TERM",
  "COLORTERM",
  "NODE_ENV",
];

/**
 * Creates a sanitized environment object safe for child processes.
 * Strips all sensitive credentials while preserving essential system variables.
 */
export function sanitizeEnv(customVars: Record<string, string> = {}): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = {};

  // Add allowed vars from current environment
  for (const key of ALLOWED_ENV_VARS) {
    if (process.env[key]) {
      sanitized[key] = process.env[key];
    }
  }

  // Add custom vars (but never override sensitive ones)
  for (const [key, value] of Object.entries(customVars)) {
    if (!SENSITIVE_ENV_VARS.includes(key.toUpperCase())) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Check if a variable name is considered sensitive.
 */
export function isSensitiveVar(varName: string): boolean {
  return SENSITIVE_ENV_VARS.includes(varName.toUpperCase());
}
