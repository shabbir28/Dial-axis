# DialAxis

Standalone React + Tailwind CSS application with Express and PostgreSQL.
Independent of Balitech CRM; only the dialer module is included.

## Quick start (Windows)

Requirements: Node.js 22.12+ (or 24 LTS), npm, PostgreSQL, database dialer_record.

Already configured on this machine:
1. Open setup-credentials.txt for the initial Admin login.
2. Double-click Start-DialerRecord.cmd.
3. Open http://localhost:5100.
4. Sign in and replace the initial password. Delete the credentials file afterward.

The launcher runs the built app. Keep its terminal open; Ctrl+C stops it.
No migration or external scan runs automatically at startup.

## Clean install / another machine

- npm --prefix backend ci
- npm --prefix frontend ci
- Copy backend/.env.example to backend/.env and set PostgreSQL and dialer credentials.
- Set a unique random JWT_SECRET with at least 32 characters.
- Create dialer_record in PostgreSQL.
- npm run setup (idempotent schema setup; never overwrites existing accounts)
- npm run build
- npm start

## Development

Run npm run dev:api and npm run dev:web in two terminals.
Frontend: http://localhost:5175. API: http://localhost:5100/api.
Vite proxies API requests. Session cookies are HttpOnly; no tokens in browser storage.

## Roles

Only User and Admin are supported.
- User: view all dialer stats and download existing exports.
- Admin: all User access, start scans, create/manage User and Admin accounts.
- Administrators cannot change their own role or active status; an active Admin is required.
- Passwords must be 8–128 characters. Initial passwords must be changed on first login.
- Role/status changes revoke existing sessions.
- Existing Super Admin accounts are migrated to Admin without changing usernames/passwords.

## Dialers

- BaliT6 Voice: campaign 001 / Bismillah
- FE: campaign 1002 / FE Bot 2 i9
- FE2 S: campaign 001 / Outbound

File stats refresh every two minutes while visible. Manual refresh is rate-coalesced.
Unique/duplicate/status CSVs update only via an admin-triggered scan.
Copied snapshots retain their original scan timestamp.
No CRM suppression comparisons or CRM database tables are used.
Displayed call count means number occurrences; CSV lead_call_attempts is separate.

## Structure

- backend/migrations: PostgreSQL auth schema
- backend/scripts: First-run setup
- backend/src/config: Environment and database pool
- backend/src/middleware: Session and role checks
- backend/src/routes: Auth, users and dialer endpoints
- backend/src/utils: Dialer parsing, scanning and CSV exports
- backend/tests: Regression and transactional integration tests
- backend/exports: Private generated snapshots/CSVs (gitignored)
- frontend/src/components: Shell and dialer panels
- frontend/src/context: Auth state
- frontend/src/pages: Login, first-login password setup, dashboard, downloads, users and dialer views
- frontend/src/services: Same-origin API client

## Verification

npm test runs dialer unit tests and PostgreSQL-backed auth integration tests.
Integration test users are created in one transaction and rolled back afterward.
npm run build creates frontend/dist.

## Deployment

Default binding is localhost only. For public access, use HTTPS, set COOKIE_SECURE=true,
and configure APP_ORIGINS to the exact public origin. Keep .env, exports and initial
credentials out of source control. Serve only frontend/dist publicly; exports require auth.


## Workspace navigation
- Overview: combined real campaign KPIs, per-dialer activity, and best Sale/HA files.
- Dialers: detailed BaliT6, FE and FE2 S campaign views.
- Downloads: saved number inventory and category/status CSV downloads.
- User management: role-controlled account management and a focused create-user dialog.
- Account navigation was removed. Password setup appears only during first-login onboarding.
- Supplied Go Connectivo branding appears beneath the login form and at the sidebar footer.

Dashboard totals are sums of uploaded records, not distinct phone counts across dialers.
Unavailable sources and stale snapshots are explicitly marked.


## Audit logs
Admins can open Audit logs from the sidebar and filter by user, action, dialer,
result and local date range. Results are paginated (25 events per page).
Download categories and selected-status exports record the user/role, time,
dialer/campaign, file name, row count, snapshot ID, selected statuses and request IP.
Scan requests, user creation, and role/activation updates are also recorded.
Authenticated failed/denied requests to these endpoints are logged.
No CSV contents, phone numbers, passwords, session cookies or API secrets are recorded.
Export ready means the server prepared the response, not proof of a device saving it.
Interrupted actions remain pending/unconfirmed. If audit storage fails, CSV contents
are not released. History starts when this feature is installed; it is not backfilled.
Logs have no edit/delete endpoints. Database administrators still control the database.
