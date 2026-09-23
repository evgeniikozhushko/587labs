import ChatPanel from '@/components/chat-panel'

export default function Home() {
  // const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <main className="flex min-h-dvh w-full justify-center overflow-x-hidden bg-background px-4 py-8 text-foreground sm:px-6 lg:items-center lg:py-12">
      <div className="flex w-full max-w-4xl flex-col items-start gap-8s lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <section className="flex w-full max-w-sm flex-col items-start gap-0 text-left lg:shrink-0">
          <h1 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
            587 Labs{" "}
          </h1>

          <h2 className="text-xl leading-10 text-zinc-800 dark:text-zinc-400">
            feels like{" "}
            <code className="inline-block rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
              magic
            </code>{" "}
          </h2>

          <p className="mt-10 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-600">
            Start with the chat to learn more.{" "}
            <span className="block">
              Or head over to{" "}
              <a
                href="https://587labs.com/docs"
                className="font-medium text-zinc-950 dark:text-zinc-50"
              >
                documentation
              </a>
              .
            </span>
          </p>
        </section>
        <ChatPanel /> 
      </div>
    </main>
  );
}
