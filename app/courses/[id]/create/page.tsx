import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyCourseCreatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/create?courseId=${id}`);
}
