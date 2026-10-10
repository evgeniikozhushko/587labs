# Pinecone Knowledge Base + LangSmith Observability

**Date:** 2026-10-09

## Summary

Add a focused RAG release to the existing Gemini chat: Pinecone will index only reviewed 587 Labs Markdown knowledge, Gemini will embed and answer from retrieved context, and LangSmith will record redacted operational traces. Conversations and lead-session persistence remain out of scope for this release.

Use the native Gemini and Pinecone SDKs—no migration to a LangChain chat stack. Pinecone is intended for semantic knowledge retrieval, not conversation storage.

## Implementation changes

- Create a version-controlled `knowledge/` directory of approved Markdown documents, with required frontmatter: `title`, `slug`, `canonicalUrl`, `category`, and `updatedAt`. Seed it by splitting the stable factual portions of the current system prompt into services, process, technology, contact, and FAQ documents.
- Add `npm run knowledge:sync` to validate documents, chunk them deterministically (target 600 tokens with 100-token overlap), embed with `gemini-embedding-2` at 768 dimensions using document retrieval mode, and upsert to one Pinecone serverless cosine index.
- Store chunk text plus source metadata in Pinecone. Generate deterministic IDs from source slug, content hash, and chunk index; remove stale vectors when a source is revised or deleted. Use a `public` namespace for this site's approved knowledge only.
- Add server-only knowledge services for embeddings, Pinecone retrieval, source formatting, and ingestion. The chat route retrieves the top four chunks before its Gemini generation call, applies an initial relevance threshold of `0.70`, and adds only qualifying context to the model prompt.
- Amend the model instructions: factual claims about 587 Labs must be grounded in retrieved sources; if no source clears the threshold, explain that the bot cannot verify the detail and offer email/booking handoff. Preserve the existing jailbreak, topic, rate-limit, model, and UI behavior.
- Extend successful `/api/chat` responses with an optional `sources: Array<{ title; url }>` field. Update the client's saved conversation schema and assistant-message rendering to show up to two compact source links below grounded answers; messages without retrieval remain unchanged.
- Add `@pinecone-database/pinecone` and `langsmith`. Configure server-only environment variables: `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, optional `PINECONE_NAMESPACE`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT=587labs-chat`, `LANGSMITH_TRACING`, and optional regional `LANGSMITH_ENDPOINT`. Document them in `.env.example`; never expose them with `NEXT_PUBLIC_`.
- Instrument retrieval and response generation with LangSmith's SDK using redacted inputs and outputs only: request type, message length, selected source IDs, scores, counts, model IDs, latency, branch outcome, and errors. Do not send raw visitor messages, replies, email addresses, IPs, full retrieved chunks, or conversation IDs to LangSmith. Tracing must be best-effort and fail open.

## Test plan

- Add a small, versioned RAG evaluation set covering service questions, contact details, irrelevant prompts, ambiguous questions, and unsupported factual claims; sync it to a LangSmith dataset through `npm run eval:rag`.
- Test document/frontmatter validation, deterministic chunk IDs, changed/deleted-source cleanup, metadata mapping, and embedding/vector dimension checks.
- Mock Pinecone and Gemini to verify retrieved context is injected only above threshold, source links are returned correctly, no-result answers use the verification fallback, and retrieval failures do not block normal chat.
- Verify LangSmith trace payloads contain only approved metadata, tracing failures do not affect chat responses, and existing rate-limit/topic/jailbreak paths still bypass unnecessary retrieval.
- Run lint, production build, ingestion dry run, and the evaluation suite before enabling production retrieval. Use LangSmith traces and the evaluation dataset to calibrate the initial `0.70` relevance threshold before rollout.

## Assumptions

- `gemini-embedding-2` with 768-dimensional vectors and a Pinecone serverless cosine index are the initial retrieval configuration.
- Knowledge changes are made through reviewed repository Markdown and deployed via `knowledge:sync`; no website crawler, client uploads, or private client documents are included.
- The browser continues to own only its current local chat history in this phase; Supabase-backed sessions, reply caps, qualification, and email delivery remain a later release.
