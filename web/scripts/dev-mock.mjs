/* `npm run dev:mock`: runs the site against a fake, in-memory Supabase so you can try sign-up, sign-in, the
   owner/view-only dashboard and the tools gate locally with no keys and no email. Nothing touches your real
   Supabase project. Stop your normal `npm run dev` first (two dev servers cannot share one folder). */
import { spawn } from "node:child_process";

const MOCK_PORT = process.env.MOCK_PORT || "54321";
const KEY = "mock-service-key";
const env = {
  ...process.env,
  MOCK_PORT,
  MOCK_SERVICE_KEY: KEY,
  NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
  SUPABASE_URL: `http://localhost:${MOCK_PORT}`,
  SUPABASE_SERVICE_ROLE_KEY: KEY,
};
// The human check would need real Cloudflare keys, so it stays off in this mode.
delete env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
delete env.TURNSTILE_SECRET_KEY;

const children = [
  spawn(process.execPath, ["scripts/mock-supabase.mjs"], { env, stdio: "inherit" }),
  spawn("npx", ["next", "dev", ...(process.env.PORT ? ["-p", process.env.PORT] : [])], { env, stdio: "inherit", shell: true }),
];

const stop = () => children.forEach((c) => c.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
children.forEach((c) => c.on("exit", stop));
console.log("\n[dev:mock] Sign-in test mode. No emails are sent and accounts are confirmed instantly. Data resets when you stop.\n");
