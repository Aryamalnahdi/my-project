import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const ids = {
  admin: "00000000-0000-4000-8000-000000000001",
  lena: "00000000-0000-4000-8000-000000000002",
  head2: "00000000-0000-4000-8000-000000000003",
  head3: "00000000-0000-4000-8000-000000000004",
  alice: "00000000-0000-4000-8000-000000000005",
  bob: "00000000-0000-4000-8000-000000000006",
};

test("database authorization and transactional notifications", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      create publication supabase_realtime;
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/001_initial.sql", import.meta.url), "utf8"));
    for (const [name, id] of Object.entries(ids)) {
      const role = name === "admin" ? "main_admin" : ["lena", "head2", "head3"].includes(name) ? "head" : "normal_user";
      await db.query("insert into auth.users(id) values ($1)", [id]);
      await db.query("insert into public.profiles(id, name, username, role) values ($1, $2, $2, $3)", [id, name, role]);
    }
    await db.query("select public.configure_initial_head($1, 1::smallint, true)", [ids.lena]);
    await db.query("select public.configure_initial_head($1, 2::smallint, false)", [ids.head2]);
    await db.query("select public.configure_initial_head($1, 3::smallint, false)", [ids.head3]);
    // Test-only routing choice. Production deliberately remains unconfigured pending the owner's decision.
    await db.exec("update private.configuration set normal_task_head_id = 1");

    async function as(name: keyof typeof ids) {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ids[name]]);
      await db.exec("set role authenticated");
    }
    async function count(table: string) { return Number((await db.query<{ count: number }>(`select count(*)::int as count from public.${table}`)).rows[0].count); }
    let aliceTask = "";
    let bobTask = "";

    await t.test("Admin creates tasks and directs each to a fixed Head", async () => {
      await as("admin");
      aliceTask = (await db.query<{ id: string }>("select public.create_admin_task('Alice task', $1, 1::smallint, 'Not Approved') as id", [ids.alice])).rows[0].id;
      bobTask = (await db.query<{ id: string }>("select public.create_admin_task('Bob task', $1, 2::smallint, 'Approved') as id", [ids.bob])).rows[0].id;
      assert.equal(await count("tasks"), 2);
      assert.equal(await count("notifications"), 0);
    });
    await t.test("normal users cannot read another user's tasks or profiles", async () => {
      await as("alice");
      assert.equal(await count("tasks"), 1);
      assert.equal(await count("profiles"), 1);
      assert.equal((await db.query("select * from public.tasks where id = $1", [bobTask])).rows.length, 0);
    });
    await t.test("direct table mutations, role escalation and Head changes are denied", async () => {
      await as("alice");
      await assert.rejects(db.query("update public.profiles set role = 'main_admin' where id = $1", [ids.alice]), /permission denied/);
      await assert.rejects(db.query("update public.tasks set assigned_user_id = $1 where id = $2", [ids.bob, aliceTask]), /permission denied/);
      await assert.rejects(db.query("delete from public.tasks where id = $1", [aliceTask]), /permission denied/);
      await assert.rejects(db.query("select public.assign_task($1, $2, 2::smallint)", [aliceTask, ids.bob]), /Not permitted/);
      await assert.rejects(db.query("select public.configure_initial_head($1, 1::smallint, true)", [ids.alice]), /permission denied/);
    });
    await t.test("normal users cannot change other users' statuses", async () => {
      await as("alice");
      await assert.rejects(db.query("select public.update_task_status($1, 'Not Approved')", [bobTask]), /Task unavailable/);
      await assert.rejects(db.query("select public.create_admin_task('Injected', $1, 1::smallint, 'Approved')", [ids.bob]), /Not permitted/);
    });
    await t.test("normal-user creation always assigns ownership to the caller", async () => {
      await as("alice");
      const result = await db.query<{ id: string }>("select public.create_own_task('My new task', 'Not Approved') as id");
      const task = (await db.query<{ assigned_user_id: string; creator_id: string }>("select * from public.tasks where id = $1", [result.rows[0].id])).rows[0];
      assert.equal(task.assigned_user_id, ids.alice);
      assert.equal(task.creator_id, ids.alice);
      assert.equal(await count("notifications"), 0);
    });
    await t.test("Lena receives precisely the two notification types, including other Heads", async () => {
      await as("alice");
      await db.query("select public.update_task_status($1, 'Approved')", [aliceTask]);
      await db.query("select public.update_task_status($1, 'Approved')", [aliceTask]);
      await as("bob");
      await db.query("select public.update_task_status($1, 'Not Approved')", [bobTask]);
      await as("lena");
      const rows = (await db.query<{ type: string; actor_id: string }>("select type, actor_id from public.notifications order by created_at")).rows;
      assert.equal(rows.length, 3);
      assert.deepEqual(rows.map((r) => r.type), ["task_added", "task_status_updated", "task_status_updated"]);
      assert.equal(rows[2].actor_id, ids.bob);
    });
    await t.test("Heads read only their directed tasks and cannot invoke unspecified write actions", async () => {
      await as("head2");
      assert.equal(await count("tasks"), 1);
      assert.equal(await count("notifications"), 0);
      await assert.rejects(db.query("select public.update_task_status($1, 'Approved')", [bobTask]), /Not permitted/);
      await assert.rejects(db.query("select public.create_own_task('Unspecified action', 'Approved')"), /Not permitted/);
      await as("lena");
      assert.equal((await db.query("select * from public.tasks where id = $1", [bobTask])).rows.length, 0);
    });
    await t.test("only the two exact statuses are accepted in the database", async () => {
      await as("alice");
      await assert.rejects(db.query("select public.update_task_status($1, 'Pending')", [aliceTask]), /invalid input value/);
    });
    await t.test("a failed notification rolls back the status change", async () => {
      await db.exec("reset role; update private.configuration set lena_user_id = null");
      await as("alice");
      await assert.rejects(db.query("select public.update_task_status($1, 'Not Approved')", [aliceTask]), /Notification recipient is not configured/);
      const row = (await db.query<{ status: string }>("select status from public.tasks where id = $1", [aliceTask])).rows[0];
      assert.equal(row.status, "Approved");
    });
    await t.test("missing routing fails closed rather than choosing an unapproved Head", async () => {
      await db.exec("reset role; update private.configuration set normal_task_head_id = null");
      await as("alice");
      await assert.rejects(db.query("select public.create_own_task('No routing', 'Approved')"), /routing has not been configured/);
    });
    await t.test("anonymous users have no task access", async () => {
      await db.exec("reset role; set role anon");
      await assert.rejects(db.query("select * from public.tasks"), /permission denied/);
      await assert.rejects(db.query("select public.create_own_task('Unauthorized', 'Approved')"), /permission denied/);
    });
  } finally { await db.close(); }
});
