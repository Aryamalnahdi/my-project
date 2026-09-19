"use client";
import { useState, useTransition } from "react";
import { Check, ClipboardList, LoaderCircle } from "lucide-react";
import { updateStatus } from "@/app/actions";
import type { Profile, Task } from "@/lib/types";
import { AssignButton } from "./forms";

function Status({ task, editable }: { task: Task; editable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const approved = task.status === "Approved";
  if (!editable) return <span className={`status-badge ${approved ? "approved" : "not-approved"}`}>{approved && <Check size={13} />}{task.status}</span>;
  return <div className="status-control">
    <select aria-label={`Status for ${task.task_text}`} className={`status-select ${approved ? "approved" : "not-approved"}`} value={task.status} disabled={pending} onChange={(e) => {
      const status = e.target.value;
      setError("");
      start(async () => {
        try { const result = await updateStatus({ task_id: task.id, status }); setError(result.error ?? ""); }
        catch { setError("Unable to save. Please try again."); }
      });
    }}><option>Approved</option><option>Not Approved</option></select>
    {pending && <LoaderCircle size={14} className="spin" aria-label="Saving" />}
    {error && <small role="alert" className="inline-error">{error}</small>}
  </div>;
}

export function TaskList({ tasks, users = [], admin = false, editable = false }: { tasks: Task[]; users?: Profile[]; admin?: boolean; editable?: boolean }) {
  if (!tasks.length) return <div className="empty-state"><span className="empty-icon"><ClipboardList size={28} /></span><h3>A clear space to get started</h3><p>{admin ? "Create a task and send it to the right person and Head." : editable ? "Your tasks will appear here. Add a task to get started." : "Tasks directed to your Head will appear here."}</p></div>;
  return <div className="task-list">{tasks.map((task) => {
    const user = users.find((u) => u.id === task.assigned_user_id);
    return <article className="task-row" key={task.id}>
      <span className={`task-marker ${task.status === "Approved" ? "complete" : ""}`} aria-hidden="true">{task.status === "Approved" && <Check size={14} />}</span>
      <div className="task-content"><h3 dir="auto">{task.task_text}</h3><div className="task-meta"><span>Head {task.head_id}</span>{admin && user && <><span aria-hidden="true">·</span><span dir="auto">{user.name}</span></>}</div></div>
      <div className="task-controls"><Status task={task} editable={editable} />{admin && <AssignButton task={task} users={users} />}</div>
    </article>;
  })}</div>;
}
