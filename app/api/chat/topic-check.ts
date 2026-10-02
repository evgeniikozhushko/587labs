// experimental_evaluate runs a small, fast "judge" model call that scores an
// input against a yes/no question, instead of invoking the full chat model.
import { experimental_evaluate as evaluate } from "ai";
import type { ChatHistoryItem } from "./chat-utils";

// Lightweight model used only for the on-topic classification, not for
// generating the actual chat reply.
const TOPIC_CHECK_MODEL = "typesafe-ai/jev";
// Abort the check quickly so a slow/hung judge call never delays the real
// chat response for long.
const TOPIC_CHECK_TIMEOUT_MS = 2000;

// p(on-topic) below this skips the chat model. 0.3–0.6 is ambiguous and, like
// anything above 0.6, falls through: a false "off-topic" costs a lead.
const OFF_TOPIC_THRESHOLD = 0.3;

// Canned reply sent to the user in place of a chat model response when
// isConfidentlyOffTopic() returns true.
export const OFF_TOPIC_RESPONSE =
  "I'm here to help with AI, automation, and software projects at 587 Labs. Is there something along those lines you're working on?";

// Extracts the text of the assistant's most recent reply from the chat
// history, if the last turn was from the model. Used to give the topic
// checker conversational context (so a short follow-up like "how much?"
// can be judged against what was just discussed) rather than judging the
// new message in isolation. Returns undefined if there's no prior model
// turn (e.g. this is the first message).
function lastModelReply(history: ChatHistoryItem[]) {
  const last = history.at(-1);
  return last?.role === "model"
    ? last.parts.map((part) => part.text).join("")
    : undefined;
}

// Guardrail run before the real chat model replies. It asks a cheap judge
// model whether the incoming message is on-topic for 587 Labs (AI,
// automation, software services), and reports "confidently off-topic" only
// when the judge is quite sure it isn't — everything else (on-topic,
// ambiguous, or unknown because the check itself failed) is treated as
// on-topic so the chat model still gets a chance to answer.
export async function isConfidentlyOffTopic(
  message: string,
  history: ChatHistoryItem[],
): Promise<boolean> {
  try {
    // If the previous turn was the model's, pass it along as extra state so
    // the judge can read the new message in context (e.g. short replies to
    // its own last question) instead of cold, on its own.
    const previousReply = lastModelReply(history);
    const result = await evaluate({
      model: TOPIC_CHECK_MODEL,
      state: previousReply ? { previousReply, message } : message,
      // A single yes/no question the judge model scores with a probability
      // rather than a hard boolean, which is what lets us threshold on
      // confidence below instead of trusting a single true/false verdict.
      questions: {
        onTopic: {
          type: "boolean",
          instructions:
            "Is this message related to AI, automation, or software development services a business might want to build or hire for?",
          criteria: {
            true: "The message is about AI, automation, software, or a business problem those could solve; or asks about 587 Labs, its services, pricing, process, or contact details; or is a greeting or a follow-up to the previous reply.",
            false:
              "The message is clearly unrelated, e.g. trivia, homework, recipes, general chit-chat, or requests for content unrelated to a business's software or AI needs.",
          },
        },
      },
      // Bail out of the judge call after TOPIC_CHECK_TIMEOUT_MS so it can
      // never meaningfully delay the actual chat response.
      abortSignal: AbortSignal.timeout(TOPIC_CHECK_TIMEOUT_MS),
      // Tell the AI gateway not to retain/log this request's data.
      providerOptions: { gateway: { zeroDataRetention: true } },
    });

    // Only flag as off-topic when the model is confidently below the
    // threshold; anything in the ambiguous/on-topic range falls through.
    return result.answers.onTopic.probability < OFF_TOPIC_THRESHOLD;
  } catch (error) {
    // Missing key, timeout, gateway error: never block the real reply on this.
    console.warn("Topic check failed, falling through to chat model:", error);
    console.error('GATEWAY_FALLBACK', error)
    return false;
  }
}