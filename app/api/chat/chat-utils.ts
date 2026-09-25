import type { NextRequest } from "next/server";

export type ChatHistoryItem = {
  role: "user" | "model";
  parts: { text: string }[];
};

export const MAX_MESSAGE_LENGTH = 2000;

export const JAILBREAK_PATTERNS = [
  /ignore (previous|prior|above|all) instructions?/i,
  /you are now/i,
  /pretend (to be|you are)/i,
  /developer mode/i,
  /DAN mode/i,
  /forget (everything|your instructions)/i,
];

export function isJailbreakAttempt(message: string): boolean {
  return JAILBREAK_PATTERNS.some((pattern) => pattern.test(message));
}

export function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return forwarded?.split(",")[0].trim() ?? realIp ?? "anonymous";
}

function isHistoryPart(value: unknown): value is { text: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

function isHistoryItem(value: unknown): value is ChatHistoryItem {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { role?: unknown }).role !== undefined &&
    ((value as { role?: unknown }).role === "user" ||
      (value as { role?: unknown }).role === "model") &&
    Array.isArray((value as { parts?: unknown }).parts) &&
    (value as { parts: unknown[] }).parts.every(isHistoryPart)
  );
}

export function normalizeHistory(history: unknown): ChatHistoryItem[] {
  if (!Array.isArray(history)) return [];
  return history.filter(isHistoryItem);
}

export function isValidMessage(message: unknown): message is string {
  return typeof message === "string" && message.trim().length > 0;
}