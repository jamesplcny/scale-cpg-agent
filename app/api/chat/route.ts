import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "@/lib/buildSystemPrompt";
import type { ManufacturerConfig } from "@/lib/buildSystemPrompt";

const anthropic = new Anthropic();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function extractLead(text: string): Record<string, string> | null {
  const match = text.match(/<lead>([\s\S]*?)<\/lead>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function stripLeadTags(text: string): string {
  return text.replace(/<lead>[\s\S]*?<\/lead>/g, "").trim();
}

export async function POST(request: Request) {
  const { messages, manufacturerId } = await request.json();

  if (!messages || !manufacturerId) {
    return Response.json(
      { error: "messages and manufacturerId are required" },
      { status: 400 }
    );
  }

  // Fetch manufacturer config
  const { data: manufacturer, error: fetchError } = await supabase
    .from("manufacturers")
    .select("*")
    .eq("id", manufacturerId)
    .single();

  if (fetchError || !manufacturer) {
    return Response.json(
      { error: "Manufacturer not found" },
      { status: 404 }
    );
  }

  const config: ManufacturerConfig = {
    companyName: manufacturer.company_name,
    location: manufacturer.location,
    specialties: manufacturer.specialties,
    moqDetails: manufacturer.moq_details,
    leadTime: manufacturer.lead_time,
    certifications: manufacturer.certifications,
    capacity: manufacturer.capacity,
    faqs: manufacturer.faqs,
    dealBreakers: manufacturer.deal_breakers,
    tone: manufacturer.tone,
  };

  const systemPrompt = buildSystemPrompt(config);

  // Stream the response from Claude
  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  });

  // Collect the full text in the background for lead extraction
  let fullText = "";

  stream.on("text", (delta) => {
    fullText += delta;
  });

  // When streaming finishes, check for leads and save conversation
  stream.on("finalMessage", async () => {
    const lead = extractLead(fullText);

    const saveTasks: PromiseLike<unknown>[] = [];

    if (lead) {
      saveTasks.push(
        supabase.from("leads").insert({
          manufacturer_id: manufacturerId,
          contact_name: lead.contactName,
          company_name: lead.companyName,
          email: lead.email,
          phone: lead.phone || null,
          product_interest: lead.productInterest,
          estimated_volume: lead.estimatedVolume || null,
          target_launch_date: lead.targetLaunchDate || null,
          special_requirements: lead.specialRequirements || null,
        })
      );
    }

    saveTasks.push(
      supabase.from("conversations").insert({
        manufacturer_id: manufacturerId,
        messages: [
          ...messages,
          { role: "assistant", content: stripLeadTags(fullText) },
        ],
        lead_captured: !!lead,
      })
    );

    await Promise.all(saveTasks);
  });

  // Return a streaming response, stripping lead tags from the output
  const readable = stream.toReadableStream();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
