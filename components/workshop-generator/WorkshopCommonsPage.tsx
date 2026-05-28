"use client";

import { useRouter } from "next/navigation";

import { WorkshopCommonsSearch } from "@/components/workshop-generator/WorkshopCommonsSearch";

export function WorkshopCommonsPage() {
  const router = useRouter();

  return (
    <div style={{ maxWidth: 960 }}>
      <header className="page-header">
        <div>
          <div className="eyebrow">Workshop Commons</div>
          <h1 style={{ fontSize: "2rem", lineHeight: 1.06 }}>Search and Reopen Saved Workshops</h1>
          <p className="lede">
            Open any saved workshop as a starting point, then revise and copy updated HTML in the generator.
          </p>
        </div>
      </header>

      <WorkshopCommonsSearch onOpenWorkshop={(id) => router.push(`/workshop-generator?open=${id}`)} />
    </div>
  );
}
