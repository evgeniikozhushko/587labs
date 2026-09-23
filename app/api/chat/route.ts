import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "./system-prompts";
import {
  checkRateLimits,
  recordAbuseAttempt,
  type RateLimitResult,
} from "./rate-limit";
import {
  getClientIdentifier,
  isJailbreakAttempt,
  isValidMessage,
  MAX_MESSAGE_LENGTH,
  normalizeHistory,
} from "./chat-utils";

const CHAT_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

function getClient() {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}

function isValidBody(value: unknown): value is {
  message?: unknown;
  history?: unknown;
} {
  return typeof value === "object" && value !== null;
}

function successHeaders(rateLimit: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.reset),
  };
}

function errorHeaders(rateLimit: RateLimitResult) {
  const retryAfter = Math.max(1, Math.ceil((rateLimit.reset - Date.now()) / 1000));

  return {
    "Retry-After": String(retryAfter),
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.reset),
  };
}

function rateLimitMessage(tier?: string) {
  switch (tier) {
    case "burst":
      return "You're sending messages too fast. Please wait a few seconds and try again.";
    case "minute":
      return "You've hit the per-minute limit. Please try again in a minute.";
    case "daily":
      return "You've hit today's limit. Please try again tomorrow or email support@freakmount.com.";
    default:
      return "You're sending messages too fast. Please try again in a moment.";
  }
}

async function parseRequestBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const identifier = getClientIdentifier(request);

    const rateLimit = await checkRateLimits(identifier);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: rateLimitMessage(rateLimit.tier),
          retryAfter: Math.max(
            1,
            Math.ceil((rateLimit.reset - Date.now()) / 1000),
          ),
        },
        {
          status: 429,
          headers: errorHeaders(rateLimit),
        },
      );
    }

    const body = await parseRequestBody(request);
    if (!isValidBody(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const message = body.message;
    const history = normalizeHistory(body.history);

    if (!isValidMessage(message)) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 },
      );
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)` },
        { status: 400 },
      );
    }

    if (isJailbreakAttempt(message)) {
      const abuse = await recordAbuseAttempt(identifier);

      if (!abuse.success) {
        return NextResponse.json(
          {
            error:
              "Too many policy violations. Access temporarily restricted. Email support@freakmount.com if this is in error.",
          },
          {
            status: 429,
            headers: errorHeaders(abuse),
          },
        );
      }

      const response =
        "I can only help with Freakmount-related questions. What can I help you with today?";
      const updatedHistory = [
        ...history,
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ text: response }] },
      ];
      return NextResponse.json(
        { response, history: updatedHistory },
        { headers: successHeaders(rateLimit) },
      );
    }

    const chat = getClient().chats.create({
      model: CHAT_MODEL,
      history,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 300,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage({ message });
    const response = result.text ?? "";

    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: message }] },
      { role: "model", parts: [{ text: response }] },
    ];

    return NextResponse.json(
      { response, history: updatedHistory },
      {
        headers: successHeaders(rateLimit),
      },
    );
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
