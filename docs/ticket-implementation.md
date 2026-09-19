# Ticket implementation inventory

## Created

- `supabase/migrations/002_employee_role.sql`: dedicated employee role.
- `supabase/migrations/003_ticket_management.sql`: ticket schema, authorization, mutations, login throttling, Realtime.
- `src/app/admin/login/page.tsx`: dedicated Admin login.
- `src/app/admin/accounts/page.tsx`: employee account creation/list/status.
- `src/app/admin/tickets/page.tsx`, `src/app/admin/tickets/[id]/page.tsx`: all tickets, details, and notes.
- `src/app/employee/login/page.tsx`, `src/app/employee/page.tsx`: Employee login/dashboard.
- `src/app/employee/tickets/page.tsx`, `src/app/employee/tickets/new/page.tsx`, `src/app/employee/tickets/[id]/page.tsx`: own tickets, create form, own details/notes.
- `src/app/ticket-actions.ts`: authenticated account, ticket, note, and login actions.
- `src/app/not-found.tsx`: unavailable/inaccessible ticket state.
- `src/lib/login.ts`: server-only shared login validation, throttling, role separation, activation.
- `src/lib/employee-credentials.ts`: random credentials and server-used PIN derivation.
- `src/lib/ticket-validation.ts`: strict form schemas.
- `src/lib/tickets.ts`: session-based database queries and pagination.
- `src/components/portal-login.tsx`, `portal-login-form.tsx`: shared presentation for separate logins.
- `src/components/ticket-forms.tsx`: account, ticket, and admin-note forms.
- `src/components/ticket-view.tsx`: shared lists, details, status/date formatting, empty states, pagination.
- `src/components/ticket-live-updates.tsx`: RLS-authorized live refresh.
- `scripts/bootstrap-tickets.ts`: provision the requested fixed Admin credentials from private environment variables.
- `tests/ticket-security.test.ts`: real migration/security/validation tests.
- `tests/e2e/ticket-portals.spec.ts`: public login and route-protection browser checks.
- `tests/e2e/ticket-flow.spec.ts`: optional real Supabase flow test.
- `docs/legacy-tasks.md`: preserved prior setup documentation.
- `.env.local` (ignored): supplied server-only Admin credentials and a generated PIN pepper; Supabase values need configuring.

## Modified

- `src/app/admin/page.tsx`: requested ticket dashboard replaces the previous Admin task landing screen.
- `src/app/page.tsx`: unauthenticated entry opens Employee login.
- `src/app/actions.ts`: shared throttled legacy login, role-specific logout, explicit legacy task mutation roles.
- `src/app/login/page.tsx`: links to the new login experiences.
- `src/components/shell.tsx`: role-specific navigation using the existing shell.
- `src/app/globals.css`: scoped blue/white ticket styles and responsive navigation.
- `src/lib/auth.ts`: role-specific unauthenticated redirects.
- `src/lib/types.ts`: employee role and typed ticket data.
- `package.json`: ticket Admin provisioning command.
- `.env.example`: server-only PIN pepper variable.
- `tests/e2e/login.spec.ts`: legacy route test follows the new dedicated Admin login.
- `README.md`: setup, security explanation, complete manual test steps, verification.

## Database

`employees.id` references the existing profile/Auth identity. Names and unique usernames are reused from `profiles`; passwords remain in Supabase Auth. Employee records hold status, creation date, and first login date.

`tickets` holds a UUID, generated unique serial, employee owner, title, description, Open status, and timestamps. `ticket_notes` holds timestamped, append-only notes and a constrained ticket/employee pair.

`private.ticket_login_attempts` stores only a username digest, count, and time window. Service-only functions maintain the limit. Public Authenticated roles cannot inspect or reset it.

No migration removes existing tables or data. Run migration 002 separately so its enum addition commits before migration 003.
