# Academy — gamified training platform

A training and training-tracking platform: slide-based courses with quizzes, XP, levels, badges, streaks, leaderboards, a character-creator avatar and an item shop. Sign-in is Microsoft Entra ID (SSO), and it deploys as a single container to Azure Container Apps.

## Features

- **Courses**: slide decks with rich questions (single/multiple choice, true/false, ordering, matching, acknowledgement), video and audio slides that can require watching to the end, built in the in-app studio or imported from `.pptx` (text, tables, pictures, backgrounds, embedded video/audio and speaker notes), with a score summary at the end.
- **Reading modules**: import a PDF (or add a *Document* slide). Learners open it in a pop-up reader, must open it before moving on, then answer the questions that follow.
- **Authoring**: author preview (nothing recorded), question banks (each attempt draws N random questions), and versioning: every publish freezes the slides, learners finish the version they started, and authors can restore any earlier version into the draft.
- **Feedback**: learners rate courses 1–5 stars with an optional comment. Averages show on course cards, and authors read comments in the studio.
- **Gamification**: XP and levels, coins, 17 badges, daily streaks, individual and team leaderboards, a layered SVG character creator, an item shop and rare badge-only avatar items.
- **Fun extras**: speed bonus for quick correct answers, quiz sound effects (with mute), an animated level-up moment, seasonal events run by admins (1.5x to 3x XP with a dashboard countdown and live team challenge standings), and kudos: thank colleagues with coins (100 a day cap) on a shared kudos wall.
- **Teams**: admins create teams (or generate one per Entra department), add people and choose team leads. New starters join the team named after their department.
- **Assignments**: team leads assign courses to their team or its members; admins can assign to any team, department or everyone. Due dates drive in-app reminders (a topbar bell, a dashboard banner and due chips).
- **Compliance**: recurring training (every 6, 12, 24 or 36 months) expires and asks people to renew; acknowledgement slides record a timestamped policy sign-off; a daily job sends email (Microsoft Graph) and Teams channel reminders, weekly manager digests with escalation, and managers can nudge people from the Team page.
- **Team progress**: team leads see completion, overdue training and XP for their teams, and can download members' certificates.
- **Certificates**: every passed course earns a PDF certificate (`/certificates`).

## Quick start (local)

Requirements: Node.js 22+. No database install needed. Local dev uses embedded [PGlite](https://pglite.dev) stored in `./.data`.

```bash
npm install
cp .env.example .env.local   # then set AUTH_SECRET; AUTH_DEV_LOGIN=true enables the local login form
npm run dev
```

Tests: `npm test` (unit + integration on in-memory Postgres) and `npm run test:e2e` (Playwright; uses your installed Edge locally).

Open http://localhost:3000. With `AUTH_DEV_LOGIN=true` you can sign in with any name and email. Put your email in `INITIAL_ADMIN_EMAILS` to become an admin.

Database migrations in `./drizzle` run automatically on startup. After changing `src/db/schema.ts`, run `npm run db:generate`.

## Roles

Roles are managed in the app (**Admin → People & roles**):

| Role    | Can                                                   |
| ------- | ----------------------------------------------------- |
| Learner | Take courses, earn XP and coins, customise an avatar  |
| Manager | Lead teams: see their progress and assign training     |
| Author  | Create, import and publish courses                    |
| Admin   | Everything, including managing roles                  |

Anyone listed in `INITIAL_ADMIN_EMAILS` is made an admin when they sign in. Managers manage the **teams they lead** (Admin → Teams). A manager who leads no team falls back to everyone in their Entra **department**.

## Running the container locally

```bash
docker compose up --build
```

This runs the production image against Postgres 17. Production mode turns off the dev login, so set the Entra variables in `.env.local` first.

## Deploying to Azure

Infrastructure as code lives in [`infra/`](infra/main.bicep): Container Apps, ACR, PostgreSQL Flexible Server, Blob Storage, Key Vault, Log Analytics and a managed identity. GitHub Actions deploys on every push to `main` using OIDC. See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the Entra app registration and the one-command bootstrap (`infra/bootstrap.sh`).

**Terraform:** to deploy into an existing Terraform repo from the public image (`ghcr.io/sudo-rm-me/att-training-platform`), use the module in [`infra/terraform`](infra/terraform/README.md):

```hcl
module "training" {
  source               = "github.com/sudo-rm-me/att-training-platform//infra/terraform?ref=v0.9.0"
  resource_group_name  = "rg-training"
  image                = "ghcr.io/sudo-rm-me/att-training-platform:0.9.0"
  entra_tenant_id      = var.tenant_id
  entra_client_id      = var.client_id
  entra_client_secret  = var.client_secret
  initial_admin_emails = ["you@contoso.com"]
}
```

**Releases:** pushing a tag like `v1.2.0` (or running the *Release* workflow) publishes `ghcr.io/sudo-rm-me/att-training-platform:1.2.0`, `:1.2` and `:latest`, and creates a GitHub release.

## Configuration

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Auth.js session encryption secret |
| `AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER` | Entra sign-in app (`https://login.microsoftonline.com/<tenant>/v2.0`) |
| `INITIAL_ADMIN_EMAILS` | Comma-separated emails that become admins on sign-in |
| `AUTH_DEV_LOGIN` | `true` enables the local dev login form (ignored in production) |
| `DATABASE_URL` | Postgres URL. Unset uses embedded PGlite in `./.data` |
| `DATABASE_SSL` | `true` forces verified TLS |
| `DATABASE_POOL_MAX`, `RUN_MIGRATIONS` | Pool size (default 10); `false` skips startup migrations |
| `AZURE_STORAGE_ACCOUNT_URL`, `AZURE_STORAGE_CONTAINER`, `AZURE_CLIENT_ID` | Blob storage for uploads via managed identity |
| `UPLOAD_DIR` | Local upload folder when Blob Storage isn't configured |
| `APP_TIMEZONE` | IANA timezone for streaks and due dates (default `Europe/London`) |
| `APP_NAME` | Display name (runtime; `NEXT_PUBLIC_APP_NAME` still works at build time) |
| `APP_URL` | Public URL used in email and Teams links |
| `CRON_SECRET` | Enables `POST /api/cron/reminders` (Bearer token) |
| `MAIL_SENDER` | Mailbox for reminder emails via Microsoft Graph (`Mail.Send`) |
| `ESCALATE_AFTER_DAYS` | Days overdue before managers see “Escalated” (default 14) |
