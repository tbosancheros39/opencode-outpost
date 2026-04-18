import { Context } from "grammy";
import { createMainKeyboard } from "../utils/keyboard.js";
import { getStoredAgent } from "../../agent/manager.js";
import { getStoredModel } from "../../model/manager.js";
import { formatVariantForButton } from "../../variant/manager.js";
import { pinnedMessageManager } from "../../pinned/manager.js";
import { keyboardManager } from "../../keyboard/manager.js";
import { clearSession } from "../../session/manager.js";
import { clearProject } from "../../settings/manager.js";
import { foregroundSessionState } from "../../scheduled-task/foreground-state.js";
import { abortCurrentOperation } from "./abort.js";
import { t } from "../../i18n/index.js";
import { isSimpleUser } from "../../users/access.js";
import { isSuperUser } from "../utils/user-tracker.js";

export async function startCommand(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    return;
  }

  const userId = ctx.from?.id;

  // Super users bypass simple user restrictions
  if (userId && isSuperUser(userId)) {
    // Proceed to full interface forsuper users
  } else if (userId && isSimpleUser(userId)) {
    await abortCurrentOperation(ctx, { notifyUser: false });
    foregroundSessionState.clearAll("start_command_reset");
    clearSession(chatId);
    clearProject(chatId);

    pinnedMessageManager.initialize(ctx.api, chatId);
    await pinnedMessageManager.clear(chatId);

    await ctx.reply(
      "Zdravo! 👋 Ja sam tvoj asistent.\n\n" +
        "Samo mi napiši šta te zanima i rado ću pomoći! " +
        "Možeš me pitati o kuhanju, receptima, planiranju obroka, " +
        "kupovini, organizaciji doma i svemu što ti treba u svakodnevnom životu. 🏠\n\n" +
        "Kada god želiš početi novi razgovor, ukucaj /new.",
      { reply_markup: { remove_keyboard: true } },
    );
    return;
  }

  if (!pinnedMessageManager.isInitialized(chatId)) {
    pinnedMessageManager.initialize(ctx.api, chatId);
  }
  keyboardManager.initialize(ctx.api, chatId);

  await abortCurrentOperation(ctx, { notifyUser: false });
  foregroundSessionState.clearAll("start_command_reset");

  clearSession(chatId);
  clearProject(chatId);
  keyboardManager.clearContext(chatId);
  await pinnedMessageManager.clear(chatId);

  if (pinnedMessageManager.getContextLimit(chatId) === 0) {
    await pinnedMessageManager.refreshContextLimit(chatId);
  }

  const currentAgent = getStoredAgent(chatId);
  const currentModel = getStoredModel(chatId);
  const variantName = formatVariantForButton(currentModel.variant || "default");
  const contextInfo =
    pinnedMessageManager.getContextInfo(chatId) ??
    (pinnedMessageManager.getContextLimit(chatId) > 0
      ? { tokensUsed: 0, tokensLimit: pinnedMessageManager.getContextLimit(chatId) }
      : null);

  keyboardManager.updateAgent(chatId, currentAgent);
  keyboardManager.updateModel(chatId, currentModel);
  if (contextInfo) {
    keyboardManager.updateContext(chatId, contextInfo.tokensUsed, contextInfo.tokensLimit);
  }

  const keyboard = createMainKeyboard(
    currentAgent,
    currentModel,
    contextInfo ?? undefined,
    variantName,
  );

  await ctx.reply(t("start.welcome"), { reply_markup: keyboard });
}
