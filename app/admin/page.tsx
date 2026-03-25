import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import ActiveToggle from "./active-toggle";

async function toggleActive(id: string, current: boolean) {
  "use server";
  const supabase = await createServerClient();
  await supabase
    .from("manufacturers")
    .update({ active: !current })
    .eq("id", id);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const supabase = await createServerClient();

  const { data: manufacturers } = await supabase
    .from("manufacturers")
    .select("id, company_name, plan, active, created_at")
    .order("created_at", { ascending: false });

  const ids = (manufacturers ?? []).map((m) => m.id);

  // Fetch lead counts per manufacturer in one query
  const { data: leadCounts } = ids.length
    ? await supabase.rpc("get_lead_counts", { manufacturer_ids: ids })
    : { data: [] };

  const countMap = new Map<string, number>(
    (leadCounts ?? []).map((r: { manufacturer_id: string; count: number }) => [
      r.manufacturer_id,
      r.count,
    ])
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <Link
          href="/admin/clients/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
        >
          New client
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Company
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Plan
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Active
              </th>
              <th className="px-6 py-3 text-left font-semibold text-gray-700">
                Leads
              </th>
              <th className="px-6 py-3 text-right font-semibold text-gray-700">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(manufacturers ?? []).map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                  {m.company_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PlanBadge plan={m.plan} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <ActiveToggle
                    manufacturerId={m.id}
                    active={m.active}
                    toggleActive={toggleActive}
                  />
                </td>
                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                  {countMap.get(m.id) ?? 0}
                </td>
                <td className="px-6 py-4 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/clients/${m.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {(manufacturers ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-10 text-center text-gray-400"
                >
                  No clients yet. Add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-gray-100 text-gray-700",
    starter: "bg-blue-100 text-blue-700",
    pro: "bg-purple-100 text-purple-700",
    enterprise: "bg-amber-100 text-amber-700",
  };

  const cls = colors[plan?.toLowerCase()] ?? colors.free;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {plan ?? "free"}
    </span>
  );
}
