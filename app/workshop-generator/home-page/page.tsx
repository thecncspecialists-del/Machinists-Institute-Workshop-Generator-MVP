import { redirect } from "next/navigation";

import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function HomePageGeneratorPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  redirect("/workshop-generator/course-workspace");
}
