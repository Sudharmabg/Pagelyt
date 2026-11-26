import { GUIDES, GUIDE_ORDER } from "./guides";

/* The part of each fix guide that is specific to it: how long it takes, the mistakes people actually make, two
   questions owners ask, and the guides worth reading next. Kept apart from `guides.ts` (the steps) so each guide
   page has real content of its own rather than only the shared template. `related` is hand-picked, across areas. */
export type GuideExtra = { time: string; mistakes: string[]; faq: [string, string][]; related: string[] };

export const GUIDE_EXTRA: Record<string, GuideExtra> = {
  hsts: {
    time: "About 10 minutes to add, then 1 to 2 weeks to raise the value safely",
    mistakes: [
      "Setting a year-long max-age on day one. If a subdomain still lacks HTTPS, visitors who already saw the header cannot reach it.",
      "Adding includeSubDomains before checking every subdomain, including forgotten ones such as mail or staging.",
      "Submitting to the browser preload list without realising it is slow and hard to undo.",
    ],
    faq: [
      ["Does HSTS slow my site down?", "No. It is one small header, and it saves time on repeat visits because the browser skips the redirect from HTTP to HTTPS."],
      ["Can I undo HSTS?", "Yes, by serving a max-age of 0 over HTTPS. Browsers that stored the old value keep it until it expires, which is why you start with a short max-age."],
    ],
    related: ["csp", "clickjacking", "code-form-http"],
  },
  csp: {
    time: "1 to 3 hours, plus about a week in report-only mode",
    mistakes: [
      "Skipping report-only mode and breaking analytics, fonts or embedded videos on a live site.",
      "Allowing 'unsafe-inline' and 'unsafe-eval' everywhere, which removes most of the protection.",
      "Allowing a broad source such as https: for scripts, which lets any site's script run.",
    ],
    faq: [
      ["Will a Content-Security-Policy hurt my SEO?", "No. It controls what the browser loads, not what search engines read, as long as the policy does not block your own content."],
      ["Why did my page break after adding it?", "A script, style or font loads from an address the policy does not list. The browser console names each blocked address; allow only the ones you recognise."],
    ],
    related: ["code-risky", "code-no-sri", "hsts"],
  },
  clickjacking: {
    time: "About 5 minutes",
    mistakes: [
      "Using DENY on a page you embed yourself, such as a preview or widget, so your own page stops working.",
      "Adding the header to the homepage only. It belongs on every page, ideally set once for the whole site.",
      "Relying on JavaScript frame-busting, which attackers can get around.",
    ],
    faq: [
      ["SAMEORIGIN or DENY?", "SAMEORIGIN lets your own pages frame each other and blocks everyone else, which suits most sites. DENY blocks all framing."],
      ["Do I still need X-Frame-Options if I have a CSP?", "frame-ancestors in a Content-Security-Policy is the modern replacement. Sending both also covers older browsers."],
    ],
    related: ["csp", "hsts", "code-risky"],
  },
  nosniff: {
    time: "About 5 minutes",
    mistakes: [
      "Adding the header while a stylesheet or script is served with the wrong content type. It then stops working.",
      "Setting it on HTML pages only instead of every response.",
    ],
    faq: [
      ["Can nosniff break my site?", "Only if a file is served with the wrong content type. The browser then refuses to treat it as a script or stylesheet, and fixing the type fixes the page."],
      ["Is it worth doing on a static site?", "Yes. It is one line, and it protects against mistakes with any file that visitors or editors can upload later."],
    ],
    related: ["hsts", "csp", "referrer"],
  },
  referrer: {
    time: "About 5 minutes",
    mistakes: [
      "Choosing no-referrer, which also hides visits between your own subdomains from your analytics.",
      "Leaving the browser default, so full page addresses, sometimes with tokens in them, reach third parties.",
    ],
    faq: [
      ["Which value should I use?", "strict-origin-when-cross-origin is a sensible default: the full address inside your site, only your domain when visitors leave, and nothing when going from HTTPS to HTTP."],
      ["Will it affect my analytics?", "Not for visits to your own site. Other sites will see only your domain as the source, which is what most reports use anyway."],
    ],
    related: ["hsts", "nosniff", "no-cookie-consent"],
  },
  "no-llms": {
    time: "About 30 minutes",
    mistakes: [
      "Listing every page. llms.txt works best pointing at the 10 to 30 pages that explain the site.",
      "Writing marketing copy instead of plain descriptions of what each page covers.",
      "Expecting it to replace robots.txt or a sitemap. It does neither.",
    ],
    faq: [
      ["Do AI assistants actually read llms.txt?", "Support is still emerging and differs by tool, so treat it as a cheap helper rather than a guarantee."],
      ["Where does the file go?", "At the root of the site, so it opens at yourdomain.com/llms.txt as plain text."],
    ],
    related: ["ai-blocked", "no-structured-data", "no-sitemap"],
  },
  "ai-blocked": {
    time: "About 15 minutes",
    mistakes: [
      "Leaving User-agent: * with Disallow: / from a staging site, which blocks every crawler.",
      "Allowing search crawlers but forgetting AI-specific ones such as GPTBot, ClaudeBot or PerplexityBot.",
      "Editing robots.txt on a different host (www versus non-www) from the one visitors use.",
    ],
    faq: [
      ["Should I allow every AI crawler?", "That is your choice. Allowing them lets assistants cite you. Many owners block training crawlers but allow the ones that fetch pages to answer questions."],
      ["How do I test the change?", "Open yourdomain.com/robots.txt and read it, then rescan with Pagelyt or use the robots.txt tester."],
    ],
    related: ["no-llms", "no-sitemap", "no-faq"],
  },
  "no-structured-data": {
    time: "30 to 60 minutes",
    mistakes: [
      "Marking up content that is not visible on the page, which can get the markup ignored.",
      "Copying a template without changing the business name, address or URLs.",
      "Leaving invalid code with a trailing comma or a missing quote.",
    ],
    faq: [
      ["Which type should I start with?", "Organization (or LocalBusiness) on the homepage, then Article on posts and Product on product pages."],
      ["How do I check it?", "Paste the page address into Google's Rich Results Test or the Schema Markup Validator and fix any errors it lists."],
    ],
    related: ["no-faq", "no-og", "no-description"],
  },
  "no-faq": {
    time: "About 1 hour",
    mistakes: [
      "Writing questions nobody asks. Take real ones from emails, chats and search suggestions.",
      "Answers that run to three paragraphs. Assistants quote short, direct answers.",
      "Adding FAQ markup for questions that are not shown on the page.",
    ],
    faq: [
      ["How many questions do I need?", "Five to eight good ones is plenty. Clear answers matter more than the count."],
      ["Do I need FAQ markup?", "It helps machines read the page, but the visible question-and-answer text is what actually gets quoted."],
    ],
    related: ["no-structured-data", "no-llms", "no-title"],
  },
  "no-sitemap": {
    time: "About 15 minutes",
    mistakes: [
      "Listing pages that redirect, are marked noindex or return errors.",
      "Forgetting to tell Google. Submit it in Search Console and add a Sitemap line to robots.txt.",
      "Stamping every page with today's date as lastmod, which teaches search engines to ignore it.",
    ],
    faq: [
      ["Does a sitemap guarantee my pages get indexed?", "No. It helps search engines find pages, but they still decide which are worth indexing."],
      ["How often should it update?", "Automatically whenever you publish or change a page, with the real last-changed date for each."],
    ],
    related: ["broken-links", "no-canonical", "ai-blocked"],
  },
  "no-description": {
    time: "About 10 minutes per page",
    mistakes: [
      "Using the same description on every page.",
      "Running past about 155 characters so it is cut off in results.",
      "Stuffing keywords instead of saying what the visitor will get.",
    ],
    faq: [
      ["Does the description affect ranking?", "Not directly, but a clear one lifts the click rate, and people clicking your result is a good sign."],
      ["Will Google always show mine?", "Not always. It sometimes rewrites the text to match the search, but a good description is still shown often."],
    ],
    related: ["no-title", "no-og", "no-canonical"],
  },
  "no-title": {
    time: "About 10 minutes per page",
    mistakes: [
      "Starting every title with the brand name, so the topic is pushed out of view.",
      "Titles over about 60 characters, which get cut off.",
      "The same title on several pages.",
    ],
    faq: [
      ["How long should a title be?", "Around 50 to 60 characters so it is not cut off, with the main topic first."],
      ["Should it include my brand?", "Usually at the end, after the topic, separated by a dash or a pipe."],
    ],
    related: ["no-description", "no-canonical", "no-og"],
  },
  "no-canonical": {
    time: "About 15 minutes",
    mistakes: [
      "Pointing the canonical at a different page by copy and paste.",
      "Using a relative address or the http version.",
      "Pointing every page of a paginated list at page one.",
    ],
    faq: [
      ["When do I need a canonical?", "Whenever the same content opens at more than one address: with and without www, with a trailing slash, or with tracking parameters."],
      ["Does it replace a redirect?", "No. A redirect sends visitors away. A canonical only tells search engines which version to prefer."],
    ],
    related: ["no-sitemap", "no-title", "broken-links"],
  },
  "no-og": {
    time: "About 20 minutes",
    mistakes: [
      "Using a small image. Aim for about 1200 by 630 pixels.",
      "A relative image address. It must be a full https:// address.",
      "Not refreshing the preview after a change. Each platform has a sharing debugger that clears its cache.",
    ],
    faq: [
      ["Do Open Graph tags help SEO?", "Not directly, but better-looking shares earn more clicks and links, which do help."],
      ["Do I need Twitter card tags too?", "Most platforms read Open Graph. Add twitter:card if you want a large image on X."],
    ],
    related: ["no-title", "no-description", "no-structured-data"],
  },
  "a11y-alt": {
    time: "About 5 minutes per image",
    mistakes: [
      "Starting with \"image of\" or \"picture of\". Screen readers already say it is an image.",
      "Stuffing keywords into the text.",
      "Writing long alt text for decorative images. Use an empty alt (alt=\"\") for those.",
    ],
    faq: [
      ["How long should alt text be?", "Usually one short sentence, under about 125 characters, describing what matters about the image."],
      ["What about charts and diagrams?", "Give a short alt, and put the full data or takeaway in the text around the image."],
    ],
    related: ["form-labels", "no-lazy", "no-og"],
  },
  "form-labels": {
    time: "About 10 minutes per form",
    mistakes: [
      "Using placeholder text as the only label. It disappears as soon as someone starts typing.",
      "Labels that are not linked to the field with matching for and id values.",
      "Hiding labels with display: none, which hides them from screen readers too.",
    ],
    faq: [
      ["Is a placeholder enough?", "No. It vanishes when the visitor types and is not reliably read out. Use a real label."],
      ["Can I hide a label visually?", "Yes, with a visually-hidden style, but keep it in the page so assistive technology can read it."],
    ],
    related: ["a11y-alt", "code-form-http", "no-cookie-consent"],
  },
  "no-privacy-policy": {
    time: "1 to 2 hours, less with a generator",
    mistakes: [
      "Copying another company's policy without checking it matches what you collect.",
      "Hiding the link. Put it in the footer of every page.",
      "Never updating it after adding analytics, ads or a new form.",
    ],
    faq: [
      ["What must a privacy policy include?", "What you collect, why, who you share it with, how long you keep it, and how people can ask to see or delete their data."],
      ["Do I need one if I only have a contact form?", "Yes. Anything that collects personal data, including a contact form or analytics, needs one."],
    ],
    related: ["no-cookie-consent", "form-labels", "code-form-http"],
  },
  "no-cookie-consent": {
    time: "About 1 hour",
    mistakes: [
      "Setting analytics or advertising cookies before the visitor agrees.",
      "Making Reject harder to find than Accept.",
      "A banner that does nothing. Consent has to actually switch the tags off.",
    ],
    faq: [
      ["Do all cookies need consent?", "Strictly necessary ones, such as keeping someone signed in, do not. Analytics and advertising cookies usually do."],
      ["Does this apply outside Europe?", "Many regions have similar rules, so a clear consent choice is the safest approach for an international audience."],
    ],
    related: ["no-privacy-policy", "referrer", "form-labels"],
  },
  "no-spf": {
    time: "About 15 minutes, plus up to a day for DNS to update",
    mistakes: [
      "Publishing two SPF records. A domain can have only one.",
      "Going over 10 DNS lookups by including too many services.",
      "Ending the record with +all, which lets anyone send as you.",
    ],
    faq: [
      ["How do I know which services to include?", "List everything that sends mail as your domain: your mailbox provider, newsletter, billing and CRM tools."],
      ["~all or -all?", "Start with ~all while you test, then move to -all once you are sure the list is complete."],
    ],
    related: ["no-dmarc", "hsts", "no-sitemap"],
  },
  "no-dmarc": {
    time: "About 20 minutes, then a few weeks to tighten",
    mistakes: [
      "Jumping straight to p=reject before SPF and DKIM pass for all your senders.",
      "Not setting a reporting address (rua), so you never see what is failing.",
      "Publishing it at the wrong name. It belongs at _dmarc.yourdomain.com.",
    ],
    faq: [
      ["Which policy should I start with?", "p=none to watch the reports, then quarantine, then reject once all your legitimate mail passes."],
      ["Do I need DMARC if I rarely send email?", "Yes. It also stops other people spoofing your domain."],
    ],
    related: ["no-spf", "hsts", "clickjacking"],
  },
  "broken-links": {
    time: "30 minutes to a few hours",
    mistakes: [
      "Fixing only the links in one report. Scan again after fixing, because new ones appear.",
      "Redirecting every missing page to the homepage instead of the closest match.",
      "Ignoring broken links that point to other websites.",
    ],
    faq: [
      ["Do broken links hurt SEO?", "A few do little harm, but many waste crawl time and frustrate visitors, which hurts both."],
      ["Should I redirect or fix the link?", "If a page moved, fix the link and add a permanent (301) redirect from the old address."],
    ],
    related: ["no-sitemap", "no-canonical", "slow-response"],
  },
  "slow-response": {
    time: "1 hour to a day",
    mistakes: [
      "Optimising images first when the server itself takes over a second to answer.",
      "Skipping caching for pages that rarely change.",
      "Running heavy plugins or database queries on every request.",
    ],
    faq: [
      ["What is a good server response time?", "Under about 600 milliseconds for the first byte is a good target."],
      ["Will a CDN fix it?", "Often, for cached pages, because visitors are served from a nearby location instead of your origin server."],
    ],
    related: ["no-compression", "no-lazy", "broken-links"],
  },
  "no-compression": {
    time: "About 10 minutes",
    mistakes: [
      "Compressing images that are already compressed (JPEG, PNG), which gains almost nothing.",
      "Turning compression on at the origin and again at the CDN.",
      "Forgetting to check that CSS and JavaScript files are compressed too.",
    ],
    faq: [
      ["Gzip or Brotli?", "Brotli compresses smaller and modern browsers support it. Most hosts can serve both."],
      ["How do I check it is working?", "Look for content-encoding: br or gzip in the response headers."],
    ],
    related: ["slow-response", "no-lazy", "a11y-alt"],
  },
  "no-lazy": {
    time: "About 15 minutes",
    mistakes: [
      "Lazy-loading the main image at the top, which delays the largest paint.",
      "Not setting width and height, so the page jumps as images load in.",
      "Lazy-loading everything, including content in the first screen.",
    ],
    faq: [
      ["Is loading=\"lazy\" enough?", "For most sites, yes. It is built into modern browsers."],
      ["Which images should not be lazy-loaded?", "The first image visitors see, usually the hero, should load straight away."],
    ],
    related: ["a11y-alt", "no-compression", "slow-response"],
  },
  "code-vuln-lib": {
    time: "1 to 4 hours, depending on testing",
    mistakes: [
      "Jumping several major versions at once without testing.",
      "Updating the file but not the CDN link or the lockfile, so the old version still loads.",
      "Skipping the changelog, which lists breaking changes.",
    ],
    faq: [
      ["How do I know the new version is safe?", "Read the release notes, update a copy of the site, test the key pages and forms, then publish."],
      ["What if no fixed version exists?", "Replace the library or apply the vendor's workaround, and add a Content-Security-Policy to limit the damage."],
    ],
    related: ["code-eol-lib", "code-no-sri", "csp"],
  },
  "code-eol-lib": {
    time: "A day to a few weeks",
    mistakes: [
      "Waiting until a vulnerability is announced.",
      "Replacing the library without a list of the features you rely on.",
      "Forgetting plugins or themes that bundle their own copy.",
    ],
    faq: [
      ["What does end of life mean?", "The maintainers no longer publish fixes, so any new flaw stays open."],
      ["Can I keep using it for now?", "Short term, with other protections in place, but plan the move because the risk only grows."],
    ],
    related: ["code-vuln-lib", "csp", "code-risky"],
  },
  "code-secret": {
    time: "30 minutes, plus replacing the key",
    mistakes: [
      "Deleting the key from the file but not revoking it. Anyone who already saw it can still use it.",
      "Moving it into another front-end file, where it is still public.",
      "Committing it again through an environment file.",
    ],
    faq: [
      ["What should I do first?", "Revoke or rotate the key with its provider, then remove it from your code."],
      ["Where should secrets live?", "On the server, in environment variables, never in code that is sent to browsers."],
    ],
    related: ["code-source-map", "code-form-http", "csp"],
  },
  "code-source-map": {
    time: "About 15 minutes",
    mistakes: [
      "Deleting the .map files but leaving the sourceMappingURL comment in the script.",
      "Turning source maps off entirely, which makes real errors hard to debug.",
      "Publishing them to production when they are only needed during development.",
    ],
    faq: [
      ["Are source maps dangerous?", "They reveal your original code, comments and file names, which makes it easier to find weaknesses."],
      ["Can I keep them for debugging?", "Yes. Upload them to your error-tracking tool instead of serving them publicly."],
    ],
    related: ["code-secret", "code-vuln-lib", "csp"],
  },
  "code-no-sri": {
    time: "About 20 minutes",
    mistakes: [
      "Adding an integrity hash to an address whose content changes, such as an always-latest link.",
      "Forgetting crossorigin=\"anonymous\", which makes the check fail.",
      "Generating the hash from a different copy of the file than the one the CDN serves.",
    ],
    faq: [
      ["What does Subresource Integrity do?", "The browser checks the downloaded file against your hash and refuses to run it if it was changed."],
      ["What if the CDN updates the file?", "Pin a specific version in the address so the hash always matches."],
    ],
    related: ["code-vuln-lib", "csp", "code-risky"],
  },
  "code-dom-xss": {
    time: "1 to 3 hours",
    mistakes: [
      "Escaping a few characters by hand instead of writing the value as text.",
      "Trusting values from the address bar, document.referrer or localStorage.",
      "Sanitising on the server only, when the problem happens in the browser.",
    ],
    faq: [
      ["What is the safest fix?", "Write values with textContent or your framework's normal binding, which treats them as text and not as HTML."],
      ["Can a Content-Security-Policy help?", "Yes. A strict policy limits what injected code can do, but fix the code as well."],
    ],
    related: ["code-risky", "csp", "code-vuln-lib"],
  },
  "code-risky": {
    time: "1 to 4 hours",
    mistakes: [
      "Moving inline scripts into one large inline block, which changes nothing.",
      "Replacing eval with new Function, which is just as risky.",
      "Leaving onclick attributes in place, which stop a strict Content-Security-Policy from working.",
    ],
    faq: [
      ["Why are inline handlers a problem?", "They force you to allow inline scripts in your Content-Security-Policy, which weakens it."],
      ["What replaces document.write?", "Create elements and add them with DOM methods such as createElement and append."],
    ],
    related: ["csp", "code-dom-xss", "code-no-sri"],
  },
  "code-form-http": {
    time: "About 15 minutes",
    mistakes: [
      "Fixing the form but leaving the page itself loading over HTTP.",
      "Changing the visible text of a link instead of the form's action.",
      "Missing forms in templates, popups or embedded widgets.",
    ],
    faq: [
      ["Why does it matter if the page itself is HTTPS?", "What visitors type goes to the form's own address, so an HTTP address sends it unencrypted."],
      ["How do I fix it?", "Change the action to an https:// address or a relative path, and add a redirect from HTTP to HTTPS."],
    ],
    related: ["hsts", "form-labels", "code-secret"],
  },
};

/** A few guides for an area, starting at a spot chosen by `seed` so different pages link to different guides. */
export function guidesForArea(area: string, seed: string, n = 3): string[] {
  const ids = GUIDE_ORDER.filter((id) => GUIDES[id].module === area);
  if (!ids.length) return [];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: Math.min(n, ids.length) }, (_, i) => ids[(h + i) % ids.length]);
}

/** The guides that point at a free tool (each guide offers the tool that helps with it). */
export const guidesForTool = (slug: string): string[] => Object.keys(GUIDES).filter((id) => GUIDES[id].tool?.href === `/tools/${slug}`);
