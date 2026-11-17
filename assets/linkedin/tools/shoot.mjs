/* Headless Chrome screenshots over the DevTools protocol (no extra packages; Node 22 has WebSocket).
   node shoot.mjs jobs.json
   jobs.json: { "auth": {"origin","key","tokensUrl"}?, "jobs": [{ url, out, width, height, scale?, mobile?, wait?, eval?, clip?: {selector, pad?} | {x,y,width,height}, full? }] } */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";

const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333 + Math.floor(Math.random() * 500);
const cfgPath = resolve(process.argv[2]);
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const base = dirname(cfgPath);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "shoot-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none", "about:blank"], { stdio: "ignore" });

let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
}
if (!target) { chrome.kill(); throw new Error("Chrome did not start"); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0; const pending = new Map(); const waiters = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else if (m.method) waiters.filter((w) => w.method === m.method).forEach((w) => { waiters.splice(waiters.indexOf(w), 1); w.res(m.params); });
});
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const once = (method, ms = 30000) => new Promise((res) => { waiters.push({ method, res }); setTimeout(res, ms); });
const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

await send("Page.enable"); await send("Runtime.enable");

if (cfg.auth) { // put a Supabase session in localStorage for the origin
  const tokens = await (await fetch(cfg.auth.tokensUrl)).json();
  const loaded = once("Page.loadEventFired"); await send("Page.navigate", { url: cfg.auth.origin + "/robots.txt" }); await loaded;
  await evaluate(`localStorage.setItem(${JSON.stringify(cfg.auth.key)}, ${JSON.stringify(JSON.stringify(tokens))}); true`);
}

for (const j of cfg.jobs) {
  const scale = j.scale ?? 2;
  await send("Emulation.setDeviceMetricsOverride", { width: j.width, height: j.height, deviceScaleFactor: scale, mobile: !!j.mobile });
  if (j.mobile) await send("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
  const url = /^[a-z]+:/i.test(j.url) ? j.url : "file:///" + resolve(base, j.url).replace(/\\/g, "/");
  const loaded = once("Page.loadEventFired"); await send("Page.navigate", { url }); await loaded;
  await evaluate("document.fonts ? document.fonts.ready.then(() => true) : true");
  await sleep(j.wait ?? 1500);
  if (j.eval) { const r = await evaluate(`(async () => { ${j.eval} })()`); if (r !== undefined) console.log("  eval:", r); await sleep(j.after ?? 600); }
  let clip;
  if (j.clip?.selector) {
    const r = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(j.clip.selector)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, width: b.width, height: b.height }; })()`);
    if (!r) { console.log("  missing selector", j.clip.selector); continue; }
    const p = j.clip.pad ?? 0; clip = { x: r.x - p, y: r.y - p, width: r.width + 2 * p, height: r.height + 2 * p, scale: 1 };
  } else if (j.clip) clip = { ...j.clip, scale: 1 };
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: !!(clip || j.full), ...(clip ? { clip } : {}) });
  const out = resolve(base, j.out); mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("saved", j.out);
}
ws.close(); chrome.kill();
