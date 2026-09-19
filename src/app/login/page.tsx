import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionProfile } from "@/lib/auth";
import { roleRoute } from "@/lib/types";
import { LoginForm } from "./login-form";
import { Brand } from "@/components/brand";
import { ArrowUpRight, Check } from "lucide-react";

export default async function LoginPage() {
  const profile = await sessionProfile();
  if (profile) redirect(roleRoute[profile.role]);
  return <main className="login-page">
    <section className="login-form-side"><Brand /><div className="login-form-wrap"><span className="eyebrow">YOUR WORKSPACE, SIMPLIFIED</span><h1>Welcome back.</h1><p className="page-description">A clear view of your tasks. A little more focus for your day.</p><LoginForm /><p className="login-help"><Link href="/employee/login">Employee support login</Link> ? <Link href="/admin/login">Admin login</Link></p><p className="login-help">Use the credentials provided by your administrator.</p></div><small className="login-footer">Company Tasks · Internal workspace</small></section>
    <aside className="login-art"><div className="art-top">A LITTLE CLARITY GOES A LONG WAY <ArrowUpRight size={23} /></div><div className="art-center"><div className="large-check"><Check size={85} strokeWidth={1.4} /></div><h2>Less noise.<br />More progress.</h2><p>One simple place for the work<br />that brings us together.</p></div><span className="art-bottom">Made for your team.</span></aside>
  </main>;
}
