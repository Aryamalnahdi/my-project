import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listTickets, pageNumber } from "@/lib/tickets";
import { Shell } from "@/components/shell";
import { TicketList, Pagination } from "@/components/ticket-view";
import { TicketLiveUpdates } from "@/components/ticket-live-updates";

export default async function MyTicketsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const profile = await requireRole("employee");
  const page = pageNumber((await searchParams).page);
  const { tickets, count } = await listTickets(profile.id, page);
  return <Shell profile={profile} section="My Tickets">
    <div className="page-heading"><div><span className="eyebrow">YOUR SUPPORT REQUESTS</span><h1>My Tickets</h1><p className="page-description">Open a ticket to view its details and admin notes.</p></div><Link className="button primary" href="/employee/tickets/new"><Plus size={17} />Create Ticket</Link></div>
    <TicketLiveUpdates employeeId={profile.id} />
    <section className="panel"><TicketList tickets={tickets} /><Pagination page={page} count={count} href="/employee/tickets" /></section>
  </Shell>;
}
