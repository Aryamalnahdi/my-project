# Company support tickets

The app uses the existing Next.js App Router, React, TypeScript, shared CSS, and Supabase Auth/SSR integration. Admin and employee portals have separate login pages and server-enforced roles.

- Admin login: `/admin/login`
- Admin dashboard, accounts, and tickets: `/admin`, `/admin/accounts`, `/admin/tickets`
- Employee login: `/employee/login`
- Employee dashboard, tickets, and new ticket: `/employee`, `/employee/tickets`, `/employee/tickets/new`

## Supabase setup

1. Use the existing Supabase project if you have one. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. The service-role key must remain server-only.
2. Apply the migrations in order using the Supabase SQL editor:
   - `supabase/migrations/001_initial.sql` — only if this project has not already applied it. This preserves the existing task schema.
   - `supabase/migrations/002_employee_role.sql` — run separately and commit before the next migration.
   - `supabase/migrations/003_ticket_management.sql` — employees, tickets, notes, RLS, narrow write functions, login attempt limits, and Realtime publication.
   - `supabase/migrations/004_lock_legacy_tables.sql` — removes public access to unused legacy tables when present.
3. Disable public signups in Supabase Authentication. Keep email/password authentication enabled. Email delivery is not used. The internal email identifier is derived from the username on the server.
   In `supabase/config.toml`, keep `[auth].enable_signup = false` and `[auth.email].enable_signup = true`. Disabling the email setting also disables password login for existing accounts.
4. Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` using the requested fixed administrator credentials. This workspace’s ignored `.env.local` has them prefilled; they are not in frontend source, migrations, or example configuration. Configure `EMPLOYEE_PIN_PEPPER` with a random secret of at least 32 characters. A random pepper has also been generated in the local file.
5. Run `npm.cmd run bootstrap:tickets` (or `npm run bootstrap:tickets` outside Windows). This creates the single admin account, or resets the matching admin’s Auth password to the configured value. It does not provision any employees or require the old Head setup. If a different Main Admin already exists, setup stops without changing it.
6. Run `npm.cmd run dev`.

The Supabase connection fields are initially empty. Installing dependencies or starting the app does not apply migrations or provision a hosted database. Do not overwrite an existing configured `.env.local` with the example file.

The admin bootstrap credentials are only needed during provisioning and can be removed from the deployment runtime afterward. Retain `EMPLOYEE_PIN_PEPPER` securely and use the same value on every app instance. Changing it invalidates existing employee PIN logins. Supabase stores the salted password hash of a server-derived secret; neither the original PIN nor the pepper is stored in application tables.

## Authentication and access

- Every protected page and server action verifies the authenticated Supabase user and role from `profiles`; cookies are refreshed by the existing Next.js proxy.
- Employee accounts receive the dedicated `employee` role. They cannot enter the Admin, Head, or legacy task flows.
- Usernames are generated with cryptographic randomness and database uniqueness. PINs use cryptographic randomness, are exactly four ASCII digits (including possible leading zeroes), and are revealed only in the successful creation response. They are not persisted in browser storage.
- PINs are converted to an account-specific HMAC secret on the server before being sent to Supabase Auth. This also keeps PIN login compatible with Supabase’s minimum password length. The PIN and Auth secret are never logged.
- Every login entry point shares a durable, atomic Supabase limit of five attempts per normalized username per 15 minutes. Successful login clears that account’s counter. The rate-limit functions are executable only by the server’s service role.
- Application reads use the user’s Supabase session and RLS. The service role is used only for provisioning and login limits.
- Employees can read only their own profile, employee record, tickets, and notes. Legacy Head directory data is hidden from employees.
- Direct authenticated table writes are denied. Database functions derive ticket ownership from `auth.uid()` and note recipients from the ticket. The note’s ticket/employee pair also has a composite foreign key.
- First successful employee login activates the account and records `first_login_at` once. Admin notes are append-only; employees cannot write or edit them.
- The current scope has an Open ticket status. No status-changing workflow is introduced.
- Logout clears the current Supabase session and returns to that role’s login. One browser session represents one role; use separate browser profiles/private windows to test both simultaneously.
- Next.js Server Actions retain their built-in same-origin protections. Rendered descriptions and notes are plain React text.
- Realtime subscriptions obey RLS and refresh lists/details when data changes. Returning to the tab and the Refresh button also reload persisted data.

Supabase references: [SSR sessions](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [database functions](https://supabase.com/docs/guides/database/functions).

## Test the complete flow

1. Apply migrations and run the admin bootstrap against the configured development project.
2. Open `/admin/login` and sign in with the supplied admin credentials.
3. Open Accounts → Create Account. Optionally enter an employee name. Save the generated username and PIN, including any leading zeroes. Close the dialog and verify the row is Inactive; reopening Accounts cannot reveal that PIN.
4. In a separate private browser window, open `/employee/login` and use that username and PIN. Verify the employee dashboard opens and the admin’s Accounts row changes to Active. Refresh the employee page and confirm the session persists.
5. Choose Create Ticket, enter a title and description, and submit. Verify the success message, employee’s My Tickets, and admin’s Tickets show the same serial number with status Open.
6. As admin, open the ticket. Verify the employee name, username, original description, and date. Send two notes. Both should appear with timestamps in the employee’s ticket details.
7. Create and sign in as a second employee. Verify their My Tickets is empty and entering the first employee’s ticket URL displays “Ticket unavailable.” Opening `/admin` or `/admin/accounts` must return them to their own dashboard.
8. Confirm invalid credentials fail, a malformed PIN/blank ticket is rejected, and repeated invalid login attempts trigger the limit.
9. Logout in both windows; protected pages must redirect to the correct login page.

## Verification commands

```text
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:browser
```

The database tests execute all actual migrations in isolated PGlite PostgreSQL with test Auth roles/identities. They cover activation, ticket ownership, cross-account reads, forged writes, multiple notes, role isolation, foreign-key enforcement, and durable login limits. Existing task tests remain included.

Browser tests use headless Microsoft Edge and the production build. They cover both logins, mobile/desktop layout, all unauthenticated protected routes, and missing configuration. They do not mock production application data.

A hosted end-to-end test is included but runs only with `TICKET_E2E_LIVE=1` and configured development credentials. Run it after building:

```powershell
$env:TICKET_E2E_LIVE = "1"
node --env-file=.env.local node_modules/@playwright/test/cli.js test tests/e2e/ticket-flow.spec.ts
```

This opt-in test creates two temporary employees through the admin UI, exercises tickets and notes in separate browser sessions, checks authorization and logout, and removes its own test records afterward. Use a development project. No PINs or passwords are logged; traces/screenshots are disabled for this test.

Hosted Auth, PostgREST relationships, and websocket delivery require this configured-project check; isolated database tests do not claim to verify those services.

## Existing task application

The old Head and normal-user task pages remain at `/head` and `/my-tasks`, with their existing `/login`. The Admin landing page now serves the requested ticket dashboard. Existing task tables/components and bootstrap script are retained. Prior setup documentation is in [docs/legacy-tasks.md](docs/legacy-tasks.md); its Admin navigation description predates the ticket portal.

See [docs/ticket-implementation.md](docs/ticket-implementation.md) for the file inventory and migration details.

For production configuration and release checks, see [docs/deployment.md](docs/deployment.md).
