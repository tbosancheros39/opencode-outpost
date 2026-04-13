The "Silent Timeout" Illusion (The Root Cause)
Telegram has a very strict rule for inline queries (@botname ...): The bot must respond with answerInlineQuery within a few seconds.

Currently, your inline-query.ts is trying to call resolveInlineQuery(query) to get the AI's answer synchronously while the user's popup is still open.

You type @botname. The bot instantly returns the suggestion list. (Telegram caches this on your screen).

You type @botname eli5: why salty. The bot starts asking the LLM.

The LLM takes 5–8 seconds to generate the answer.

Telegram's client times out. Because it didn't receive a fast enough response, Telegram silently gives up. Instead of showing an error, Telegram's UI just leaves the last valid response on the screen—the cached suggestions!

You and the agents thought the bot's code was actively returning suggestions for the long query. It wasn't. The bot was simply timing out, and Telegram hid the timeout behind the old cache.

Why the llm-command.ts fix didn't apply here
The "Two-Phase Guard" we just built uses ctx.reply() and edits messages in the chat. You cannot send chat messages from inside an inline_query overlay until a result is actually chosen.

The Solution: Turn Inline Mode into a "Command Launcher"
To fix this permanently and integrate perfectly with the new Two-Phase Guard, we must change what inline-query.ts does. It should not talk to the LLM at all.

Instead, it should act as an auto-completer. When you type @bot eli5: why salty and tap the result, the bot should instantly inject /eli5 why salty into the chat box. This hands the text over to the main chat, immediately triggering the llm-command.ts guard we just perfected!

Here is the exact code to overwrite your src/bot/handlers/inline-query.ts file.

Why this is the perfect architectural fix:
Zero Timeouts: The inline query handler no longer calls the LLM. It processes a Regex match in milliseconds and returns a button instantly. It is literally impossible for Telegram to time out now.

Unified Logic: By making the inline button simply send /${command} ${payload} to the chat, we funnel the user directly into llm-command.ts. You don't have to duplicate the async worker logic, the "Got it!" placeholders, or the isForegroundBusy checks. It's perfectly DRY.

Better UX: When you tap the suggestion on an empty query, switchInlineQueryCurrentChat cleanly pre-fills the chat input box for you, encouraging you to keep typing.
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

import { InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import { Context } from "grammy";

// The 6 direct LLM commands
const INLINE_COMMANDS = [
  { name: "eli5", desc: "Explain like I'm 5" },
  { name: "feynman", desc: "Explain using Feynman technique" },
  { name: "devils_advocate", desc: "Play Devil's Advocate" },
  { name: "deep_research", desc: "Deep research a topic" },
  { name: "summarise", desc: "Summarize text" },
  { name: "steel_man", desc: "Steel-man an argument" }
];

export async function inlineQueryHandler(ctx: Context) {
  const query = ctx.inlineQuery?.query.trim() || "";

  // 1. EMPTY QUERY: Show suggestions that type into the user's chat box
  if (!query) {
    const results = INLINE_COMMANDS.map(cmd =>
      InlineQueryResultBuilder.article(`sugg_${cmd.name}`, `⚡ ${cmd.name}`, {
        description: cmd.desc,
        // When tapped, it switches the user's chat box to: "@botname cmd: "
        reply_markup: new InlineKeyboard().switchInlineQueryCurrentChat(cmd.desc, `${cmd.name}: `)
      }).text(`/${cmd.name}`) // Fallback if they manage to send it directly
    );

    // Short cache so it feels responsive
    await ctx.answerInlineQuery(results, { cache_time: 10 });
    return;
  }

  // 2. QUERY PROVIDED: Parse the command and the text
  // Matches "eli5: query", "eli5 query", "feynman: query", etc.
  const match = query.match(/^(eli5|feynman|devils_advocate|deep_research|summarise|steel_man)[\s:]+(.+)$/i);

  if (match) {
    const command = match[1].toLowerCase();
    const payload = match[2].trim();

    // If the query is too short (e.g. they only typed "why"), prompt them to keep typing
    if (payload.length < 5) {
      const keepTyping = InlineQueryResultBuilder.article("typing", "Keep typing...", {
        description: "Your query needs to be a bit longer."
      }).text("..."); // Dummy text, usually ignored

      await ctx.answerInlineQuery([keepTyping], { cache_time: 0 });
      return;
    }

    // 3. READY TO LAUNCH: Return a single button to execute
    const result = InlineQueryResultBuilder.article(`exec_${command}`, `🚀 Ask AI: ${command}`, {
      description: `Query: "${payload}"\nTap to send to chat and generate!`,
    }).text(`/${command} ${payload}`);
    // ^^^ THIS IS THE MAGIC. When clicked, it sends "/eli5 why salty" to the chat.
    // This perfectly triggers your new Two-Phase Guard in `llm-command.ts`!

    await ctx.answerInlineQuery([result], { cache_time: 0 });
    return;
  }

  // 4. FALLBACK: User typed something but it didn't match a command
  const fallback = InlineQueryResultBuilder.article("unknown", "Unknown command", {
    description: "Please start with a valid command like eli5: or feynman:"
  }).text("Invalid command format.");

  await ctx.answerInlineQuery([fallback], { cache_time: 0 });
}
