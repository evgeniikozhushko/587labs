# Bounded, saved lead-chat architecture

## Summary

Move chat authority from browser storage to Supabase-backed server sessions. A secure cookie identifies the session; Supabase owns messages, reply counts, qualifications, retention, quotas, and delivery state. Vercel Cron finalizes idle conversations, retries email, and purges expired data.

## Key changes

- Add server-only Supabase and Resend integrations plus a SQL migration:
  - `conversations`: opaque-session-token digest, peppered IP hash, status (`active`, `processing`, `closed`), reply count, activity/finalization/expiry timestamps, running context summary, qualification result, and closure reason.
  - `conversation_messages`: ordered immutable user/assistant messages, including fixed handoff messages.
  - `email_deliveries`: one delivery record per qualified conversation with attempt count, next retry time, provider idempotency key, and sent/failure state.
  - Enable RLS with no public table access; only server-side service-role calls access these records.

- Replace client-supplied `history` with these APIs:
  - `GET /api/chat` restores the current conversation transcript and authoritative state after reload.
  - `POST /api/chat` accepts only `{ message, requestId }`; returns the assistant message and `{ repliesUsed, repliesRemaining, status, locked }`.
  - `POST /api/chat/session` creates a separate session for “New chat” and rotates the HttpOnly, Secure, SameSite=Lax cookie.
  - The cookie contains only a random opaque token; Supabase stores its keyed digest. Browser storage may hold no authoritative transcript or counters.

- Make turn creation atomic in a Supabase RPC/transaction:
  - Lock the conversation and reserve the turn before any model call; reject a different concurrent request while one is in progress and replay a completed result for the same `requestId`.
  - Enforce the 20-assistant-reply cap server-side. The twentieth assistant message is the fixed 587 Labs handoff, includes `hello@587labs.ca` and the existing booking URL, and closes/locks the session without a model call.
  - Apply the existing 2,000-character input cap and reduce Gemini output to 500 tokens.
  - Treat deterministic topic/jailbreak replies as assistant replies for the per-session cap; model-generated replies consume the daily generated-reply quota.

- Persist rate-limit state in Supabase alongside the session system:
  - Hash the trusted request IP with `IP_HASH_PEPPER`; never store raw IP addresses.
  - Enforce 6 requests/minute and 40 model-generated replies/IP/day atomically, independent of the session cookie.
  - Keep the current fail-safe topic behavior: classifier failure allows the normal chat flow, while database failures return a safe retryable error rather than bypassing session limits.

- Build model context exclusively from persisted messages. After reply 10, maintain a compact running summary of older turns and send it with the six most recent complete turns; retain the full transcript unchanged for review and lead processing.

- Finalize conversations through one shared workflow:
  - Reply 20 queues finalization immediately.
  - Vercel Cron runs every five minutes. It atomically claims active conversations idle for 30 minutes, closes them, evaluates structured qualification/lead-summary output, and queues qualified deliveries.
  - Qualified conversations are retained for 90 days; unqualified or abandoned conversations are retained only for temporary processing and purged within 24 hours.
  - A closed idle session cannot resume; the visitor uses “New chat.” This produces one stable transcript and at most one lead delivery.
  - Delivery retries use bounded exponential backoff through the 90-day retention window. Provider idempotency is keyed to the conversation delivery record so retries do not create duplicate notifications.

- Update the chat UI:
  - Hydrate from the server instead of `localStorage`.
  - Display the authoritative remaining-replies notice from reply 15; make the final handoff explicit at reply 19.
  - Disable the composer for locked sessions, retain “New chat,” and render server errors without inventing local state.
  - Add the required privacy notice beneath the composer and create `/privacy`, covering chat processing, qualification, retention periods, and potential 587 Labs follow-up.

- Configure server-only environment variables: Supabase URL/service-role key, `GEMINI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CHAT_REVIEW_EMAIL`, `CHAT_SESSION_SECRET`, `IP_HASH_PEPPER`, and `CRON_SECRET`. Protect cron endpoints with the cron secret.

## Test plan

- Unit-test validation, cookie-token hashing, quota bucketing, final-handoff construction, context compaction, qualification parsing, and retry scheduling.
- Integration-test atomic concurrent turn submission, replay by `requestId`, reload restoration, browser-history tampering, 20th-reply closure, and IP quotas across newly created sessions.
- Test idle finalization at 30 minutes, qualified/unqualified retention windows, 90-day purge, one-time email delivery, provider failure retries, and cron authorization.
- Add UI tests for replies-15/19 notices, locked composer behavior, “New chat,” privacy link, and authoritative server-state recovery after page reload.

## Assumptions

- Vercel Cron is the scheduler and runs every five minutes.
- A concrete business problem, workflow, or requested software/automation project qualifies as a lead; general service interest does not.
- Idle qualified chats are finalized and delivered after 30 minutes, even below 20 replies; returning visitors start a new session.
- The existing booking URL remains `https://calendar.app.google/B7xUm6MqY8LfA7bC7`.
