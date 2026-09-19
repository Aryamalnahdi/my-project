import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { employeePassword, generateEmployeeCredentials } from "../src/lib/employee-credentials";
import { employeeLoginSchema, ticketSchema, ticketNoteSchema } from "../src/lib/ticket-validation";

test("employee PINs remain four digits and derive account-specific Auth secrets", () => {
  const pepper = "test-pepper-only-12345678901234567890";
  for (let i = 0; i < 100; i++) {
    const generated = generateEmployeeCredentials();
    assert.match(generated.pin, /^[0-9]{4}$/);
    assert.match(generated.username, /^employee-[a-f0-9]{12}$/);
  }
  const secret = employeePassword("employee-a", "0012", pepper);
  assert.equal(secret, employeePassword(" EMPLOYEE-A ", "0012", pepper));
  assert.notEqual(secret, employeePassword("employee-b", "0012", pepper));
  assert.notEqual(secret, employeePassword("employee-a", "0013", pepper));
  assert.notEqual(secret, employeePassword("employee-a", "0012", pepper + "x"));
  assert.ok(secret.length >= 40);
  assert.throws(() => employeePassword("employee-a", "0012", "short"));
  assert.throws(() => employeePassword("employee-a", "123", pepper));
});

test("ticket validation rejects empty content, forged owners, and nonnumeric PINs", () => {
  for (const pin of ["", "123", "12345", "12a4", " 1234", "١٢٣٤"]) {
    assert.equal(employeeLoginSchema.safeParse({ username: "employee-a", password: pin }).success, false);
  }
  assert.equal(employeeLoginSchema.safeParse({ username: "employee-a", password: "0012" }).success, true);
  assert.equal(ticketSchema.safeParse({ title: " ", description: "something" }).success, false);
  assert.equal(ticketSchema.safeParse({ title: "Problem", description: " " }).success, false);
  assert.equal(ticketSchema.safeParse({ title: "Problem", description: "Details", employee_id: "forged" }).success, false);
  assert.equal(ticketNoteSchema.safeParse({ ticket_id: "00000000-0000-4000-8000-000000000001", note: " " }).success, false);
});

test("ticket database enforces ownership, roles, activation, notes, and login throttling", async (t) => {
  const db = new PGlite();
  const ids = {
    admin: "00000000-0000-4000-8000-000000000001",
    alice: "00000000-0000-4000-8000-000000000002",
    bob: "00000000-0000-4000-8000-000000000003",
    legacy: "00000000-0000-4000-8000-000000000004",
    head: "00000000-0000-4000-8000-000000000005",
  };
  let aliceTicket = "";
  let bobTicket = "";
  let noteId = "";
  const key = "a".repeat(64);
  async function as(name: keyof typeof ids) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[name]]);
    await db.exec("set role authenticated");
  }
  async function count(table: string) { return (await db.query<{ count: number }>(`select count(*)::int as count from public.${table}`)).rows[0].count; }
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      create publication supabase_realtime;
    `);
    for (const migration of ["001_initial", "002_employee_role", "003_ticket_management"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${migration}.sql`, import.meta.url), "utf8"));
    }
    for (const [name, id] of Object.entries(ids)) {
      await db.query("insert into auth.users(id) values ($1)", [id]);
      if (name === "alice" || name === "bob") {
        await db.query("select public.provision_employee($1, $2, $3)", [id, name === "alice" ? "employee-aaaaaaaaaaaa" : "employee-bbbbbbbbbbbb", name]);
      } else {
        await db.query("insert into public.profiles(id,name,username,role) values ($1,$2,$2,$3)", [id, name, name === "admin" ? "main_admin" : name === "head" ? "head" : "normal_user"]);
      }
    }
    await t.test("accounts start inactive and activate exactly once for their owner", async () => {
      await as("admin");
      assert.equal(await count("employees"), 2);
      const inactive = await db.query<{ status: string; first_login_at: null }>("select status,first_login_at from public.employees");
      assert.ok(inactive.rows.every((r) => r.status === "inactive" && r.first_login_at === null));
      await as("alice");
      await db.exec("select public.activate_employee()");
      const first = (await db.query<{ first_login_at: Date; status: string }>("select first_login_at,status from public.employees")).rows[0];
      assert.equal(first.status, "active");
      await db.exec("select public.activate_employee()");
      assert.deepEqual((await db.query("select first_login_at,status from public.employees")).rows[0], first);
      await as("bob");
      assert.equal((await db.query<{ status: string }>("select status from public.employees")).rows[0].status, "inactive");
      await db.exec("select public.activate_employee()");
    });
    await t.test("database assigns serial, timestamp, open status, and current employee", async () => {
      await as("alice");
      aliceTicket = (await db.query<{ id: string }>("select public.create_ticket('  Login issue  ', '  Cannot open the tool.  ') as id")).rows[0].id;
      const ticket = (await db.query<{ employee_id: string; status: string; title: string; ticket_number: number; created_at: Date }>("select * from public.tickets")).rows[0];
      assert.equal(ticket.employee_id, ids.alice);
      assert.equal(ticket.status, "open");
      assert.equal(ticket.title, "Login issue");
      assert.equal(Number(ticket.ticket_number), 1);
      assert.ok(ticket.created_at);
      await as("bob");
      bobTicket = (await db.query<{ id: string }>("select public.create_ticket('Other issue', 'Other employee details') as id")).rows[0].id;
      await assert.rejects(db.query("select public.create_ticket(' ', 'Details')"), /check constraint/);
      await assert.rejects(db.query("select public.create_ticket('Title', ' ')"), /check constraint/);
    });
    await t.test("employees cannot read another employee, ticket, directory, or legacy task", async () => {
      await as("alice");
      assert.equal(await count("employees"), 1);
      assert.equal(await count("profiles"), 1);
      assert.equal(await count("tickets"), 1);
      assert.equal(await count("heads"), 0);
      assert.equal(await count("tasks"), 0);
      assert.equal((await db.query("select * from public.tickets where id = $1", [bobTicket])).rows.length, 0);
      assert.equal((await db.query("select * from public.profiles where id = $1", [ids.bob])).rows.length, 0);
    });
    await t.test("employees cannot forge table writes, accounts, roles, notes, or task mutations", async () => {
      await as("alice");
      await assert.rejects(db.query("insert into public.tickets(employee_id,title,description) values ($1,'Forged','Ownership')", [ids.bob]), /permission denied/);
      await assert.rejects(db.query("update public.tickets set employee_id=$1 where id=$2", [ids.bob, aliceTicket]), /permission denied/);
      await assert.rejects(db.query("delete from public.tickets where id=$1", [aliceTicket]), /permission denied/);
      await assert.rejects(db.query("update public.profiles set role='main_admin' where id=$1", [ids.alice]), /permission denied/);
      await assert.rejects(db.query("update public.employees set status='inactive'"), /permission denied/);
      await assert.rejects(db.query("select public.provision_employee($1,'employee-cccccccccccc','Injected')", [ids.alice]), /permission denied/);
      await assert.rejects(db.query("select public.add_ticket_note($1,'Forged note')", [aliceTicket]), /Not permitted/);
      await assert.rejects(db.query("select public.create_own_task('Bypass','Approved')"), /Not permitted/);
    });
    await t.test("admin reads all tickets and creates multiple timestamped notes for the actual owner", async () => {
      await as("admin");
      assert.equal(await count("tickets"), 2);
      assert.equal(await count("employees"), 2);
      noteId = (await db.query<{ id: string }>("select public.add_ticket_note($1,'Try logging out and back in.') as id", [aliceTicket])).rows[0].id;
      await db.query("select public.add_ticket_note($1,'Let us know if this continues.')", [aliceTicket]);
      await db.query("select public.add_ticket_note($1,'Bob-only note')", [bobTicket]);
      const notes = (await db.query<{ employee_id: string; created_at: Date }>("select * from public.ticket_notes where ticket_id=$1", [aliceTicket])).rows;
      assert.equal(notes.length, 2);
      assert.ok(notes.every((note) => note.employee_id === ids.alice && note.created_at));
      await assert.rejects(db.query("select public.add_ticket_note($1,' ')", [aliceTicket]), /check constraint/);
      await assert.rejects(db.query("select public.add_ticket_note($1,'Unknown ticket')", [ids.admin]), /Ticket unavailable/);
      await assert.rejects(db.query("select public.create_ticket('Admin','Cannot impersonate an employee')"), /Not permitted/);
      await assert.rejects(db.query("select public.activate_employee()"), /Not permitted/);
    });
    await t.test("employees can only read their own notes and cannot edit them", async () => {
      await as("alice");
      assert.equal(await count("ticket_notes"), 2);
      assert.equal((await db.query("select * from public.ticket_notes where ticket_id=$1", [bobTicket])).rows.length, 0);
      await assert.rejects(db.query("update public.ticket_notes set note='Changed' where id=$1", [noteId]), /permission denied/);
      await assert.rejects(db.query("delete from public.ticket_notes where id=$1", [noteId]), /permission denied/);
      await as("bob");
      assert.equal(await count("ticket_notes"), 1);
      assert.equal((await db.query("select * from public.ticket_notes where id=$1", [noteId])).rows.length, 0);
    });
    await t.test("note ownership is also enforced by a composite foreign key", async () => {
      await db.exec("reset role");
      await assert.rejects(db.query("insert into public.ticket_notes(ticket_id,employee_id,note) values ($1,$2,'Wrong owner')", [aliceTicket, ids.bob]), /foreign key constraint/);
    });
    await t.test("legacy users, Heads, and anonymous clients have no ticket access", async () => {
      for (const role of ["legacy", "head"] as const) {
        await as(role);
        assert.equal(await count("tickets"), 0);
        assert.equal(await count("ticket_notes"), 0);
        assert.equal(await count("employees"), 0);
        await assert.rejects(db.query("select public.create_ticket('No','Access')"), /Not permitted/);
        await assert.rejects(db.query("select public.add_ticket_note($1,'No access')", [aliceTicket]), /Not permitted/);
      }
      await db.exec("reset role; set role anon");
      for (const table of ["employees", "tickets", "ticket_notes"]) await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
      await assert.rejects(db.query("select public.create_ticket('No','Access')"), /permission denied/);
    });
    await t.test("login attempts persist, stop at five, expire, and cannot be reset by clients", async () => {
      await as("alice");
      await assert.rejects(db.query("select public.consume_ticket_login_attempt($1)", [key]), /permission denied/);
      await assert.rejects(db.query("select public.clear_ticket_login_attempts($1)", [key]), /permission denied/);
      await db.exec("reset role; set role service_role");
      for (let i = 1; i <= 7; i++) {
        const result = await db.query<{ allowed: boolean }>("select public.consume_ticket_login_attempt($1) as allowed", [key]);
        assert.equal(result.rows[0].allowed, i <= 5);
      }
      await db.exec("reset role");
      await db.query("update private.ticket_login_attempts set window_started_at=now()-interval '16 minutes' where key=$1", [key]);
      await db.exec("set role service_role");
      assert.equal((await db.query<{ allowed: boolean }>("select public.consume_ticket_login_attempt($1) as allowed", [key])).rows[0].allowed, true);
      await db.query("select public.clear_ticket_login_attempts($1)", [key]);
      await db.exec("reset role");
      assert.equal((await db.query("select * from private.ticket_login_attempts")).rows.length, 0);
    });
  } finally { await db.close(); }
});
