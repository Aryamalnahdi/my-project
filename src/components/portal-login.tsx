import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Ticket } from "lucide-react";
import { sessionProfile } from "@/lib/auth";
import { roleRoute } from "@/lib/types";
import { Brand } from "./brand";
import { PortalLoginForm } from "./portal-login-form";

export async function PortalLogin({ portal }: { portal: "admin" | "employee" }) {
  const profile = await sessionProfile();
  if (profile) redirect(roleRoute[profile.role]);
  const admin = portal === "admin";
  return <main className="login-page ticket-portal">
    <section className="login-form-side">
      <Brand />
      <div className="login-form-wrap">
        <span className="eyebrow">{admin ? "ADMIN WORKSPACE" : "EMPLOYEE SUPPORT"}</span>
        <h1>{admin ? "Admin login" : "Employee login"}</h1>
        <p className="page-description">{admin ? "Manage employee accounts and help your team resolve problems." : "Report a problem, follow your tickets, and hear back from your administrator."}</p>
        <PortalLoginForm portal={portal} />
        <p className="login-help">{admin ? "Use your administrator username and password." : "Use the username and four-digit PIN provided by your administrator."}</p>
        <p className="login-help"><Link href={admin ? "/employee/login" : "/admin/login"}>{admin ? "Employee login" : "Admin login"} <span aria-hidden="true">→</span></Link></p>
      </div>
      <small className="login-footer">Company · Internal support</small>
    </section>
    <aside className="login-art">
      <div className="art-top">A CLEAR PATH TO GETTING HELP {admin ? <ShieldCheck size={24} /> : <Ticket size={24} />}</div>
      <div className="art-center"><div className="large-check">{admin ? <ShieldCheck size={68} /> : <Ticket size={68} />}</div><h2>A little help.<br />A better workday.</h2><p>One place for your team’s questions<br />and the answers that move work forward.</p></div>
      <span className="art-bottom">Simple. Clear. Together.</span>
    </aside>
  </main>;
}
