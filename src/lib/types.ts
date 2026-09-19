export type Role = "main_admin" | "head" | "normal_user" | "employee";
export type TaskStatus = "Approved" | "Not Approved";
export type Profile = { id: string; name: string; username: string; role: Role };
export type Task = {
  id: string;
  task_text: string;
  assigned_user_id: string;
  head_id: number;
  status: TaskStatus;
  creator_id: string;
};
export type Notification = {
  id: string;
  recipient_id: string;
  actor_id: string;
  actor_name: string;
  task_id: string | null;
  type: "task_added" | "task_status_updated";
  created_at: string;
};
export const roleRoute: Record<Role, string> = {
  main_admin: "/admin", head: "/head", normal_user: "/my-tasks", employee: "/employee",
};

export type Employee = {
  id: string; status: "inactive" | "active"; created_at: string; first_login_at: string | null;
  profiles: { name: string; username: string };
};
export type TicketNote = { id: string; ticket_id: string; employee_id: string; note: string; created_at: string };
export type Ticket = {
  id: string; ticket_number: number; employee_id: string; title: string; description: string;
  status: "open"; created_at: string; updated_at: string;
  employees: { profiles: { name: string; username: string } };
  ticket_notes: TicketNote[];
};
