import { PRICING_ON } from "./site-config";
import { AREA_COUNT, AREA_LIST, capWords } from "./counts";

export type Feature = {
  slug: string;
  name: string;
  short: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  intro: string[];
  checks: string[];
  gains: [string, string][];
  faq: [string, string][];
  related: string[];
  /** The scored area (MODULE_NAMES key) this page is about, for the per-area feature pages. */
  area?: string;
  /** Product cards shown under the hero (the Google hub). */
  products?: { key: "gsc" | "ga4" | "ads"; name: string; tag: string; text: string; points: string[]; guide: string; open: string }[];
};

export const FEATURES: Feature[] = [
  {
    slug: "website-health",
    area: "health",
    name: "Website Health",
    short: "Uptime, SSL, DNS and response time in one view.",
    title: "Website Health Check: Uptime, SSL and DNS",
    description:
      "Check website availability, response time, SSL certificate expiry, DNS configuration and broken pages with a free website health check from Pagelyt.",
    h1: "Know your website is up, secure and reachable.",
    lead: "A website health check covering availability, response time, SSL certificates, DNS and redirects.",
    intro: [
      "A healthy website is available, responds quickly and serves a valid SSL certificate. Pagelyt's website health check tests the basics that visitors and search engines depend on, so you can find problems before they cost you traffic or trust.",
      "Enter your URL and Pagelyt tests availability and HTTP status, measures server response time, validates your SSL certificate and its expiry date, reviews DNS configuration and follows redirects to catch broken pages and redirect chains. Every finding comes with a plain-English explanation and a next step.",
    ],
    checks: [
      "Availability and HTTP status",
      "Server response time",
      "SSL certificate validity and expiry",
      "DNS configuration",
      "Domain information",
      "Broken pages and redirect chains",
    ],
    gains: [
      ["Catch outages early", "Spot downtime and slow responses before visitors or search engines do."],
      ["Never miss a renewal", "See SSL certificate expiry well in advance."],
      ["Fix redirect problems", "Find redirect chains and broken pages that waste crawl budget."],
    ],
    faq: [
      [
        "What does a website health check test?",
        "It checks that your site is reachable, returns the right HTTP status, responds quickly, has a valid SSL certificate, resolves DNS correctly and avoids broken redirects.",
      ],
      [
        "How often should I check website health?",
        "Run a check after any hosting, DNS or certificate change. Every saved website is rescanned weekly by default, with uptime checks, so checks run automatically.",
      ],
    ],
    related: ["performance", "monitoring-reports"],
  },
  {
    slug: "performance",
    area: "performance",
    name: "Performance & Core Web Vitals",
    short: "Speed, Lighthouse and Core Web Vitals for mobile and desktop.",
    title: "Website Speed Test and Core Web Vitals Analysis",
    description:
      "Test website speed on mobile and desktop. Get Lighthouse scores, Core Web Vitals (LCP, INP, CLS) and prioritised fixes for images, scripts and fonts.",
    h1: "See how fast your website really is.",
    lead: "Lighthouse audits and Core Web Vitals, with clear fixes for the biggest slowdowns.",
    intro: [
      "Page speed shapes user experience, conversions and search visibility. Pagelyt measures performance on mobile and desktop using Lighthouse and reports Core Web Vitals: Largest Contentful Paint (LCP), Interaction to Next Paint (INP) and Cumulative Layout Shift (CLS).",
      "Instead of a wall of metrics, Pagelyt ranks what is slowing you down: oversized images, render-blocking scripts, unused code and slow fonts. Each recommendation shows the likely gain, so you fix the biggest problem first.",
    ],
    checks: [
      "Desktop and mobile performance",
      "Lighthouse performance audits",
      "Largest Contentful Paint (LCP)",
      "Interaction to Next Paint (INP)",
      "Cumulative Layout Shift (CLS)",
      "Image and resource optimisation opportunities",
    ],
    gains: [
      ["Fix the biggest slowdown first", "Recommendations are ranked by estimated time saved."],
      ["Compare mobile and desktop", "See where mobile visitors get a worse experience."],
      ["Track improvement", "Rescan after changes and watch your scores climb."],
    ],
    faq: [
      [
        "What are Core Web Vitals?",
        "Core Web Vitals are Google's user-experience metrics for loading (LCP), responsiveness (INP) and visual stability (CLS).",
      ],
      [
        "Why is my mobile score lower than desktop?",
        "Mobile devices have slower processors and networks, so large images and heavy scripts hurt more. Pagelyt shows both so you can target mobile fixes.",
      ],
    ],
    related: ["seo", "ai-recommendations"],
  },
  {
    slug: "seo",
    area: "seo",
    name: "Technical SEO",
    short: "Titles, descriptions, canonicals, sitemaps and indexing.",
    title: "Free Technical SEO Audit: Titles, Canonicals and Sitemaps",
    description:
      "Free technical SEO audit: page titles, meta descriptions, headings, canonicals, sitemaps, robots.txt and broken links, with a fix for each issue.",
    h1: "Fix the technical SEO that holds your pages back.",
    lead: "A technical SEO audit of the basics search engines read first, with a plain-English fix for every problem.",
    intro: [
      "Before a search engine can rank a page, it has to crawl it, understand it and decide which address to show. Technical SEO is the set of signals that make those steps easy: a clear title, a useful description, one canonical address, a sitemap and links that work.",
      "Pagelyt reads your homepage and crawls up to 50 more pages. It checks page titles and meta descriptions for length and duplicates, heading structure, canonical URLs, robots.txt and the XML sitemap, broken internal and external links, image alt text, Open Graph tags for sharing, and pages that tell search engines not to index them.",
    ],
    checks: [
      "Page titles: missing, too long or duplicated",
      "Meta descriptions: missing, too long or duplicated",
      "Heading structure and a single clear H1",
      "Canonical URLs",
      "XML sitemap and robots.txt",
      "Broken internal and external links",
      "Image alt attributes",
      "Noindex tags and indexability",
      "Open Graph tags for social sharing",
      "Content that hasn't been updated in years",
    ],
    gains: [
      ["Get pages indexed", "Find the settings that stop search engines crawling or indexing a page."],
      ["Earn more clicks", "Titles and descriptions written for people, at the right length."],
      ["Fix site-wide problems once", "Issues that repeat across the crawl are grouped, so one template fix solves them all."],
    ],
    faq: [
      [
        "What is a technical SEO audit?",
        "A check of the settings that help search engines crawl, understand and index your pages: titles, descriptions, canonicals, sitemaps, robots.txt, links and headings. It doesn't judge your content or backlinks.",
      ],
      [
        "Does Pagelyt guarantee higher rankings?",
        "No. Pagelyt finds technical issues and opportunities, but rankings depend on many factors outside any tool's control.",
      ],
      [
        "How many pages does it check?",
        "Your homepage in depth, plus up to 50 more pages from your links and sitemap, so problems that repeat across the site show up.",
      ],
    ],
    related: ["geo", "performance"],
  },
  {
    slug: "geo",
    area: "geo",
    name: "AI Search (GEO)",
    short: "Be readable and quotable by ChatGPT, Gemini and AI Overviews.",
    title: "GEO Checker: Is Your Site Ready for AI Search?",
    description:
      "Check if ChatGPT, Perplexity and Google AI Overviews can read and cite your site: AI crawler access, llms.txt, structured data and FAQs.",
    h1: "Be the answer AI assistants give.",
    lead: "A GEO check: can AI assistants and AI search reach your pages, understand them and quote them?",
    intro: [
      "More people now ask ChatGPT, Perplexity, Gemini or Google's AI Overviews instead of clicking through ten blue links. GEO, or generative engine optimisation, is the work of making your site easy for those systems to read, understand and cite.",
      "Pagelyt checks whether AI crawlers such as GPTBot, ClaudeBot and PerplexityBot are allowed in your robots.txt, whether you publish an llms.txt file, which structured data (JSON-LD) your pages carry, whether you have question-and-answer content AI can quote, and how clearly your page names who you are and what you do.",
    ],
    checks: [
      "AI crawler access (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)",
      "llms.txt file",
      "Structured data (JSON-LD) and its types",
      "FAQ and question-and-answer content",
      "Organisation and entity details",
      "Content that only appears after JavaScript runs",
      "Content freshness",
    ],
    gains: [
      ["Stop blocking AI by accident", "See which AI crawlers your robots.txt lets in, and which it turns away."],
      ["Be easier to quote", "Structured data and clear answers give AI tools something to cite."],
      ["Know where you stand", "AI visibility checks show whether ChatGPT mentions you today."],
    ],
    faq: [
      [
        "What is GEO?",
        "GEO stands for generative engine optimisation: structuring and publishing content so AI-powered search and assistants can find, understand and cite it.",
      ],
      [
        "Is GEO different from SEO?",
        "It builds on SEO. AI search tools still find pages through search indexes, so technical SEO comes first. GEO adds the signals that help AI systems read and quote a page.",
      ],
      [
        "Can Pagelyt make ChatGPT recommend my site?",
        "No tool can promise that. Pagelyt removes the technical barriers and, on paid plans, checks whether ChatGPT mentions and cites your site so you can track progress.",
      ],
    ],
    related: ["seo", "ai-recommendations"],
  },
  {
    slug: "security",
    area: "security",
    name: "Security Headers & TLS",
    short: "HTTPS, certificates, security headers and exposed files.",
    title: "Website Security Scanner: Headers, SSL and Exposed Files",
    description:
      "Scan your site's public security setup: HTTPS, certificate expiry, HSTS, CSP and other security headers, mixed content and exposed .env or .git files.",
    h1: "Close the security gaps anyone can see.",
    lead: "A check of your site's publicly visible security setup, with the exact header or setting to change.",
    intro: [
      "Most attacks on small websites aren't clever. They look for easy, visible gaps: a missing security header, an expired certificate, a backup file left on the server. Pagelyt checks the same things from the outside, so you can close them first.",
      "It tests HTTPS and redirects, your TLS certificate and its expiry, the main security headers (HSTS, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy), mixed content, files that should never be public such as .env, .git and backups, and whether you publish a security.txt contact.",
    ],
    checks: [
      "HTTPS and HTTP-to-HTTPS redirects",
      "TLS certificate validity and expiry",
      "HSTS and Content-Security-Policy",
      "X-Frame-Options and X-Content-Type-Options",
      "Referrer-Policy and Permissions-Policy",
      "Mixed content on HTTPS pages",
      "Exposed files: .env, .git, backups and phpinfo",
      "security.txt contact file",
    ],
    gains: [
      ["Close easy security gaps", "Many fixes are a single server setting."],
      ["Keep browsers on your side", "Avoid the warnings that send visitors away."],
      ["Copy-paste fixes", "The security headers generator writes the config for your server."],
    ],
    faq: [
      [
        "Does Pagelyt test my site for vulnerabilities?",
        "No. It reviews publicly observable configuration such as headers, certificates and exposed files. It is not a penetration test.",
      ],
      [
        "Which security headers matter most?",
        "Start with HSTS (always use HTTPS), X-Content-Type-Options and a frame rule (X-Frame-Options or CSP frame-ancestors). A Content-Security-Policy gives the most protection but needs testing.",
      ],
    ],
    related: ["code-security", "domain-email"],
  },
  {
    slug: "accessibility",
    area: "accessibility",
    name: "Accessibility",
    short: "Contrast, alt text, labels and keyboard access, tagged with WCAG.",
    title: "Website Accessibility Checker: Contrast, Alt Text and Labels",
    description:
      "Free accessibility check: colour contrast, alt text, form labels, link names, headings and ARIA, each issue tagged with its WCAG 2.2 rule.",
    h1: "Make your site work for every visitor.",
    lead: "Automated accessibility checks on your homepage, each issue tagged with the WCAG 2.2 rule it breaks and the fix.",
    intro: [
      "Many people browse with a screen reader, a keyboard or zoomed-in text. When a site isn't built for them, they leave, and in many countries accessibility is also a legal requirement.",
      "Pagelyt checks your homepage twice: once in its HTML and once with Google Lighthouse's accessibility audits on the page as a real browser renders it. It flags low colour contrast, images without alt text, unlabelled form fields, links and buttons with no name, skipped heading levels, missing page language and invalid ARIA, and tags each issue with its WCAG 2.2 criterion.",
    ],
    checks: [
      "Colour contrast",
      "Image alt text",
      "Form field labels",
      "Link and button names",
      "Heading order",
      "Page language",
      "ARIA attributes and roles",
      "Every issue tagged with its WCAG 2.2 rule and level",
    ],
    gains: [
      ["Reach more visitors", "Fix barriers for people using screen readers and keyboards."],
      ["Know the rule behind each issue", "Every finding links to its WCAG criterion."],
      ["Know what to do", "Each issue explains the impact and the recommended change."],
    ],
    faq: [
      [
        "Can automated checks guarantee accessibility compliance?",
        "No. Automated checks find many common issues, but full WCAG conformance also needs manual review. The WCAG 2.2 checklist in every report lists the rules a person still has to check.",
      ],
      [
        "Which pages are checked?",
        "Your homepage, in its HTML and as a real browser renders it. Fixes there usually apply to shared templates across the site.",
      ],
    ],
    related: ["wcag-checklist", "seo"],
  },
  {
    slug: "wcag-checklist",
    name: "WCAG 2.2 Checklist",
    short: "Every Level A and AA rule: what fails, and what needs a person.",
    title: "WCAG 2.2 Checker: Level A and AA Accessibility Checklist",
    description:
      "See every WCAG 2.2 Level A and AA rule and where your site stands: failing, passed automated checks, or needs a person to review. Free with every scan.",
    h1: "See what blocks WCAG 2.2 AA, rule by rule.",
    lead: "A free checklist of every Level A and AA success criterion, built from your scan: what fails, how to fix it, and what still needs a person.",
    intro: [
      "WCAG 2.2 is the current version of the Web Content Accessibility Guidelines, the standard most accessibility laws and contracts point to. Level A and AA together have 55 success criteria. Pagelyt checks your homepage with automated tests, including Google Lighthouse's accessibility audits on the rendered page, and maps every issue it finds to the criterion it breaks.",
      "The result is a checklist in three parts. Failing: rules your site breaks today, each with the issues behind it and the fix. Check by hand: rules no automated tool can decide, such as captions, keyboard traps and clear error messages. No issues found: rules our checks tested and found nothing wrong with.",
      "Automated checks can prove a failure, but they can't prove conformance. So Pagelyt never tells you your site is compliant. It tells you what to fix first and exactly what is left for a person to review.",
    ],
    checks: [
      "All 55 WCAG 2.2 Level A and AA success criteria, each with a status",
      "Every accessibility finding tagged with its criterion and level",
      "Colour contrast, text alternatives and link and button names",
      "Form labels, page language and page titles",
      "Keyboard focus, focus order and visible focus",
      "Zoom and text resizing, target size and ARIA use",
      "A clear list of the rules a person must check",
      "Links to the W3C explanation of every rule",
      "Download the checklist as CSV; a WCAG section in the PDF report",
    ],
    gains: [
      ["Know where you stand", "See at a glance how many Level A and AA rules fail, and which."],
      ["Fix in the right order", "Failing rules come with the issues behind them and a plain-English fix."],
      ["No false comfort", "What needs a person is listed, not hidden behind a score."],
    ],
    faq: [
      [
        "Does a clean Pagelyt scan mean my site is WCAG 2.2 compliant?",
        "No. Automated checks find failures, but many WCAG rules can only be judged by a person, such as whether captions are accurate or whether you can use every control with a keyboard. Pagelyt lists those rules for you to check by hand.",
      ],
      [
        "What is the difference between Level A and Level AA?",
        "Level A covers the most basic barriers, such as images with no text alternative. Level AA adds rules like minimum colour contrast and visible focus. Most laws and policies ask for Level AA, which includes every Level A rule.",
      ],
      [
        "Is the WCAG checklist free?",
        "Yes. The checklist, the WCAG tags on every finding and the CSV download are on every plan, including free.",
      ],
      [
        "Which pages does it check?",
        "Your homepage, twice: our checks read its HTML, and Google Lighthouse's accessibility audits run on the page as a real browser renders it. Fixes there usually apply to shared templates across the site, but other page types can have their own issues.",
      ],
      [
        "Why is WCAG 4.1.1 Parsing not on the list?",
        "WCAG 2.2 made 4.1.1 obsolete: it no longer has to be met, so the checklist leaves it out.",
      ],
    ],
    related: ["accessibility", "ai-recommendations"],
  },
  {
    slug: "domain-email",
    area: "domain",
    name: "Domain & Email",
    short: "Domain expiry, nameservers and SPF, DKIM and DMARC.",
    title: "Domain and Email Check: Expiry, SPF, DKIM and DMARC",
    description:
      "Check your domain's expiry, nameservers, DNSSEC and CAA, and your MX, SPF, DKIM and DMARC records. Stop spoofing and keep mail out of spam.",
    h1: "Keep your domain and email safe.",
    lead: "Domain expiry, DNS and the email records that stop scammers sending mail in your name.",
    intro: [
      "Your domain is the one thing your website and your email both depend on. If it expires, everything goes offline and anyone can buy it. If its email records are missing, scammers can send mail that looks like yours, and your real mail is more likely to land in spam.",
      "Pagelyt looks up your domain's registration and expiry date, its nameservers, DNSSEC and CAA records, and your email setup: MX records, SPF (and whether it lets anyone send), DKIM keys at common selectors and your DMARC policy.",
    ],
    checks: [
      "Domain expiry date and registrar",
      "Nameservers (at least two)",
      "DNSSEC",
      "CAA record",
      "MX records",
      "SPF record, including a dangerous +all",
      "DKIM keys at common selectors",
      "DMARC policy (none, quarantine or reject)",
    ],
    gains: [
      ["Never lose your domain", "See the expiry date well before it lapses."],
      ["Stop email spoofing", "SPF, DKIM and DMARC tell receivers which mail is really yours."],
      ["Land in the inbox", "Gmail and Yahoo now require these records from senders."],
    ],
    faq: [
      [
        "What are SPF, DKIM and DMARC?",
        "SPF lists the servers allowed to send mail for your domain, DKIM signs each message, and DMARC tells receivers what to do with mail that fails those checks. Together they stop others sending mail in your name.",
      ],
      [
        "Do I need these if I don't send email?",
        "Yes. A domain with no SPF and DMARC is easy to spoof. Publish an SPF record that allows no senders and a DMARC reject policy.",
      ],
    ],
    related: ["security", "website-health"],
  },
  {
    slug: "privacy",
    area: "privacy",
    name: "Privacy & Compliance",
    short: "Privacy policy, cookie consent and third-party trackers.",
    title: "Website Privacy Check: Privacy Policy, Cookies and Trackers",
    description:
      "Check your site for a privacy policy and terms, cookie consent before tracking, third-party trackers and insecure forms. GDPR and CCPA basics, free.",
    h1: "Show visitors you handle their data with care.",
    lead: "The privacy basics laws such as GDPR and CCPA expect, checked from your homepage.",
    intro: [
      "Privacy laws such as GDPR, the UK GDPR, India's DPDP Act and California's CCPA expect a clear privacy policy and, in many places, consent before tracking. Visitors notice too: a site that is open about data earns more trust.",
      "Pagelyt checks that your homepage links to a privacy policy and terms of use, finds analytics and ad trackers (Google Analytics, Meta, Hotjar, TikTok and more), looks for a cookie consent tool when trackers are present, counts third-party script sources and flags password forms on pages without HTTPS.",
    ],
    checks: [
      "Privacy policy link",
      "Terms of use link",
      "Analytics and ad trackers on the page",
      "A cookie consent tool when trackers are present",
      "Number of third-party script sources",
      "Password fields on non-HTTPS pages",
    ],
    gains: [
      ["Cover the legal basics", "See at a glance whether the policies laws expect are in place."],
      ["Know who you share data with", "Every tracker and outside script on the page, listed."],
      ["Build trust", "Clear policies and consent make visitors more comfortable."],
    ],
    faq: [
      [
        "Is this a legal compliance audit?",
        "No. Pagelyt checks the visible basics. It can't read your policy for legal accuracy or see how you store data, so ask a lawyer for a full review.",
      ],
      [
        "Why does cookie consent matter?",
        "In the EU, UK and other regions, analytics and ad trackers need the visitor's consent before they load. Loading them first can breach the law.",
      ],
    ],
    related: ["security", "domain-email"],
  },
  {
    slug: "code-security",
    area: "code",
    name: "Code Security Check",
    short: "Old libraries, leaked keys and source maps in your JavaScript.",
    title: "JavaScript Security Check: Old Libraries and Leaked Keys",
    description:
      "Check the JavaScript your site sends to browsers for libraries with known vulnerabilities, leaked API keys, public source maps and missing integrity checks",
    h1: "See what your JavaScript gives away.",
    lead: "Basic security checks of the script files browsers download from your site: old libraries with known flaws, leaked keys and more. Just your URL, nothing to install.",
    intro: [
      "Every visitor downloads your site's JavaScript, and anyone can open it in a browser. That makes it the first place attackers look: an old version of jQuery with a published flaw, a secret API key someone pasted into a script, or a source map that hands out your original code.",
      "Pagelyt loads your homepage in a real browser, notes every script file it downloads and reads them, along with the inline scripts in the HTML. It recognises more than 20 common libraries, such as jQuery, Bootstrap, Lodash, AngularJS and Moment.js, and checks each version against published vulnerabilities. It also looks for secret keys in known formats, public source maps, CDN files with no integrity check, forms that send data over plain HTTP and risky code patterns.",
      "These are basic checks of what the browser receives, not a full security audit. Pagelyt never sees your server code, and pages behind a login aren't checked. A clean result is a good sign, and the findings it does report are real problems anyone can see.",
    ],
    checks: [
      "Libraries with known vulnerabilities (CVEs), such as old jQuery, Bootstrap and Lodash",
      "Libraries that no longer get security fixes, such as AngularJS 1.x and Vue 2",
      "Secret keys left in your scripts (Stripe, AWS, OpenAI, GitHub and more), shown masked",
      "Public source maps that expose your original code",
      "CDN scripts and stylesheets with no integrity (SRI) check",
      "eval, document.write and risky DOM writes when there is no Content Security Policy",
      "Forms that send data over plain HTTP",
      "A list of every file we read, from a real browser load",
    ],
    gains: [
      ["Close the easy doors", "Old libraries and leaked keys are what automated attacks look for first."],
      ["Fix with confidence", "Each issue names the file, the version to upgrade to and the published flaw."],
      ["No setup at all", "Enter your URL. No code access, no repository, nothing to install."],
    ],
    faq: [
      [
        "Is this a full security audit or a penetration test?",
        "No. Pagelyt reads only what your site sends to every browser: its HTML and the JavaScript files it loads. It never sees your server code, databases or pages behind a login. Think of it as a quick check for the problems anyone can spot, not a replacement for a security review.",
      ],
      [
        "How do you know a library version is vulnerable?",
        "We recognise each library from its file name, CDN address or the version banner inside the file, then compare the version with the affected ranges in published security advisories (CVEs). We only flag versions we can identify, so a library we don't recognise is left out rather than guessed.",
      ],
      [
        "Will the report show my secret keys?",
        "No. Keys are always masked: you see the kind of key, its first few characters and where it was found, so the report is safe to share. If we find one, revoke it in that service and move the call that needs it to your server.",
      ],
      [
        "Which files do you read?",
        "The script files a real browser downloaded when it loaded your homepage, your own files first, plus the inline scripts in the HTML. Analytics and ad scripts are skipped. Each report lists every file we read.",
      ],
      [
        "Is the code check free?",
        "Yes. It runs in every scan, on every plan, including free.",
      ],
    ],
    related: ["security", "wcag-checklist"],
  },
  {
    slug: "competitor-intelligence",
    name: "Competitor Analysis",
    short: "Compare your site with competitors side by side.",
    title: "Competitor Website Analysis and Benchmarking",
    description:
      "Compare your website with competitors on performance, technical SEO, accessibility, content structure and GEO readiness using publicly observable data.",
    h1: "See where competitors are ahead, and where you lead.",
    lead: "Side-by-side website benchmarking based on publicly observable signals.",
    intro: [
      "Your website doesn't operate in isolation. Pagelyt compares your site with competing websites so you can see where you lead and where there is room to improve.",
      "Comparisons use publicly observable data: performance, technical SEO, accessibility, content structure, GEO readiness, visible technology signals and changes over time. Opportunity cards turn each gap into a clear next step.",
    ],
    checks: [
      "Website performance differences",
      "Technical SEO comparisons",
      "Accessibility comparisons",
      "Content structure differences",
      "GEO readiness",
      "Publicly visible technology signals",
      "Content and topic opportunities",
      "Website changes over time",
    ],
    gains: [
      ["Benchmark with context", "Scores mean more next to a competitor's."],
      ["Spot opportunities", "See content and technical gaps worth closing."],
      ["Watch for changes", "Know when competitors change their sites."],
    ],
    faq: [
      [
        "What data does competitor analysis use?",
        "Only publicly observable website data, such as page speed, metadata, structure and visible technology signals.",
      ],
      [
        "Which plans include competitor analysis?",
        "Competitor intelligence is included from the Professional plan, with advanced comparisons on Business.",
      ],
    ],
    related: ["seo", "monitoring-reports"],
  },
  {
    slug: "ai-recommendations",
    name: "AI Recommendations",
    short: "Findings explained and ranked, with clear next steps.",
    title: "AI Website Recommendations: What to Fix First",
    description:
      "Pagelyt's AI turns technical audit findings into plain-English, prioritised recommendations: what was detected, why it matters and what to do next.",
    h1: "Don't just find problems. Know how to fix them.",
    lead: "AI-written recommendations, ranked by impact and effort.",
    intro: [
      "Traditional audit tools hand you numbers and warnings. Pagelyt goes further. Its AI recommendation engine turns technical findings into explanations a non-technical owner can understand and a developer can act on.",
      "Every recommendation answers four questions: what was detected, why it matters, how important it is and what to do next. Evidence snippets show exactly what Pagelyt saw, and priority labels help you decide where to start.",
    ],
    checks: [
      "What was detected",
      "Why it matters",
      "How important it is",
      "What to do next",
      "Evidence and examples",
      "Priority, impact and effort",
    ],
    gains: [
      ["Plain English", "No jargon, just explanations anyone can follow."],
      ["Prioritised", "High-impact fixes come before minor ones."],
      ["Actionable", "Every issue includes a recommended action."],
    ],
    faq: [
      [
        "How does Pagelyt prioritise recommendations?",
        "By estimated impact on your score and the effort to fix, so quick, high-impact wins come first.",
      ],
      [
        "Can I share recommendations with a developer?",
        "Yes. Reports include evidence and suggested actions, and PDF downloads are available on paid plans.",
      ],
    ],
    related: ["performance", "seo"],
  },
  {
    slug: "monitoring-reports",
    name: "Monitoring & Reports",
    short: "Scheduled scans, history, alerts and monthly reports.",
    title: "Website Monitoring, Uptime Alerts and Monthly Reports",
    description:
      "Schedule website scans, track score history, monitor uptime, detect changes and receive monthly intelligence reports with improvements and regressions.",
    h1: "Your website changes. Your intelligence should too.",
    lead: "Scheduled scans, history, alerts and monthly reports.",
    intro: [
      "A website is never finished. Pages are published, content changes and performance drifts. A one-time audit only shows a moment in time.",
      "Pagelyt monitors your site on a schedule that depends on your plan, compares each scan with the last and highlights what improved, what regressed and what needs attention. Uptime monitoring and alerts flag problems early, and a monthly intelligence report summarises everything in one place.",
    ],
    checks: [
      "Scheduled website scans",
      "Historical comparisons",
      "Uptime monitoring",
      "Website change detection",
      "Actionable alerts",
      "Monthly intelligence reports",
      "PDF report downloads",
    ],
    gains: [
      ["See progress", "Compare scans and track your score over time."],
      ["Catch regressions", "Know when a change makes things worse."],
      ["Stay informed", "Monthly reports land in your inbox."],
    ],
    faq: [
      [
        "How often does Pagelyt scan my website?",
        "Every website you save is rescanned weekly by default, on every plan. You can switch a site to daily or monthly, or pause it, from its Save and monitor page.",
      ],
      [
        "Can I download reports?",
        "Yes. PDF reports are available on paid plans, with white-label PDFs on Business.",
      ],
    ],
    related: ["website-health", "competitor-intelligence"],
  },
  {
    slug: "google-integrations",
    products: [
      {
        key: "gsc",
        name: "Google Search Console",
        tag: "Searches",
        text: "The Google searches that bring people to each page, and the issues on those pages.",
        points: ["Clicks and impressions on every issue", "Searches close to page one", "Pages losing clicks, low click rates", "Google's own indexing check", "AI insights with a next step"],
        guide: "/blog/google-search-console-setup-guide",
        open: "/dashboard?view=google&gtab=search",
      },
      {
        key: "ga4",
        name: "Google Analytics 4",
        tag: "Visitors",
        text: "Who arrives on each page, from which channel, and whether they stay.",
        points: ["Visits and engagement per issue", "Channels, devices and countries", "The drop detective: pages losing visitors", "Pages that don't hold visitors", "AI insights with a next step"],
        guide: "/blog/google-analytics-4-setup-guide",
        open: "/dashboard?view=google&gtab=analytics",
      },
      {
        key: "ads",
        name: "Google Ads",
        tag: "Ad spend",
        text: "What you pay to send people to pages with problems, and where ads overlap free clicks.",
        points: ["Ad spend landing on pages with issues", "Below-average landing-page keywords", "Paid searches you already rank for", "Organic clicks priced as ads", "Searches with spend and no conversions"],
        guide: "/blog/google-ads-setup-guide",
        open: "/dashboard?view=google&gtab=ads",
      },
    ],
    name: "Google Integrations",
    short: "Your overall traffic from Google, what's changing, and how to grow it.",
    title: "Google Search Console, GA4 and Google Ads Integration",
    description:
      "Connect Google Search Console, GA4 and Google Ads to Pagelyt. See clicks, traffic and ad results next to your site's issues, and learn how to grow.",
    h1: "Your traffic, explained. And how to grow it.",
    lead: "See your overall traffic from Google, what's growing or dropping and why, with AI steps to improve it. Plus the real clicks, visitors and ad spend behind every fix.",
    intro: [
      "A website audit tells you what is wrong. Your Google data tells you how your site is actually doing. Pagelyt works with Google Search Console, Google Analytics 4 and Google Ads and turns their numbers into one overall picture of your traffic: total clicks and visits, the channels, pages and searches that bring people in, and what is growing or dropping.",
      "AI insights then explain what changed and give you clear steps to grow your traffic, from searches close to page one to pages losing visitors and ad spend landing on weak pages. And because every finding in your report shows the clicks, visits and spend it touches, you fix what costs you most first.",
      "Connect once with your Google account and pick the property or account for each site. Pagelyt only reads your data: it can't change anything in Google, and you can disconnect any time from your account page.",
    ],
    checks: [
      "An overall traffic picture: clicks, visits and trends across Search Console and Analytics",
      "AI insights on what's growing or dropping, with steps to improve your traffic",
      "Search Console: clicks and impressions on the pages each issue affects",
      "Search Console: searches close to page one, pages that lost clicks, low click rates",
      "Search Console: Google's own indexing answer for your key pages",
      "Analytics: visits and engagement per issue, by channel, device and country",
      "Analytics: the drop detective, pages that lost visitors and why",
      "Google Ads: spend landing on pages with issues, and weak landing-page keywords",
      "Google Ads: paid searches where you already rank in the top 3 organically",
      "AI insights for each product, with a next step for each",
      "7, 28 and 90-day views, sortable tables and CSV downloads",
    ],
    gains: [
      ["Understand your traffic", "One overall view of searches, visitors and ads, with what changed and why."],
      ["Know how to grow it", "AI insights turn your numbers into clear next steps."],
      ["Read-only", "Pagelyt never changes your Google account or campaigns."],
    ],
    faq: [
      [
        "Which plans include the Google integrations?",
        "Search Console, Analytics and Google Ads come with the Professional and Business plans.",
      ],
      [
        "What can Pagelyt do in my Google account?",
        "Only read. Pagelyt asks for read-only access, can't change settings, campaigns, budgets or bids, and you can disconnect from your account page at any time.",
      ],
      [
        "Do I need all three?",
        "No. Connect any of them. Search Console is the best place to start: it shows the searches that bring people to your site.",
      ],
      [
        "Do I need to add a tracking script?",
        "No. Pagelyt reads the Google Analytics 4 property you already have. The website audit itself needs no script at all.",
      ],
    ],
    related: ["monitoring-reports", "seo"],
  },

];

export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug);

/* ---------- homepage copy ---------- */
export const HOME_VALUES = [
  {
    k: "Understand",
    d: "See your website's real state.",
    more: `Scores and evidence for ${AREA_COUNT} areas: ${AREA_LIST}.`,
    href: "/features",
    cta: "Explore features",
  },
  {
    k: "Optimise",
    d: "Know what to fix first.",
    more: "AI ranks every issue by impact and effort, in plain English.",
    href: "/features/ai-recommendations",
    cta: "See recommendations",
  },
  {
    k: "Monitor",
    d: "Track every change.",
    more: "Scheduled scans, history and alerts show what improved and what broke.",
    href: "/features/monitoring-reports",
    cta: "See monitoring",
  },
];

export const FLOW = [
  { k: "Discover", d: "Paste a URL. Pagelyt maps your public pages." },
  { k: "Analyse", d: `${capWords(AREA_COUNT)} checks run together: ${AREA_LIST}.` },
  { k: "Recommend", d: "AI ranks fixes by impact, in plain English." },
  { k: "Improve", d: "Rescan, compare and watch your score climb." },
];

export const HOW_DETAIL = [
  {
    k: "Discover",
    h: "Enter your URL. That's the whole setup.",
    p: [
      "Paste your website address. Pagelyt reads your publicly accessible pages, links, metadata and technology signals, with nothing to install and no code to add.",
      "It maps your site structure first, so every later check knows which pages exist and how they connect.",
    ],
  },
  {
    k: "Analyse",
    h: `${capWords(AREA_COUNT)} checks run together.`,
    p: [
      "Pagelyt evaluates website health, performance and Core Web Vitals, technical SEO, GEO readiness, security headers, accessibility, domain and email records, privacy basics and the code your site sends to browsers in a single pass.",
      "Each area gets its own score, and the scores combine into one Website Intelligence Score you can track over time.",
    ],
  },
  {
    k: "Recommend",
    h: "Findings become a clear to-do list.",
    p: [
      "AI turns technical findings into plain-English recommendations. Each one explains what was detected, why it matters, how important it is and what to do next.",
      "Fixes are ranked by impact and effort, so you start with the changes that move your score most.",
    ],
  },
  {
    k: "Improve",
    h: "Rescan and watch the score climb.",
    p: [
      "Upgrade to unlock scheduled scans, uptime monitoring, historical comparisons, alerts and monthly intelligence reports.",
      "Every scan is compared with the last, so you can prove progress and catch regressions early.",
    ],
  },
];

export const USE_CASES = [
  {
    slug: "small-businesses",
    h: "Website audits for small businesses",
    p: "Know whether your website is healthy without hiring a technical team. Pagelyt turns speed, SEO, security and accessibility findings into a short, plain-English to-do list.",
    points: ["One-URL website health report", "Fixes ranked by impact", "No technical knowledge needed"],
    link: ["/features/ai-recommendations", "See AI recommendations"],
  },
  {
    slug: "website-owners",
    h: "A clearer picture for website owners",
    p: "See how your site performs for visitors, search engines and AI assistants. Track the score over time and spot problems before they cost you traffic.",
    points: ["Speed, SEO and AI search readiness", "Security and accessibility checks", "Monthly intelligence reports"],
    link: ["/features/monitoring-reports", "See monitoring and reports"],
  },
  {
    slug: "freelancers",
    h: "Repeatable website audits for freelancers",
    p: "Generate professional website audits for clients in minutes. Use clear findings and evidence to scope improvement work and show results.",
    points: ["Audit any client site from a URL", "Shareable PDF reports", "Show before and after progress"],
    link: PRICING_ON ? ["/pricing", "Compare plans"] : ["/features", "See all features"],
  },
  {
    slug: "agencies",
    h: "Website monitoring for digital agencies",
    p: "Manage multiple client websites, monitor changes and deliver consistent website intelligence reports. White-label PDF reports are available on the Business plan.",
    points: ["Multi-website monitoring", "White-label PDF reports", "Competitor benchmarking"],
    link: ["/features/competitor-intelligence", "See competitor analysis"],
  },
  {
    slug: "developers",
    h: "Technical diagnostics for developers",
    p: "Get detailed findings with evidence: Core Web Vitals, headers, structured data, redirects and accessibility issues, with the fix suggested.",
    points: ["Core Web Vitals diagnostics", "Security header and TLS checks", "Evidence for every finding"],
    link: ["/features/performance", "See performance analysis"],
  },
];
