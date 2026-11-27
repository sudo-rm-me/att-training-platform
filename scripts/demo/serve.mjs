// Starts a dev server on the seeded demo database (port 3200) for screenshots.
import { spawn } from "node:child_process";
const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-demo",
  DATABASE_URL: "pglite:./.data/demo",
  AUTH_SECRET: "demo-only-secret-not-for-production",
  AUTH_DEV_LOGIN: "true",
  AUTH_URL: "http://localhost:3200",
  APP_NAME: "Contoso Academy",
  APP_TIMEZONE: "Europe/London",
};
spawn("npx", ["next", "dev", "-p", "3200"], { env, stdio: "inherit", shell: true });
