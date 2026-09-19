import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listTickets } from "@/lib/tickets";
import { Shell } from "@/components/shell";
import { TicketList } from "@/components/ticket-view";
import { TicketLiveUpdates } from "@/components/ticket-live-updates";

export default async function EmployeePage() {
  const profile = await requireRole("employee");
  const { tickets, count } = await listTickets(profile.id, 1, 5);
  return <Shell profile={profile}>
    <div className="page-heading"><div><span className="eyebrow">EMPLOYEE SUPPORT</span><h1>How can we help?</h1><p className="page-description">Create a ticket and follow your administrator’s updates here.</p></div><Link className="button primary" href="/employee/tickets/new"><Plus size={17} />Create Ticket</Link></div>
    <TicketLiveUpdates employeeId={profile.id} />
    <section className="panel"><header className="panel-header"><div><h2>My recent tickets</h2><p>{count} {count === 1 ? "ticket" : "tickets"} created by your account.</p></div><Link className="text-button" href="/employee/tickets">My Tickets</Link></header><TicketList tickets={tickets} /></section>
  </Shell>;
}
