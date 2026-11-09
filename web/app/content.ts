export const NAV = ["Product", "Features", "How It Works", "Pricing", "Resources", "About"];

export const TRUST = [
  "Performance Intelligence",
  "SEO Intelligence",
  "GEO Readiness",
  "Security Analysis",
  "Accessibility Insights",
];

export const INTRO_CARDS = [
  {
    t: "See the Bigger Picture",
    d: "Understand your website across performance, SEO, security, accessibility and more.",
  },
  {
    t: "Discover What Matters",
    d: "Identify issues, potential risks and opportunities that deserve attention.",
  },
  {
    t: "Know What to Do Next",
    d: "Get practical recommendations that help you move from identifying problems to improving your website.",
  },
];

export type Mod = {
  n: string;
  id: string;
  title: string;
  lead: string;
  intro?: string;
  label: string;
  items: string[];
  cta: string;
};

export const MODULES: Mod[] = [
  {
    n: "01",
    id: "health",
    title: "Website Health Intelligence",
    lead: "Know whether your website is healthy, accessible and available.",
    label: "Discover",
    items: [
      "Website availability and HTTP status.",
      "Response time.",
      "SSL certificate validity and expiry.",
      "DNS configuration.",
      "Domain information.",
      "Broken pages and redirect issues.",
    ],
    cta: "Explore Website Health",
  },
  {
    n: "02",
    id: "performance",
    title: "Performance Intelligence",
    lead: "Understand how quickly your website loads and where performance improvements are possible.",
    label: "Discover",
    items: [
      "Desktop and mobile performance.",
      "Lighthouse performance audits.",
      "Core Web Vitals diagnostics.",
      "Largest Contentful Paint.",
      "Interaction to Next Paint.",
      "Cumulative Layout Shift.",
      "Image and resource optimisation opportunities.",
    ],
    cta: "Explore Performance",
  },
  {
    n: "03",
    id: "seo",
    title: "SEO Intelligence",
    lead: "Make your website easier for search engines to understand and discover.",
    label: "Discover",
    items: [
      "Page titles and meta descriptions.",
      "Heading structure.",
      "Canonical URLs.",
      "Sitemap and robots.txt.",
      "Broken internal and external links.",
      "Image alt attributes.",
      "Indexability signals.",
      "Structured data opportunities.",
    ],
    cta: "Explore SEO",
  },
  {
    n: "04",
    id: "geo",
    title: "GEO Intelligence",
    lead: "Prepare your website for the evolving world of AI-powered search.",
    intro:
      "Understand how your website presents information to AI-powered discovery systems.",
    label: "Analyse",
    items: [
      "AI crawler accessibility.",
      "AI-related robots.txt directives.",
      "llms.txt presence.",
      "Structured data.",
      "Content structure and extractability.",
      "Entity clarity.",
      "FAQ and informational content structure.",
    ],
    cta: "Explore GEO",
  },
  {
    n: "05",
    id: "security",
    title: "Security Intelligence",
    lead: "Understand your website's publicly observable security configuration.",
    label: "Identify",
    items: [
      "SSL and TLS configuration issues.",
      "Expiring certificates.",
      "Missing security headers.",
      "Content Security Policy.",
      "HSTS configuration.",
      "X-Frame-Options.",
      "Mixed content.",
      "DNS security configuration.",
    ],
    cta: "Explore Security",
  },
  {
    n: "06",
    id: "a11y",
    title: "Accessibility Intelligence",
    lead: "Make your website more accessible and usable.",
    intro: "Discover potential accessibility issues through automated analysis.",
    label: "Analyse",
    items: [
      "Image descriptions.",
      "Colour contrast.",
      "Form labels.",
      "Keyboard accessibility indicators.",
      "Heading hierarchy.",
      "ARIA attributes.",
      "Accessibility recommendations.",
    ],
    cta: "Explore Accessibility",
  },
];

export const STEPS = [
  {
    n: "STEP 01",
    t: "Enter Your Website",
    d: ["Submit your website URL and let Pagelyt begin analysing its publicly accessible pages."],
  },
  {
    n: "STEP 02",
    t: "Discover Your Website Intelligence",
    d: [
      "Get a comprehensive report covering website health, performance, SEO, GEO, security and accessibility.",
      "Understand your scores, detected issues and improvement opportunities.",
    ],
  },
  {
    n: "STEP 03",
    t: "Understand What Needs Improvement",
    d: [
      "Explore detailed findings and AI-powered recommendations.",
      "Understand why something needs attention, its potential impact and what you can do about it.",
    ],
  },
  {
    n: "STEP 04",
    t: "Keep Improving",
    d: [
      "Upgrade to a subscription to unlock scheduled scans, monitoring, historical comparisons and automated intelligence reports.",
    ],
  },
];

export const RECS = [
  {
    p: "High Priority",
    t: "Your Homepage Has an Unoptimised Hero Image",
    d: "Your largest homepage image is contributing to slower loading.",
    a: "Optimise the image dimensions, convert it to a modern format and implement responsive image delivery.",
  },
  {
    p: "Medium Priority",
    t: "Your Website Is Missing Important Metadata",
    d: "Some pages do not have descriptive meta descriptions.",
    a: "Create unique descriptions that accurately communicate each page's content.",
  },
  {
    p: "High Priority",
    t: "Important Security Headers Are Missing",
    d: "Your website does not currently return certain recommended security headers.",
    a: "Review and configure appropriate HTTP security headers based on your hosting environment.",
  },
];

export const REC_QS = [
  "What was detected?",
  "Why does it matter?",
  "How important is it?",
  "What should you do next?",
];

export const CONTINUOUS = [
  {
    t: "Scheduled Website Scans",
    d: "Automatically analyse your website according to your subscription plan.",
  },
  {
    t: "Historical Comparisons",
    d: "Compare previous reports and understand how your website has changed.",
  },
  { t: "Uptime Monitoring", d: "Track website availability and identify downtime." },
  {
    t: "Website Change Detection",
    d: "Discover important changes to publicly accessible website content and configuration.",
  },
  {
    t: "Monthly Intelligence Reports",
    d: "Receive a consolidated monthly report highlighting improvements, regressions and recommended actions.",
  },
  {
    t: "Actionable Alerts",
    d: "Get notified about important issues that need attention.",
  },
];

export const COMPETITOR_DISCOVER = [
  "Website performance differences.",
  "Technical SEO comparisons.",
  "Content structure differences.",
  "Publicly visible technology signals.",
  "Content and topic opportunities.",
  "Website changes over time.",
];

export const COMPETITOR_COMPARE = [
  "Performance.",
  "Technical SEO.",
  "Accessibility.",
  "Content structure.",
  "GEO readiness.",
];

export const ANALYTICS = [
  {
    t: "Traffic Intelligence",
    d: "Understand visitors, sessions, page views and traffic trends through connected analytics.",
  },
  {
    t: "Search Performance",
    d: "Explore search impressions, clicks, CTR and average search positions through Google Search Console.",
  },
  {
    t: "Conversion Intelligence",
    d: "Understand landing pages, CTAs and conversion opportunities using connected analytics and tracking.",
  },
  {
    t: "Performance Trends",
    d: "Compare website improvements with changes in user engagement and performance.",
  },
];

export const PERSONAS = [
  {
    t: "For Small Businesses",
    d: "Understand whether your website is healthy, discover issues and improve your online presence without needing a technical team.",
  },
  {
    t: "For Website Owners",
    d: "Get a clearer picture of your website's performance, search readiness, security and accessibility.",
  },
  {
    t: "For Freelancers",
    d: "Generate professional website audits, identify client improvement opportunities and deliver better website services.",
  },
  {
    t: "For Digital Agencies",
    d: "Manage multiple client websites, monitor changes and create consistent website intelligence reports.",
  },
  {
    t: "For Developers",
    d: "Explore technical website diagnostics, identify performance bottlenecks and understand implementation issues.",
  },
];

export const CONSULTS = [
  {
    t: "Quick Website Consultation",
    mins: 30,
    p: "₹499",
    d: "For a second opinion on your audit and a clear first step.",
    get: [
      "A walkthrough of your Pagelyt report in plain English",
      "Your top three fixes, in the order to do them",
      "Answers to your questions, with no jargon",
    ],
  },
  {
    t: "Technical Website Consultation",
    mins: 60,
    p: "₹999",
    d: "For owners and developers fixing speed, SEO or security.",
    get: [
      "A review of your Core Web Vitals, crawlability and security setup",
      "Step-by-step fixes for your platform: WordPress, Shopify or custom code",
      "A prioritised fix list, emailed after the call",
    ],
  },
  {
    t: "Website Growth Strategy",
    mins: 90,
    p: "₹1,499",
    d: "For businesses planning the next three to six months.",
    get: [
      "Your SEO and AI search (GEO) gaps, compared with up to two competitors",
      "A conversion review of your most important pages",
      "A written 90-day roadmap, emailed after the call",
    ],
  },
];

/** Session choices in the consultation form. The request API only accepts these exact labels. */
export const SESSIONS = CONSULTS.map((c) => `${c.t} · ${c.mins} min · ${c.p}`);

export const PLANS = [
  {
    name: "FREE",
    price: "₹0",
    per: "/ year",
    for: "For anyone who wants to understand their website.",
    head: "Includes:",
    items: [
      "Initial website analysis.",
      "Basic website health checks.",
      "Basic performance analysis.",
      "Basic technical SEO analysis.",
      "Basic GEO analysis.",
      "Basic security checks.",
      "Basic accessibility checks.",
      "Limited AI recommendations.",
      "Basic intelligence report.",
    ],
    cta: "Start Free",
  },
  {
    name: "ESSENTIAL",
    price: "₹999",
    per: "/ website / year",
    for: "For website owners who want to maintain their websites.",
    head: "Everything in Free, plus:",
    items: [
      "Advanced website health analysis.",
      "Advanced performance analysis.",
      "Advanced SEO analysis.",
      "GEO analysis.",
      "Security analysis.",
      "Accessibility analysis.",
      "Domain and DNS intelligence.",
      "Content intelligence.",
      "AI recommendations.",
      "Monthly scheduled scans.",
      "Basic uptime monitoring.",
      "Three months of historical reports.",
      "Monthly intelligence reports.",
      "PDF report downloads.",
    ],
    cta: "Choose Essential",
  },
  {
    name: "PROFESSIONAL",
    price: "₹2,499",
    per: "/ website / year",
    for: "For growing businesses and professionals who want deeper website intelligence.",
    head: "Everything in Essential, plus:",
    badge: "MOST POPULAR",
    items: [
      "Advanced GEO analysis.",
      "Advanced accessibility analysis.",
      "Weekly scheduled scans.",
      "Advanced uptime monitoring.",
      "Twelve months of historical comparisons.",
      "Website change detection.",
      "Competitor intelligence.",
      "Analytics integration.",
      "Google Search Console integration.",
      "AI Website Assistant.",
      "Advanced AI recommendations.",
      "Custom alerts.",
      "One complimentary 30-minute consultation per subscription year.",
    ],
    cta: "Choose Professional",
  },
  {
    name: "BUSINESS",
    price: "₹4,999",
    per: "/ website / year",
    for: "For businesses and agencies that want comprehensive website intelligence.",
    head: "Everything in Professional, plus:",
    items: [
      "Daily scheduled scans.",
      "Advanced competitor intelligence.",
      "Advanced monitoring.",
      "Twenty-four months of historical reports.",
      "Advanced security checks.",
      "White-label PDF reports.",
      "Multiple client website management capabilities.",
      "Advanced reporting.",
      "Priority support.",
      "One complimentary 60-minute consultation per subscription year.",
    ],
    cta: "Choose Business",
  },
];

export const FAQS: [string, string][] = [
  [
    "What is Pagelyt?",
    "Pagelyt is a website intelligence and optimisation platform that analyses website health, performance, SEO, GEO readiness, security and accessibility. It helps website owners understand issues, discover opportunities and improve their websites through actionable recommendations.",
  ],
  [
    "How does website analysis work?",
    "Simply enter your website URL. Pagelyt performs automated checks on publicly accessible website information and generates an intelligence report.",
  ],
  [
    "Is the initial website analysis free?",
    "Yes. You can start with a free website analysis and explore the findings before choosing a subscription.",
  ],
  [
    "Do I need to install anything?",
    "No installation is required for the initial website audit. Certain advanced capabilities, such as real-user analytics and conversion tracking, require integrations or a tracking script.",
  ],
  [
    "What is GEO?",
    "GEO stands for Generative Engine Optimisation. It refers to improving how your website content is structured and made accessible to AI-powered discovery and search systems.",
  ],
  [
    "Can Pagelyt monitor multiple websites?",
    "Yes. Each website requires its own subscription. You can purchase multiple website subscriptions according to your requirements.",
  ],
  [
    "How frequently does Pagelyt scan my website?",
    "Scan frequency depends on your subscription plan. Different plans provide different scheduled scanning intervals.",
  ],
  [
    "Can I compare my website with competitors?",
    "Yes. Supported subscription plans include competitor intelligence features that analyse publicly observable website characteristics.",
  ],
  [
    "Can I download my website reports?",
    "Yes. Pagelyt provides downloadable PDF reports according to your subscription plan.",
  ],
  [
    "How do monthly intelligence reports work?",
    "Pagelyt generates a periodic summary of your website's findings, improvements, changes and recommendations and delivers it to your registered email address.",
  ],
  [
    "Can I book a consultation without purchasing a subscription?",
    "Yes. You can book a standalone one-on-one consultation without subscribing to Pagelyt.",
  ],
  [
    "Do Professional and Business plans include consultations?",
    "Yes. Professional includes one 30-minute consultation, while Business includes one 60-minute consultation per subscription year.",
  ],
  [
    "Does Pagelyt guarantee better Google rankings?",
    "No. Pagelyt identifies technical SEO issues and opportunities, but search rankings depend on many factors outside the platform's control.",
  ],
];

export const FOOTER = {
  Product: [
    "Website Health",
    "Performance Intelligence",
    "SEO Intelligence",
    "GEO Intelligence",
    "Security Intelligence",
    "Accessibility Intelligence",
    "Competitor Intelligence",
    "AI Recommendations",
  ],
  Resources: [
    "Blog",
    "Guides",
    "Website Optimisation Tips",
    "SEO Resources",
    "GEO Resources",
    "FAQs",
  ],
  Company: ["About Pagelyt", "Book a Consultation", "Contact", "Pricing"],
  Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "Refund Policy"],
};

export const VALUES = [
  {
    k: "Understand",
    d: "Discover the current state of a website.",
    more: "Scores for health, performance, SEO, GEO, security and accessibility, with the evidence behind each one.",
  },
  {
    k: "Optimise",
    d: "Identify and prioritise improvements.",
    more: "AI turns findings into a ranked list of fixes, with why each matters and what to do next.",
  },
  {
    k: "Monitor",
    d: "Keep track of website health and changes.",
    more: "Scheduled scans, history and alerts, so you can see what changed and what improved.",
  },
];

export type Cap = {
  id: string;
  title: string;
  gain: string;
  items: string[];
  cta: string;
};

export const CAPS: Cap[] = [
  {
    id: "health",
    title: "Website Health",
    gain: "Know whether your website is healthy, accessible and available.",
    items: [
      "Availability and HTTP status.",
      "Response time.",
      "SSL certificate validity and expiry.",
      "DNS configuration.",
      "Broken pages and redirect issues.",
    ],
    cta: "Explore Website Health",
  },
  {
    id: "performance",
    title: "Performance Intelligence",
    gain: "Understand how quickly your website loads and where improvements are possible.",
    items: [
      "Desktop and mobile performance.",
      "Core Web Vitals diagnostics.",
      "Lighthouse performance audits.",
      "Image and resource optimisation opportunities.",
    ],
    cta: "Explore Performance",
  },
  {
    id: "seogeo",
    title: "SEO & GEO Intelligence",
    gain: "Make your website easier for search engines and AI systems to understand.",
    items: [
      "Titles, meta descriptions and heading structure.",
      "Sitemap, robots.txt and canonical URLs.",
      "AI crawler accessibility and llms.txt.",
      "Structured data and content extractability.",
    ],
    cta: "Explore SEO and GEO",
  },
  {
    id: "secA11y",
    title: "Security & Accessibility",
    gain: "Find publicly observable security gaps and accessibility issues.",
    items: [
      "Security headers, HSTS and Content Security Policy.",
      "SSL and TLS configuration and mixed content.",
      "Colour contrast and form labels.",
      "Image descriptions and heading hierarchy.",
    ],
    cta: "Explore Security and Accessibility",
  },
  {
    id: "competitor",
    title: "Competitor Intelligence",
    gain: "See where competing websites are ahead and where you lead.",
    items: [
      "Website performance differences.",
      "Technical SEO comparisons.",
      "Content structure differences.",
      "Website changes over time.",
    ],
    cta: "Explore Competitor Intelligence",
  },
  {
    id: "ai",
    title: "AI Recommendations",
    gain: "Turn technical findings into prioritised, practical actions.",
    items: [
      "What was detected.",
      "Why it matters.",
      "How important it is.",
      "What to do next.",
    ],
    cta: "Explore AI Recommendations",
  },
  {
    id: "monitor",
    title: "Monitoring & Reports",
    gain: "Track changes, improvements and regressions over time.",
    items: [
      "Scheduled website scans.",
      "Historical comparisons.",
      "Uptime monitoring and actionable alerts.",
      "Monthly intelligence reports.",
    ],
    cta: "Explore Monitoring",
  },
];

export const STAGES = [
  {
    k: "Discover",
    d: "Pagelyt scans the website and discovers its structure.",
    more: "Enter a URL and Pagelyt maps the publicly accessible pages, links and technology signals. Nothing to install.",
  },
  {
    k: "Analyse",
    d: "It evaluates performance, SEO, security, accessibility and GEO.",
    more: "Each dimension is analysed on its own, then combined into one Website Intelligence Score.",
  },
  {
    k: "Recommend",
    d: "AI turns findings into prioritised, actionable recommendations.",
    more: "Every recommendation explains what was detected, why it matters, how important it is and what to do next.",
  },
  {
    k: "Improve",
    d: "Monitor changes and track improvements over time.",
    more: "Compare scans, spot regressions early and watch your score climb as fixes land.",
  },
];
