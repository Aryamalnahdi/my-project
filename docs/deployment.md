# Deployment

The existing Vercel project is `interflow-dashboard`. It uses Next.js and Node.js 24.x. The platform requires a running server; a static export does not support its authenticated pages and Server Actions.

## Environment

Set these four variables in Vercel's Production environment before building:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The existing Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Its public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only account provisioning and login limits; store as a secret |
| `EMPLOYEE_PIN_PEPPER` | Server-only PIN derivation; store as a secret |

Use the existing pepper from the configured local environment. Generating a replacement would invalidate existing employee PINs. The service key and pepper must never have a `NEXT_PUBLIC_` prefix. Admin bootstrap credentials are not needed in the deployed application. `.vercelignore` excludes local environment files from uploads.

All four SQL migrations must be applied. Keep public signup disabled and email/password login enabled. In `supabase/config.toml`, these are `[auth].enable_signup = false` and `[auth.email].enable_signup = true`. Review `supabase config diff` before pushing configuration. After the final deployment URL is known, set Supabase's Auth Site URL to that HTTPS URL.

## Verification

Run the following from the project directory on Windows:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run typecheck
npm.cmd audit --omit=dev
```

Stop any development server on port 3000. Run the browser suite against the production build with real backend credentials loaded:

```powershell
$env:TICKET_E2E_LIVE = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test
```

The hosted test creates two temporary employees, exercises account activation, PIN login, tickets, live admin notes, session persistence, mobile layout, access isolation, and logout, then removes its own records. Run it before inviting real users. Tests for missing backend configuration are intentionally skipped when the backend is configured.

The production server needs outbound HTTPS access to Supabase. Running it in a network-restricted shell can render login pages successfully while preventing authentication.

## Verify a deployment

The same browser tests can target the actual HTTPS deployment without starting a local server:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'https://YOUR-DEPLOYMENT-HOST'
$env:TICKET_E2E_LIVE = '1'
node --env-file=.env.local node_modules/@playwright/test/cli.js test
```

Use credentials for the same Supabase project as the deployment. Hosted tests disable traces, screenshots, video, and automatic failure page snapshots to avoid recording login passwords or generated PINs. Next.js Server Function argument logging is also disabled during local development.

Confirm both `/admin/login` and `/employee/login` on the deployed URL. Confirm that public registration remains disabled, employees cannot access admin pages or another employee's tickets, and the browser assets contain no server secrets. Keep the exact environment values and the Supabase database backed up through the account owner's normal backup process.
