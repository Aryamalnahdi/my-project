"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Plus, Send } from "lucide-react";
import { createEmployee, createTicket, addTicketNote, type AccountResult } from "@/app/ticket-actions";
import type { Result } from "@/app/actions";
import { Feedback, Modal } from "./forms";

export function CreateAccountButton() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AccountResult>({});
  const [pending, start] = useTransition();
  function close() { if (!pending) { setOpen(false); setResult({}); } }
  return <>
    <button className="button primary" onClick={() => { setResult({}); setOpen(true); }}><Plus size={17} />Create Account</button>
    {open && <Modal title={result.credentials ? "Account created" : "Create employee account"} onClose={close}>
      {result.credentials ? <div className="stack-form">
        <Feedback result={result} />
        <dl className="credential-card"><dt>Username</dt><dd data-testid="generated-username">{result.credentials.username}</dd><dt>4-digit PIN</dt><dd className="generated-pin" data-testid="generated-pin">{result.credentials.pin}</dd></dl>
        <p className="form-intro">Share these credentials securely with the employee. Their account becomes Active after their first successful login.</p>
        <button className="button primary" onClick={close}>I’ve saved the credentials</button>
      </div> : <form className="stack-form" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setResult({});
        start(async () => {
          try { setResult(await createEmployee({ name: data.get("name") })); }
          catch { setResult({ error: "Unable to connect. Please try again." }); }
        });
      }}>
        <p className="form-intro">A unique username and a four-digit PIN will be generated automatically.</p>
        <label>Employee name <span className="muted">(optional)</span><input name="name" maxLength={100} autoFocus autoComplete="off" placeholder="e.g. Sara Ahmed" /></label>
        <Feedback result={result} />
        <button className="button primary" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      </form>}
    </Modal>}
  </>;
}

export function CreateTicketForm() {
  const [result, setResult] = useState<Result & { ticketId?: string }>({});
  const [pending, start] = useTransition();
  if (result.ticketId) return <div className="stack-form panel-body">
    <Feedback result={result} />
    <Link className="button primary" href={`/employee/tickets/${result.ticketId}`}>View ticket</Link>
    <button className="button secondary" onClick={() => setResult({})}>Create another ticket</button>
  </div>;
  return <form className="stack-form panel-body" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setResult({});
    start(async () => {
      try { setResult(await createTicket({ title: data.get("title"), description: data.get("description") })); }
      catch { setResult({ error: "Unable to connect. Please try again." }); }
    });
  }}>
    <label>Problem Title<input name="title" placeholder="Briefly describe the problem" required maxLength={160} /></label>
    <label>Problem Description<textarea name="description" placeholder="What happened? Include any details that could help your administrator." required maxLength={10000} rows={8} /></label>
    <Feedback result={result} />
    <button className="button primary" disabled={pending}><Plus size={17} />{pending ? "Creating ticket…" : "Create Ticket"}</button>
  </form>;
}

export function AdminNoteForm({ ticketId }: { ticketId: string }) {
  const [result, setResult] = useState<Result>({});
  const [pending, start] = useTransition();
  return <form className="stack-form note-form" onSubmit={(event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setResult({});
    start(async () => {
      try {
        const response = await addTicketNote({ ticket_id: ticketId, note: data.get("note") });
        setResult(response);
        if (response.success) form.reset();
      } catch { setResult({ error: "Unable to connect. Please try again." }); }
    });
  }}>
    <label>Send a note to the employee<textarea name="note" placeholder="Share an update or suggest a solution…" rows={4} required maxLength={5000} /></label>
    <Feedback result={result} />
    <button className="button primary" disabled={pending}><Send size={16} />{pending ? "Sending note…" : "Send note"}</button>
  </form>;
}
