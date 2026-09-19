import { requireRole } from "@/lib/auth";
import { listTickets, pageNumber } from "@/lib/tickets";
import { Shell } from "@/components/shell";
import { TicketList, Pagination } from "@/components/ticket-view";
import { TicketLiveUpdates } from "@/components/ticket-live-updates";

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const profile = await requireRole("main_admin");
  const page = pageNumber((await searchParams).page);
  const { tickets, count } = await listTickets(undefined, page);
  return <Shell profile={profile} section="Tickets">
    <div className="page-heading"><div><span className="eyebrow">TEAM SUPPORT</span><h1>Tickets</h1><p className="page-description">Open a ticket to read the full problem and send a note.</p></div></div>
    <TicketLiveUpdates />
    <section className="panel"><TicketList tickets={tickets} admin /><Pagination page={page} count={count} href="/admin/tickets" /></section>
  </Shell>;
}
