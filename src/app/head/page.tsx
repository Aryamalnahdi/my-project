import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Notification, Task } from "@/lib/types";
import { Shell } from "@/components/shell";
import { TaskList } from "@/components/task-list";
import { Notifications } from "@/components/notifications";

export default async function HeadPage() {
  const profile = await requireRole("head");
  const db = await supabaseServer();
  const { data: head, error: headError } = await db.from("heads").select("id").eq("user_id", profile.id).single();
  if (headError || !head) throw new Error("Your Head account has not been configured.");
  const { data: tasks, error } = await db.from("tasks").select("*").eq("head_id", head.id).order("id");
  if (error) throw new Error("Unable to load tasks.");
  // The fixed Lena account is provisioned with this canonical username.
  const isLena = profile.username === "lena baswed";
  let notifications: Notification[] = [];
  if (isLena) {
    const result = await db.from("notifications").select("*").eq("recipient_id", profile.id).order("created_at", { ascending: false });
    if (result.error) throw new Error("Unable to load notifications.");
    notifications = result.data as Notification[];
  }
  return <Shell profile={profile}>
    <div className="page-heading"><div><span className="eyebrow">HEAD {head.id}</span><h1>Hello, <bdi>{profile.name}</bdi>.</h1><p className="page-description">A clear view of the tasks directed to your Head.</p></div></div>
    <div className={isLena ? "head-grid" : ""}><section className="panel"><header className="panel-header"><div><h2>Your Head’s tasks</h2><p>Work directed to Head {head.id}.</p></div></header><TaskList tasks={tasks as Task[]} /></section>{isLena && <Notifications initial={notifications} recipientId={profile.id} />}</div>
  </Shell>;
}
