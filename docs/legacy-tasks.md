# Company Tasks

A deliberately small internal task platform: Main Admin, three fixed Heads, normal users, two task statuses, and Lena's in-app notifications.

## Run locally

1. Install dependencies with `npm.cmd install` (Windows) or `npm install`.
2. Copy `.env.example` to `.env.local` and supply the Supabase URL, publishable key, and server-only service-role key.
3. Apply `supabase/migrations/001_initial.sql` in the Supabase SQL editor against a **new development project**. The migration creates the schema and enables Realtime for notifications.
4. Disable public sign-ups in Supabase Authentication. Email delivery is not used. Leave password authentication enabled. Review Supabase Auth rate limits for the expected team size.
5. Supply the initial Admin credentials, `LENA_PASSWORD`, `LENA_HEAD_ID`, and the other two Heads' credentials in `.env.local`. Run `npm.cmd run bootstrap`. Existing profiles are reused without changing passwords. Do not commit passwords, send them through client components, or prefix them with `NEXT_PUBLIC_`. Remove bootstrap-only credentials after setup.
6. Place the provided company logo at `public/logo.png`. A text/checkmark fallback is displayed until the real asset is present.
7. Run `npm.cmd run dev` and open `http://localhost:3000`.

No `.env.local` containing real credentials is included. No external database is provisioned or modified by installing dependencies or starting the app.

## Product decisions still required

- Which of the three Heads is Lena? Set `LENA_HEAD_ID` only after confirmation.
- Which Head receives a normal user's new task? The migration deliberately leaves this unset. For a confirmed single fixed destination, set `private.configuration.normal_task_head_id` through the SQL editor to the approved ID. If routing should instead vary by user or be chosen at creation, implement that confirmed rule before launch; no extra membership system has been assumed.
- Which task write actions are Heads allowed to perform? Until specified, Heads can read their directed tasks; only Admin and normal users have the explicitly defined mutations. Lena alone receives the required notifications.
- New-task forms currently require selecting one of the two statuses; there is no invented default.

These are launch prerequisites, not extra settings pages. The secure initial setup also needs Admin and both other Head account credentials.

## Access control

- Normal application requests use the signed-in user's Supabase session.
- RLS restricts reads. Normal users can read only their own tasks and profile. Heads read tasks directed to their fixed Head. The Admin reads all tasks and profiles.
- Authenticated clients cannot directly mutate the tables. Narrow database functions validate the caller and restrict ownership, fields, and Head selection.
- User account creation is a server action that verifies the Main Admin before using the service-role key; all created accounts are normal users.
- Task insertion and actual status changes by normal users write Lena's notification in the same transaction. Repeated saves of the same status do not notify. Notifications contain the actor's name and the action, without exposing cross-Head task text.
- Realtime listens only for new notification rows authorized by RLS. Reconnection and returning to the tab reload persisted notifications.
- Username matching is case-insensitive and trims outer spaces. Supabase Auth receives an opaque server-generated internal email identifier; the user enters a username and password only. No email/SMS flow is configured.

## Verify

```text
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:browser
```

The database tests run the actual migration in an isolated in-memory PostgreSQL engine (PGlite), with Supabase's Auth identity function and roles represented locally. They exercise real RLS and mutation permissions, ownership, two-status constraints, notification events, and transactional rollback. They do not validate the hosted Supabase Auth service or websocket delivery; verify those in the configured development project with real test accounts before launch.

Browser tests use Microsoft Edge in headless mode, start the production build locally, and verify responsive login rendering and unauthenticated dashboard protection. Run the build first. Screenshots are saved under `test-results/`.

## Deploy

Connect this directory to Vercel. Set only the two public Supabase variables and the server-only service-role key in the deployment environment. Apply migrations and run initial provisioning against the intended Supabase project separately. Do not put initial account passwords in the deployed frontend or Vercel's public environment variables.

The application contains only `/login`, `/admin`, `/head`, and `/my-tasks`; `/` redirects according to role. There are no projects, boards, reports, comments, attachments, or additional statuses.
