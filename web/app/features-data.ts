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
  /** Product cards shown under the hero (the Google hub). */
  products?: { key: "gsc" | "ga4" | "ads"; name: string; tag: string; text: string; points: string[]; guide: string; open: string }[];
};

export const FEATURES: Feature[] = [
  {
    slug: "website-health",
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
        "Run a check after any hosting, DNS or certificate change. Paid plans add scheduled scans and uptime monitoring so checks run automatically.",
      ],
    ],
    related: ["performance", "monitoring-reports"],
  },
  {
    slug: "performance",
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
    related: ["seo-geo", "ai-recommendations"],
  },
  {
    slug: "seo-geo",
    name: "SEO & GEO",
    short: "Technical SEO plus AI search readiness.",
    title: "Technical SEO Audit and AI Search (GEO) Readiness",
    description:
      "Audit titles, meta descriptions, headings, sitemaps, canonical URLs and structured data. Check AI crawler access and llms.txt for generative search readiness.",
    h1: "Be easy to find, in search and in AI answers.",
    lead: "A technical SEO audit and a GEO check in one report.",
    intro: [
      "Search is changing. Alongside traditional SEO, people now get answers from AI assistants and AI search engines. Pagelyt audits both: classic technical SEO and GEO, or generative engine optimisation.",
      "The SEO audit reviews page titles, meta descriptions, heading structure, canonical URLs, sitemap and robots.txt, internal and external links, image alt text and indexability signals. The GEO check looks at AI crawler access, AI-related robots.txt rules, llms.txt, structured data and how clearly your content is structured for extraction.",
    ],
    checks: [
      "Page titles and meta descriptions",
      "Heading structure",
      "Canonical URLs",
      "Sitemap and robots.txt",
      "Broken internal and external links",
      "Image alt attributes",
      "AI crawler accessibility",
      "llms.txt and structured data",
      "Content structure and entity clarity",
    ],
    gains: [
      ["Fix technical SEO gaps", "Find missing metadata, broken links and indexability issues."],
      ["Prepare for AI search", "See whether AI crawlers can read and understand your pages."],
      ["Get structured data ideas", "Spot where schema markup could help your content stand out."],
    ],
    faq: [
      [
        "What is GEO?",
        "GEO stands for generative engine optimisation: structuring and publishing content so AI-powered search and assistants can find, understand and cite it.",
      ],
      [
        "Does Pagelyt guarantee higher rankings?",
        "No. Pagelyt finds technical issues and opportunities, but rankings depend on many factors outside any tool's control.",
      ],
    ],
    related: ["performance", "ai-recommendations"],
  },
  {
    slug: "security-accessibility",
    name: "Security & Accessibility",
    short: "Security headers, TLS and WCAG-oriented checks.",
    title: "Website Security Headers and Accessibility Checker",
    description:
      "Check security headers (HSTS, CSP, X-Frame-Options), TLS configuration, mixed content and WCAG-oriented accessibility issues such as contrast and form labels.",
    h1: "Find security gaps and accessibility issues.",
    lead: "Publicly observable security checks and automated accessibility analysis.",
    intro: [
      "Security and accessibility both protect visitors and your reputation. Pagelyt reviews your site's publicly observable security configuration, including TLS, security headers and mixed content, and runs automated accessibility checks aligned with WCAG.",
      "On the security side it looks for missing or weak headers such as HSTS, Content Security Policy and X-Frame-Options, expiring certificates and insecure resources. On the accessibility side it flags missing image descriptions, low colour contrast, unlabelled form fields, heading hierarchy problems and invalid ARIA attributes.",
    ],
    checks: [
      "SSL and TLS configuration",
      "Expiring certificates",
      "Missing security headers",
      "Content Security Policy and HSTS",
      "X-Frame-Options",
      "Mixed content",
      "Colour contrast",
      "Form labels",
      "Image descriptions",
      "Heading hierarchy and ARIA attributes",
    ],
    gains: [
      ["Close easy security gaps", "Many fixes are a single server setting."],
      ["Reach more visitors", "Fix barriers for people using screen readers and keyboards."],
      ["Know what to do", "Each issue explains the impact and the recommended change."],
    ],
    faq: [
      [
        "Does Pagelyt test my site for vulnerabilities?",
        "No. It reviews publicly observable configuration such as headers and certificates. It is not a penetration test.",
      ],
      [
        "Can automated checks guarantee accessibility compliance?",
        "No. Automated checks find many common issues, but full WCAG conformance also needs manual review.",
      ],
    ],
    related: ["website-health", "ai-recommendations"],
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
    related: ["seo-geo", "monitoring-reports"],
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
    related: ["performance", "seo-geo"],
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
        "It depends on your plan: monthly on Essential, weekly on Professional and daily on Business.",
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
    short: "Search Console, Analytics and Google Ads numbers next to every fix.",
    title: "Google Search Console, GA4 and Google Ads Integration",
    description:
      "Connect Google Search Console, Google Analytics 4 and Google Ads to see real clicks, visitors and ad spend on every website issue, with AI insights. Read-only.",
    h1: "Your Google numbers, next to every fix.",
    lead: "See which problems cost you real searches, visitors and ad spend, so you fix those first.",
    intro: [
      "A website audit tells you what is wrong. Your Google data tells you what it costs. Pagelyt works with Google Search Console, Google Analytics 4 and Google Ads, and puts their numbers on every finding in your report.",
      "Connect once with your Google account and pick the property or account for each site. Pagelyt only reads your data: it can't change anything in Google, and you can disconnect any time from your account page.",
    ],
    checks: [
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
      ["Fix what costs traffic", "Every issue ranked by the clicks, visits and spend it touches."],
      ["One view", "Search, visitors and ads in one place, next to the report."],
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
    related: ["monitoring-reports", "seo-geo"],
  },

];

export const featureBySlug = (slug: string) => FEATURES.find((f) => f.slug === slug);

/* ---------- homepage copy ---------- */
export const HOME_VALUES = [
  {
    k: "Understand",
    d: "See your website's real state.",
    more: "Scores and evidence for health, speed, SEO, AI readiness, security and accessibility.",
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
  { k: "Analyse", d: "Six checks run together: health, speed, SEO, GEO, security and accessibility." },
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
    h: "Six checks run together.",
    p: [
      "Pagelyt evaluates website health, performance and Core Web Vitals, technical SEO, GEO readiness, security headers and accessibility in a single pass.",
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
    link: ["/pricing", "Compare plans"],
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
