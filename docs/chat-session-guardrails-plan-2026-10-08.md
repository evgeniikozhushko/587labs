# Bounded, saved lead-chat sessions

**Date:** 2026-10-08

## Summary

Limit each visitor session to 20 assistant replies. Show the limit from the first message, warn after replies 15 and 19, then close the chat with a fixed 587 Labs handoff on reply 20. The server—not browser state—will enforce the limit.

Only chats that contain a concrete project, workflow, or build request will be retained. Qualified chats are stored for 90 days in Supabase, summarized, and emailed privately through Resend when the session ends.

## Implementation changes

- Replace client-supplied chat history as the source of truth with an opaque, HttpOnly conversation-session cookie and server-persisted messages.
- Add Supabase tables for conversations, ordered messages, qualification/summary output, expiry time, and email-delivery status.
- Keep unfinished or non-qualified transcripts only temporarily; purge them within 24 hours. Retain qualified transcripts and summaries for 90 days, then delete them automatically.
- Enforce the 20-reply cap atomically on the server. Rate-limit public use further to 6 requests/minute and 40 generated replies/IP/day, using a peppered IP hash rather than a raw IP address.
- Preserve the current 2,000-character user-message limit; reduce maximum model output to 500 tokens. After reply 10, use a compact running conversation summary plus recent turns for model context, while keeping the full transcript for review.
- At reply 20, save the complete transcript, use structured model output to determine project intent and generate an accurate lead summary, and send qualified conversations through Resend to `CHAT_REVIEW_EMAIL`.
- The final visible message is fixed rather than model-generated: it thanks the visitor, explains the chat has reached its limit, and provides `hello@587labs.ca` plus the existing booking link. Disable the composer afterward.
- Show: “This chat is limited to 20 replies. Qualified conversations may be saved for 587 Labs follow-up.” under the composer, linked to the privacy policy.
- Add secure, scheduled retry handling for qualified records whose email delivery fails; storage succeeds before sending, so an email outage never loses the conversation.

## Interface and UX

- Extend `/api/chat` responses with authoritative session state: replies used, replies remaining, session status, and a terminal/locked indicator.
- Display a compact remaining-replies notice from reply 15 onward; at reply 19, make the upcoming final handoff explicit.
- “New chat” creates a separate server session; it cannot bypass the IP daily quota.
- Email includes the AI-written summary, qualification rationale, full transcript, session timestamps, and an expiry date. There is no dashboard in this phase.

## Test plan

- Verify normal chats close exactly after assistant reply 20, including concurrent requests and page reloads.
- Verify warning states at replies 15 and 19, disabled input after closure, and server enforcement when browser state is altered.
- Verify a concrete project chat is summarized, persisted, emailed once, and available for retry after a delivery failure.
- Verify general, off-topic, and abandoned chats are not retained past temporary processing.
- Verify context compaction retains earlier project details while capping model input growth.
- Verify rate limits, privacy notice, expiry cleanup, and Resend/Supabase failure responses.

## Assumptions

- Supabase provides the durable PostgreSQL database; Resend sends email.
- The private recipient and credentials are configured through environment variables, including `CHAT_REVIEW_EMAIL`, and are never exposed to visitors.
- “Qualified” means the visitor describes a specific business problem, current workflow, or requested software/automation project; expressing only general service interest does not qualify.
