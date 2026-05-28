import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkshopGeneratorShell } from "@/components/workshop-generator/WorkshopGeneratorShell";

export const dynamic = "force-dynamic";

export default async function WorkshopGeneratorPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return <WorkshopGeneratorShell />;
}
