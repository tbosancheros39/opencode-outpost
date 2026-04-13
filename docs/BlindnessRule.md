Based on the codebase you provided, your bot is built with a highly asynchronous architecture (streaming responses via OpenCode SSE events) and a strict single-user security model.

To make the bot enter a group, answer a question, and automatically leave, you are facing **three specific blockers** in your current code:

1. **Missing `leaveChat` API:** The codebase currently never calls Grammy's `leaveChat` method.
2. **Asynchronous Streaming:** If you command the bot to leave the chat *immediately* after receiving the prompt, it will exit before the LLM finishes streaming the answer, causing the message delivery to fail. You must trigger the leave action *only after* the message completes.
3. **Strict Authentication:** Your bot has a strict `authMiddleware` designed for a single user (`TELEGRAM_ALLOWED_USER_ID`). If anyone else in the group tries to summon the bot, it will silently ignore them.

Here is the step-by-step guide and exact code to add a `/ask_and_leave` command that safely handles this using your existing aggregator.

### Step 1: Create a flag to track chats the bot needs to leave
Open `src/bot/index.ts`. At the top of the file where your global variables are declared (around line 77), add a Set to keep track of groups the bot needs to leave:

```typescript
let botInstance: Bot<Context> | null = null;
let chatIdInstance: number | null = null;
const commandsInitializedChats = new Set<number>();
let draftTimer: NodeJS.Timeout | null = null;

// ADD THIS LINE: Track groups that requested a hit-and-run answer
const chatsToLeaveAfterAnswer = new Set<number>();
```

### Step 2: Create the Summon Command
Further down in `src/bot/index.ts`, inside the `createBot()` function (where you register commands like `bot.command("start", startCommand);`), add a new command:

```typescript
  bot.command("ask_and_leave", async (ctx) => {
    // 1. Ensure this is only used in groups
    if (ctx.chat?.type === "private") {
      await ctx.reply(t("error.groups_only") || "This command is for groups only.");
      return;
    }

    const query = ctx.match;
    if (!query) {
      await ctx.reply("Please provide a question. Example: /ask_and_leave What is the capital of France?");
      return;
    }

    // 2. Mark this chat ID to be exited later
    chatsToLeaveAfterAnswer.add(ctx.chat.id);

    // 3. Set global instances so the aggregator knows where to route
    botInstance = bot;
    chatIdInstance = ctx.chat.id;

    // 4. Pass the prompt to your existing LLM handler
    const promptDeps = { bot, ensureEventSubscription };
    await processUserPrompt(ctx, query, promptDeps);
  });
```

### Step 3: Trigger the Leave Action AFTER the Answer
You need the bot to leave *only* when the response is fully generated. In `src/bot/index.ts`, locate `summaryAggregator.setOnComplete(async (sessionId, messageId, messageText) => { ... })`.

Scroll to the very bottom of that callback to the `finally` block, and add the `leaveChat` logic:

```typescript
    } finally {
      foregroundSessionState.markIdle(sessionId);

      // Clear draft ID - draft auto-disappears when final message is sent
      if (chatIdInstance) {
        clearDraftId(chatIdInstance);
      }

      await scheduledTaskRuntime.flushDeferredDeliveries();

      // ADD THIS BLOCK: Leave the chat if it was flagged by the summon command
      if (chatsToLeaveAfterAnswer.has(chatId)) {
        chatsToLeaveAfterAnswer.delete(chatId); // Remove from queue
        try {
          logger.info(`[Bot] Answer completed. Leaving group chat ${chatId} as requested.`);
          await botApi.leaveChat(chatId);
        } catch (leaveErr) {
          logger.error(`[Bot] Failed to leave chat ${chatId}:`, leaveErr);
        }
      }
    }
```

### Step 4: Fix Group Privacy & Auth Issues (Crucial)
Even with the code above, Telegram and your bot's security will block it if you don't adjust two things:

1. **Telegram Group Privacy:** By default, bots cannot read messages in groups unless they are an Admin or the message starts with a `/` slash command. Using the `/ask_and_leave` command created above solves this automatically because Telegram always forwards slash commands to the bot.
2. **Your Auth Middleware:** Because of your `TELEGRAM_ALLOWED_USER_ID` setup, **only you** can use the `/ask_and_leave` command. If you want *anyone* in the group to be able to summon the bot, you must modify `src/bot/middleware/auth.ts` to bypass the user ID check specifically for the `/ask_and_leave` command, or explicitly allow the Group's Chat ID in your environment variables.

With these changes, you can add the bot to a group, type `/ask_and_leave How do I exit vim?`, the bot will stream the answer natively using your OpenCode server, and the moment it finishes typing, it will gracefully remove itself from the group.
