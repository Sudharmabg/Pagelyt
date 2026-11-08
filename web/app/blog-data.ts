// Blog posts live in the repo. Paragraphs support internal links written as [text](/path).

export type Block =
  | { h2: string }
  | { h3: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { tip: string };

export type Post = {
  slug: string;
  tag: string;
  title: string; // <title> / meta title
  description: string; // meta description
  h1: string;
  lead: string;
  keywords: string[];
  body: Block[];
  faq: [string, string][];
  related: string[];
};

export const AUTHOR = "Sudharma";

export const POSTS: Post[] = [
  {
    slug: "what-is-geo-generative-engine-optimisation",
    tag: "GEO",
    title: "What Is GEO? Generative Engine Optimisation Explained",
    description:
      "What is GEO (generative engine optimisation) and how is it different from SEO? Learn how to get your website cited by ChatGPT, Google AI Overviews, Perplexity and other AI search tools.",
    h1: "What is GEO, and how do you get found in AI search?",
    lead: "Generative engine optimisation is how you make your website easy for AI assistants to read, trust and cite. Here's what it means and where to start.",
    keywords: [
      "what is GEO",
      "generative engine optimisation",
      "GEO vs SEO",
      "AI search optimisation",
      "how to rank in ChatGPT",
      "Google AI Overviews",
      "llms.txt",
    ],
    body: [
      { h2: "What is GEO?" },
      {
        p: "GEO, or generative engine optimisation, is the practice of making your website content easy for AI-powered search tools to find, understand and quote. Tools like ChatGPT search, Google AI Overviews, Perplexity, Copilot and Claude no longer just list ten blue links. They read pages, write an answer and cite a few sources. GEO is about being one of those sources.",
      },
      {
        p: "If SEO asks \"will my page rank?\", GEO asks \"will an AI assistant pick my page as the answer and mention my brand?\"",
      },
      { h2: "GEO vs SEO: what's the difference?" },
      {
        p: "GEO is not a replacement for SEO. Most AI search tools still rely on a traditional search index to find candidate pages, so technical SEO remains the foundation. The difference is in what happens next.",
      },
      {
        ul: [
          "SEO optimises for ranking positions and clicks from a results page.",
          "GEO optimises for being quoted, summarised and cited inside an AI-generated answer.",
          "SEO rewards relevance and authority signals such as links. GEO also rewards clarity: short, direct answers, clear structure and facts a model can lift without misreading.",
          "SEO success is measured in rankings and traffic. GEO success is measured in citations, brand mentions and referral visits from AI tools.",
        ],
      },
      { h2: "How do AI search engines choose which websites to cite?" },
      {
        p: "No AI company publishes its exact ranking rules, but the pattern is consistent. AI search tools favour pages that are crawlable, clearly structured, factually specific and trustworthy. In practice that means:",
      },
      {
        ul: [
          "The AI crawler is allowed to fetch the page (it isn't blocked in robots.txt or by a firewall).",
          "The answer to a question appears near the top of a section, in plain language.",
          "Headings match the questions people actually ask.",
          "Structured data tells the machine what the page is: an article, a product, an FAQ, an organisation.",
          "The page shows who wrote it and why they're credible.",
        ],
      },
      { h2: "How to optimise your website for AI search: a GEO checklist" },
      {
        ol: [
          "Check robots.txt allows the AI crawlers you want, such as GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended. Many sites block them by accident through a security plugin or CDN rule. See our guide on [unblocking AI crawlers](/fix/ai-blocked).",
          "Add an llms.txt file at the root of your site that summarises who you are and links to your most important pages. Our [llms.txt guide](/fix/no-llms) walks through it.",
          "Add structured data with schema.org JSON-LD: Organization, Article, Product and FAQPage are the most useful. See [adding structured data](/fix/no-structured-data).",
          "Write question-led headings and answer each one in the first one or two sentences beneath it.",
          "Add a short FAQ section to key pages, marked up with FAQPage schema. See [adding an FAQ](/fix/no-faq).",
          "Use specific facts, numbers and definitions rather than vague marketing language. AI models quote concrete statements.",
          "Keep the technical basics solid: fast pages, a valid sitemap, unique titles and meta descriptions, and canonical URLs.",
        ],
      },
      {
        tip: "Pagelyt's GEO Intelligence check tests AI crawler access, llms.txt, structured data, FAQ coverage and content clarity in one scan, then tells you which fix to do first.",
      },
      { h2: "What is llms.txt and do I need one?" },
      {
        p: "llms.txt is a proposed standard: a plain Markdown file at yoursite.com/llms.txt that gives language models a curated map of your site. It's similar in spirit to a sitemap, but written for machines that read rather than crawl. It isn't an official ranking factor for any search engine yet, but it costs ten minutes to create and makes your key pages easier for AI tools to find and describe accurately.",
      },
      { h2: "How do I know if AI search is sending me traffic?" },
      {
        p: "Look in your analytics for referrals from chatgpt.com, perplexity.ai, copilot.microsoft.com and gemini.google.com. Google AI Overview clicks are currently reported as ordinary Google organic traffic. You can also ask the assistants directly about your category and see whether your brand appears in the answer.",
      },
      { h2: "Where to start" },
      {
        p: "Start with access, then structure, then content. If AI crawlers can't fetch your pages, nothing else matters. Once they can, structured data and clear question-and-answer sections give you the quickest wins. [Run a free GEO check](/) to see where your site stands today.",
      },
    ],
    faq: [
      [
        "What does GEO stand for?",
        "GEO stands for generative engine optimisation: optimising website content so that AI-powered search tools such as ChatGPT, Google AI Overviews and Perplexity can understand it and cite it in their answers.",
      ],
      [
        "Is GEO replacing SEO?",
        "No. Most AI search tools find pages through a traditional search index, so strong technical SEO is still required. GEO builds on SEO by making content easier for AI models to quote accurately.",
      ],
      [
        "How do I get my website mentioned by ChatGPT?",
        "Allow OpenAI's crawlers (GPTBot and OAI-SearchBot) in robots.txt, make sure your pages are indexed by search engines, answer common questions clearly near the top of each section, and add structured data such as FAQPage and Organization schema.",
      ],
      [
        "Should I block AI crawlers?",
        "It depends on your goals. Blocking AI crawlers stops your content being used, but it also stops AI search tools from citing and linking to you. Most businesses that want visibility should allow search-focused AI crawlers.",
      ],
      [
        "Does llms.txt improve rankings?",
        "llms.txt is not a confirmed ranking factor. It is a low-effort way to give AI tools a clear summary and map of your site, which can help them describe your business accurately.",
      ],
    ],
    related: ["technical-seo-checklist", "free-website-audit-what-to-check"],
  },

  {
    slug: "core-web-vitals-explained",
    tag: "Performance",
    title: "Core Web Vitals Explained: LCP, INP and CLS in Plain English",
    description:
      "What are Core Web Vitals? A plain-English guide to LCP, INP and CLS, what good scores look like, how they affect Google rankings, and how to improve each one.",
    h1: "Core Web Vitals explained in plain English.",
    lead: "LCP, INP and CLS are Google's three measures of how a page feels to a real visitor. Here's what each one means, what a good score is and how to fix a poor one.",
    keywords: [
      "core web vitals",
      "what is LCP",
      "what is INP",
      "what is CLS",
      "improve core web vitals",
      "page experience ranking factor",
      "PageSpeed Insights",
    ],
    body: [
      { h2: "What are Core Web Vitals?" },
      {
        p: "Core Web Vitals are three metrics Google uses to measure real-world user experience on a web page: how quickly the main content loads, how quickly the page responds when someone interacts with it, and how stable the layout is while it loads. They are part of Google's page experience signals.",
      },
      {
        ul: [
          "LCP (Largest Contentful Paint) measures loading.",
          "INP (Interaction to Next Paint) measures responsiveness.",
          "CLS (Cumulative Layout Shift) measures visual stability.",
        ],
      },
      { h2: "What are good Core Web Vitals scores?" },
      {
        p: "Google rates each metric as good, needs improvement or poor. To pass, at least 75% of real visits to a page should fall in the good range:",
      },
      {
        ul: [
          "LCP: 2.5 seconds or less is good; over 4 seconds is poor.",
          "INP: 200 milliseconds or less is good; over 500 milliseconds is poor.",
          "CLS: 0.1 or less is good; over 0.25 is poor.",
        ],
      },
      { h2: "What is LCP and how do I improve it?" },
      {
        p: "Largest Contentful Paint is the time it takes for the biggest visible element, usually a hero image, video poster or large heading, to appear on screen. A slow LCP makes a page feel like it isn't loading.",
      },
      {
        ul: [
          "Compress and resize the hero image, and serve it as WebP or AVIF.",
          "Don't lazy-load the LCP image. Load it eagerly and consider fetchpriority=\"high\".",
          "Reduce server response time (TTFB) with caching or a CDN.",
          "Remove render-blocking CSS and JavaScript from the top of the page.",
        ],
      },
      { h2: "What is INP and how do I improve it?" },
      {
        p: "Interaction to Next Paint measures the delay between a visitor clicking, tapping or typing and the page visibly responding. It replaced First Input Delay (FID) as a Core Web Vital in March 2024. Poor INP is almost always caused by too much JavaScript running on the main thread.",
      },
      {
        ul: [
          "Remove unused scripts, plugins and third-party tags.",
          "Break long JavaScript tasks into smaller chunks.",
          "Delay non-essential scripts such as chat widgets until after the page loads.",
          "Avoid heavy work inside click and input handlers.",
        ],
      },
      { h2: "What is CLS and how do I improve it?" },
      {
        p: "Cumulative Layout Shift measures how much content jumps around while the page loads. It's the reason you sometimes tap the wrong button because an ad pushed it down.",
      },
      {
        ul: [
          "Always set width and height (or aspect-ratio) on images and videos.",
          "Reserve space for ads, embeds and banners before they load.",
          "Use font-display: swap with a closely matched fallback font.",
          "Don't insert content above existing content unless the user asked for it.",
        ],
      },
      { h2: "Do Core Web Vitals affect SEO rankings?" },
      {
        p: "Yes, but modestly. Google has confirmed Core Web Vitals are a ranking signal, and relevance still matters far more. Where they make a bigger difference is conversions: faster, more stable pages keep more visitors and sell more. Think of them as a tiebreaker for rankings and a multiplier for revenue.",
      },
      { h2: "Lab data vs field data" },
      {
        p: "Tools such as Lighthouse produce lab data: a simulated load on a set device and network. Google's rankings use field data from real Chrome users (the Chrome UX Report). Lab scores are great for diagnosing problems; field data tells you what visitors actually experience. Small or new sites often don't have enough traffic for field data, so lab data is the best guide.",
      },
      {
        tip: "Pagelyt's Performance Intelligence check measures LCP, CLS and Total Blocking Time (a lab stand-in for INP) and lists the specific images, scripts and requests slowing the page down.",
      },
      {
        p: "Want the full list of speed problems, not just the scores? Read [why your website is slow](/blog/why-is-my-website-slow), or [run a free speed test](/) on your own site.",
      },
    ],
    faq: [
      [
        "What are the three Core Web Vitals?",
        "Largest Contentful Paint (LCP) for loading speed, Interaction to Next Paint (INP) for responsiveness, and Cumulative Layout Shift (CLS) for visual stability.",
      ],
      [
        "What is a good LCP score?",
        "An LCP of 2.5 seconds or less is good. Between 2.5 and 4 seconds needs improvement, and over 4 seconds is poor.",
      ],
      [
        "What replaced First Input Delay?",
        "Interaction to Next Paint (INP) replaced First Input Delay (FID) as a Core Web Vital in March 2024. INP measures the responsiveness of all interactions on a page, not just the first one.",
      ],
      [
        "How do I check my Core Web Vitals?",
        "Use a website speed test such as Pagelyt or PageSpeed Insights for lab results, and the Core Web Vitals report in Google Search Console for field data from real visitors.",
      ],
      [
        "Why is my mobile score lower than desktop?",
        "Mobile tests simulate a slower processor and network, so heavy images and JavaScript have a much bigger impact. Most real visitors are on mobile, which is why Google uses mobile performance for ranking.",
      ],
    ],
    related: ["why-is-my-website-slow", "technical-seo-checklist"],
  },

  {
    slug: "why-is-my-website-slow",
    tag: "Performance",
    title: "Why Is My Website Slow? 10 Common Causes and How to Fix Them",
    description:
      "Why is my website so slow? Find the 10 most common causes of a slow website, from oversized images to slow hosting, and learn how to speed up your site step by step.",
    h1: "Why is my website slow? 10 common causes and fixes.",
    lead: "Slow websites lose visitors, sales and rankings. These are the problems we see most often, roughly in order of how much they cost, and what to do about each one.",
    keywords: [
      "why is my website slow",
      "how to speed up my website",
      "website loading slowly",
      "website speed test",
      "slow website fix",
      "reduce page load time",
      "page speed optimisation",
    ],
    body: [
      { h2: "How slow is too slow?" },
      {
        p: "As a rule of thumb, the main content of a page should appear within 2.5 seconds on a typical mobile connection. Beyond that, more visitors give up before the page finishes loading, and mobile visitors are the least patient. If your site feels slow to you on a fast office connection, it's slower still for your customers.",
      },
      { h2: "1. Images that are too large" },
      {
        p: "This is the number one cause. A photo straight from a camera or stock site can be 3–8 MB, when the same image at display size in WebP is often under 150 KB. Resize images to the largest size they're actually shown at, compress them, and use modern formats like WebP or AVIF.",
      },
      { h2: "2. Images that load all at once" },
      {
        p: "Images below the fold don't need to load until the visitor scrolls. Adding loading=\"lazy\" to those images can cut the initial download dramatically. Don't lazy-load the hero image, though: that one should load first. See our guide to [lazy loading images](/fix/no-lazy).",
      },
      { h2: "3. Slow server response time" },
      {
        p: "If your server takes more than about 600 ms to start sending a page (time to first byte), everything else waits. Common causes are cheap shared hosting, no page caching and slow database queries. Page caching or a CDN usually fixes it. Read [fixing slow server response](/fix/slow-response).",
      },
      { h2: "4. No text compression" },
      {
        p: "HTML, CSS and JavaScript compress extremely well. Enabling Gzip or Brotli on your server typically shrinks them by 60–80%, and it's often a single setting. See [enabling compression](/fix/no-compression).",
      },
      { h2: "5. Too many plugins and scripts" },
      {
        p: "Every plugin, tracking pixel, chat widget and social embed adds JavaScript the browser has to download and run. Audit what's installed and remove anything that isn't earning its place. This is the biggest fix for a poor INP score.",
      },
      { h2: "6. Render-blocking CSS and JavaScript" },
      {
        p: "Scripts and stylesheets in the page head block the browser from showing anything until they've loaded. Add defer or async to scripts that don't need to run immediately, and keep critical CSS small.",
      },
      { h2: "7. Web fonts loading badly" },
      {
        p: "Several font families, each in multiple weights, can add hundreds of kilobytes. Limit yourself to the weights you use, self-host where possible, preload the main font file and use font-display: swap so text appears straight away.",
      },
      { h2: "8. No browser caching" },
      {
        p: "Without cache headers, returning visitors download your logo, CSS and scripts again on every page. Set long cache lifetimes for static files that rarely change.",
      },
      { h2: "9. Redirect chains" },
      {
        p: "A link that goes http → https → www → final URL makes the browser do several round trips before it starts loading anything. Point links and redirects straight to the final URL.",
      },
      { h2: "10. No CDN for a global audience" },
      {
        p: "If your server is in one country and your visitors are worldwide, every request travels a long way. A content delivery network serves files from a location near each visitor.",
      },
      { h2: "How to find out exactly what's slowing your site down" },
      {
        p: "Guessing is slow. A website speed test shows which images are oversized, which scripts block rendering and how long your server takes to respond. Fix the biggest item first, test again, and repeat.",
      },
      {
        tip: "Pagelyt ranks speed issues by impact and effort, so you can see that compressing three images might save more time than any other change, before you spend a day on it.",
      },
      {
        p: "For the metrics behind all of this, read [Core Web Vitals explained](/blog/core-web-vitals-explained), or [test your website speed for free](/).",
      },
    ],
    faq: [
      [
        "What is the most common reason a website is slow?",
        "Oversized images. Uncompressed photos that are much larger than their display size are the most common cause of slow page loads, followed by slow hosting and too much JavaScript.",
      ],
      [
        "How can I check my website speed for free?",
        "Use a free website speed test such as Pagelyt or Google PageSpeed Insights. Enter your URL and you'll get load-time metrics plus a list of specific issues to fix.",
      ],
      [
        "Does website speed affect SEO?",
        "Yes. Page speed and Core Web Vitals are Google ranking signals, and slow pages also have higher bounce rates, which reduces conversions.",
      ],
      [
        "What is a good page load time?",
        "Aim for the main content to appear within 2.5 seconds (a good Largest Contentful Paint) and for the page to respond to taps within 200 milliseconds.",
      ],
      [
        "Will changing hosting make my website faster?",
        "It can, if your server response time is slow. If the slowness comes from large images or heavy scripts, better hosting alone won't fix it. Test first to find the real cause.",
      ],
    ],
    related: ["core-web-vitals-explained", "free-website-audit-what-to-check"],
  },

  {
    slug: "technical-seo-checklist",
    tag: "SEO",
    title: "Technical SEO Checklist: 15 Checks for Every Website",
    description:
      "A practical technical SEO checklist for small businesses and agencies: title tags, meta descriptions, sitemaps, robots.txt, canonical tags, structured data, broken links, HTTPS and more.",
    h1: "The technical SEO checklist every website needs.",
    lead: "Great content can't rank if search engines can't crawl, understand and trust your pages. Work through these 15 checks to fix the foundations.",
    keywords: [
      "technical SEO checklist",
      "SEO audit",
      "how to do an SEO audit",
      "title tag length",
      "meta description",
      "XML sitemap",
      "canonical tag",
      "robots.txt",
    ],
    body: [
      { h2: "What is technical SEO?" },
      {
        p: "Technical SEO is everything that helps search engines crawl, index and understand your website, as opposed to the words on the page or the links pointing to it. It's the plumbing: if it's broken, nothing else you do will reach its potential.",
      },
      { h2: "Crawling and indexing" },
      {
        ol: [
          "**Robots.txt** exists at yoursite.com/robots.txt and isn't blocking pages you want in search results. One stray \"Disallow: /\" can remove a whole site from Google.",
          "**XML sitemap** lists every important page, is referenced in robots.txt and is submitted in Google Search Console. See [creating a sitemap](/fix/no-sitemap).",
          "**No accidental noindex** tags on pages that should rank, which is a common leftover from a staging site.",
          "**Canonical tags** tell search engines which version of a page is the main one, so duplicate URLs don't split your rankings. See [adding canonical tags](/fix/no-canonical).",
          "**No broken links.** Internal links that return 404 waste crawl budget and frustrate visitors. See [fixing broken links](/fix/broken-links).",
        ],
      },
      { h2: "On-page tags" },
      {
        ol: [
          "**Unique title tags** on every page, ideally 50–60 characters, with the main keyword near the start. See [writing title tags](/fix/no-title).",
          "**Meta descriptions** of around 140–160 characters that summarise the page and give a reason to click. Google may rewrite them, but a good one often survives. See [writing meta descriptions](/fix/no-description).",
          "**One clear H1** per page that matches what the page is about, followed by logical H2 and H3 headings.",
          "**Descriptive image alt text** that helps both accessibility and image search.",
          "**Open Graph tags** so links shared on social media and messaging apps show the right title, description and image. See [adding Open Graph tags](/fix/no-og).",
        ],
      },
      { h2: "Site-wide signals" },
      {
        ol: [
          "**HTTPS everywhere**, with HTTP redirecting to HTTPS and a valid SSL certificate.",
          "**Mobile-friendly layout.** Google indexes the mobile version of your site first.",
          "**Fast pages** with good Core Web Vitals. See [Core Web Vitals explained](/blog/core-web-vitals-explained).",
          "**Structured data** (schema.org JSON-LD) describing your organisation, articles, products and FAQs. This also helps with AI search. See [adding structured data](/fix/no-structured-data).",
          "**Clean URLs and short redirect paths**, with no chains of three or four hops.",
        ],
      },
      { h2: "How often should I do a technical SEO audit?" },
      {
        p: "Run a full audit at least once a quarter, and always after a redesign, CMS migration, new plugin or domain change. Those are the moments things break silently. Automated monitoring catches problems between audits.",
      },
      { h2: "What about AI search?" },
      {
        p: "Technical SEO is also the foundation of GEO (generative engine optimisation). AI search tools rely on the same crawlable, well-structured pages. Once the checklist above is done, read [what is GEO](/blog/what-is-geo-generative-engine-optimisation) for the next layer.",
      },
      {
        tip: "Pagelyt's SEO Intelligence check runs most of this checklist automatically on up to dozens of pages and links each finding to a step-by-step fix guide.",
      },
    ],
    faq: [
      [
        "What is included in a technical SEO audit?",
        "A technical SEO audit checks crawlability (robots.txt, sitemap, noindex tags), indexing (canonical tags, duplicates), on-page tags (titles, meta descriptions, headings), site speed, mobile-friendliness, HTTPS, structured data and broken links.",
      ],
      [
        "How long should a title tag be?",
        "Aim for 50–60 characters. Longer titles are usually cut off in search results, so put the most important keyword and message first.",
      ],
      [
        "How long should a meta description be?",
        "Around 140–160 characters. It isn't a direct ranking factor, but a clear description improves click-through rate from search results.",
      ],
      [
        "Do I need an XML sitemap?",
        "Small, well-linked sites can be crawled without one, but a sitemap helps search engines discover new and updated pages faster. It's quick to add and recommended for every site.",
      ],
      [
        "Can I do technical SEO myself?",
        "Yes. Most technical SEO fixes, such as titles, descriptions, sitemaps and alt text, can be done in a CMS like WordPress, Shopify or Webflow without coding. An automated audit tells you which ones your site needs.",
      ],
    ],
    related: ["what-is-geo-generative-engine-optimisation", "free-website-audit-what-to-check"],
  },

  {
    slug: "website-security-checklist",
    tag: "Security",
    title: "Website Security Checklist: SSL, Security Headers, SPF and DMARC",
    description:
      "Is my website secure? A plain-English website security checklist covering SSL certificates, HTTPS, security headers like HSTS and CSP, and email protection with SPF and DMARC.",
    h1: "Is my website secure? A practical security checklist.",
    lead: "You don't need to be a security expert to close the most common gaps. These checks cover what attackers and browsers look at first.",
    keywords: [
      "is my website secure",
      "website security checklist",
      "security headers",
      "SSL certificate check",
      "HSTS",
      "content security policy",
      "SPF and DMARC",
    ],
    body: [
      { h2: "How do I check if my website is secure?" },
      {
        p: "Start with what's visible from the outside: your SSL certificate, your HTTP security headers, the software versions your site reveals and how your domain's email is protected. These are exactly what automated scanners and attackers check first, and they're all things you can test without logging into your server.",
      },
      { h2: "1. A valid SSL certificate and HTTPS everywhere" },
      {
        ul: [
          "Your certificate is valid, issued for the right domain and not close to expiry. Expired certificates trigger full-page browser warnings.",
          "Every HTTP URL redirects to HTTPS.",
          "There's no mixed content: no images, scripts or styles loaded over plain HTTP on an HTTPS page.",
          "The server supports modern TLS (1.2 and 1.3) and has older protocols switched off.",
        ],
      },
      { h2: "2. HTTP security headers" },
      {
        p: "Security headers are instructions your server sends to the browser about how to handle your site. They're one of the cheapest security wins available:",
      },
      {
        ul: [
          "**Strict-Transport-Security (HSTS)** forces browsers to always use HTTPS for your domain.",
          "**Content-Security-Policy (CSP)** limits where scripts and other resources can load from, which reduces the impact of cross-site scripting (XSS).",
          "**X-Content-Type-Options: nosniff** stops browsers guessing file types.",
          "**X-Frame-Options or CSP frame-ancestors** prevents your site being embedded in other pages for clickjacking.",
          "**Referrer-Policy** controls how much of your URLs is shared with other sites.",
          "**Permissions-Policy** switches off browser features like camera or geolocation that you don't use.",
        ],
      },
      {
        tip: "Start CSP in report-only mode. A strict policy added in one go can break analytics, embeds or payment widgets.",
      },
      { h2: "3. Don't advertise your software versions" },
      {
        p: "Headers like Server or X-Powered-By, and generator meta tags, can reveal exact CMS and server versions. That makes it easy for automated attacks to target known vulnerabilities. Hide version numbers and, more importantly, keep the software updated.",
      },
      { h2: "4. Protect your email domain with SPF and DMARC" },
      {
        p: "Even if your website is secure, scammers can send email that appears to come from your domain unless you publish email authentication records in DNS.",
      },
      {
        ul: [
          "**SPF** lists the servers allowed to send email for your domain. See [setting up SPF](/fix/no-spf).",
          "**DKIM** adds a cryptographic signature to outgoing mail.",
          "**DMARC** tells receiving servers what to do with mail that fails SPF or DKIM, and sends you reports. Start with p=none and move to quarantine or reject. See [setting up DMARC](/fix/no-dmarc).",
        ],
      },
      {
        p: "Gmail and Yahoo now require SPF, DKIM and DMARC for bulk senders, so these records also help your legitimate email reach the inbox.",
      },
      { h2: "5. Keep the basics in order" },
      {
        ul: [
          "Update your CMS, themes and plugins promptly, and remove ones you don't use.",
          "Use strong, unique admin passwords and two-factor authentication.",
          "Keep regular off-site backups and test that you can restore them.",
          "Publish a clear privacy policy, and a cookie consent banner where the law requires one. See [adding a privacy policy](/fix/no-privacy-policy).",
        ],
      },
      { h2: "Does website security affect SEO?" },
      {
        p: "Yes. HTTPS is a confirmed Google ranking signal, browsers warn visitors away from insecure or expired-certificate sites, and a hacked site can be flagged or removed from search results entirely. Security is also a trust signal for customers and AI search tools alike.",
      },
      {
        tip: "Pagelyt's Security Intelligence check tests your certificate, TLS versions, security headers, exposed version information, SPF and DMARC in one scan, with a fix guide for each gap.",
      },
    ],
    faq: [
      [
        "How can I tell if my website is secure?",
        "Check that it has a valid SSL certificate, redirects all HTTP traffic to HTTPS, sends security headers such as HSTS and Content-Security-Policy, keeps software updated, and has SPF and DMARC records for its email domain. A website security scanner checks most of these automatically.",
      ],
      [
        "What are security headers?",
        "Security headers are HTTP response headers that tell browsers how to behave when handling your site, for example to always use HTTPS (HSTS), restrict which scripts can run (CSP), or block your pages being framed by other sites (X-Frame-Options).",
      ],
      [
        "What happens when an SSL certificate expires?",
        "Browsers show a full-page security warning and most visitors leave. Forms, logins and payments may stop working. Use auto-renewal and monitor the expiry date.",
      ],
      [
        "What is the difference between SPF, DKIM and DMARC?",
        "SPF lists which servers may send email for your domain, DKIM signs messages so they can't be altered, and DMARC tells receiving mail servers what to do when a message fails those checks, and reports back to you.",
      ],
      [
        "Is a free SSL certificate good enough?",
        "Yes. Free certificates from providers like Let's Encrypt use the same encryption as paid ones. Paid certificates mainly add warranties or organisation validation.",
      ],
    ],
    related: ["free-website-audit-what-to-check", "website-accessibility-checklist"],
  },

  {
    slug: "website-accessibility-checklist",
    tag: "Accessibility",
    title: "How to Check Website Accessibility: A WCAG Checklist for Beginners",
    description:
      "How do I check if my website is accessible? A beginner-friendly WCAG checklist covering alt text, colour contrast, form labels, keyboard navigation and headings, plus the laws that apply.",
    h1: "How to check if your website is accessible.",
    lead: "About one in six people worldwide lives with a significant disability. An accessible website serves all of them, reduces legal risk and usually ranks better too.",
    keywords: [
      "website accessibility checker",
      "WCAG checklist",
      "how to make a website accessible",
      "WCAG 2.2",
      "ADA website compliance",
      "European Accessibility Act",
      "alt text",
      "colour contrast",
    ],
    body: [
      { h2: "What is web accessibility?" },
      {
        p: "Web accessibility means people can use your website regardless of disability, including people who are blind and use screen readers, people with low vision or colour blindness, people who navigate by keyboard only, and people with cognitive or motor impairments. The international standard is the Web Content Accessibility Guidelines (WCAG), and most laws point to WCAG 2.1 or 2.2 at level AA.",
      },
      { h2: "Is website accessibility a legal requirement?" },
      {
        p: "Increasingly, yes. In the US, website accessibility lawsuits under the ADA run into the thousands each year. In the EU, the European Accessibility Act has applied to many consumer-facing digital products and services since June 2025. The UK Equality Act requires reasonable adjustments, and public-sector sites have specific regulations. Requirements depend on your location, sector and size, so check what applies to you.",
      },
      { h2: "A beginner's WCAG checklist" },
      { h3: "Images and media" },
      {
        ul: [
          "Every meaningful image has alt text that describes its content or purpose.",
          "Decorative images have empty alt text (alt=\"\") so screen readers skip them.",
          "Videos have captions, and audio has a transcript.",
        ],
      },
      { h3: "Colour and text" },
      {
        ul: [
          "Body text has a contrast ratio of at least 4.5:1 against its background, and large text at least 3:1.",
          "Colour isn't the only way information is shown. For example, error fields have a message, not just a red border.",
          "Text can be zoomed to 200% without breaking the layout.",
        ],
      },
      { h3: "Structure" },
      {
        ul: [
          "Each page has one H1, and headings follow a logical order without skipping levels.",
          "The page language is set (for example lang=\"en\").",
          "Link text makes sense on its own. Avoid \"click here\" and \"read more\" without context.",
        ],
      },
      { h3: "Forms and interaction" },
      {
        ul: [
          "Every form field has a visible label linked to it. Placeholder text isn't a label. See [fixing form labels](/fix/form-labels).",
          "Everything can be reached and used with the keyboard alone, using Tab, Enter and Space.",
          "A visible focus outline shows where you are on the page.",
          "Buttons and icons have accessible names.",
          "Error messages explain what went wrong and how to fix it.",
        ],
      },
      { h2: "How to test your website for accessibility" },
      {
        ol: [
          "Run an automated accessibility checker. It catches missing alt text, low contrast, missing labels and structural issues across many pages quickly.",
          "Unplug your mouse and try to complete your most important task, such as a purchase or enquiry, using only the keyboard.",
          "Turn on a screen reader (VoiceOver on Mac or iPhone, NVDA on Windows, TalkBack on Android) and listen to your homepage.",
          "Zoom the browser to 200% and check nothing overlaps or disappears.",
        ],
      },
      {
        p: "Automated tools typically detect only a portion of WCAG issues, so treat them as the first pass, not a certificate of compliance. Beware of \"accessibility overlay\" widgets that promise instant compliance: they don't fix the underlying code and are frequently named in lawsuits.",
      },
      { h2: "Does accessibility help SEO?" },
      {
        p: "Yes. Many accessibility fixes are also SEO fixes: descriptive alt text helps image search, clear heading structure helps search engines and AI tools understand your content, and meaningful link text improves internal linking signals.",
      },
      {
        tip: "Pagelyt's Accessibility Intelligence check runs Google Lighthouse accessibility audits plus its own WCAG-oriented checks, and explains each issue in plain English with how to fix it.",
      },
    ],
    faq: [
      [
        "How do I check if my website is accessible?",
        "Start with an automated website accessibility checker to find issues like missing alt text, low colour contrast and unlabelled form fields. Then test manually with the keyboard only and with a screen reader, since automated tools can't catch everything.",
      ],
      [
        "What is WCAG 2.2 AA?",
        "WCAG 2.2 is the latest version of the Web Content Accessibility Guidelines, published by the W3C in 2023. Level AA is the middle conformance level and the one most laws and policies require.",
      ],
      [
        "Do accessibility overlays make my website compliant?",
        "No. Overlay widgets don't fix the underlying code and can interfere with assistive technology. Accessibility experts and many disabled users recommend fixing the site itself instead.",
      ],
      [
        "What is a good colour contrast ratio?",
        "WCAG AA requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text (about 24px, or 19px bold) and for user interface components.",
      ],
      [
        "Does my small business website need to be accessible?",
        "In many countries, yes, especially if you sell to consumers online. Beyond legal risk, accessible sites reach more customers and are easier for everyone to use.",
      ],
    ],
    related: ["website-security-checklist", "free-website-audit-what-to-check"],
  },

  {
    slug: "free-website-audit-what-to-check",
    tag: "Guides",
    title: "Free Website Audit: What to Check and How to Prioritise Fixes",
    description:
      "How to audit a website for free: what a complete website audit covers (speed, SEO, AI search, security, accessibility, uptime) and how to decide which fixes to do first.",
    h1: "How to audit your website for free, and what to fix first.",
    lead: "A website audit is a health check-up for your site. Here's what a complete one covers, how long it takes and how to turn a long list of findings into a short plan.",
    keywords: [
      "free website audit",
      "website audit checklist",
      "how to audit a website",
      "website health check",
      "website analysis tool",
      "check my website",
      "website checker",
    ],
    body: [
      { h2: "What is a website audit?" },
      {
        p: "A website audit is a structured review of how well your website works for visitors, search engines and AI tools. A good audit doesn't just list problems. It tells you which ones matter, why, and what to do about them.",
      },
      { h2: "What should a website audit include?" },
      {
        p: "Many tools only check one area. A complete audit covers six:",
      },
      {
        ol: [
          "**Website health:** is the site up, does it respond quickly, is the SSL certificate valid, and are there broken pages or redirect chains?",
          "**Performance:** Core Web Vitals, page weight, image sizes and render-blocking scripts. See [Core Web Vitals explained](/blog/core-web-vitals-explained).",
          "**SEO:** titles, meta descriptions, headings, sitemap, robots.txt, canonical tags and structured data. See the [technical SEO checklist](/blog/technical-seo-checklist).",
          "**GEO (AI search readiness):** can AI crawlers access the site, is there an llms.txt file, and is content easy to quote? See [what is GEO](/blog/what-is-geo-generative-engine-optimisation).",
          "**Security:** HTTPS, security headers, exposed software versions, and SPF and DMARC for email. See the [website security checklist](/blog/website-security-checklist).",
          "**Accessibility:** alt text, colour contrast, form labels and keyboard access. See [how to check accessibility](/blog/website-accessibility-checklist).",
        ],
      },
      { h2: "How to prioritise website fixes" },
      {
        p: "A first audit can produce dozens of findings. Don't try to fix them in the order they're listed. Score each one on two things, impact and effort, and work in this order:",
      },
      {
        ol: [
          "**Critical and quick:** site-breaking problems you can fix in minutes, such as an expiring certificate, a robots.txt that blocks Google or a missing title tag.",
          "**High impact, moderate effort:** compressing large images, adding structured data, fixing broken links.",
          "**Quick wins with smaller impact:** security headers, Open Graph tags, alt text.",
          "**Larger projects:** theme rebuilds, hosting migrations or major accessibility rework. Plan these deliberately.",
        ],
      },
      {
        tip: "Pagelyt does this sorting for you: every finding gets an impact and effort rating, and the dashboard puts the highest-value fixes at the top.",
      },
      { h2: "How long does a website audit take?" },
      {
        p: "An automated audit takes a few minutes. A manual audit by a consultant can take days. The practical approach is to run an automated audit first to find the obvious issues, then spend human time on the judgement calls such as content quality, messaging and user journeys.",
      },
      { h2: "How often should I audit my website?" },
      {
        p: "Run a full audit at least quarterly, and immediately after a redesign, platform migration or major plugin update. Between audits, ongoing monitoring catches problems like downtime, an expiring SSL certificate or a sudden speed drop before your visitors do.",
      },
      { h2: "Free vs paid website audit tools" },
      {
        p: "Free tools are good enough to find and fix the most common problems on most small business websites. Paid tools add scheduled monitoring, multiple sites, history over time, competitor comparisons and white-label reports, which matter more for growing businesses and agencies.",
      },
      {
        p: "Ready to see where your site stands? [Run a free website audit](/) and get a prioritised list of fixes in a few minutes.",
      },
    ],
    faq: [
      [
        "How do I audit my website for free?",
        "Enter your URL into a free website audit tool such as Pagelyt. It checks health, speed, SEO, AI search readiness, security and accessibility, and gives you a prioritised list of fixes.",
      ],
      [
        "What is the difference between an SEO audit and a website audit?",
        "An SEO audit focuses on search rankings: crawling, indexing and on-page tags. A full website audit also covers performance, security, accessibility, uptime and AI search readiness.",
      ],
      [
        "How often should a website be audited?",
        "At least every three months, and after any redesign, migration or major update. Continuous monitoring is recommended for business-critical sites.",
      ],
      [
        "Which website issues should I fix first?",
        "Fix critical issues that are quick to resolve first, such as an expiring SSL certificate or pages blocked from search engines. Then move to high-impact fixes like image compression and broken links.",
      ],
      [
        "Can I audit a competitor's website?",
        "Yes. Public checks like speed, SEO tags, security headers and accessibility can be run on any public website, which makes competitor comparisons a useful way to find opportunities.",
      ],
    ],
    related: ["technical-seo-checklist", "why-is-my-website-slow"],
  },
];

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

const words = (b: Block) =>
  ("p" in b ? b.p : "tip" in b ? b.tip : "h2" in b ? b.h2 : "h3" in b ? b.h3 : ("ul" in b ? b.ul : b.ol).join(" "))
    .split(/\s+/).length;

export const readMins = (p: Post) =>
  Math.max(1, Math.round((p.body.reduce((n, b) => n + words(b), 0) + p.faq.flat().join(" ").split(/\s+/).length) / 220));
