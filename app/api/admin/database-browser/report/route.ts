import {
  databaseBrowserReportFilename,
  databaseBrowserResultToCsv,
  queryDatabaseBrowser
} from "@/lib/admin-database-browser";
import { requireAdminUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireAdminUser();
  if (authResult.response) return authResult.response;

  const url = new URL(request.url);
  const result = await queryDatabaseBrowser(url.searchParams, { report: true });
  const csv = databaseBrowserResultToCsv(result);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${databaseBrowserReportFilename(result.dataset)}"`
    }
  });
}
