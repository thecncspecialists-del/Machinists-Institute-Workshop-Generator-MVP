"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function SignInForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/workshop-generator"
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setIsPending(false);
      return;
    }

    window.location.assign("/workshop-generator");
  }

  return (
    <form
      action={(formData) => {
        void handleSubmit(formData);
      }}
      className="panel sign-in-panel"
      style={{ maxWidth: 420 }}
    >
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? (
        <div className="warning" role="alert">
          {error}
        </div>
      ) : null}
      <button className="btn primary" type="submit" disabled={isPending}>
        {isPending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
