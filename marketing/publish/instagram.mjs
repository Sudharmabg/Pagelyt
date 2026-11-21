/* Publish a post to Instagram through the Instagram Graph API (content publishing).
   node instagram.mjs <post-folder> [--base-url https://media.example.com/social] [--yes]

   Needs an Instagram Business or Creator account linked to a Facebook Page, and a Meta app token with
   instagram_basic + instagram_content_publish (+ instagram_manage_comments for the first comment).
   Env: IG_USER_ID, IG_ACCESS_TOKEN (optional when a cloud session's proxy injects it), IG_GRAPH_VERSION (default v21.0).

   Instagram fetches media from a public URL, so the files must be uploaded first. Each file is read from
   <base-url>/<slug>/<file name>; set --base-url or PUBLIC_MEDIA_BASE (e.g. a public Cloudflare R2 bucket).

   post.json → "instagram": { "type": "reel" | "carousel" | "image", "media": ["reel.mp4"], "caption": "...",
                               "cover": "cover.png"?, "thumbOffsetMs": 1500?, "shareToFeed": true?, "firstComment": "..."? } */
import { basename } from "node:path";
import { loadPost, filePath, fail, LIVE, banner, http, sleep, opt } from "./lib.mjs";

const post = loadPost();
const ig = post.instagram;
if (!ig) fail("post.json has no \"instagram\" section");
const { type, media = [], caption = "" } = ig;
if (!["reel", "carousel", "image"].includes(type)) fail(`instagram.type must be reel, carousel or image (got ${type})`);
if (!media.length) fail("instagram.media is empty");
if (type === "carousel" && (media.length < 2 || media.length > 10)) fail("a carousel needs 2–10 items");
if (caption.length > 2200) fail(`caption is ${caption.length} characters (Instagram's limit is 2,200)`);
if ((caption.match(/#\w/g) || []).length > 30) fail("more than 30 hashtags");
media.forEach((f) => filePath(post, f));
if (ig.cover) filePath(post, ig.cover);

const base = (opt("base-url") || process.env.PUBLIC_MEDIA_BASE || "").replace(/\/$/, "");
const urlOf = (f) => `${base}/${post.slug}/${basename(f)}`;
const isVideo = (f) => /\.(mp4|mov)$/i.test(f);

banner("Instagram", post, [
  `type: ${type}`, `media: ${media.map(urlOf).join("\n       ")}`, ig.cover ? `cover: ${urlOf(ig.cover)}` : "",
  `caption (${caption.length} chars):\n${caption}`, ig.firstComment ? `first comment:\n${ig.firstComment}` : "",
].filter(Boolean).join("\n"));
if (!LIVE) process.exit(0);

if (!base) fail("set --base-url or PUBLIC_MEDIA_BASE to where the media files are hosted publicly");
const USER = process.env.IG_USER_ID || fail("IG_USER_ID is not set");
const V = process.env.IG_GRAPH_VERSION || "v21.0";
const API = `https://graph.facebook.com/${V}`;
const headers = { Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN || "proxy-injected"}` };

// fail early if a file is not reachable at its public URL
for (const f of [...media, ...(ig.cover ? [ig.cover] : [])]) {
  const r = await fetch(urlOf(f), { method: "HEAD" }).catch((e) => ({ ok: false, status: e.message }));
  if (!r.ok) fail(`${urlOf(f)} is not publicly reachable (${r.status}). Upload it first.`);
}

const create = async (form) => (await http("POST", `${API}/${USER}/media`, { headers, form })).data.id;
async function waitReady(id) {
  for (let i = 0; i < 60; i++) {
    const { data } = await http("GET", `${API}/${id}?fields=status_code,status`, { headers });
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") fail(`container ${id}: ${data.status_code} ${data.status || ""}`);
    process.stdout.write(`  processing (${data.status_code})…\r`);
    await sleep(5000);
  }
  fail(`container ${id} not ready after 5 minutes`);
}

let container;
if (type === "reel") {
  const form = { media_type: "REELS", video_url: urlOf(media[0]), caption, share_to_feed: String(ig.shareToFeed ?? true) };
  if (ig.cover) form.cover_url = urlOf(ig.cover);
  else if (ig.thumbOffsetMs) form.thumb_offset = String(ig.thumbOffsetMs);
  container = await create(form);
  await waitReady(container);
} else if (type === "image") {
  container = await create({ image_url: urlOf(media[0]), caption });
  await waitReady(container);
} else {
  const children = [];
  for (const f of media) {
    const id = await create(isVideo(f) ? { media_type: "VIDEO", video_url: urlOf(f), is_carousel_item: "true" } : { image_url: urlOf(f), is_carousel_item: "true" });
    children.push(id);
  }
  for (const id of children) await waitReady(id);
  container = await create({ media_type: "CAROUSEL", children: children.join(","), caption });
  await waitReady(container);
}

const { data: pub } = await http("POST", `${API}/${USER}/media_publish`, { headers, form: { creation_id: container } });
const { data: info } = await http("GET", `${API}/${pub.id}?fields=permalink`, { headers });
console.log(`✓ published: ${info.permalink || pub.id}`);

if (ig.firstComment) {
  try { await http("POST", `${API}/${pub.id}/comments`, { headers, form: { message: ig.firstComment } }); console.log("✓ first comment added (pin it in the app)"); }
  catch (e) { console.log("! first comment failed, add it by hand:", e.message); }
}
console.log(`RESULT ${JSON.stringify({ platform: "instagram", slug: post.slug, id: pub.id, url: info.permalink || null })}`);
