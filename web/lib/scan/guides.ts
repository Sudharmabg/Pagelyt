import type { ModuleKey } from "./types";

/* Step-by-step guides, keyed by finding id. Written for owners first, with a
   developer note where the fix lives in server or code. */
export type Guide = {
  title: string;
  module: ModuleKey;
  summary: string;
  steps: string[];
  dev?: string;
  tool?: { label: string; href: string };
};

export const GUIDES: Record<string, Guide> = {
  hsts: {
    title: "How to add the HSTS header",
    module: "security",
    summary: "HSTS tells browsers to only ever use HTTPS for your site, which stops downgrade attacks.",
    steps: ["Confirm every page and subdomain already works over HTTPS.", "Add the Strict-Transport-Security header at your host or CDN.", "Start with a short max-age such as 300 seconds and check the site still loads.", "Raise it to 31536000 (one year) once you are confident."],
    dev: "Strict-Transport-Security: max-age=31536000; includeSubDomains",
    tool: { label: "Generate the config for your host", href: "/tools" },
  },
  csp: {
    title: "How to add a Content-Security-Policy",
    module: "security",
    summary: "A CSP limits which scripts and resources can load, reducing the damage from injected code.",
    steps: ["Start in report-only mode so nothing breaks.", "List the domains your site genuinely loads scripts, styles, images and fonts from.", "Build a policy that allows only those, then watch the reports.", "Switch from report-only to enforcing once reports are quiet."],
    dev: "Content-Security-Policy-Report-Only: default-src 'self'; img-src 'self' data: https:",
    tool: { label: "Generate headers", href: "/tools" },
  },
  clickjacking: {
    title: "How to stop other sites embedding yours",
    module: "security",
    summary: "Without protection, a hostile page can load yours invisibly in a frame and trick visitors into clicking.",
    steps: ["Add the X-Frame-Options header with the value SAMEORIGIN.", "Or, better, add frame-ancestors 'self' to your Content-Security-Policy.", "Reload your site to confirm nothing you intentionally embed has broken."],
    dev: "X-Frame-Options: SAMEORIGIN",
    tool: { label: "Generate headers", href: "/tools" },
  },
  nosniff: {
    title: "How to add X-Content-Type-Options",
    module: "security",
    summary: "This stops browsers guessing a file's type, which blocks a class of attacks.",
    steps: ["Add the header X-Content-Type-Options: nosniff at your host or CDN.", "Check that scripts and styles are served with the correct content types."],
    tool: { label: "Generate headers", href: "/tools" },
  },
  referrer: {
    title: "How to set a Referrer-Policy",
    module: "security",
    summary: "It controls how much of your page address is shared with other sites when visitors click out.",
    steps: ["Add the header Referrer-Policy: strict-origin-when-cross-origin.", "Reload and confirm analytics still attribute traffic correctly."],
    tool: { label: "Generate headers", href: "/tools" },
  },
  "no-llms": {
    title: "How to publish an llms.txt file",
    module: "geo",
    summary: "llms.txt is a short, plain guide that helps AI assistants understand what your site is and which pages matter.",
    steps: ["Write one paragraph describing your business in plain facts.", "List your 5 to 10 most important pages with one line each.", "Save it as llms.txt and upload it to the root of your site.", "Open yoursite.com/llms.txt to confirm it loads as plain text."],
    tool: { label: "Generate llms.txt", href: "/tools" },
  },
  "ai-blocked": {
    title: "How to let AI assistants read your site",
    module: "geo",
    summary: "If robots.txt blocks AI crawlers, assistants such as ChatGPT, Claude and Perplexity cannot cite you.",
    steps: ["Open your robots.txt file.", "Decide which AI crawlers you want to allow. Allowing them is what makes you citable.", "Remove the Disallow: / rules for those user agents.", "Reload /robots.txt to confirm the change is live."],
    tool: { label: "Build a robots.txt", href: "/tools" },
  },
  "no-structured-data": {
    title: "How to add structured data (JSON-LD)",
    module: "geo",
    summary: "Structured data labels your business, products and FAQs so search and AI systems can read them without guessing.",
    steps: ["Pick the type that fits the page: Organization for the home page, LocalBusiness if you serve a location, FAQPage for questions.", "Generate the snippet and paste it into the page head.", "Test it with Google's Rich Results Test.", "Keep the facts in the markup identical to what is visible on the page."],
    tool: { label: "Generate schema markup", href: "/tools" },
  },
  "no-faq": {
    title: "How to add an FAQ that AI and search can quote",
    module: "geo",
    summary: "Question-and-answer content is what assistants most often lift into their answers.",
    steps: ["List the 5 to 8 questions customers actually ask you.", "Use each question as a heading and answer it in two or three sentences.", "Add FAQPage structured data for the same questions.", "Update it whenever the answers change."],
    tool: { label: "Generate FAQ schema", href: "/tools" },
  },
  "no-sitemap": {
    title: "How to publish a sitemap",
    module: "health",
    summary: "A sitemap lists your pages so search engines find them all.",
    steps: ["Most website platforms and plugins generate /sitemap.xml automatically. Turn that feature on.", "Add a line to robots.txt: Sitemap: https://yoursite.com/sitemap.xml.", "Submit the sitemap in Google Search Console."],
  },
  "no-description": {
    title: "How to write a meta description",
    module: "seo",
    summary: "The description is the grey text under your title in search results, and it decides whether people click.",
    steps: ["Write one sentence that says what the page offers and why to choose you.", "Keep it between 70 and 160 characters.", "Make it unique for every important page.", "Preview it before publishing."],
    tool: { label: "Preview in search results", href: "/tools" },
  },
  "no-title": {
    title: "How to write a page title",
    module: "seo",
    summary: "The title is the blue headline in search results and the single strongest on-page SEO signal.",
    steps: ["Put the main topic first, then your brand.", "Keep it between 30 and 60 characters.", "Give every page its own title."],
    tool: { label: "Preview in search results", href: "/tools" },
  },
  "no-canonical": {
    title: "How to add a canonical URL",
    module: "seo",
    summary: "A canonical tag tells search engines which address is the main version of a page.",
    steps: ["Add a link tag in the page head pointing to the preferred address.", "Use the full https address, without tracking parameters.", "Keep it identical on every duplicate version of the page."],
    dev: '<link rel="canonical" href="https://example.com/page">',
  },
  "no-og": {
    title: "How to add Open Graph tags",
    module: "seo",
    summary: "Open Graph tags control how your pages look when shared on WhatsApp, LinkedIn, Facebook and Slack.",
    steps: ["Add og:title, og:description, og:image and og:url to the page head.", "Use an image about 1200 by 630 pixels.", "Test by pasting the link into a chat."],
  },
  "a11y-alt": {
    title: "How to write good image alt text",
    module: "accessibility",
    summary: "Alt text lets screen reader users, and search engines, understand your images.",
    steps: ["Describe what the image shows in a short phrase.", "Skip phrases like \"image of\".", "For purely decorative images use an empty alt (alt=\"\").", "Make sure every image has an alt attribute."],
  },
  "form-labels": {
    title: "How to label form fields",
    module: "accessibility",
    summary: "Unlabelled fields leave screen reader users guessing what to type.",
    steps: ["Give each input a visible label element.", "Connect them: the label's for attribute matches the input's id.", "Never use placeholder text as the only label."],
    dev: '<label for="email">Email</label><input id="email" type="email">',
  },
  "no-privacy-policy": {
    title: "How to add a privacy policy",
    module: "privacy",
    summary: "Privacy laws and ad platforms expect a clear policy that visitors can find.",
    steps: ["Write down what data you collect, why, who you share it with and how long you keep it.", "Publish it as a page at /privacy.", "Link to it from the footer of every page and from any form that collects data.", "Have a professional review it if you handle sensitive data."],
  },
  "no-cookie-consent": {
    title: "How to add cookie consent",
    module: "privacy",
    summary: "Visitors in many regions must agree before analytics or advertising cookies are set.",
    steps: ["Choose a consent tool such as CookieYes, Cookiebot or Complianz.", "Configure it to block analytics and ad scripts until the visitor accepts.", "Add a link to your cookie details in the privacy policy.", "Test with a fresh private window."],
  },
  "no-spf": {
    title: "How to set up SPF",
    module: "domain",
    summary: "SPF lists who may send email for your domain, so receivers can spot fakes.",
    steps: ["Find your mail provider's SPF include value in their help pages.", "Add one TXT record on your domain starting with v=spf1.", "End it with ~all, and keep only one SPF record per domain."],
    dev: "v=spf1 include:_spf.google.com ~all",
  },
  "no-dmarc": {
    title: "How to set up DMARC",
    module: "domain",
    summary: "DMARC tells receivers what to do with mail that fails checks and sends you reports.",
    steps: ["Make sure SPF and DKIM are working first.", "Add a TXT record named _dmarc with a monitoring policy.", "Read the reports for a few weeks.", "Tighten the policy from none to quarantine, then reject."],
    dev: "v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com",
  },
  "broken-links": {
    title: "How to fix broken links",
    module: "health",
    summary: "Broken links frustrate visitors and waste the time search engines spend on your site.",
    steps: ["Open each address listed in the finding evidence.", "If the page moved, update the link to the new address.", "If the page is gone, remove the link or redirect the old address to the closest relevant page.", "Rescan to confirm."],
  },
  "slow-response": {
    title: "How to speed up server response",
    module: "performance",
    summary: "A slow first response delays everything else on the page.",
    steps: ["Turn on page caching at your host or with a plugin.", "Put a CDN such as Cloudflare in front of the site.", "Upgrade hosting if response stays slow under light traffic.", "Remove heavy plugins or database queries you do not need."],
  },
  "no-compression": {
    title: "How to enable compression",
    module: "performance",
    summary: "Compression shrinks pages and scripts so they download faster, especially on mobile.",
    steps: ["Enable gzip or Brotli in your server, host dashboard or CDN settings.", "Reload the page and check the response header content-encoding."],
  },
  "no-lazy": {
    title: "How to lazy-load images",
    module: "performance",
    summary: "Lazy loading stops images below the fold from slowing the first view.",
    steps: ["Add loading=\"lazy\" to images that are not visible on first load.", "Do not lazy-load the main banner image.", "Set width and height on each image so layout does not jump."],
    dev: '<img src="photo.jpg" loading="lazy" width="800" height="600" alt="...">',
  },
};
