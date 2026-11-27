# Academy — gamified training platform

A training and training-tracking platform: slide-based courses with quizzes, XP, levels, badges, streaks, leaderboards, a character-creator avatar and an item shop. Sign-in is Microsoft Entra ID (SSO), and it deploys as a single container to Azure Container Apps.

## Features

- **Courses**: slide decks with rich questions (single/multiple choice, true/false, ordering, matching), built in the in-app studio or imported from `.pptx`, with a score summary at the end.
- **Gamification**: XP and levels, coins, 15 badges, daily streaks, individual and team leaderboards, a layered SVG character creator and an item shop.
- **Assignments**: managers assign courses to people or their department; admins can also assign to any department or everyone. Due dates drive in-app reminders (a topbar bell, a dashboard banner and due chips).
- **Team progress**: managers see completion, overdue training and XP for their department, and can download team members' certificates.
- **Certificates**: every passed course earns a PDF certificate (`/certificates`).

## Quick start (local)

Requirements: Node.js 22+. No database install needed. Local dev uses embedded [PGlite](https://pglite.dev) stored in `./.data`.

```bash
npm install
cp .env.example .env.local   # then set AUTH_SECRET; AUTH_DEV_LOGIN=true enables the local login form
npm run dev
```

Open http://localhost:3000. With `AUTH_DEV_LOGIN=true` you can sign in with any name and email. Put your email in `INITIAL_ADMIN_EMAILS` to become an admin.

Database migrations in `./drizzle` run automatically on startup. After changing `src/db/schema.ts`, run `npm run db:generate`.

## Roles

Roles are managed in the app (**Admin → People & roles**):

| Role    | Can                                                   |
| ------- | ----------------------------------------------------- |
| Learner | Take courses, earn XP and coins, customise an avatar  |
| Manager | See their department's progress and assign training   |
| Author  | Create, import and publish courses                    |
| Admin   | Everything, including managing roles                  |

Anyone listed in `INITIAL_ADMIN_EMAILS` is made an admin when they sign in. A manager's team is everyone with the same **department** (synced from Microsoft Entra / Graph on sign-in).

## Running the container locally

```bash
docker compose up --build
```

This runs the production image against Postgres 17. Production mode turns off the dev login, so set the Entra variables in `.env.local` first.
