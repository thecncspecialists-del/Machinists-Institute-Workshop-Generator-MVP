import { NextResponse } from "next/server";

import { queryDatabaseBrowser } from "@/lib/admin-database-browser";
import { requireAdminUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireAdminUser();
  if (authResult.response) return authResult.response;

  const url = new URL(request.url);
  const result = await queryDatabaseBrowser(url.searchParams);
  return NextResponse.json(result);
}
