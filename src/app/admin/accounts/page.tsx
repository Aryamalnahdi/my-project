import { requireRole } from "@/lib/auth";
import { listEmployees, pageNumber } from "@/lib/tickets";
import { Shell } from "@/components/shell";
import { CreateAccountButton } from "@/components/ticket-forms";
import { DateLabel, EmptyState, Pagination, StatusBadge } from "@/components/ticket-view";
import { TicketLiveUpdates } from "@/components/ticket-live-updates";

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const profile = await requireRole("main_admin");
  const page = pageNumber((await searchParams).page);
  const { employees, count } = await listEmployees(page);
  return <Shell profile={profile} section="Accounts">
    <div className="page-heading"><div><span className="eyebrow">EMPLOYEE ACCESS</span><h1>Accounts</h1><p className="page-description">Create login credentials and see who has joined the platform.</p></div><CreateAccountButton /></div>
    <TicketLiveUpdates accounts />
    <section className="panel"><header className="panel-header"><div><h2>Employee accounts</h2><p>Accounts become Active automatically after the employee’s first login.</p></div></header>
      {!employees.length ? <EmptyState title="No employee accounts">Create an account to give an employee access to their support dashboard.</EmptyState> : <div className="table-scroll"><table className="ticket-table"><thead><tr><th>Employee / Account</th><th>Username</th><th>Status</th><th>Created</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td><strong className="employee-name" dir="auto">{employee.profiles.name}</strong><span className="table-subtitle account-identifier">{employee.id}</span></td><td>{employee.profiles.username}</td><td><StatusBadge value={employee.status} /></td><td><DateLabel value={employee.created_at} /></td></tr>)}</tbody></table></div>}
      <Pagination page={page} count={count} href="/admin/accounts" />
    </section>
  </Shell>;
}
