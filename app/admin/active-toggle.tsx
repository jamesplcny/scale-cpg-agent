"use client";

import { useTransition } from "react";

export default function ActiveToggle({
  manufacturerId,
  active,
  toggleActive,
}: {
  manufacturerId: string;
  active: boolean;
  toggleActive: (id: string, current: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => toggleActive(manufacturerId, active))}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        active ? "bg-green-600" : "bg-gray-300"
      } ${pending ? "opacity-50" : ""}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
          active ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
