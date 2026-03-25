import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updateFields: Record<string, unknown> = {};
  if (body.companyName !== undefined) updateFields.company_name = body.companyName;
  if (body.location !== undefined) updateFields.location = body.location;
  if (body.specialties !== undefined) updateFields.specialties = body.specialties;
  if (body.moqDetails !== undefined) updateFields.moq_details = body.moqDetails;
  if (body.leadTime !== undefined) updateFields.lead_time = body.leadTime;
  if (body.certifications !== undefined) updateFields.certifications = body.certifications;
  if (body.capacity !== undefined) updateFields.capacity = body.capacity;
  if (body.faqs !== undefined) updateFields.faqs = body.faqs;
  if (body.dealBreakers !== undefined) updateFields.deal_breakers = body.dealBreakers;
  if (body.tone !== undefined) updateFields.tone = body.tone;

  if (Object.keys(updateFields).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("manufacturers")
    .update(updateFields)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return Response.json({ error: "Manufacturer not found" }, { status: 404 });
  }

  return Response.json(data);
}
