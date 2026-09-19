import { requireRole } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { CreateTicketForm } from "@/components/ticket-forms";

export default async function NewTicketPage() {
  const profile = await requireRole("employee");
  return <Shell profile={profile} section="Create Ticket">
    <div className="page-heading"><div><span className="eyebrow">LET’S GET IT SORTED</span><h1>Create Ticket</h1><p className="page-description">Tell us what’s happening. Your administrator will reply with a note.</p></div></div>
    <section className="panel ticket-form-panel"><CreateTicketForm /></section>
  </Shell>;
}
