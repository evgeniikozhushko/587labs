# Potential client conversation briefs

Status: idea for future development; not implemented.

## Goal

Capture meaningful conversations with potential clients and prepare a concise project brief for the 587 Labs owner to review and follow up on.

Example outcome: “Alex runs a bakery and wants to automate order tracking.”

## Proposed visitor experience

1. The visitor discusses their business problem with the assistant.
2. Once a specific project emerges, the assistant offers to prepare a brief for the 587 Labs team.
3. If the visitor agrees, collect their name and email for follow-up.
4. Generate a short summary and let the visitor review and correct it.
5. The visitor submits the brief. Save it on the server and notify the owner by email.
6. Confirm successful submission and explain the next step without promising a response time.

This is the recommended starting approach, not a confirmed product decision. An alternative is automatically saving internal summaries of promising conversations, including visitors who leave without submitting. Decide between these approaches before implementation.

## What makes a conversation worth reviewing?

Useful signals include a concrete business problem, a description of the current workflow, and a desired outcome. Relevant tools, project readiness, and expressed interest in working with 587 Labs can strengthen the signal.

A greeting, general AI question, or off-topic conversation alone should not trigger a lead submission. Exact qualification criteria remain to be defined.

## Example brief

> Alex runs a bakery and wants to automate customer order tracking. Orders arrive through Instagram and phone calls, and staff copy them into a spreadsheet. The goal is fewer missed orders and automatic customer updates. Contact: Alex, alex@example.com. Suggested next step: discuss the current tools and integration options.

Suggested fields:

- Name and contact email
- Business or industry
- Problem to solve
- Current workflow and relevant tools
- Desired outcome
- Timeline or other constraints, if volunteered
- Open questions for follow-up

Summaries must reflect what the visitor actually said. Mark missing information as unknown; do not invent requirements, budgets, timelines, or commitments.

## Implementation direction

- Use AI to identify a possible handoff and draft a structured brief.
- Use application code to validate submissions, save records, and send notifications.
- Add a server endpoint for lead submissions and durable database storage for a review queue.
- Notify the owner by email with the brief or a link to the saved lead.
- Keep summaries and contact information as the initial stored artifact. Full transcript storage is a separate decision.
- Report success only after durable storage succeeds. Avoid duplicate leads on retries and handle notification failures without losing the saved submission.

Existing conversation memory lives in the visitor's browser through `localStorage`. It restores their chat but cannot provide the owner with remote access or serve as the lead database.

## Decisions to revisit

- Visitor-approved submissions versus automatic internal capture
- Qualification criteria and when to offer a handoff
- Required contact fields
- Whether to retain a full transcript alongside the summary
- Database and email provider, notification destination, and owner review interface
- Visitor disclosure, retention period, deletion, and owner access controls
- Duplicate-submission handling and notification retry behavior

## Future acceptance checks

- A productive project discussion can produce an accurate, reviewable brief.
- Casual or off-topic chats do not become leads solely because a conversation occurred.
- Under the visitor-approved approach, nothing is submitted before confirmation.
- A submitted lead remains available independently of browser storage.
- Storage failures do not produce a false success message; retries do not create duplicate submissions.
- Email delivery failures preserve the lead for later review and notification retry.
- The existing conversation restore and reset behavior continues to work.
