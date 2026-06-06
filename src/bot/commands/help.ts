import { Context } from "grammy";
import type { I18nKey } from "../../i18n/en.js";
import { t } from "../../i18n/index.js";
import { getLocalizedBotCommands } from "./definitions.js";
import { isSimpleUser } from "../../users/access.js";

function formatSimpleHelpText(): string {
  return (
    "📖 Pomoć\n\n" +
    "Slobodno mi napiši bilo šta — odgovoriću odmah! 😊\n\n" +
    "Dostupne naredbe:\n" +
    "/new - Počni novi razgovor\n" +
    "/abort - Zaustavi trenutni odgovor\n\n" +
    "Specijalizirana sam za: kuhanje 🍳, recepte, planiranje obroka, " +
    "kupovinu, njegu doma i porodice. Pitaj me slobodno!"
  );
}

function formatHelpText(): string {
  const commands = getLocalizedBotCommands();
  const cmdMap = new Map(commands.map((c) => [c.command, c.description]));

  const categories: { header: I18nKey; commands: string[] }[] = [
    {
      header: "help.category.session",
      commands: [
        "new",
        "sessions",
        "resume",
        "snapshot",
        "digest",
        "rename",
        "compact",
        "start",
        "messages",
      ],
    },
    {
      header: "help.category.tasks",
      commands: ["task", "tasklist", "tasks", "commands"],
    },
    {
      header: "help.category.local_ops",
      commands: [
        "shell",
        "ls",
        "read",
        "fe",
        "find",
        "pin",
        "export",
        "sandbox",
        "projects",
      ],
    },
    { header: "help.category.git", commands: ["branch", "commit", "diff"] },
    {
      header: "help.category.browse",
      commands: ["models", "skills", "mcps", "tts", "steer"],
    },
    {
      header: "help.category.bot_control",
      commands: [
        "help",
        "status",
        "abort",
        "opencode_start",
        "opencode_stop",
        "health",
        "journal",
        "logs",
        "cost",
      ],
    },
  ];

  const lines: string[] = [`📖 ${t("cmd.description.help")}\n`];

  for (const cat of categories) {
    const catCommands = cat.commands
      .filter((cmd) => cmdMap.has(cmd))
      .map((cmd) => `/${cmd} - ${cmdMap.get(cmd)}`);

    if (catCommands.length === 0) continue;

    const count = catCommands.length;
    lines.push(
      `${t(cat.header)} (${count} ${count === 1 ? "command" : "commands"})`,
    );
    lines.push(...catCommands);
    lines.push("");
  }

  lines.push(t("help.tip_commands"));

  return lines.join("\n");
}

export async function helpCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId && isSimpleUser(userId)) {
    await ctx.reply(formatSimpleHelpText());
    return;
  }

  await ctx.reply(formatHelpText());
}
