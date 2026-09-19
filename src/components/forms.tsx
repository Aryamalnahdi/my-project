"use client";
import { useRef, useState, useTransition } from "react";
import { LoaderCircle, Plus, UserPlus, X } from "lucide-react";
import { createTask, createUser, assignTask, type Result } from "@/app/actions";
import type { Profile, Task } from "@/lib/types";

export function Feedback({ result }: { result: Result }) {
  return result.error ? <p role="alert" className="feedback error">{result.error}</p> : result.success ? <p role="status" className="feedback success">{result.success}</p> : null;
}

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  return <dialog className="modal" ref={(node) => { ref.current = node; if (node && !node.open) node.showModal(); }} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={title}>
    <header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></header>
    {children}
  </dialog>;
}

function StatusField() {
  return <label>Status<select name="status" required defaultValue=""><option value="" disabled>Select status</option><option>Approved</option><option>Not Approved</option></select></label>;
}
function AssignmentFields({ users, task }: { users: Profile[]; task?: Task }) {
  return <>
    <label>Assign to<select name="assigned_user_id" required defaultValue={task?.assigned_user_id ?? ""}><option value="" disabled>Select a user</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)}</select></label>
    <label>Head<select name="head_id" required defaultValue={task?.head_id ?? ""}><option value="" disabled>Select a Head</option>{[1, 2, 3].map((id) => <option key={id} value={id}>Head {id}</option>)}</select></label>
  </>;
}

export function TaskFormButton({ users, admin = false }: { users?: Profile[]; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result>({});
  const [pending, start] = useTransition();
  return <><button className="button primary" onClick={() => { setResult({}); setOpen(true); }}><Plus size={18} />{admin ? "Create task" : "Add task"}</button>
    {open && <Modal title={admin ? "Create a task" : "Add your task"} onClose={() => { if (!pending) setOpen(false); }}>
      <form className="stack-form" onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
        start(async () => {
          try {
            const value = await createTask({ task_text: data.get("task_text"), status: data.get("status"), ...(admin ? { assigned_user_id: data.get("assigned_user_id"), head_id: Number(data.get("head_id")) } : {}) });
            setResult(value); if (value.success) form.reset();
          } catch { setResult({ error: "Unable to connect. Please try again." }); }
        });
      }}>
        <label>Task<textarea name="task_text" placeholder="What needs to be done?" required maxLength={2000} rows={4} autoFocus /></label>
        {admin && <AssignmentFields users={users ?? []} />}
        <StatusField /><Feedback result={result} />
        <button className="button primary full" disabled={pending}>{pending ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />}{pending ? "Saving…" : "Add task"}</button>
      </form>
    </Modal>}
  </>;
}

export function UserFormButton() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result>({});
  const [pending, start] = useTransition();
  return <><button className="button secondary" onClick={() => { setResult({}); setOpen(true); }}><UserPlus size={18} />Add user</button>
    {open && <Modal title="Add a user" onClose={() => { if (!pending) setOpen(false); }}>
      <form className="stack-form" onSubmit={(e) => {
        e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
        start(async () => {
          try {
            const value = await createUser({ name: data.get("name"), username: data.get("username"), password: data.get("password") });
            setResult(value); if (value.success) form.reset();
          } catch { setResult({ error: "Unable to connect. Please try again." }); }
        });
      }}>
        <p className="form-intro">Create their login credentials, then share them securely.</p>
        <label>Name<input name="name" required maxLength={100} autoComplete="off" autoFocus /></label>
        <label>Username<input name="username" required maxLength={80} autoComplete="off" spellCheck={false} /></label>
        <label>Password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>At least 12 characters.</small></label>
        <Feedback result={result} />
        <button className="button primary full" disabled={pending}>{pending ? <LoaderCircle size={17} className="spin" /> : <UserPlus size={17} />}{pending ? "Creating…" : "Create user"}</button>
      </form>
    </Modal>}
  </>;
}

export function AssignButton({ task, users }: { task: Task; users: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result>({});
  const [pending, start] = useTransition();
  return <><button className="text-button" onClick={() => { setResult({}); setOpen(true); }}>Assign</button>
    {open && <Modal title="Assign task" onClose={() => { if (!pending) setOpen(false); }}>
      <form className="stack-form" onSubmit={(e) => {
        e.preventDefault(); const data = new FormData(e.currentTarget);
        start(async () => {
          try { setResult(await assignTask({ task_id: task.id, assigned_user_id: data.get("assigned_user_id"), head_id: Number(data.get("head_id")) })); }
          catch { setResult({ error: "Unable to connect. Please try again." }); }
        });
      }}>
        <p className="form-intro" dir="auto">{task.task_text}</p><AssignmentFields users={users} task={task} /><Feedback result={result} />
        <button className="button primary full" disabled={pending}>{pending ? "Saving…" : "Save assignment"}</button>
      </form>
    </Modal>}
  </>;
}
