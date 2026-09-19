"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function TicketLiveUpdates({ employeeId, ticketId, accounts = false, dashboard = false }: { employeeId?: string; ticketId?: string; accounts?: boolean; dashboard?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("connecting");
  useEffect(() => {
    const db = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };
    const channel = db.channel(`tickets:${employeeId ?? "admin"}:${ticketId ?? "list"}:${accounts}`);
    const tables = dashboard ? ["employees", "tickets", "ticket_notes"] : accounts ? ["employees"] : ticketId ? ["ticket_notes"] : ["tickets", "ticket_notes"];
    for (const table of tables) {
      const filter = ticketId ? `ticket_id=eq.${ticketId}` : employeeId ? `employee_id=eq.${employeeId}` : undefined;
      channel.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, refresh);
    }
    channel.subscribe((status) => { setStatus(status === "SUBSCRIBED" ? "connected" : "offline"); if (status === "SUBSCRIBED") refresh(); });
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      void db.removeChannel(channel);
    };
  }, [router, employeeId, ticketId, accounts, dashboard]);
  return <div className="ticket-live"><span className={`live-label ${status === "connected" ? "connected" : ""}`}><i />{status === "connected" ? "Live updates" : status === "connecting" ? "Connecting to live updates..." : "Live updates paused"}</span><button type="button" className="text-button" onClick={() => router.refresh()}>Refresh</button></div>;
}
