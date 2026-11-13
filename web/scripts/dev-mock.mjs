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
  // Emails (when EMAILS_ON=1) go to the mock, never to Resend; see /__state for what would have been sent.
  RESEND_API_URL: `http://localhost:${MOCK_PORT}`,
  RESEND_API_KEY: process.env.EMAILS_ON === "1" ? "mock-resend-key" : "",
  // Connect Google runs against the mock's fake Google (consent screen, tokens, Search Console); see MOCK_GOOGLE.
  GOOGLE_MOCK_URL: `http://localhost:${MOCK_PORT}`,
  GOOGLE_CLIENT_ID: "mock-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "mock-client-secret",
  GOOGLE_TOKEN_KEY: "mock-google-token-key-not-secret-0123456789",
  // Switches the Google Ads tab on; the mock accepts any developer token (MOCK_GOOGLE=adstoken plays an unapproved one).
  GOOGLE_ADS_DEVELOPER_TOKEN: "mock-ads-developer-token",
  // Without a real OPENAI_API_KEY, the "Analyse with AI" buttons (Analytics and Ads) use the mock's fake OpenAI.
  ...(process.env.OPENAI_API_KEY ? {} : { OPENAI_MOCK_URL: `http://localhost:${MOCK_PORT}` }),
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
