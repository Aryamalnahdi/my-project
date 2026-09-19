import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";
import { Shell } from "@/components/shell";
import { TaskFormButton } from "@/components/forms";
import { TaskList } from "@/components/task-list";

export default async function MyTasksPage() {
  const profile = await requireRole("normal_user");
  const db = await supabaseServer();
  const { data, error } = await db.from("tasks").select("*").eq("assigned_user_id", profile.id).order("id");
  if (error) throw new Error("Unable to load your tasks.");
  return <Shell profile={profile}>
    <div className="page-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Hello, <bdi>{profile.name}</bdi>.</h1><p className="page-description">Your tasks. A clear place to focus.</p></div><TaskFormButton /></div>
    <section className="panel"><header className="panel-header"><div><h2>My tasks</h2><p>Add a task or update its approval status.</p></div></header><TaskList tasks={data as Task[]} editable /></section>
  </Shell>;
}
