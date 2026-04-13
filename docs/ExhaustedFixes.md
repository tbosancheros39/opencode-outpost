# Exhausted Fixes - Inline Query Debugging Log

**Date:** 2026-04-08  
**Issue:** `@OCTelegrambotLocalbot eli5: question` not returning visible results  
**Status:** UNRESOLVED - Multiple attempts made, root cause not identified

---

## Problem Statement

User types inline query format (`@OCTelegrambotLocalbot eli5: question`) in Telegram:
- Bot receives text as REGULAR messages (goes to `/eli5 what is quantum computing`)
- NO inline query handler logs generated
- `bot.on("inline_query", handleInlineQuery)` NOT being triggered

---

## Phase 1: Problem Identification

### Symptoms Observed
- User tests: `/eli5`, `/eli5 why does water in the sea have salt`, `/devils_advocate why...`
- All commands go to text handler (slash command path)
- No inline_query logs appear in bot logs
- Bot IS functioning - responds to slash commands

### User's Test Results
```
[8. 4. 2026. 20:30] T Sa: /eli5
[8. 4. 2026. 20:30] T Sa: /eli5 why does water in the sea have salt and cannot be drank?
[8. 4. 2026. 20:30] T Sa: /devils_advocate why does water in the sea have salt... (still same shit)
```

---

## Phase 2: Code Investigation

### Files Examined
- `src/bot/handlers/inline-query.ts` (332 lines)
- `src/bot/index.ts` (handler registration)
- `docs/stillstruggling.md` (prior debugging notes)
- `docs/InlineQueryFix.md` (prior debugging notes)

### Handler Registration (Verified CORRECT)
```typescript
// In src/bot/index.ts:
bot.on("inline_query", handleInlineQuery);
```
✅ Handler is registered BEFORE fallback text handler

### Code Issues Found & Fixed

**Issue 1: Malformed Code (Lines 358-369)**
- `logger.debug()` call INSIDE `buildSendQueryResult()` argument list
- `result` variable referenced before assignment
- Cause: Failed sed edit attempt from prior session

**Issue 2: TypeScript Type Error**
- `InlineQueryResult` is a union type
- `title` and `input_message_content` don't exist on all variants

**Fixes Applied:**
```typescript
// Type cast for debug logging
logger.debug("Sending query result", { result: result as any });

// Build result object correctly
const result: InlineQueryResultArticle = { ... };
```

**Build Status:** ✅ SUCCESS (0 errors)

---

## Phase 3: Process Conflicts

### Problem
Multiple bot instances running simultaneously causing 409 Conflict errors:
```
Failed to start bot: Call to 'getUpdates' failed! (409: Conflict: terminated by other getUpdates request)
```

### Processes Found
```
anini39  431508  /home/anini39/.opencode/bin/opencode serve --port 4096
anini39  432350  /usr/bin/node dist/index.js (Telegram bot)
anini39  432711  /usr/bin/node dist/index.js (Telegram bot - systemd watchdog restart)
```

### Resolution
- Killed processes manually with `kill PID`
- Identified systemd service: `opencode-telegram-bot.service`
- Used `sudo systemctl stop opencode-telegram-bot` to stop watchdog-restart cycle

---

## Phase 4: BotFather Configuration

### Verified Settings
| Setting | Status | Command |
|---------|--------|---------|
| Inline Mode | ✅ ENABLED | `/setinline` |
| Privacy Mode | ❓ UNKNOWN | `/setprivacy` |

### Commands Tested
- `/setinline` → Shows inline mode is enabled
- `/setprivacy` → NOT CHECKED YET

---

## Phase 5: Build & Deployment

### Commands Executed
```bash
# Build
npm run build  # ✅ Success

# Start with debug logging
cd /media/ext4_storage/workspace/OpenCodeTelegramBot/opencode-telegram-bot
LOG_LEVEL=debug node dist/index.js > /tmp/bot-new.log 2>&1 &

# Kill process
kill PID

# Systemd control
sudo systemctl stop opencode-telegram-bot
sudo systemctl start opencode-telegram-bot
```

### Systemd Service
```
● opencode-telegram-bot.service
   Loaded: loaded (/etc/systemd/system/opencode-telegram-bot.service)
   Active: active (running)
   Main PID: 432711 (node)
```

---

## Phase 6: What WAS Tested vs NOT Tested

### ✅ Verified & Working
- Handler registration in code
- Inline mode enabled in BotFather
- Code syntax fixed
- Build succeeds
- Bot receives updates from Telegram
- Slash commands work (/eli5, /devils_advocate)
- Bot responds to text messages

### ❌ NOT Verified / Unknown
- Privacy mode status in BotFather
- Direct inline query test in DM to bot
- Inline query handler logs when it ACTUALLY fires
- Compiled JS matches fixed source
- GrammY middleware configuration
- Whether inline_query event ever reaches handler

---

## Possible Root Causes (Not Ruled Out)

### 1. Privacy Mode Enabled (MOST LIKELY)
- BotFather `/setprivacy` might be blocking inline queries
- Inline queries in groups require disabled privacy mode
- **Action:** Check and disable privacy mode

### 2. Group vs DM Context
- Inline queries behave differently in groups vs DMs
- User may be testing in a context that blocks inline queries
- **Action:** Test inline query directly in DM to bot

### 3. Handler Silent Failure
- `handleInlineQuery` could throw without logging
- GrammY might catch and suppress the error
- **Action:** Add try/catch and explicit logging at entry

### 4. Middleware Interception
- GrammY middleware might intercept inline_query events
- Auth middleware or other middleware could block it
- **Action:** Check middleware chain in src/bot/index.ts

### 5. GrammY Config Issue
- Missing or incorrect grammY configuration
- Long polling configuration conflict
- **Action:** Review grammY setup in src/bot/index.ts

---

## Workaround Implemented (InlineQueryFix.md)

Instead of fixing inline query directly, the solution returns a SLASH COMMAND:
- When user sends inline query `eli5: question`
- Bot returns `/eli5 question` as inline result
- User taps it → goes to text handler → WORKS

**This workaround is functional but NOT the ideal solution.**

---

## Files Modified

| File | Change |
|------|--------|
| `src/bot/handlers/inline-query.ts` | Fixed syntax error (lines 358-369), fixed type error |

## Files Created

| File | Purpose |
|------|---------|
| `docs/stillstruggling.md` | Prior debugging notes |
| `docs/InlineQueryFix.md` | Prior debugging notes |

---

## Next Steps (Recommended)

1. **Check privacy mode NOW:**
   ```
   Send /setprivacy to @BotFather
   Select @OCTelegrambotLocalbot
   Choose "Disable" if enabled
   ```

2. **Test inline query in DM:**
   - Open chat with @OCTelegrambotLocalbot
   - Type "@OCTelegrambotLocalbot eli5: test" directly to bot
   - Check logs for inline_query event

3. **Add logging at handler entry:**
   ```typescript
   bot.on("inline_query", async (ctx) => {
     logger.debug("INLINE_QUERY_RECEIVED", { query: ctx.inlineQuery.query });
     // ... rest of handler
   });
   ```

4. **Verify compiled JS:**
   ```bash
   # Rebuild and verify timestamp
   npm run build && ls -la dist/bot/handlers/inline-query.js
   ```

---

## Commands Reference

```bash
# Stop bot & watchdog
sudo systemctl stop opencode-telegram-bot

# Check status
systemctl status opencode-telegram-bot --no-pager

# Start both (server first, then bot)
sudo systemctl start opencode-serve && sudo systemctl start opencode-telegram-bot

# View logs
journalctl -u opencode-telegram-bot -f
tail -f /tmp/bot-new.log
```

---

## Timeline

| Time | Action |
|------|--------|
| 2026-04-08 18:xx | Code fixes applied to inline-query.ts |
| 2026-04-08 18:xx | Build succeeded |
| 2026-04-08 19:xx | Process conflicts resolved |
| 2026-04-08 20:xx | Bot restarted via systemd |
| 2026-04-08 20:30 | User tested - inline still broken |

---

**Conclusion:** Multiple attempts made. Code is fixed. Root cause of inline_query handler not firing is UNKNOWN. Most likely issue is BotFather privacy mode.
