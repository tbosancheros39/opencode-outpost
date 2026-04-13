# Blindness Rule Fix (Pre-Implementation)

## Verdict
`BlindnessRule.md` identified the right core failure mode for our current inline launcher design.

The exact Telegram internals are more nuanced than "hard drop," but the official inline model confirms the practical outcome: **you cannot rely on receiving a normal `message` update when a user picks an inline result**.

Relevant official behavior from grammY/Telegram docs:

1. Inline results are **fire-and-forget**; after answering inline query results, the bot does not automatically know what was picked.
2. Selection feedback comes through **`chosen_inline_result`** (optional, BotFather-configured), not regular message flow.
3. `chosen_inline_result` is "sent to their chat partner", and does not give a normal chat command update path.

## Why This Matches Our Bot Symptoms

Our current flow in `src/bot/handlers/inline-query.ts` builds inline results with:

- `input_message_content.message_text = "/<command> <query>"`

And `src/bot/index.ts` expects command execution via:

- `bot.command("<inline command>", ...)`

This assumes the injected slash text will come back as a normal command update. In inline mode, that assumption is unreliable, which explains the observed "I see the text in chat, but nothing runs" behavior.

## What Needs to Be Fixed

Replace "inline sends slash text and hopes command handler receives it" with a callback-driven execution path.

1. In `inline-query.ts`, return inline results that include an inline keyboard button (e.g. `✅ Generate`) with callback data token (`inln_run:<id>`), not execution via raw slash message.
2. Store parsed `{ command, query, userId, createdAt }` in a short-lived in-memory cache keyed by that token.
3. Add a dedicated callback handler (e.g. `handleInlineRunCallback`) that:
   - validates token and ownership,
   - checks busy guard,
   - edits ack message,
   - dispatches existing LLM/queue pipeline,
   - deletes cache entry.
4. Register this callback handler in `src/bot/index.ts` inside `callback_query:data` handling chain.
5. Add i18n keys for expired/invalid callback token and callback execution failures.

## Notes on Alternatives

- `chosen_inline_result` alone is not sufficient for robust execution routing because it is optional feedback and not a full replacement for actionable chat callback context.
- The callback button pattern is aligned with grammY's inline documentation and existing callback handling architecture already used in this project.

## Acceptance Criteria for the Follow-Up Fix

1. Inline query always answers quickly (no LLM work in inline handler).
2. Tapping inline result button reliably triggers callback handler in DM.
3. Callback path launches the same guarded async LLM pipeline already used by slash/text commands.
4. No dependency remains on receiving bot-originated inline message text as a command update.
