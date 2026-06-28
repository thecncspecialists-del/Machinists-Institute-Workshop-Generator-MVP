import { NextResponse } from "next/server";

import { isExternalLmsProvider, searchExternalLmsCatalog } from "@/lib/external-lms-catalog";
import { requireStaffUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireStaffUser();
  if (authResult.response) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const providerParam = url.searchParams.get("provider")?.trim() ?? "";
  const provider = providerParam && isExternalLmsProvider(providerParam) ? providerParam : providerParam === "all" ? "all" : "";
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) ? limitParam : undefined;

  return NextResponse.json(
    searchExternalLmsCatalog({
      provider,
      query: url.searchParams.get("q") ?? "",
      limit
    })
  );
}
