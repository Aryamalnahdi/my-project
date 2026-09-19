import { requireRole } from "@/lib/auth";
import { getTicket } from "@/lib/tickets";
import { Shell } from "@/components/shell";
import { TicketDetails } from "@/components/ticket-view";
import { TicketLiveUpdates } from "@/components/ticket-live-updates";

export default async function EmployeeTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("employee");
  const ticket = await getTicket((await params).id, profile.id);
  return <Shell profile={profile} section="My Tickets"><TicketLiveUpdates employeeId={profile.id} ticketId={ticket.id} /><TicketDetails ticket={ticket} /></Shell>;
}
