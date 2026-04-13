# Fatima Fix - Super User Model Selection Fix

## Problem

Super user 7\*\*\* (7917752417) could not access the `/models` command and was getting the simple user interface instead of full interface.

### Root Cause

User 7917752417 was listed in **BOTH**:

- `SUPER_USER_IDS` in `src/bot/utils/user-tracker.ts` (should get full interface)
- `USER_PROJECT_RESTRICTIONS` in `src/users/access.ts` (marked as simple user)

The `isSimpleUser()` function checked `USER_PROJECT_RESTRICTIONS.has(userId)` and returned `true` for this user, overriding the super user status.

This caused:

- Super user 7\*\*\* to get simple user interface (only /new and /abort)
- `/models` command not accessible
- Full interface not available

## Solution

### Files Changed

1. **Created `/src/constants.ts`**
   - New shared constant file
   - Contains `SUPER_USER_IDS` to avoid circular dependencies

2. **Updated `/src/bot/utils/user-tracker.ts`**
   - Imports `SUPER_USER_IDS` from `constants.ts`
   - Removed local `SUPER_USER_IDS` definition

3. **Updated `/src/users/access.ts`**
   - Imports `SUPER_USER_IDS` from `constants.ts`
   - Modified `isSimpleUser()` function:
     ```typescript
     export function isSimpleUser(userId: number): boolean {
       if (SUPER_USER_IDS.has(userId)) {
         return false; // Super users always get full interface
       }
       return USER_PROJECT_RESTRICTIONS.has(userId);
     }
     ```
   - Super users now **always** get full interface

4. **Updated `/src/model/free-models.ts`**
   - Added OpenCode zen free models:
     - `qwen` (all qwen models)
     - `nemotron` (all nemotron models)
     - `pickle` (big pickle models)
     - `minimax` (all minimax models including minimax-m2.7)
   - These are available to ALL users, including simple users

## User Classification After Fix

| User Type                                             | `isSuperUser()` | `isSimpleUser()` | Interface        |
| ----------------------------------------------------- | --------------- | ---------------- | ---------------- |
| Super User (1402234843)                               | `true`          | `false`          | Full             |
| Super User (7917752417)                               | `true`          | `false`          | **Full** (fixed) |
| Simple User (in USER_PROJECT_RESTRICTIONS, not super) | `false`         | `true`           | Simple           |
| Regular User                                          | `false`         | `false`          | Full             |

## Available Models

### Super Users

- ALL models from ALL providers

### Simple Users (Non-Tech)

- Free models from OpenCode zen:
  - QWEN models
  - Nemotron models
  - Big Pickle models
  - Minimax models (including minimax-m2.7)
- Plus Google Gemini free models
- Plus OpenRouter free models

### Regular Users

- ALL models from ALL providers

## Testing

```bash
npm run build  # ✅ Pass
npm run lint   # ✅ Pass
```

## Deploy

After changes, restart services:

```bash
sudo systemctl restart opencode-serve.service opencode-telegram-bot.service
```

## Related Error: "Model not found: opencode/default"

This error appears to come from the OpenCode server configuration, not from the bot code. The bot config specifies `opencode-go/minimax-m2.7` as the default model, but the server may have its own default model configuration that references a non-existent model.

**Investigation needed:**

- Check OpenCode server config for default model settings
- Verify available models on OpenCode server
- Ensure server-side model configuration matches bot expectations

## Changes Summary

- Super user 7**\* now gets **FULL\*\* interface with access to:
  - `/new` - Start new session
  - `/sessions` - View sessions
  - `/models` - Select model (all models available)
  - All other commands

- Simple users (non-tech) get **LIMITED** interface with:
  - `/new` - Start new session
  - `/abort` - Stop current operation
  - Access to FREE models only (QWEN, Nemotron, Big Pickle, Minimax)
