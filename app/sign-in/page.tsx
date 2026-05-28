import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInForm } from "@/components/auth/SignInForm";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/workshop-generator");
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: "1.5rem" }}>
      <div style={{ width: "100%" }}>
        <header className="page-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="eyebrow">Machinists Institute</div>
            <h1 style={{ fontSize: "2rem", lineHeight: 1.05 }}>Workshop Generator Sign In</h1>
          </div>
        </header>
        <SignInForm />
      </div>
    </div>
  );
}
