/* Publish a post to the Pagelyt LinkedIn company page through the LinkedIn Posts API.
   node linkedin.mjs <post-folder> [--yes]

   Needs a LinkedIn developer app with the Community Management API (scope w_organization_social) and a token
   from a page admin. Env: LINKEDIN_ORG_ID (numeric company id), LINKEDIN_ACCESS_TOKEN (optional when a cloud
   session's proxy injects it), LINKEDIN_VERSION (YYYYMM; default: two months ago).
   Media is uploaded straight from disk, so no public hosting is needed.

   post.json → "linkedin": { "type": "video" | "document" | "images" | "text", "media": ["deck.pdf"], "title": "...",
                              "caption": "...", "firstComment": "..."? }
   Write the caption as plain text; #Hashtags become real hashtags and LinkedIn's reserved characters are escaped. */
import { readFileSync, statSync } from "node:fs";
import { loadPost, filePath, fail, LIVE, banner, http } from "./lib.mjs";

const post = loadPost();
const li = post.linkedin;
if (!li) fail("post.json has no \"linkedin\" section");
const { type, media = [], caption = "", title = post.slug } = li;
if (!["video", "document", "images", "text"].includes(type)) fail(`linkedin.type must be video, document, images or text (got ${type})`);
if (type !== "text" && !media.length) fail("linkedin.media is empty");
if (type === "images" && media.length > 20) fail("at most 20 images");
if (caption.length > 3000) fail(`caption is ${caption.length} characters (LinkedIn's limit is 3,000)`);
media.forEach((f) => filePath(post, f));

banner("LinkedIn", post, [`type: ${type}`, media.length ? `media: ${media.join(", ")}` : "", type === "document" ? `document title: ${title}` : "",
  `caption (${caption.length} chars):\n${caption}`, li.firstComment ? `first comment:\n${li.firstComment}` : ""].filter(Boolean).join("\n"));
if (!LIVE) process.exit(0);

const ORG = `urn:li:organization:${process.env.LINKEDIN_ORG_ID || fail("LINKEDIN_ORG_ID is not set")}`;
const d = new Date(); d.setUTCMonth(d.getUTCMonth() - 2);
const VERSION = process.env.LINKEDIN_VERSION || `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const API = "https://api.linkedin.com/rest";
const headers = { Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN || "proxy-injected"}`, "LinkedIn-Version": VERSION, "X-Restli-Protocol-Version": "2.0.0" };

/** LinkedIn "little text" format: escape reserved characters, turn #Word into hashtag templates. */
function littleText(s) {
  const esc = (t) => t.replace(/[\\|{}@[\]()<>*_~]/g, (c) => "\\" + c);
  return s.split(/(#[\p{L}\p{N}_]+)/u).map((part) => part.startsWith("#") && part.length > 1 ? `{hashtag|\\#|${part.slice(1)}}` : esc(part).replace(/#/g, "\\#")).join("");
}

async function uploadSimple(kind, file) {
  // images and documents: one PUT to the returned upload URL
  const { data } = await http("POST", `${API}/${kind}?action=initializeUpload`, { headers, json: { initializeUploadRequest: { owner: ORG } } });
  await http("PUT", data.value.uploadUrl, { headers: { Authorization: headers.Authorization }, body: readFileSync(file) });
  return data.value.image || data.value.document;
}

async function uploadVideo(file) {
  const size = statSync(file).size, bytes = readFileSync(file);
  const { data } = await http("POST", `${API}/videos?action=initializeUpload`, { headers,
    json: { initializeUploadRequest: { owner: ORG, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false } } });
  const { video, uploadToken = "", uploadInstructions } = data.value;
  const parts = [];
  for (const u of uploadInstructions) {
    const r = await http("PUT", u.uploadUrl, { headers: { "Content-Type": "application/octet-stream" }, body: bytes.subarray(u.firstByte, u.lastByte + 1) });
    parts.push(r.headers.get("etag"));
  }
  await http("POST", `${API}/videos?action=finalizeUpload`, { headers, json: { finalizeUploadRequest: { video, uploadToken, uploadedPartIds: parts } } });
  return video;
}

let content;
if (type === "video") content = { media: { id: await uploadVideo(filePath(post, media[0])), title } };
else if (type === "document") content = { media: { id: await uploadSimple("documents", filePath(post, media[0])), title } };
else if (type === "images" && media.length === 1) content = { media: { id: await uploadSimple("images", filePath(post, media[0])) } };
else if (type === "images") {
  const images = [];
  for (const f of media) images.push({ id: await uploadSimple("images", filePath(post, f)) });
  content = { multiImage: { images } };
}

const body = { author: ORG, commentary: littleText(caption), visibility: "PUBLIC",
  distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
  lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false, ...(content ? { content } : {}) };
const res = await http("POST", `${API}/posts`, { headers, json: body });
const urn = res.headers.get("x-restli-id");
const url = urn ? `https://www.linkedin.com/feed/update/${urn}/` : null;
console.log(`✓ published: ${url || "(no id returned)"}`);

if (li.firstComment && urn) {
  try {
    await http("POST", `${API}/socialActions/${encodeURIComponent(urn)}/comments`, { headers, json: { actor: ORG, object: urn, message: { text: li.firstComment } } });
    console.log("✓ first comment added");
  } catch (e) { console.log("! first comment failed, add it by hand:", e.message); }
}
console.log(`RESULT ${JSON.stringify({ platform: "linkedin", slug: post.slug, id: urn, url })}`);
