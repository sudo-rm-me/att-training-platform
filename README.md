# Academy — gamified training platform

A training and training-tracking platform: slide-based courses with quizzes, XP, levels, badges, streaks, leaderboards, a character-creator avatar and an item shop. Sign-in is Microsoft Entra ID (SSO), and it deploys as a single container to Azure Container Apps.

## Features

- **Courses**: slide decks with rich questions (single/multiple choice, true/false, ordering, matching), built in the in-app studio or imported from `.pptx`, with a score summary at the end.
- **Gamification**: XP and levels, coins, 15 badges, daily streaks, individual and team leaderboards, a layered SVG character creator and an item shop.
- **Teams**: admins create teams (or generate one per Entra department), add people and choose team leads. New starters join the team named after their department.
- **Assignments**: team leads assign courses to their team or its members; admins can assign to any team, department or everyone. Due dates drive in-app reminders (a topbar bell, a dashboard banner and due chips).
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
| `NEXT_PUBLIC_APP_NAME` | Display name (build time) |
