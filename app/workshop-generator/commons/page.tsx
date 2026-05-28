import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WorkshopCommonsPage } from "@/components/workshop-generator/WorkshopCommonsPage";

export const dynamic = "force-dynamic";

export default async function WorkshopCommonsRoutePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  return <WorkshopCommonsPage />;
}
