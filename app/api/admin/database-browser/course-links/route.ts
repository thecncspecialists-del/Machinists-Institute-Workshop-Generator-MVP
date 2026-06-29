import { NextResponse } from "next/server";
import { z } from "zod";

import { updateCourseLinksFromDatabaseBrowser } from "@/lib/admin-database-browser";
import { courseLinkFields } from "@/lib/admin-database-browser-shared";
import { requireAdminUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

const patchSchema = z.object({
  courseId: z.string().uuid(),
  links: z.object(Object.fromEntries(courseLinkFields.map((field) => [field, z.string().nullable().optional()]))).partial()
});

export async function PATCH(request: Request) {
  const authResult = await requireAdminUser();
  if (authResult.response || !authResult.user) {
    return authResult.response ?? NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = patchSchema.parse(await request.json());
  const result = await updateCourseLinksFromDatabaseBrowser({
    actor: { id: authResult.user.id, email: authResult.user.email },
    courseId: payload.courseId,
    links: payload.links,
    request
  });

  if (result.response) return result.response;
  return NextResponse.json(result.payload);
}
