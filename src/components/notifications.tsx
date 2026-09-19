"use client";
import { useEffect, useState } from "react";
import { Bell, Check, Plus } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Notification } from "@/lib/types";

export function Notifications({ initial, recipientId }: { initial: Notification[]; recipientId: string }) {
  const [items, setItems] = useState(initial);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const db = supabaseBrowser();
    let active = true;
    let latestRequest = 0;
    async function reload() {
      const request = ++latestRequest;
      const { data, error } = await db.from("notifications").select("*").eq("recipient_id", recipientId).order("created_at", { ascending: false });
      if (active && request === latestRequest) { setError(Boolean(error)); if (data) setItems(data as Notification[]); }
    }
    const channel = db.channel(`notifications:${recipientId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${recipientId}` }, () => { void reload(); })
      .subscribe((status) => {
        if (!active) return;
        setConnected(status === "SUBSCRIBED");
        // Recover events missed before subscription or during a disconnection.
        if (status === "SUBSCRIBED") void reload();
      });
    const recover = () => { if (document.visibilityState === "visible") void reload(); };
    window.addEventListener("online", reload);
    document.addEventListener("visibilitychange", recover);
    return () => { active = false; void db.removeChannel(channel); window.removeEventListener("online", reload); document.removeEventListener("visibilitychange", recover); };
  }, [recipientId]);

  return <section className="panel notifications-panel">
    <header className="panel-header"><h2><Bell size={18} />Notifications</h2><span className={`live-label ${connected ? "connected" : ""}`}><i />{connected ? "Live" : "Connecting"}</span></header>
    {error && <p className="feedback error" role="alert">Notifications could not be refreshed. Reconnect or reload to try again.</p>}
    <div className="notification-list" role="log" aria-label="Task notifications" aria-live="polite" aria-relevant="additions">
      {!items.length && <div className="empty-state compact"><span className="empty-icon"><Bell size={24} /></span><h3>You’re up to date</h3><p>New tasks and status updates from users will appear here.</p></div>}
      {items.map((item) => <article className="notification" key={item.id}><span className="notification-icon">{item.type === "task_added" ? <Plus size={17} /> : <Check size={17} />}</span><div><p><strong dir="auto">{item.actor_name}</strong> {item.type === "task_added" ? "added a task." : "updated a task status."}</p><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time></div></article>)}
    </div>
  </section>;
}
