import type { I18nKey } from "../../i18n/en.js";
import { t } from "../../i18n/index.js";

/**
 * Centralized bot commands definitions
 * Used for both Telegram API setMyCommands and command handler registration
 */

export interface BotCommandDefinition {
  command: string;
  description: string;
}

interface BotCommandI18nDefinition {
  command: string;
  descriptionKey: I18nKey;
}

/**
 * List of all bot commands
 * Update this array when adding new commands
 */
const COMMAND_DEFINITIONS: BotCommandI18nDefinition[] = [
  { command: "start", descriptionKey: "cmd.description.start" },
  { command: "status", descriptionKey: "cmd.description.status" },
  { command: "new", descriptionKey: "cmd.description.new" },
  { command: "abort", descriptionKey: "cmd.description.stop" },
  { command: "stop", descriptionKey: "cmd.description.stop" },
  { command: "sessions", descriptionKey: "cmd.description.sessions" },
  { command: "projects", descriptionKey: "cmd.description.projects" },
  { command: "task", descriptionKey: "cmd.description.task" },
  { command: "tasklist", descriptionKey: "cmd.description.tasklist" },
  { command: "rename", descriptionKey: "cmd.description.rename" },
  { command: "commands", descriptionKey: "cmd.description.commands" },
  { command: "opencode_start", descriptionKey: "cmd.description.opencode_start" },
  { command: "opencode_stop", descriptionKey: "cmd.description.opencode_stop" },
  { command: "help", descriptionKey: "cmd.description.help" },
  { command: "shell", descriptionKey: "cmd.description.shell" },
  { command: "ls", descriptionKey: "cmd.description.ls" },
  { command: "read", descriptionKey: "cmd.description.read" },
  { command: "tasks", descriptionKey: "cmd.description.tasks" },
  { command: "logs", descriptionKey: "cmd.description.logs" },
  { command: "health", descriptionKey: "cmd.description.health" },
  { command: "journal", descriptionKey: "cmd.description.journal" },
  { command: "sandbox", descriptionKey: "cmd.description.sandbox" },
  { command: "cost", descriptionKey: "cmd.description.cost" },
  { command: "fe", descriptionKey: "cmd.description.fe" },
  { command: "export", descriptionKey: "cmd.description.export" },
  { command: "messages", descriptionKey: "cmd.description.messages" },
  { command: "skills", descriptionKey: "cmd.description.skills" },
  { command: "mcps", descriptionKey: "cmd.description.mcps" },
  { command: "models", descriptionKey: "cmd.description.models" },
  { command: "compact", descriptionKey: "cmd.description.compact" },
  { command: "steer", descriptionKey: "cmd.description.steer" },
  { command: "tts", descriptionKey: "cmd.description.tts" },
  { command: "branch", descriptionKey: "cmd.description.branch" },
  { command: "commit", descriptionKey: "cmd.description.commit" },
  { command: "diff", descriptionKey: "cmd.description.diff" },
];

export function getLocalizedBotCommands(): BotCommandDefinition[] {
  return COMMAND_DEFINITIONS.map(({ command, descriptionKey }) => ({
    command,
    description: t(descriptionKey),
  }));
}

export const BOT_COMMANDS: BotCommandDefinition[] = getLocalizedBotCommands();
