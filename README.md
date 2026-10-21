This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Notes And Task Fields

Deployed 2026-10-19 to `neste-steg-00012-rez` (100% traffic), image tag
`20261019-notes-fields`. App build `becdfe50-1e21-4c5a-af2e-78ccc36f0a64`
and migration build `6329e3ad-e391-454f-9111-ddaa2cfb268c` succeeded.
Pre-migration Cloud SQL backup `1792417261085` completed successfully;
migration execution `neste-steg-migrate-x7d74` completed successfully.
Validation: 196 tests, lint and production build passed. PostgreSQL migration
tests verified preservation of existing tasks/accounts and link-only cascades.
Candidate and production HTTPS checks verified authentication redirects on notes,
new-task and settings pages. Full authenticated browser acceptance on PC/mobile
remains manual; no claim of browser screenshot or end-to-end testing is made.
Rollback target: `neste-steg-00010-rig`; leave the additive tables in place.

Dashboard and Inbox have a permanent New task link. Settings > Visible task
fields stores each user's preferred optional fields in PostgreSQL, so the
preference follows that user between devices. The default visible optional
fields are Description, Priority and Due date. Asset, Energy level, Estimated
time and Location are initially hidden. More fields reveals all optional fields
temporarily, without changing the preference. Required title/area and the edit
status remain available. Hidden inputs retain their existing values; clearing
an optional value explicitly is distinct from omitting it in an update.

Notes has a searchable list and a single title/content editor. Notes are private
to their owner, store plain text, and can stand alone or link to multiple tasks.
Tasks can link multiple notes. The task editor offers New note (prelinked to
that task), existing-note linking and unlinking. The note editor offers linked
task navigation and optional task selection. Removing a link or deleting either
object never deletes the object on the other side. Note deletion is confirmed.
Content is limited to 100,000 characters and titles to 200. Failed saves retain
the draft. No recurrence, rich-text editor, attachments or task templates are
included in this release.

Apply `20261019160000_notes_task_preferences` before the new app image. It adds
`Note`, `TaskNote` and `TaskFormPreference`; existing tables/data are unchanged.
The previous application remains compatible for rollback. All note reads and
writes are owner-scoped, and task linking verifies both owners server-side.
Notes is enabled in navigation by default and can be hidden by an administrator
through the existing menu configuration.

Use a full Cloud SQL backup or PostgreSQL-native backup for production recovery.
The legacy SQLite data-transfer utility only covers its original table list;
it does not export notes, task-note links or task-field preferences and is not
a full backup of the current application.

### Task List Filters

Menu dismissal fix deployed on 2026-10-19 to `neste-steg-00010-rig` (100%
traffic), image tag `20261019-filter-dismiss`, Cloud Build
`7e6ec5af-45fb-47e2-8ac5-9d8b8f49cc5f`. Menus now close after a selection,
outside pointer interaction, focus leaving the menu, or Escape. Selection and
Escape restore focus to the menu summary; reopening preserves multiple values.
Validation: 162 tests, lint and production build passed. Candidate and
production HTTPS checks passed; authenticated browser acceptance remains manual.
No database changes. Rollback target: `neste-steg-00008-los`.

Deployed on 2026-10-19 to `neste-steg-00008-los` (100% traffic).
Image: `europe-north1-docker.pkg.dev/runprice/neste-steg/neste-steg:20261019-task-filters`.
Cloud Build: `ff0592ef-8b95-498b-8f54-e4895e865fb8` (successful).
No database migration or configuration changes were required. The previous
revision `neste-steg-00006-xay` remains the rollback target. Validation: 157
tests, lint, TypeScript and production build passed; unauthenticated HTTPS
checks passed on the candidate revision. An authenticated browser acceptance
test of the full editing workflow remains to be done by a user.

The Tasks page supports multiple statuses, areas and priorities. Values within
one group are combined with OR; the groups are combined with AND. Single-value
URLs still work. No selection uses the existing default: exclude inbox and
archived tasks. Sorting supports priority, newest, oldest and title, with stable
ID tie-breaking. Reset filters restores the default filters and sorting.

The URL is the source of truth. A browser-session cookie remembers the last
selection for the authenticated user, including when Save returns to `/tasks`.
Explicit URL filters override the cookie, and browser back/forward navigation
updates the remembered selection. Normal logout and successful login clear it.
Selections are browser-specific, not synchronized between devices. The cookie
contains preferences, not credentials; server queries always enforce the
authenticated user ID and validate statuses, priorities and sorting.

### Database Cost Review (2026-10-19)

Read-only inspection of `runprice/neste-steg-db` found PostgreSQL 16,
Enterprise, `db-f1-micro`, ZONAL, 10 GB SSD, always running, seven retained
daily backups and seven days of point-in-time recovery logs. No database or
billing settings were changed. Configuration alone does not establish the
actual invoice, discounts, credits or total project costs.

Recommended order:

1. In Billing Reports, filter project `runprice`, service Cloud SQL and group
   by SKU. Compare a full month's compute, storage, backup and network costs.
   Set budget notifications; an alerts-only budget does not stop spending.
2. Keep the existing small instance if continuous availability and managed
   backups justify the baseline cost. Do not disable backups as the first
   saving measure, and do not commit to long-term discounts before confirming
   eligibility and ongoing usage for this shared-core machine type.
3. Consider scheduled Cloud SQL stop/start only if downtime is acceptable.
   Compute charges stop, but storage and applicable IP charges remain. The app,
   including login, cannot use the database while stopped. It does not start
   automatically when an application request arrives. Scheduler also has costs.
   Stopping for eight hours saves about one third of compute time, not one third
   of the total project bill.
4. For low, intermittent traffic, test a managed serverless PostgreSQL service
   such as Neon while leaving the app in Cloud Run. Its current Free plan has
   1 GB storage and 100 CU-hours monthly per project and scales to zero after
   five inactive minutes. This is a candidate, not a guarantee of free
   production operation. Check EU region, data processing terms, backup/restore
   limits, pooling, TLS, network charges and cold-start latency. Prisma and the
   SQL schema can remain, but migrations, transactions, password reset locking
   and connection settings must be tested against the chosen service.
5. Before any move: take a fresh backup, prove restore into a separate test
   database, compare data, test authentication and task workflows, plan a short
   write freeze and retain a rollback route. Avoid writes to both databases
   after cutover; rolling back after new writes needs explicit reconciliation.
6. Do not use local SQLite inside Cloud Run: its writable filesystem is
   ephemeral and not shared between instances. Firestore needs substantial
   changes to the relational Prisma model and is not a first-choice cost fix.
   Self-managed PostgreSQL on a VM adds patching, monitoring, backups and restore
   responsibilities; compare that work with the modest current instance cost.

References (checked 2026-10-19):
[Billing Reports](https://docs.cloud.google.com/billing/docs/how-to/reports),
[budget alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets),
[Cloud SQL stop/start](https://docs.cloud.google.com/sql/docs/postgres/start-stop-restart-instance),
[Neon pricing](https://neon.com/pricing),
[Cloud Run filesystem](https://docs.cloud.google.com/run/docs/container-contract).

### Password Management

Production deployment verified on 2026-10-15:

- Service: `runprice/europe-north1/neste-steg`.
- Active revision: `neste-steg-00006-xay` (100% traffic).
- App image: `europe-north1-docker.pkg.dev/runprice/neste-steg/neste-steg:20261015-password-recovery`.
- Migration execution: `neste-steg-migrate-7m5vd` (successful).
- Pre-migration Cloud SQL backup: `1792049985123` (successful).
- Verification: lint, TypeScript, production build and 140 tests passed.
- HTTPS checks: login, forgotten-password and reset pages returned 200;
  unauthenticated Settings redirected to login, auth session was empty,
  and Realtime session creation returned 401.
- Authenticated browser testing with a real user remains a manual acceptance step.
- Previous production revision: `neste-steg-00003-2ml`. Traffic can be returned
  to that revision without removing the additive database migration.

Signed-in users can change their password under Settings. The current password
is required. Passwords must match, contain at least 12 characters and fit within
bcrypt's 72-byte UTF-8 limit. Saving a password ends all existing sessions;
users then sign in with the new password.

For a forgotten password, the sign-in page links to administrator-assisted
recovery. An administrator opens Settings, finds the user and selects
"Lag tilbakestillingslenke". Confirm the user's identity before sharing the link
through an agreed private channel. The link expires after 30 minutes, works
once, and is replaced when a new link is generated. Creating a link does not
change the password or end the user's sessions. Only a successful password
change or reset does that. This workflow requires no email service or domain.

Recovery tokens are stored only as SHA-256 hashes. Tokens travel in the URL
fragment and are removed from the browser address after capture. The recovery
page never automatically signs in a user. Old JWTs are rejected server-side
using the user's session version, including access to Realtime session creation.

Deploy the `20261009120000_password_recovery` migration with the migration image
before deploying the application image. This adds a session version to existing
users and creates the recovery table without changing existing password hashes.
The previous app image remains compatible with this additive migration.

If the only administrator is locked out, another administrator cannot generate
a link. Recovery then requires an operator with database access; keep an agreed
administrative recovery procedure outside the public application.

### Windows npm

On this PC, the npm launcher selects an old global npm 8.3.0 even though
Node 24 includes npm 11.9.0. Use the bundled CLI directly if dependency
installation fails with `Cannot read properties of null (reading 'edgesOut')`:

```powershell
$npmCli = "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js"
node $npmCli ci
node $npmCli run test -- --maxWorkers=2
```

This does not update global tools or delete the lockfile. Use the same CLI for
other npm commands in that terminal. Two test workers avoid transfer-test
timeouts under heavy load.

### Local PostgreSQL

Run commands from the project root in PowerShell. Install and start Docker
Desktop, then start the local database:

```powershell
docker compose up -d db
```

Set `DATABASE_URL` in your local `.env` to
`postgresql://neste:neste@localhost:5432/nestesteg`.
The credentials in Compose are for local development only. The database port
is bound to localhost, and its data is stored in the `pgdata` Docker volume.

Apply the committed migrations and generate the client:

```powershell
npm run db:deploy
npx prisma generate
```

Use `npm run db:migrate` when developing new schema migrations. Use
`npm run db:deploy` for existing migrations, including production; do not use
`db:push` for production. `npm run db:seed` creates only areas, locations and
navigation defaults; it does not create users or grant admin rights. During
data migration, import existing data before considering seed defaults to avoid
conflicting IDs for shared records. SQLite data is not imported by these
commands; keep the original database and backups for the separate data transfer.

Before cloud deployment, build the separate migration target:

```powershell
docker build --target migration --tag neste-steg-migration:local .
docker run --rm --network neste-steg_default `
	-e DATABASE_URL=postgresql://neste:neste@db:5432/nestesteg `
	neste-steg-migration:local
```

This image runs as the `node` user and uses the installed Prisma CLI without
downloading packages at startup. It includes the Prisma config, schema and
migrations, but no local environment files or database backups.
Use `cloudbuild.migration.yaml` to build and publish this target in Cloud Build.
Cloud Run migration jobs must use this image, not the application runner image.

The application runner uses Next.js standalone dependency tracing. It does not
copy Prisma CLI/config packages wholesale. Database initialization is lazy:
building the image needs no database credentials, while the first database
operation still requires a PostgreSQL URL.

The dependency audit is not clean: the current lockfile reports 12 findings
(11 high, one low), with no critical findings. Production audit reports three
high findings from one `deepmerge-ts` advisory through Prisma CLI/config, which
are verified absent from the runner image but remain in development and the
migration image. Use only reviewed local Prisma configuration and keep build
and migration tooling isolated. The full audit also includes development-tool
findings; do not treat runtime exclusion as a fix for those tools. Revisit the
four security overrides when upstream dependencies adopt patched releases.

### SQLite Data Transfer

Export from a verified SQLite backup, never from a database being written to:

```powershell
npm run db:transfer -- export --source backup/dev-20261006-113031.db --output backup/data-export.json
```

The export contains private data and password hashes. Keep it in the ignored
`backup` directory or outside the project, restrict Windows file permissions,
and do not share or upload it as build input. Existing export files are never
overwritten. The source is opened read-only and checked for integrity.

Set `DATABASE_URL` to the intended PostgreSQL target and apply migrations first.
All eight application tables must be empty. Do not run seed beforehand.

```powershell
npm run db:transfer -- import --input backup/data-export.json --dry-run
npm run db:transfer -- import --input backup/data-export.json --commit
```

Without `--commit`, import always rolls back. Both modes validate relationships,
import in dependency order, and compare every stored field, including IDs,
dates, admin flags and password hashes. A failure rolls back the whole import.
Only row counts and verification status are logged. Non-empty targets are
rejected; this tool never deletes or replaces existing data. For Cloud SQL,
connect through Cloud SQL Auth Proxy rather than opening a public database port.

### User Invitations

Open registration is disabled. An existing administrator can view users and
create invitations under Settings. Share the generated link privately; it is
shown only when created. The link is bound to one email address, expires after
48 hours, and can be redeemed once. Pending invitations can be revoked. New
users are regular users, never administrators. Apply migrations before using
this feature and transfer the existing administrator through the data import.

Only SHA-256 token hashes are stored. The token is in the URL fragment, not
the request URL. New passwords require at least 12 characters and at most
72 UTF-8 bytes. Existing users keep their passwords. Authentication rate
limits are process-local: keep Cloud Run at one instance until a shared
limiter is introduced. Restarting the process resets the limits.

### Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
