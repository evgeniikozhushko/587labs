import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

const messages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    label: "587 Labs",
    text: "Hi. I can help scope, design, and ship practical AI systems.",
  },
  {
    id: "prompt",
    role: "user",
    label: "You",
    text: "What can we build before the agent is connected?",
  },
  {
    id: "response",
    role: "assistant",
    label: "587 Labs",
    text: "Start with a static transcript that exercises the same scrolling surface the agent will use later.",
  },
  {
    id: "handoff",
    role: "assistant",
    label: "587 Labs",
    text: "When the agent API is ready, this list can be replaced by streamed messages without changing the layout.",
  },
  {
    id: "constraints",
    role: "user",
    label: "You",
    text: "Keep it quiet, fixed, and close to the future chat shape.",
  },
  {
    id: "confirmation",
    role: "assistant",
    label: "587 Labs",
    text: "That works. The shell can stay static while the message rows use role-based alignment and AI-compatible message fields.",
  },
];

export default function Home() {
  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-background p-4 text-foreground">

      <div className="max-w-sm flex flex-col items-center gap-6 sm:items-start sm:text-left mr-60">

        <h1 className="max-w-sm text-3xl font-semibold leading-2 tracking-tight text-black dark:text-zinc-50">
          587 Labs{" "}
        </h1>

        <h2 className="text-xl leading-6 text-zinc-800 dark:text-zinc-400">feels like{" "}
          <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
            magic
          </code>{" "}
        </h2>

        <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-600">
          Start with the chat to learn more{" "}
          <span className="block">
            Or head over to{" "}
            <a href="https://587labs.com/docs" className="font-medium text-zinc-950 dark:text-zinc-50">
              documentation
            </a>
            .
          </span>
        </p>

      </div>

      <Card className="h-[35rem] w-[calc(100vw-5rem)] max-w-sm overflow-hidden sm:w-full">
        <CardHeader className="border-b border-border">
          <CardTitle>587 Labs</CardTitle>
          <CardDescription>Static chat preview</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <MessageScrollerProvider>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent className="gap-4 p-4">
                  {messages.map((message) => {
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
                              className={align === "end" ? "justify-end" : undefined}
                            >
                              {message.label}
                            </MessageHeader>
                            <Bubble
                              align={align}
                              variant={
                                message.role === "user" ? "default" : "secondary"
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
          <div className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-sm text-muted-foreground">
            Ask 587 Labs...
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
