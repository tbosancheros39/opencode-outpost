# Fatima Fix 2 - Model Selection and Inline Menu Fixes

## Problems Fixed

1. **"Opencode model not found" error** - The provider ID was incorrectly set to "opencode" instead of "opencode-go"
2. **Auto-select "free" model** - When the stored model is invalid, automatically find and select a free model
3. **Inline menu in 1v1 chats** - Block the confusing inline menu from appearing for Fatima in private 1v1 chats
4. **Model selection cleanup** - Ensure Fatima (super user) has proper model configuration

## Changes Made

### 1. User Access (`src/users/access.ts`)

Fatima was already removed from `USER_PROJECT_RESTRICTIONS` in a previous fix. She is a super user and should not have project restrictions.

```typescript
/**
 * Maps Telegram user IDs to their dedicated project restriction.
 * Users listed here can only see and interact with their assigned project.
 * Super users (in SUPER_USER_IDS) are NOT listed here - they have full access.
 *
 * NOTE: User 7917752417 (Fatima) was previously listed here but has been
 * moved to SUPER_USER_IDS for full access. Do NOT re-add super users here.
 */
const USER_PROJECT_RESTRICTIONS = new Map<number, UserProjectRestriction>([]);
```

### 2. Model Manager (`src/model/manager.ts`)

Added `findFirstAvailableFreeModel()` function and modified `reconcileStoredModelSelection()` to auto-select a free model when the stored model is invalid.

**New function:**
```typescript
async function findFirstAvailableFreeModel(): Promise<FavoriteModel | null> {
  try {
    const response = await opencodeClient.config.providers();
    if (response.error || !response.data) {
      logger.warn("[ModelManager] Could not fetch providers for free model search");
      return null;
    }
    const freeModels = filterFreeModels(response.data.providers);
    if (freeModels.length === 0) {
      logger.warn("[ModelManager] No free models found in catalog");
      return null;
    }
    return freeModels[0];
  } catch (err) {
    logger.warn("[ModelManager] Error finding free model:", err);
    return null;
  }
}
```

**Updated `reconcileStoredModelSelection()` logic:**
1. If stored model is valid, use it
2. If stored model is invalid, try env default model
3. If env default is also invalid, find first available free model
4. If no free model found, log warning (model unchanged)

### 3. Bot Handlers (`src/bot/index.ts`)

Added blocking of inline menus for Fatima in private 1v1 chats.

**New helper function:**
```typescript
const FATIMA_USER_ID = 7917752417;

function shouldBlockInlineMenusForFatima(ctx: Context): boolean {
  return ctx.from?.id === FATIMA_USER_ID && ctx.chat?.type === "private";
}
```

**Modified handlers** (model, agent, variant buttons) to check and block inline menus for Fatima:
```typescript
if (shouldBlockInlineMenusForFatima(ctx)) {
  await ctx.reply(t("model.inline_blocked_fatima")).catch(() => {});
  return;
}
```

### 4. Settings (`settings.json`)

Updated model configuration:
```json
"currentModel": {
  "providerID": "opencode-go",
  "modelID": "qwen",
  "variant": "default"
}
```

**Note:** The settings.json is auto-managed by the bot at runtime. The bot will override these values when it runs. The fix in `reconcileStoredModelSelection()` handles invalid model configurations at runtime.

### 5. Internationalization (`src/i18n/en.ts`)

Added new translation keys for blocked inline menus:
```typescript
"agent.inline_blocked_fatima": "ℹ️ You can use /models to select a model.",
"model.inline_blocked_fatima": "ℹ️ You can use /models to select a model.",
"variant.inline_blocked_fatima": "ℹ️ You can use /models to select a model variant."
```

## Free Models Available

The following free models are available from `opencode-go` provider:
- `qwen` - Qwen models
- `nemotron` - Nemotron models
- `pickle` - Big Pickle models
- `minimax` - Minimax models (including minimax-m2.7)

Plus free models from Google Gemini and OpenRouter providers.

## How It Works

1. When Fatima starts a chat in 1v1 private chat and clicks a model/agent/variant button, instead of showing the inline selection menu, she gets a message telling her to use `/models` command instead.

2. When the bot starts or reconnects, `reconcileStoredModelSelection()` validates the stored model. If it's invalid:
   - First tries to fall back to the env default model
   - If that's also invalid, finds the first available free model
   - Auto-selects that free model

3. The model catalog is cached for 10 minutes to reduce API calls.

## Testing

```bash
npm run build  # Build the project
npm run lint  # Run linting
```

## Deploy

After changes, restart services:

```bash
sudo systemctl restart opencode-serve.service opencode-telegram-bot.service
```

## Related Issues

- **"Opencode model not found"**: Caused by invalid provider ID "opencode" instead of "opencode-go"
- **Confusing inline menus**: Fatima was clicking model buttons and getting confused by the inline menu popup in private chats
- **Model not auto-selected**: When stored model was invalid, no fallback was attempted to find a valid free model
