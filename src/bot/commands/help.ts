import { Context } from "grammy";
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
  const lines = commands.map((item) => `/${item.command} - ${item.description}`);

  return `📖 ${t("cmd.description.help")}\n\n${lines.join("\n")}\n\n${t("help.keyboard_hint")}`;
}

export async function helpCommand(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (userId && isSimpleUser(userId)) {
    await ctx.reply(formatSimpleHelpText());
    return;
  }

  await ctx.reply(formatHelpText());
}
