Here's how you'd frame it as an orchestrator task brief — written in the style that agentic systems expect (goal, context, constraints, decomposition hints):

---

## Orchestrator Task Brief

```
TASK: Refactor Telegram-OpenCode bot architecture to implement 
optimistic acknowledgment pattern with async result delivery.

CONTEXT:
- Runtime: Grammy (TypeScript/Deno or Node)
- Existing: Per-group session binding via my_chat_member events
- Existing: SQLite/Redis persistence layer
- Existing: OpenCode CLI invocation as async subprocess
- Problem: LLM requests block the message handler thread, 
  causing Telegram webhook timeouts and poor UX

GOAL:
Decouple message receipt from LLM response delivery. 
Bot must acknowledge instantly and edit-in-place when result is ready.

WORKER ASSIGNMENTS:

[Worker 1 — Message Handler Refactor]
- Wrap all text handlers in immediate ctx.reply() ack
- Make ack message_id available to downstream workers
- Ensure handler returns before OpenCode job fires
- Rotate ack strings from a configurable pool

[Worker 2 — Job Queue / Async Runner]
- Implement lightweight job queue (in-memory or Redis-backed)
- Each job carries: chat_id, message_id, ack_message_id, query
- Worker pulls job, calls OpenCode, resolves result
- Emit result event on completion or timeout

[Worker 3 — Result Delivery]
- Listen for job completion events
- editMessageText(chat_id, ack_message_id, result)
- Handle edge cases: result too long (split/truncate), 
  Markdown parse errors, deleted ack message
- On failure: edit ack with error string, log to persistence

[Worker 4 — Session Integrity Check]
- Verify session is still valid before delivering result
- If session expired mid-request, drop result gracefully
- No orphaned edits to messages in dead sessions

CONSTRAINTS:
- No additional LLM calls per request (ack is static/offline)
- Webhook must return 200 in < 5s
- Job state must survive bot restart (persist to SQLite)
- Single request per user query — no retry spam

SUCCESS CRITERIA:
- User receives ack < 500ms after sending message
- Ack message edits in-place with result when ready
- No Telegram webhook timeout errors in logs
- Existing session-binding logic untouched
```

---

This gives the orchestrator enough to slice cleanly into parallel worker tracks without ambiguity. Worker 2 and 3 are the critical path — everything else is a wrapper around them. Want me to scaffold the actual code structure for any of the workers?
