"use client";

import { use, useEffect, useRef, useState } from "react";
import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function stripLeadTags(text: string): string {
  return text.replace(/<lead>[\s\S]*?<\/lead>/g, "").trim();
}

export default function WidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { manufacturerId } = use(searchParams);

  if (!manufacturerId || typeof manufacturerId !== "string") {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-4">
        <p className="text-sm text-gray-400">
          Missing manufacturerId parameter.
        </p>
      </div>
    );
  }

  return <Chat manufacturerId={manufacturerId} />;
}

function Chat({ manufacturerId }: { manufacturerId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setStreaming(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, manufacturerId }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const stream = MessageStream.fromReadableStream(res.body);

      stream.on("text", (delta) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = {
            ...last,
            content: last.content + delta,
          };
          return copy;
        });
      });

      await stream.done();
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        };
        return copy;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-300 mt-8">
            How can we help you today?
          </p>
        )}
        <div className="mx-auto max-w-xl space-y-3">
          {messages.map((m, i) => {
            const display = stripLeadTags(m.content);
            return (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-blue-600 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-900 rounded-bl-md"
                  }`}
                >
                  {display || (
                    <span className="inline-flex gap-1 text-gray-400">
                      <span className="animate-pulse">...</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-xl gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message..."
            disabled={streaming}
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:bg-white disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
            aria-label="Send"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.105 2.29a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.084L2.28 16.76a.75.75 0 0 0 .826.95l15.25-5.75a.75.75 0 0 0 0-1.42L3.105 2.29Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
