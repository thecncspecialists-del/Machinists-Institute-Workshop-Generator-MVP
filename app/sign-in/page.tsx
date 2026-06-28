import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInForm } from "@/components/auth/SignInForm";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/courses");
  }

  return (
    <div className="sign-in-page">
      <div className="sign-in-card-wrap">
        <header className="sign-in-header">
          <div>
            <div className="eyebrow">Machinists Institute</div>
            <h1>Canvas Asset Builder Sign In</h1>
          </div>
        </header>
        <SignInForm />
      </div>
    </div>
  );
}
