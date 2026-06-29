import { Role } from "@prisma/client";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { auth } from "@/auth";
import { DatabaseBrowserClient } from "@/components/admin/DatabaseBrowserClient";
import { buildCourseBreadcrumbs, EditorBreadcrumbs } from "@/components/workshop-generator/EditorStatus";
import { queryDatabaseBrowser } from "@/lib/admin-database-browser";

export const dynamic = "force-dynamic";

type DatabaseBrowserSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DatabaseBrowserPage({ searchParams }: { searchParams: DatabaseBrowserSearchParams }) {
  const params = normalizeParams(await searchParams);
  const session = await auth();
  const isAdmin = session?.user?.role === Role.ADMIN;

  if (!isAdmin) {
    const signedInAs = session?.user?.email ?? "Not signed in";
    const detectedRole = session?.user?.role ?? "No session";
    return (
      <>
        <header className="page-header">
          <div>
            <EditorBreadcrumbs items={[...buildCourseBreadcrumbs(), { label: "Database Browser" }]} />
            <h1>Database Browser</h1>
          </div>
        </header>
        <section className="panel empty-state">
          <ShieldAlert size={28} />
          <h2>Admin access required</h2>
          <p>This tool is limited to administrators because it exposes operational records and report exports.</p>
          <div className="access-diagnostic">
            <span>Signed in as</span>
            <strong>{signedInAs}</strong>
            <span>Detected role</span>
            <strong>{detectedRole}</strong>
          </div>
          {session?.user ? (
            <p className="inline-notice">Sign out and sign back in with an admin account if this role looks wrong.</p>
          ) : (
            <Link className="btn primary" href="/sign-in">
              Sign In
            </Link>
          )}
        </section>
      </>
    );
  }

  const result = await queryDatabaseBrowser(params);

  return (
    <>
      <header className="page-header">
        <div>
          <EditorBreadcrumbs items={[...buildCourseBreadcrumbs(), { label: "Database Browser" }]} />
          <h1>Database Browser</h1>
          <p className="lede">Admin-only operational views with safe filtering, sorting, expansion, and CSV reports.</p>
        </div>
      </header>

      <DatabaseBrowserClient result={result} params={params} />
    </>
  );
}

function normalizeParams(rawParams: Record<string, string | string[] | undefined>) {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawParams)) {
    params[key] = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }
  return params;
}
