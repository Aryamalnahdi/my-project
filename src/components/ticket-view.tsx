import Link from "next/link";
import { ClipboardList, MessageSquare, ArrowLeft } from "lucide-react";
import type { Ticket } from "@/lib/types";
import { PAGE_SIZE } from "@/lib/tickets";
import { AdminNoteForm } from "./ticket-forms";

export function DateLabel({ value }: { value: string }) {
  return <time dateTime={value}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC</time>;
}
export function TicketNumber({ value }: { value: number }) { return <>TKT-{String(value).padStart(5, "0")}</>; }
export function StatusBadge({ value }: { value: string }) {
  return <span className={`status-badge ticket-status ${value}`}>{value.charAt(0).toUpperCase() + value.slice(1)}</span>;
}
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><ClipboardList size={26} /></span><h3>{title}</h3><p>{children}</p></div>;
}
export function TicketList({ tickets, admin = false }: { tickets: Ticket[]; admin?: boolean }) {
  if (!tickets.length) return <EmptyState title={admin ? "No tickets yet" : "You haven’t created any tickets"}>{admin ? "Problems reported by your employees will appear here." : "Create a ticket when you need help. Your administrator’s replies will appear in its details."}</EmptyState>;
  return <div className="table-scroll"><table className="ticket-table"><thead><tr><th>Ticket / Problem</th>{admin && <th>Employee</th>}<th>Created</th><th>Status</th>{admin && <th>Latest admin note</th>}</tr></thead><tbody>
    {tickets.map((ticket) => <tr key={ticket.id}>
      <td><Link className="ticket-title" href={`/${admin ? "admin" : "employee"}/tickets/${ticket.id}`}><span className="ticket-number"><TicketNumber value={ticket.ticket_number} /></span><strong dir="auto">{ticket.title}</strong></Link>{admin && <p className="table-description" dir="auto">{ticket.description}</p>}</td>
      {admin && <td><strong className="employee-name" dir="auto">{ticket.employees.profiles.name}</strong><span className="table-subtitle">@{ticket.employees.profiles.username}</span></td>}
      <td><DateLabel value={ticket.created_at} /></td><td><StatusBadge value={ticket.status} /></td>
      {admin && <td><p className="table-description" dir="auto">{ticket.ticket_notes[0]?.note ?? "No notes yet"}</p></td>}
    </tr>)}
  </tbody></table></div>;
}
export function Pagination({ page, count, href }: { page: number; count: number; href: string }) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (pages <= 1 && page === 1) return null;
  return <nav className="pagination" aria-label="Pagination">
    {page > 1 && <Link className="button secondary" href={`${href}?page=${page - 1}`}>Previous</Link>}
    <span>Page {page} · {count} total</span>
    {page < pages && <Link className="button secondary" href={`${href}?page=${page + 1}`}>Next</Link>}
  </nav>;
}
export function TicketDetails({ ticket, admin = false }: { ticket: Ticket; admin?: boolean }) {
  return <>
    <Link className="back-link" href={admin ? "/admin/tickets" : "/employee/tickets"}><ArrowLeft size={16} />{admin ? "All tickets" : "My Tickets"}</Link>
    <div className="page-heading"><div><span className="eyebrow"><TicketNumber value={ticket.ticket_number} /></span><h1 dir="auto">{ticket.title}</h1><p className="page-description">Created <DateLabel value={ticket.created_at} /></p></div><StatusBadge value={ticket.status} /></div>
    {admin && <div className="employee-summary"><strong dir="auto">{ticket.employees.profiles.name}</strong><span>@{ticket.employees.profiles.username}</span><small>Account: {ticket.employee_id}</small></div>}
    <section className="panel ticket-problem"><header className="panel-header"><h2>Original problem</h2></header><p className="panel-body problem-description" dir="auto">{ticket.description}</p></section>
    <section className="panel"><header className="panel-header"><div><h2><MessageSquare size={19} />Admin notes</h2><p>Updates and guidance from your administrator.</p></div></header>
      <div className="panel-body">
        {ticket.ticket_notes.length ? <ol className="note-list">{ticket.ticket_notes.map((note) => <li className="admin-note" key={note.id}><header><strong>Administrator</strong><DateLabel value={note.created_at} /></header><p dir="auto">{note.note}</p></li>)}</ol>
          : <p className="muted">{admin ? "No notes yet. Send the employee an update below." : "No notes yet. Your administrator’s updates will appear here."}</p>}
        {admin && <AdminNoteForm ticketId={ticket.id} />}
      </div>
    </section>
  </>;
}
