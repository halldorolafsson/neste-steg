This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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
