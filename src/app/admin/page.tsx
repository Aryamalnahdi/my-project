import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { dashboardCounts, listTickets } from "@/lib/tickets";
import { Shell } from "@/components/shell";
import { TicketList } from "@/components/ticket-view";
import { TicketLiveUpdates } from "@/components/ticket-live-updates";

export default async function AdminPage() {
  const profile = await requireRole("main_admin");
  const [counts, recent] = await Promise.all([dashboardCounts(), listTickets(undefined, 1, 5)]);
  return <Shell profile={profile}>
    <div className="page-heading"><div><span className="eyebrow">ADMIN WORKSPACE</span><h1>Dashboard</h1><p className="page-description">A clear view of your team’s accounts and support requests.</p></div><Link className="button primary" href="/admin/accounts">Manage accounts</Link></div>
    <section className="stats-grid" aria-label="Overview"><Link className="stat-card" href="/admin/accounts"><span>Employee accounts</span><strong>{counts.employees}</strong></Link><Link className="stat-card" href="/admin/accounts"><span>Active employees</span><strong>{counts.active}</strong></Link><Link className="stat-card" href="/admin/tickets"><span>Open tickets</span><strong>{counts.tickets}</strong></Link></section>
    <TicketLiveUpdates dashboard />
    <section className="panel"><header className="panel-header"><div><h2>Recent tickets</h2><p>The latest problems reported by your employees.</p></div><Link className="text-button" href="/admin/tickets">View all</Link></header><TicketList tickets={recent.tickets} admin /></section>
  </Shell>;
}
