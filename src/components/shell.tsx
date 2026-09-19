import Link from "next/link";
import { ClipboardList, LayoutDashboard, LogOut, ShieldCheck, Users, Plus } from "lucide-react";
import { Brand } from "./brand";
import { logout } from "@/app/actions";
import type { Profile } from "@/lib/types";

const roleNames = { main_admin: "Admin", head: "Head", normal_user: "Team member", employee: "Employee" };

export function Shell({ profile, children, section = "Dashboard" }: { profile: Profile; children: React.ReactNode; section?: string }) {
  const portal = profile.role === "main_admin" || profile.role === "employee";
  const admin = profile.role === "main_admin";
  const label = profile.role === "normal_user" ? "My tasks" : section;
  const links = admin ? [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/accounts", label: "Accounts", icon: Users },
    { href: "/admin/tickets", label: "Tickets", icon: ClipboardList },
  ] : [
    { href: "/employee", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employee/tickets", label: "My Tickets", icon: ClipboardList },
    { href: "/employee/tickets/new", label: "Create Ticket", icon: Plus },
  ];
  return <div className={`app-shell ${portal ? "ticket-portal" : ""}`}>
    <aside className="sidebar">
      <Brand />
      <div className="sidebar-section-label">WORKSPACE</div>
      {portal ? <nav className="ticket-nav" aria-label={admin ? "Admin navigation" : "Employee navigation"}>
        {links.map((link) => <Link key={link.href} href={link.href} className={section === link.label ? "nav-current" : "nav-link"} aria-current={section === link.label ? "page" : undefined}><link.icon size={19} />{link.label}</Link>)}
      </nav> : <div className="nav-current" aria-current="page"><LayoutDashboard size={19} />{label}<span className="nav-dot" /></div>}
      <div className="sidebar-note"><ClipboardList size={23} /><p>A little clarity.<br />A better workday.</p></div>
      <div className="account-block"><span className="avatar">{profile.name.slice(0, 1).toUpperCase()}</span><div><strong dir="auto">{profile.name}</strong><small>{roleNames[profile.role]}</small></div></div>
      <form action={logout}><button className="logout" type="submit"><LogOut size={17} />Logout</button></form>
    </aside>
    <div className="workspace">
      <header className="topbar"><span>Workspace <span className="breadcrumb-divider">/</span> <strong>{label}</strong></span><span className="role-label"><ShieldCheck size={15} />{roleNames[profile.role]}</span></header>
      <main id="main-content">{children}</main>
      <footer>Company <span>Simple. Clear. Together.</span></footer>
    </div>
  </div>;
}
