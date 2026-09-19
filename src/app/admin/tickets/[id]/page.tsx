import { requireRole } from "@/lib/auth";
import { getTicket } from "@/lib/tickets";
import { Shell } from "@/components/shell";
import { TicketDetails } from "@/components/ticket-view";
import { TicketLiveUpdates } from "@/components/ticket-live-updates";

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("main_admin");
  const ticket = await getTicket((await params).id);
  return <Shell profile={profile} section="Tickets"><TicketLiveUpdates ticketId={ticket.id} /><TicketDetails ticket={ticket} admin /></Shell>;
}
