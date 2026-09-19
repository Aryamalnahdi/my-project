"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { adminLogin, employeeLogin } from "@/app/ticket-actions";
import { Feedback } from "./forms";
import type { Result } from "@/app/actions";

export function PortalLoginForm({ portal }: { portal: "admin" | "employee" }) {
  const router = useRouter();
  const [result, setResult] = useState<Result>({});
  const [pending, start] = useTransition();
  const employee = portal === "employee";
  return <form className="stack-form login-form" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setResult({});
    start(async () => {
      try {
        const action = employee ? employeeLogin : adminLogin;
        const response = await action({ username: data.get("username"), password: data.get("password") });
        if (response.destination) { router.replace(response.destination); router.refresh(); }
        else setResult(response);
      } catch { setResult({ error: "Unable to connect. Please try again." }); }
    });
  }}>
    <label>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={80} placeholder="Enter your username" /></label>
    <label>{employee ? "4-digit PIN" : "Password"}<input name="password" type="password" autoComplete="current-password" inputMode={employee ? "numeric" : undefined} pattern={employee ? "[0-9]{4}" : undefined} minLength={employee ? 4 : 1} maxLength={employee ? 4 : 128} required placeholder={employee ? "Enter your 4-digit PIN" : "Enter your password"} /></label>
    <Feedback result={result} />
    <button className="button primary full" disabled={pending}>{pending ? "Signing in…" : "Log in"}{pending ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}</button>
  </form>;
}
