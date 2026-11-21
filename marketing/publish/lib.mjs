/* Shared helpers for the publish scripts. No dependencies (Node 22+).
   In a Claude cloud session run the scripts with NODE_USE_ENV_PROXY=1 so fetch goes through the session proxy. */
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

export const args = process.argv.slice(2);
export const flag = (k) => args.includes("--" + k);
export const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };

/** Loads marketing/posts/<slug>/post.json. The first non-flag argument is the post folder (or a path to post.json). */
export function loadPost() {
  const VALUE_OPTS = ["--base-url"];
  const target = args.find((a, i) => !a.startsWith("--") && !VALUE_OPTS.includes(args[i - 1]));
  if (!target) fail("usage: node <script> <post-folder> [--yes]");
  const dir = resolve(target.endsWith(".json") ? resolve(target, "..") : target);
  const file = join(dir, "post.json");
  if (!existsSync(file)) fail(`no post.json in ${dir}`);
  const post = JSON.parse(readFileSync(file, "utf8"));
  post.dir = dir;
  post.slug ??= dir.split(/[\\/]/).pop();
  return post;
}

export const filePath = (post, f) => {
  const p = resolve(post.dir, f);
  if (!existsSync(p)) fail(`missing media file ${p}`);
  return p;
};

export function fail(msg) { console.error("✗ " + msg); process.exit(1); }

/** Publishing is a dry run unless --yes is passed. */
export const LIVE = flag("yes");
export function banner(platform, post, summary) {
  console.log(`\n${LIVE ? "PUBLISHING" : "DRY RUN (add --yes to publish)"} → ${platform}: ${post.slug}`);
  console.log(summary);
  console.log("─".repeat(60));
}

export async function http(method, url, { headers = {}, json, body, form } = {}) {
  const init = { method, headers: { ...headers } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["Content-Type"] = "application/json"; }
  else if (form) { init.body = new URLSearchParams(form); }
  else if (body !== undefined) init.body = body;
  const res = await fetch(url, init);
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${url.split("?")[0]} → ${res.status}: ${text.slice(0, 600)}`);
  return { data, headers: res.headers, status: res.status };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
