"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { buildSystemPrompt } from "@/lib/buildSystemPrompt";
import type { ManufacturerConfig } from "@/lib/buildSystemPrompt";
import { createBrowserClient } from "@/lib/supabase";
import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Tag Input
// ---------------------------------------------------------------------------

function TagInput({
  label,
  tags,
  onChange,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setDraft("");
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((_, j) => j !== i))}
              className="text-blue-500 hover:text-blue-700"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ List
// ---------------------------------------------------------------------------

function FaqList({
  faqs,
  onChange,
}: {
  faqs: { q: string; a: string }[];
  onChange: (faqs: { q: string; a: string }[]) => void;
}) {
  function update(i: number, field: "q" | "a", value: string) {
    const next = faqs.map((f, j) => (j === i ? { ...f, [field]: value } : f));
    onChange(next);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        FAQs
      </label>
      <div className="space-y-4">
        {faqs.map((f, i) => (
          <div key={i} className="rounded-md border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-400 mt-2">
                #{i + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(faqs.filter((_, j) => j !== i))}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <input
              value={f.q}
              onChange={(e) => update(i, "q", e.target.value)}
              placeholder="Question"
              className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <textarea
              value={f.a}
              onChange={(e) => update(i, "a", e.target.value)}
              placeholder="Answer"
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...faqs, { q: "", a: "" }])}
        className="mt-3 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
      >
        + Add FAQ
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Panel
// ---------------------------------------------------------------------------

function ChatPanel({ manufacturerId }: { manufacturerId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

    // Add a placeholder for the assistant reply
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          manufacturerId,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Chat request failed");

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
    }
  }

  function stripLeadTags(text: string) {
    return text.replace(/<lead>[\s\S]*?<\/lead>/g, "").trim();
  }

  return (
    <div className="flex flex-col h-[500px] rounded-lg border border-gray-200">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-10">
            Send a message to test the agent.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {stripLeadTags(m.content) || (
                <span className="text-gray-400 italic">...</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <input
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
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function formToConfig(form: FormState): ManufacturerConfig {
  return {
    companyName: form.companyName,
    location: form.location,
    specialties: form.specialties,
    moqDetails: form.moqDetails,
    leadTime: form.leadTime,
    certifications: form.certifications,
    capacity: form.capacity,
    faqs: form.faqs,
    dealBreakers: form.dealBreakers
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    tone: form.tone,
  };
}

interface FormState {
  companyName: string;
  location: string;
  specialties: string[];
  moqDetails: string;
  leadTime: string;
  certifications: string[];
  capacity: string;
  faqs: { q: string; a: string }[];
  dealBreakers: string;
  tone: string;
}

const emptyForm: FormState = {
  companyName: "",
  location: "",
  specialties: [],
  moqDetails: "",
  leadTime: "",
  certifications: [],
  capacity: "",
  faqs: [],
  dealBreakers: "",
  tone: "professional and friendly",
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase
      .from("manufacturers")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            companyName: data.company_name ?? "",
            location: data.location ?? "",
            specialties: data.specialties ?? [],
            moqDetails: data.moq_details ?? "",
            leadTime: data.lead_time ?? "",
            certifications: data.certifications ?? [],
            capacity: data.capacity ?? "",
            faqs: data.faqs ?? [],
            dealBreakers: (data.deal_breakers ?? []).join("\n"),
            tone: data.tone ?? "professional and friendly",
          });
        }
        setLoading(false);
      });
  }, [id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setSaveMsg("");
    const config = formToConfig(form);
    const res = await fetch(`/api/admin/manufacturers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    setSaveMsg(res.ok ? "Saved" : "Error saving");
    if (res.ok) setTimeout(() => setSaveMsg(""), 2000);
  }

  const systemPrompt = buildSystemPrompt(formToConfig(form));

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to clients
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-8">
        {form.companyName || "Client details"}
      </h1>

      {/* ---- Config Form ---- */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Configuration</h2>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <TextInput
            label="Company name"
            value={form.companyName}
            onChange={(v) => set("companyName", v)}
          />
          <TextInput
            label="Location"
            value={form.location}
            onChange={(v) => set("location", v)}
          />
          <TextInput
            label="MOQ details"
            value={form.moqDetails}
            onChange={(v) => set("moqDetails", v)}
          />
          <TextInput
            label="Lead time"
            value={form.leadTime}
            onChange={(v) => set("leadTime", v)}
          />
          <TextInput
            label="Capacity"
            value={form.capacity}
            onChange={(v) => set("capacity", v)}
          />
          <TextInput
            label="Tone"
            value={form.tone}
            onChange={(v) => set("tone", v)}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <TagInput
            label="Specialties"
            tags={form.specialties}
            onChange={(v) => set("specialties", v)}
          />
          <TagInput
            label="Certifications"
            tags={form.certifications}
            onChange={(v) => set("certifications", v)}
          />
        </div>

        <div className="mt-6">
          <FaqList faqs={form.faqs} onChange={(v) => set("faqs", v)} />
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Deal-breakers (one per line)
          </label>
          <textarea
            value={form.dealBreakers}
            onChange={(e) => set("dealBreakers", e.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saveMsg && (
            <span
              className={`text-sm ${saveMsg === "Saved" ? "text-green-600" : "text-red-600"}`}
            >
              {saveMsg}
            </span>
          )}
        </div>
      </section>

      {/* ---- System Prompt Preview ---- */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">System prompt preview</h2>
        <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 border border-gray-200 p-4 text-xs text-gray-700 whitespace-pre-wrap">
          {systemPrompt}
        </pre>
      </section>

      {/* ---- Live Test Chat ---- */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Live test chat</h2>
        <ChatPanel manufacturerId={id} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple text input
// ---------------------------------------------------------------------------

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
