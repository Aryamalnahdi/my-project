"use client";
import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { login, type Result } from "@/app/actions";
import { Feedback } from "@/components/forms";

export function LoginForm() {
  const [result, setResult] = useState<Result>({});
  const [pending, start] = useTransition();
  return <form className="stack-form login-form" action={(data) => {
    setResult({});
    start(async () => { setResult(await login({ username: data.get("username"), password: data.get("password") })); });
  }}>
    <label>Username<input name="username" placeholder="Enter your username" autoComplete="username" required maxLength={80} spellCheck={false} autoCapitalize="none" /></label>
    <label>Password<input name="password" type="password" placeholder="Enter your password" autoComplete="current-password" required maxLength={128} /></label>
    <Feedback result={result} /><button className="button primary full" disabled={pending}>{pending ? "Signing in…" : "Log in"}{pending ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}</button>
  </form>;
}
