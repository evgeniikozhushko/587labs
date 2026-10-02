'use client'
import { useEffect, useState } from "react";
import type { ChatHistoryItem } from "@/app/api/chat/chat-utils";
// import { Ratelimit } from "@upstash/ratelimit";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  label: string;
  text: string;
};

// Defines the storage name and data shape for the chat history
const CHAT_STORAGE_KEY = "587labs:chat:v1";

// Defines the data structure for the chat history
type SavedConversation = {
  version: 1;
  log: ChatMessage[]; // The chat history
  history: ChatHistoryItem[]; // The conversation history
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.text === "string" &&
    (value.role === "user" || value.role === "assistant")
  );
}

function isChatHistoryItem(value: unknown): value is ChatHistoryItem {
  return (
    isRecord(value) &&
    (value.role === "user" || value.role === "model") &&
    Array.isArray(value.parts) &&
    value.parts.every(
      (part: unknown) =>
        isRecord(part) && typeof part.text === "string",
    )
  );
}

function isSavedConversation(
  value: unknown,
): value is SavedConversation {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.log) &&
    value.log.every(isChatMessage) &&
    Array.isArray(value.history) &&
    value.history.every(isChatHistoryItem)
  );
}

// Helper function to get the saved chat history from localStorage
function getSavedConversation(): SavedConversation | null {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);

    if (!saved) return null;

    const parsed: unknown = JSON.parse(saved);

    if (!isSavedConversation(parsed)) return null;

    return parsed;
  } catch (error) {
    console.warn("Could not restore the conversation:", error);
    return null;
  }
}

function saveConversation(conversation: SavedConversation): void {
  try {
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify(conversation),
    );
  } catch (error) {
    console.warn("Could not save the conversation:", error);
  }
}

function clearSavedConversation(): void {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear the saved conversation:", error);
  }
}


// Helper function to get the error message from an unknown error
function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

const messages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    label: "587 Labs",
    text: "Hi, how can I help you?",
  },
  // {
  //   id: "prompt",
  //   role: "user",
  //   label: "You",
  //   text: "What can we build before the agent is connected?",
  // },
  // {
  //   id: "response",
  //   role: "assistant",
  //   label: "587 Labs",
  //   text: "Start with a static transcript that exercises the same scrolling surface the agent will use later.",
  // },
  // {
  //   id: "handoff",
  //   role: "assistant",
  //   label: "587 Labs",
  //   text: "When the agent API is ready, this list can be replaced by streamed messages without changing the layout.",
  // },
  // {
  //   id: "constraints",
  //   role: "user",
  //   label: "You",
  //   text: "Keep it quiet, fixed, and close to the future chat shape.",
  // },
  // {
  //   id: "confirmation",
  //   role: "assistant",
  //   label: "587 Labs",
  //   text: "That works. The shell can stay static while the message rows use role-based alignment and AI-compatible message fields.",
  // },
];

export default function Home() {

  const [input, setInput] = useState("");
  const [log, setLog] = useState<ChatMessage[]>(messages);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false); // Whether the chat history has been restored from localStorage

  // Restore the chat history from localStorage
  useEffect(() => {
    const saved = getSavedConversation();

    if (saved) {
      setLog(saved.log);
      setHistory(saved.history);
    }

    setRestored(true);
  }, []);

  // Save the chat history to localStorage when the chat history changes
  useEffect(() => {
    if (!restored || loading) return;

    const isFreshConversation =
      history.length === 0 &&
      log.length === 1 &&
      log[0].id === "welcome";

    if (isFreshConversation) {
      clearSavedConversation();
      return;
    }

    saveConversation({
      version: 1,
      log,
      history,
    });
  }, [restored, loading, log, history]);

  const lastMessageId = log[log.length - 1]?.id;

  // Helper function to generate a unique ID for each message
  function nextId() {
    return crypto.randomUUID();
  }

  // Start a new conversation
  function startNewConversation() {
    if (!restored || loading) return;

    setInput("");
    setLog(messages);
    setHistory([]);
  }

  // SUBMIT //
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restored || loading || !input.trim()) return;

    const query = input;
    setInput("");
    setLoading(true);

    // Show the user's message immediately, before the fetch
    setLog((prev) => [
      ...prev,
      { id: nextId(), role: "user", label: "You", text: query },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, history }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setLog((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", label: "587 Labs", text: data.error },
        ]);
        return;
      }

      // if (res.status === 429) {
      //   setLog((prev) => [
      //     ...prev,
      //     { query, response: `*** RATE LIMITED: ${data.error} ***` },
      //   ]);
      //   return;
      // }

      if (!res.ok) {
        setLog((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", label: "587 Labs", text: data.error || "Unknown error" },
        ]);
        return;
      }

      // if (!res.ok) {
      //   setLog((prev) => [
      //     ...prev,
      //     { query, response: `*** ERROR: ${data.error || "Unknown"} ***` },
      //   ]);
      //   return;
      // }

      if (Array.isArray(data.history)) {
        setHistory(data.history);
      }
      setLog((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", label: "587 Labs", text: data.response },
      ]);
    } catch (error) {
      setLog((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", label: "587 Labs", text: getErrorMessage(error) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  //     if (Array.isArray(data.history)) {
  //       setHistory(data.history);
  //     }
  //     setLog((prev) => [...prev, { query, response: data.response }]);
  //   } catch (error) {
  //     setLog((prev) => [
  //       ...prev,
  //       { query, response: `*** ERROR: ${getErrorMessage(error)} ***` },
  //     ]);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  return (

    <Card className="h-[min(70dvh,35rem)] min-h-[28rem] w-full max-w-lg overflow-hidden lg:h-[35rem]">
      <CardHeader className="border-b border-border">
        <CardTitle>587 Labs</CardTitle>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={startNewConversation}
          disabled={!restored || loading}
          className="self-start"
        >
          New conversation
        </Button>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
        <MessageScrollerProvider>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent className="gap-4 p-4">
                {log.map((message) => {
                  const align = message.role === "user" ? "end" : "start";

                  return (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={message.id === lastMessageId}
                    >
                      <Message align={align}>
                        <MessageContent>
                          <MessageHeader
                            className={
                              align === "end" ? "justify-end" : undefined
                            }
                          >
                            {message.label}
                          </MessageHeader>
                          <Bubble
                            align={align}
                            variant={
                              message.role === "user"
                                ? "default"
                                : "secondary"
                            }
                          >
                            <BubbleContent>{message.text}</BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  );
                })}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </CardContent>
      <CardFooter className="border-t border-border">
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center gap-2"
        >
          <Input
            type="text"
            aria-label="Message to 587 Labs"
            className="min-w-0 flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask 587 Labs..."
            autoComplete="off"
            spellCheck={false}
            disabled={!restored || loading}
          />
          <Button
            type="submit"
            disabled={!restored || loading}
          >
            {loading ? "Sending..." : "Send"}
          </Button>
        </form>
      </CardFooter>
    </Card>

    //   <main className="flex min-h-dvh w-full justify-center overflow-x-hidden bg-background px-4 py-8 text-foreground sm:px-6 lg:items-center lg:py-12">
    //     <div className="flex w-full max-w-4xl flex-col items-start gap-8s lg:flex-row lg:items-center lg:justify-between lg:gap-16">
    //       <section className="flex w-full max-w-sm flex-col items-start gap-0 text-left lg:shrink-0">
    //         <h1 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
    //           587 Labs{" "}
    //         </h1>

    //         <h2 className="text-xl leading-10 text-zinc-800 dark:text-zinc-400">
    //           feels like{" "}
    //           <code className="inline-block rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
    //             magic
    //           </code>{" "}
    //         </h2>

    //         <p className="mt-10 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-600">
    //           Start with the chat to learn more.{" "}
    //           <span className="block">
    //             Or head over to{" "}
    //             <a
    //               href="https://587labs.com/docs"
    //               className="font-medium text-zinc-950 dark:text-zinc-50"
    //             >
    //               documentation
    //             </a>
    //             .
    //           </span>
    //         </p>
    //       </section>
    //     </div>
    //   </main>
  );
}
