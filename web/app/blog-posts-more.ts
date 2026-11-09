// Second batch of blog posts. Same format as POSTS in blog-data.ts, which appends these.
import type { Post } from "./blog-data";

export const MORE_POSTS: Post[] = [
  {
    slug: "why-is-my-website-not-showing-on-google",
    tag: "SEO",
    title: "Why Is My Website Not Showing on Google? Causes and Fixes",
    description:
      "Website not showing up on Google? Learn how to check if your site is indexed, what 'Crawled, currently not indexed' means, and how to fix the most common causes.",
    h1: "Why isn't my website showing up on Google?",
    lead: "You search for your business and your site isn't there. The cause is almost always one of a handful of fixable problems. Here's how to find which one.",
    keywords: [
      "website not showing on Google",
      "why is my website not on Google",
      "how to get my website on Google",
      "crawled currently not indexed",
      "discovered currently not indexed",
      "check if my site is indexed",
      "Google Search Console indexing",
    ],
    body: [
      { h2: "First, check whether Google has indexed your site" },
      {
        p: "Search Google for **site:yourdomain.com**. If nothing comes back, Google hasn't indexed any of your pages. If some pages appear but not the one you want, the problem is with that page, not the whole site.",
      },
      {
        p: "For a definitive answer, use the **URL Inspection** tool in Google Search Console. It tells you whether a URL is on Google, when Googlebot last crawled it and, if it isn't indexed, the reason why.",
      },
      {
        tip: "The site: search is a quick estimate, not an exact count. Use Search Console for anything you need to rely on.",
      },
      { h2: "Is your website brand new?" },
      {
        p: "A new site usually takes a few days to a few weeks to appear, and Google doesn't promise a timeline. You can speed it up by adding the site to Search Console, submitting your XML sitemap and linking to it from places Google already crawls, such as your social profiles or a business directory listing.",
      },
      { h2: "Technical reasons Google can't index your site" },
      {
        ol: [
          "**robots.txt blocks Googlebot.** A single **Disallow: /** line stops Google crawling everything. This often happens when a site moves from a staging server to live and the staging rules come with it.",
          "**A noindex tag.** Many website builders have a 'discourage search engines' or 'hide from search' setting. In WordPress it's under Settings, Reading. Leave it on and Google is told not to index your pages.",
          "**The wrong canonical tag.** If a page's canonical tag points to a different URL, Google indexes that other URL instead. See [how to fix canonical tags](/fix/no-canonical).",
          "**No XML sitemap.** A sitemap tells Google which pages exist. Without one, pages that aren't well linked can be missed. See [how to add a sitemap](/fix/no-sitemap).",
          "**Server errors or a slow server.** If your server returns errors or takes seconds to respond, Google crawls less. See [fixing slow server response](/fix/slow-response).",
          "**Orphan pages.** Pages that no other page links to are hard for Google to find and look unimportant when it does.",
          "**Content hidden behind logins or scripts.** Google can't index what it can't see. Content that only loads after a click, or sits behind a login, may never be indexed.",
        ],
      },
      { h2: "What does 'Discovered, currently not indexed' mean?" },
      {
        p: "Google knows the URL exists, usually from your sitemap or a link, but hasn't crawled it yet. Often Google decided the page wasn't a priority, or held back because crawling more would have overloaded your server.",
      },
      {
        p: "**How to fix it:** link to the page from your important pages and menu, make sure your server responds quickly, and keep your sitemap limited to pages you actually want in Google.",
      },
      { h2: "What does 'Crawled, currently not indexed' mean?" },
      {
        p: "Google fetched the page and chose not to add it to the index, at least for now. This is usually a judgement about quality or duplication, not a technical error. Thin pages, near-duplicate pages (tag archives, filtered product lists, location pages that only swap the town name) and pages that add nothing new are common causes.",
      },
      {
        p: "**How to fix it:** improve or merge thin pages, make sure each page answers something specific that other pages on your site don't, and strengthen internal links. Asking Google to index the page again without changing it rarely helps.",
      },
      { h2: "Your site is indexed but doesn't rank" },
      {
        p: "Being indexed and ranking are different things. Search for your exact business name first. If you don't appear even for that, it's an indexing problem or a very new site. If you appear for your name but not for searches like 'plumber in Leeds', it's a ranking problem.",
      },
      {
        ul: [
          "Give every page a unique title tag that contains the phrase people search for. See [how to write title tags](/blog/meta-title-and-description-guide).",
          "Create a dedicated page for each service and each area you serve, rather than listing everything on one page.",
          "For local searches, set up and complete a Google Business Profile.",
          "Earn links from local directories, suppliers, partners and press. Links are still one of the strongest signals Google uses.",
        ],
      },
      { h2: "Did your site suddenly disappear from Google?" },
      {
        p: "If you used to rank and now don't, look at what changed recently. The usual suspects are a redesign or migration that added a noindex tag or changed URLs without redirects, a robots.txt change, an expired domain or SSL certificate, a manual action (check the Manual actions report in Search Console) or a Google core update that re-evaluated your content.",
      },
      { h2: "How to get your website on Google, step by step" },
      {
        ol: [
          "Verify your site in Google Search Console.",
          "Submit your XML sitemap in the Sitemaps report.",
          "Check robots.txt and remove any noindex tag from pages you want found.",
          "Inspect your home page URL and click Request indexing.",
          "Link to your key pages from the home page and main menu.",
          "Create a Google Business Profile if you serve customers in a local area.",
        ],
      },
      {
        p: "Not sure which of these applies to you? [Run a free website audit](/). Pagelyt checks robots.txt, noindex tags, canonical tags, your sitemap and server response time in one scan.",
      },
    ],
    faq: [
      [
        "How long does it take for a new website to show up on Google?",
        "Usually a few days to a few weeks. Submitting a sitemap in Google Search Console and linking to the site from existing profiles can speed it up, but Google doesn't guarantee a timeline.",
      ],
      [
        "Why does my website show on Bing but not on Google?",
        "Each search engine crawls and indexes on its own. Check Google Search Console for Google-specific problems such as crawl errors, a manual action or pages Google chose not to index.",
      ],
      [
        "Does paying for Google Ads help my website get indexed?",
        "No. Google Ads and organic search are separate. Advertising doesn't affect whether your pages are indexed or how they rank.",
      ],
      [
        "How do I ask Google to index my website?",
        "In Google Search Console, paste the URL into URL Inspection and click Request indexing. That's fine for a few key pages. For a whole site, submit an XML sitemap instead.",
      ],
      [
        "Why are my pages 'Crawled, currently not indexed'?",
        "Google fetched them but decided they weren't worth indexing yet, usually because they're thin, very similar to other pages or add little new information. Improving or merging those pages is the fix.",
      ],
    ],
    related: ["technical-seo-checklist", "meta-title-and-description-guide"],
  },

  {
    slug: "how-to-get-cited-in-google-ai-overviews",
    tag: "GEO",
    title: "How to Appear in Google AI Overviews and AI Mode",
    description:
      "How do Google AI Overviews choose their sources? Learn what makes a page eligible, how to structure content so it gets cited, and how to track your AI Overview visibility.",
    h1: "How to get your website cited in Google AI Overviews.",
    lead: "AI Overviews and AI Mode answer the question at the top of Google and link to a handful of sources. Here's what decides which pages earn those links.",
    keywords: [
      "how to appear in Google AI Overviews",
      "Google AI Overviews SEO",
      "AI Mode SEO",
      "get cited in AI Overviews",
      "AI Overview ranking factors",
      "does schema help AI Overviews",
      "opt out of AI Overviews",
    ],
    body: [
      { h2: "What are AI Overviews and AI Mode?" },
      {
        p: "**AI Overviews** are AI-written summaries that appear above the regular results for many searches, with links to the pages they draw from. **AI Mode** is a separate, conversational search experience that handles follow-up questions and also cites sources. Both are built on Google's normal search index.",
      },
      { h2: "What makes a page eligible to appear?" },
      {
        p: "Google says there are no extra technical requirements beyond normal Search. A page needs to be indexed and eligible to show in results with a snippet. You don't need special AI markup, an AI-specific file or a particular schema type. The entry ticket is ordinary SEO:",
      },
      {
        ul: [
          "Googlebot can crawl the page, so it isn't blocked in robots.txt.",
          "The page is indexed. Check it with URL Inspection in Search Console.",
          "The page is allowed to show a snippet, so it doesn't use nosnippet or a very small max-snippet value.",
        ],
      },
      {
        tip: "Blocking Google-Extended in robots.txt does not remove you from AI Overviews. Google-Extended controls whether your content is used for Gemini models outside Search, not whether Google Search shows it.",
      },
      { h2: "How does Google choose which sources to cite?" },
      {
        p: "Google hasn't published a formula. AI Overviews pull specific passages that answer the question, so a page doesn't have to rank first overall to be cited. A clear passage on a page further down the results can still be picked. Strong rankings help, but they aren't the whole story.",
      },
      {
        p: "Across industry studies and Google's own guidance, the same qualities keep coming up:",
      },
      {
        ul: [
          "**A direct answer** in the first sentence or two under a heading that matches the question.",
          "**Specific facts:** numbers, steps, names, prices, conditions and exceptions, not vague generalities.",
          "**Original information:** your own data, examples and experience, rather than a rewrite of what already ranks.",
          "**Clear authorship** and signs that the writer knows the subject, which Google calls E-E-A-T (experience, expertise, authoritativeness and trust).",
          "**Up-to-date content** for topics that change, with old figures and screenshots refreshed.",
        ],
      },
      { h2: "How to structure content for AI Overviews" },
      {
        ol: [
          "Use headings that ask the questions your customers ask, such as 'How long does a boiler service take?'",
          "Answer in two or three plain sentences straight after the heading, then go into detail.",
          "Use numbered lists for steps and tables for comparisons, prices and specifications.",
          "Keep one idea per section, so each passage makes sense if it's quoted on its own.",
          "Add structured data that describes the page truthfully. See [how to add structured data](/fix/no-structured-data) and our [schema markup guide](/blog/schema-markup-guide).",
        ],
      },
      { h2: "Does structured data help with AI Overviews?" },
      {
        p: "Google says no special schema is needed to appear in AI features. Structured data still helps Google understand what your page is about and who's behind it, such as your business, products and authors, which supports everything else. Treat it as good housekeeping, not a shortcut.",
      },
      { h2: "How to track your AI Overview visibility" },
      {
        p: "At the time of writing, Search Console counts clicks and impressions from AI features inside its normal web search totals, so you can't cleanly separate them. A practical approach is to:",
      },
      {
        ul: [
          "Watch for queries where impressions rise but clicks fall, which often means an AI Overview is answering the question.",
          "Run your most important searches yourself and note whether you're cited.",
          "Track how AI assistants talk about your brand. Pagelyt's AI visibility check asks AI assistants about your business and records whether you're mentioned.",
        ],
      },
      { h2: "Can I stop my site appearing in AI Overviews?" },
      {
        p: "Only with the same controls that limit normal snippets: the nosnippet rule, data-nosnippet on specific sections or a max-snippet limit. These also shrink your regular search listing, so for most businesses the cost is higher than the benefit.",
      },
      {
        p: "Want to know if your site is ready for AI search? [Run a free audit](/) to check crawlability, structured data and AI crawler access in one go.",
      },
    ],
    faq: [
      [
        "Do I need to rank number one to appear in an AI Overview?",
        "No. AI Overviews cite passages that answer the question well, and these can come from pages that rank lower down. Ranking well still improves your chances.",
      ],
      [
        "Do AI Overviews reduce clicks to websites?",
        "Many publishers report fewer clicks on searches that show an AI Overview, especially simple factual ones. The clicks that remain tend to come from people who want more depth, which favours detailed, original pages.",
      ],
      [
        "Does llms.txt help with Google AI Overviews?",
        "Google has said it doesn't use llms.txt for Search or AI Overviews. It may still be useful for other AI tools. See our guide to what llms.txt is.",
      ],
      [
        "How long does it take to show up in AI Overviews?",
        "There's no set time. Once a page is indexed and Google has recrawled your changes, it becomes eligible straight away. Whether it's cited depends on the query and the competing pages.",
      ],
      [
        "Is optimising for AI Overviews different from SEO?",
        "Mostly no. Google says the same SEO best practices apply. The main difference is in how you write: clearer, more direct answers that work as standalone passages.",
      ],
    ],
    related: ["what-is-geo-generative-engine-optimisation", "what-is-llms-txt"],
  },

  {
    slug: "robots-txt-for-ai-crawlers",
    tag: "GEO",
    title: "Robots.txt for AI Crawlers: Allow or Block GPTBot, ClaudeBot and More",
    description:
      "Which AI crawlers should you allow in robots.txt? A plain-English guide to GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot and Google-Extended, with copy-paste examples.",
    h1: "Robots.txt for AI crawlers: what to allow and what to block.",
    lead: "AI companies send different bots to train models and to answer questions. Block the wrong one and you can disappear from AI search without meaning to.",
    keywords: [
      "robots.txt AI crawlers",
      "block GPTBot",
      "allow GPTBot",
      "ClaudeBot robots.txt",
      "Google-Extended",
      "block AI bots",
      "OAI-SearchBot",
    ],
    body: [
      { h2: "What is robots.txt?" },
      {
        p: "robots.txt is a plain text file at the root of your website, for example yourdomain.com/robots.txt. It tells crawlers which parts of your site they may visit. Each group of rules starts with a **User-agent** line naming the crawler, followed by **Allow** and **Disallow** lines.",
      },
      {
        p: "It's a polite request, not a lock. Reputable crawlers follow it. Badly behaved scrapers ignore it, so anything truly private belongs behind a login.",
      },
      { h2: "The main AI crawlers and what they do" },
      {
        p: "Most big AI companies now run separate bots for **training** their models and for **search**, meaning fetching pages to answer a user's question with a citation. That split is what makes a sensible policy possible.",
      },
      {
        ul: [
          "**GPTBot (OpenAI):** collects content that may be used to train OpenAI's models.",
          "**OAI-SearchBot (OpenAI):** finds pages for ChatGPT search results. Block it and you're unlikely to be cited there.",
          "**ChatGPT-User (OpenAI):** fetches a page when someone asks ChatGPT to look at it.",
          "**ClaudeBot (Anthropic):** collects content that may be used to train Claude models.",
          "**Claude-SearchBot and Claude-User (Anthropic):** search indexing and pages fetched at a user's request.",
          "**PerplexityBot and Perplexity-User:** Perplexity's search index and user-requested fetches.",
          "**Google-Extended:** not a separate crawler but a robots.txt token. It controls whether Google may use your content for Gemini models. It does not affect Google Search or AI Overviews.",
          "**Applebot-Extended:** a similar token for Apple's AI training.",
          "**CCBot (Common Crawl):** builds an open web archive that many AI models are trained on.",
        ],
      },
      {
        tip: "Crawler names change and new ones appear. Check each company's own crawler documentation before you rely on any list, including this one.",
      },
      { h2: "Should I block AI crawlers?" },
      {
        p: "It depends on what you want from AI tools:",
      },
      {
        ul: [
          "**You want AI assistants to recommend you** (most businesses): allow the search and user bots. Allowing training bots is your choice, and it may help AI models know your brand.",
          "**You publish original content and don't want it used for training:** block the training bots but keep the search bots, so you can still be cited.",
          "**Private or paid content:** don't rely on robots.txt at all. Put it behind a login.",
        ],
      },
      { h2: "Example: allow all AI search, block training" },
      {
        code: "# Search and user-requested fetches: allowed\nUser-agent: OAI-SearchBot\nUser-agent: ChatGPT-User\nUser-agent: Claude-SearchBot\nUser-agent: Claude-User\nUser-agent: PerplexityBot\nUser-agent: Perplexity-User\nAllow: /\n\n# Model training: blocked\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nUser-agent: Google-Extended\nUser-agent: Applebot-Extended\nUser-agent: CCBot\nDisallow: /\n\n# Everyone else, including Googlebot\nUser-agent: *\nAllow: /\n\nSitemap: https://yourdomain.com/sitemap.xml",
      },
      { h2: "Example: welcome every AI crawler" },
      {
        p: "If you want maximum visibility, you don't need AI-specific rules at all. A site with no rules that block them is open to every crawler. The simplest version is:",
      },
      {
        code: "User-agent: *\nAllow: /\n\nSitemap: https://yourdomain.com/sitemap.xml",
      },
      { h2: "How to check you're not blocking AI crawlers by accident" },
      {
        p: "Many sites block AI bots without anyone deciding to. Common causes are security plugins, a CDN or hosting setting that blocks AI bots with one click, and old robots.txt rules copied from a template. Check three places:",
      },
      {
        ol: [
          "Open yourdomain.com/robots.txt and read every User-agent group.",
          "Look at your CDN or firewall settings for bot-blocking or AI-blocking options.",
          "Check your server logs for AI bot visits that get a 403 (forbidden) response.",
        ],
      },
      {
        p: "Pagelyt's GEO check reads your robots.txt and flags AI crawlers that are blocked. See [how to unblock AI crawlers](/fix/ai-blocked), or [run a free scan](/) to check yours now.",
      },
    ],
    faq: [
      [
        "Does blocking GPTBot remove my site from ChatGPT?",
        "Blocking GPTBot stops your content being collected for training. ChatGPT search uses a different bot, OAI-SearchBot, so allow that one if you want to be cited in ChatGPT search.",
      ],
      [
        "Does blocking Google-Extended affect my Google rankings?",
        "No. Google-Extended only controls whether your content is used for Gemini models. It has no effect on Google Search rankings or on AI Overviews.",
      ],
      [
        "Do AI crawlers respect robots.txt?",
        "The major AI companies say their automated crawlers follow robots.txt. User-triggered fetches may be treated differently, and some lesser-known scrapers ignore it, so use firewall rules if you need a hard block.",
      ],
      [
        "Where does the robots.txt file go?",
        "At the root of each host, for example yourdomain.com/robots.txt. Subdomains such as shop.yourdomain.com need their own file.",
      ],
      [
        "Can robots.txt remove a page from Google?",
        "No. Blocking crawling doesn't remove a page that's already indexed. Use a noindex tag instead, and leave the page crawlable so Google can see the tag.",
      ],
    ],
    related: ["what-is-llms-txt", "how-to-get-cited-in-google-ai-overviews"],
  },

  {
    slug: "what-is-llms-txt",
    tag: "GEO",
    title: "What Is llms.txt? Example, Format and Whether You Need One",
    description:
      "What is an llms.txt file, what does it look like and does it actually help with AI search? An honest guide with an example, a step-by-step setup and what Google has said.",
    h1: "What is llms.txt, and does your website need one?",
    lead: "llms.txt is a short Markdown file that points AI tools to your most useful pages. Here's how it works, how to write one and what it can and can't do.",
    keywords: [
      "what is llms.txt",
      "llms.txt example",
      "how to create llms.txt",
      "llms.txt generator",
      "llms-full.txt",
      "does Google use llms.txt",
      "llms.txt SEO",
    ],
    body: [
      { h2: "What is llms.txt?" },
      {
        p: "llms.txt is a proposed standard, first suggested in 2024, for a Markdown file at **yourdomain.com/llms.txt**. It gives large language models a short summary of your website and a curated list of links to your most useful pages, in a format that's much easier for a machine to read than a full web page with menus, scripts and adverts.",
      },
      {
        p: "Think of it as a hand-written map of your site for AI tools, where a sitemap is a complete list of every URL.",
      },
      { h2: "What does an llms.txt file look like?" },
      {
        p: "The format is simple Markdown: your site's name as a heading, a one-line summary in a quote, then sections of links with a short description of each.",
      },
      {
        code: "# Acme Plumbing\n\n> Emergency and planned plumbing for homes and small businesses in Leeds, with 24/7 call-outs.\n\n## Services\n- [Boiler repair](https://acme.example/boiler-repair): Same-day boiler repairs and servicing\n- [Emergency plumber](https://acme.example/emergency): 24/7 call-outs, typical arrival times and prices\n\n## Help\n- [Prices](https://acme.example/prices): Call-out fees and hourly rates\n- [FAQs](https://acme.example/faq): Guarantees, payment and booking questions\n\n## Optional\n- [About us](https://acme.example/about): Team, history and accreditations",
      },
      {
        p: "A section called **Optional** marks links an AI tool can skip if it needs to keep things short.",
      },
      { h2: "llms.txt vs robots.txt vs sitemap.xml" },
      {
        ul: [
          "**robots.txt** says which crawlers may visit which parts of your site. It's about access.",
          "**sitemap.xml** lists every URL you want search engines to find. It's about completeness.",
          "**llms.txt** summarises your site and highlights the pages that matter most. It's about understanding.",
        ],
      },
      { h2: "Does llms.txt actually work?" },
      {
        p: "Here's the honest answer. Google has said it doesn't use llms.txt for Search or for AI Overviews, and that the file won't help or hurt your rankings. Adoption studies suggest only around one in ten websites has one. No major AI search engine has confirmed it uses the file when choosing which sources to cite.",
      },
      {
        p: "Where it does help today is with AI tools and agents that are pointed at a site directly, such as coding assistants reading developer documentation, and tools that specifically look for the file. It's a small, low-risk bet on where AI browsing is heading.",
      },
      {
        tip: "Do the basics first. Letting AI crawlers in, writing clear answers and adding structured data matter far more than llms.txt.",
      },
      { h2: "How to create an llms.txt file" },
      {
        ol: [
          "Write a one-line summary of what your business does, for whom and where.",
          "Pick the 5 to 20 pages that answer the questions customers ask most: services, prices, FAQs, policies.",
          "Give each link a short, plain-English description.",
          "Save it as llms.txt and upload it to the root of your site so it loads at yourdomain.com/llms.txt.",
          "Update it when you add or remove important pages.",
        ],
      },
      {
        p: "If you don't want the file itself showing up in search results, you can send an X-Robots-Tag: noindex header for it. See our [llms.txt fix guide](/fix/no-llms) for platform-specific steps.",
      },
      { h2: "What is llms-full.txt?" },
      {
        p: "llms-full.txt is an optional companion file that contains the full text of your key pages in one Markdown document, so an AI tool can read everything in one request. It's mostly used by documentation sites. Most small business websites don't need one.",
      },
      {
        p: "Pagelyt checks whether your site has an llms.txt file as part of its GEO score. [Run a free scan](/) to see where you stand.",
      },
    ],
    faq: [
      [
        "Is llms.txt an official standard?",
        "No. It's a community proposal, not a standard from a body like the W3C or IETF. Support depends on each AI tool choosing to read it.",
      ],
      [
        "Does Google use llms.txt?",
        "Google has said it doesn't use llms.txt for Google Search or AI Overviews, and that having one won't help or hurt your rankings.",
      ],
      [
        "Will adding llms.txt hurt my SEO?",
        "No. It's a separate file that search engines don't use for ranking. The only cost is the time it takes to write and maintain.",
      ],
      [
        "Where should I put my llms.txt file?",
        "At the root of your domain, so it loads at yourdomain.com/llms.txt, the same place as robots.txt.",
      ],
      [
        "Can llms.txt stop AI using my content?",
        "No. llms.txt is a guide, not access control. To control which AI crawlers can visit your site, use robots.txt or firewall rules.",
      ],
    ],
    related: ["robots-txt-for-ai-crawlers", "what-is-geo-generative-engine-optimisation"],
  },

  {
    slug: "schema-markup-guide",
    tag: "SEO",
    title: "Schema Markup Explained: A Beginner's Guide to Structured Data",
    description:
      "What is schema markup and how do you add it? A beginner's guide to structured data and JSON-LD, which schema types to use, what happened to FAQ rich results and how to test it.",
    h1: "Schema markup explained: a beginner's guide to structured data.",
    lead: "Schema markup is a small block of code that tells search engines and AI tools exactly what your page is about. Here's what to add and how.",
    keywords: [
      "what is schema markup",
      "structured data SEO",
      "JSON-LD",
      "schema markup generator",
      "local business schema",
      "FAQ schema",
      "rich results",
    ],
    body: [
      { h2: "What is schema markup?" },
      {
        p: "Schema markup, also called structured data, is code that describes your page in a vocabulary search engines agree on, published at schema.org. Instead of Google guessing that '4.8' next to some stars is a rating, your markup says so explicitly: this is a product, this is its price, this is its average rating from 212 reviews.",
      },
      { h2: "Why does schema markup matter?" },
      {
        ul: [
          "**Rich results:** it can make your listing eligible for extras like review stars, prices, breadcrumbs and event dates, which stand out and can earn more clicks.",
          "**Understanding:** it helps Google connect your pages to real things, such as your business, its address, your products and your authors.",
          "**AI search:** AI tools can read the same markup, which makes facts about your business easier to extract correctly.",
        ],
      },
      { h2: "JSON-LD, Microdata or RDFa?" },
      {
        p: "There are three ways to write structured data. Use **JSON-LD**. Google recommends it, it sits in one script block instead of being woven through your HTML, and it's the easiest to add and maintain.",
      },
      { h2: "A JSON-LD example for a local business" },
      {
        code: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Plumber",\n  "name": "Acme Plumbing",\n  "url": "https://acme.example",\n  "telephone": "+44 113 000 0000",\n  "address": {\n    "@type": "PostalAddress",\n    "streetAddress": "12 High Street",\n    "addressLocality": "Leeds",\n    "postalCode": "LS1 1AA",\n    "addressCountry": "GB"\n  },\n  "openingHours": "Mo-Su 00:00-23:59"\n}\n</script>',
      },
      {
        p: "Plumber is a more specific type of LocalBusiness. Always pick the most specific type that's accurate.",
      },
      { h2: "Which schema types should you use?" },
      {
        ul: [
          "**Organization** on your home page: name, logo, social profiles and contact details.",
          "**LocalBusiness** (or a more specific type) if customers visit you or you serve an area.",
          "**Product** with Offer and AggregateRating for things you sell.",
          "**Article** or BlogPosting for blog posts and news, including the author.",
          "**BreadcrumbList** to show your site structure in search results.",
          "**Event**, Recipe, VideoObject and JobPosting where they genuinely apply.",
        ],
      },
      { h2: "What happened to FAQ rich results?" },
      {
        p: "Google has steadily cut back FAQ rich results, the expandable questions that used to appear under a listing. In 2023 it limited them to a small set of authoritative government and health websites, and in 2026 it stopped showing them altogether. HowTo rich results were removed in 2023.",
      },
      {
        p: "FAQPage markup itself isn't invalid. Google has said it can still use it to understand a page, and other search engines and AI tools can read it too. If your page genuinely has a questions-and-answers section, keeping the markup is fine. Just don't add it expecting extra space in Google's results.",
      },
      { h2: "How to add schema markup" },
      {
        ol: [
          "**Use your platform.** SEO plugins for WordPress, and built-in settings on Shopify, Wix and Squarespace, add common types for you.",
          "**Use a generator** for anything extra, then paste the JSON-LD into your page's head or body.",
          "**Write it by hand** if you're comfortable with code. It's just JSON.",
        ],
      },
      {
        p: "Then test it. Google's **Rich Results Test** shows which rich results a page is eligible for, and the **Schema Markup Validator** at validator.schema.org checks any schema.org type. See our [structured data fix guide](/fix/no-structured-data) for more detail.",
      },
      { h2: "Common schema markup mistakes" },
      {
        ul: [
          "Marking up content that isn't visible on the page, such as reviews or FAQs that only exist in the code.",
          "Self-written or fake reviews in AggregateRating. Google can issue a manual action for this.",
          "Choosing the wrong type, or leaving out required properties such as a product's price.",
          "Several conflicting Organization blocks added by different plugins.",
          "Letting it go stale, such as old prices, opening hours or event dates.",
        ],
      },
      {
        p: "Pagelyt checks every page it scans for structured data. [Run a free audit](/) to see what your site is missing.",
      },
    ],
    faq: [
      [
        "Does schema markup improve rankings?",
        "Not directly. Google says structured data isn't a general ranking factor. It helps Google understand your page and can make you eligible for rich results, which can improve click-through rate.",
      ],
      [
        "What is the difference between schema markup and structured data?",
        "In everyday use they mean the same thing. Structured data is the general idea of machine-readable information, and schema.org is the vocabulary most websites use to write it.",
      ],
      [
        "Where do I put JSON-LD on my page?",
        "Anywhere in the HTML, usually in the head. Google reads JSON-LD in the head or body, including when it's added by JavaScript.",
      ],
      [
        "Should I still use FAQ schema?",
        "Use it only where the page genuinely has a visible questions-and-answers section. Google no longer shows FAQ rich results, but the markup can still help search engines and AI tools understand the page.",
      ],
      [
        "How long does it take for rich results to appear?",
        "After Google recrawls the page, often within days to a few weeks. Valid markup makes a page eligible, but Google doesn't guarantee to show rich results.",
      ],
    ],
    related: ["technical-seo-checklist", "how-to-get-cited-in-google-ai-overviews"],
  },

  {
    slug: "pagespeed-insights-score-explained",
    tag: "Speed",
    title: "PageSpeed Insights Score Explained: What Is Good and Why It Changes",
    description:
      "What is a good PageSpeed Insights score, why does it change every time you test, and why is mobile so much lower than desktop? Lab vs field data explained in plain English.",
    h1: "PageSpeed Insights explained: what is a good score, and why does it keep changing?",
    lead: "You run PageSpeed Insights twice and get two different scores, and mobile is always worse. Here's what the numbers actually mean and which ones matter.",
    keywords: [
      "PageSpeed Insights score",
      "what is a good PageSpeed score",
      "why does my PageSpeed score change",
      "lab data vs field data",
      "Lighthouse performance score",
      "improve PageSpeed score mobile",
      "Core Web Vitals assessment failed",
    ],
    body: [
      { h2: "What is PageSpeed Insights?" },
      {
        p: "PageSpeed Insights is Google's free tool for measuring how fast a page loads. It shows two very different kinds of data on one screen, and mixing them up causes most of the confusion:",
      },
      {
        ul: [
          "**Field data** (the top section) comes from real Chrome users who visited your site over the last 28 days, through the Chrome User Experience Report. This is what Google uses for Core Web Vitals in search.",
          "**Lab data** (the score out of 100) comes from Lighthouse running one simulated test, right now, on an emulated mid-range phone with a throttled connection.",
        ],
      },
      { h2: "What is a good PageSpeed Insights score?" },
      {
        ul: [
          "**90 to 100:** good (green).",
          "**50 to 89:** needs improvement (orange).",
          "**0 to 49:** poor (red).",
        ],
      },
      {
        p: "But the score out of 100 is a lab number. Google's ranking signal uses your **field** Core Web Vitals, not the Lighthouse score. A site can score 65 in the lab and still pass Core Web Vitals for real users.",
      },
      { h2: "Why does my PageSpeed score change every time I test?" },
      {
        p: "Each lab test is a fresh run, and lots of things vary between runs:",
      },
      {
        ul: [
          "How quickly your server responds at that moment.",
          "Third-party scripts, adverts and chat widgets that load differently each time.",
          "Whether your CDN cache was warm or cold.",
          "Load on Google's own test machines.",
          "Updates to Lighthouse, which can shift scores across the board overnight.",
        ],
      },
      {
        p: "A swing of a few points either way is normal. Run the test three to five times and use the middle result, and compare before and after with the same tool and settings.",
      },
      { h2: "Why is my mobile score so much lower than desktop?" },
      {
        p: "The mobile test deliberately simulates a slower phone on a slower connection, because that's what many real visitors use. Your page has to do the same work with less processing power and less bandwidth, so heavy JavaScript and large images hurt far more. A low mobile score with a good desktop score is very common.",
      },
      { h2: "Lab data vs field data: which matters more?" },
      {
        p: "**Field data** tells you what real visitors experience and is what Google uses for ranking. **Lab data** is a repeatable test that's best for diagnosing problems and checking fixes. When they disagree, trust the field data for 'how are we doing?' and use the lab data for 'what should we fix?'",
      },
      {
        p: "If the field section says there isn't enough data, your site doesn't get enough Chrome traffic to be included yet. That's normal for smaller sites. Use the lab data as your guide.",
      },
      { h2: "What does 'Core Web Vitals Assessment: Failed' mean?" },
      {
        p: "At least one of the three Core Web Vitals, measured at the 75th percentile of real visits, is outside the 'good' range. The thresholds are LCP (loading) at 2.5 seconds or less, INP (responsiveness) at 200 milliseconds or less, and CLS (visual stability) at 0.1 or less. Read [Core Web Vitals explained](/blog/core-web-vitals-explained) for what each one means.",
      },
      { h2: "How is the performance score calculated?" },
      {
        p: "The lab score is a weighted mix of five metrics. In current versions of Lighthouse, Total Blocking Time and Largest Contentful Paint carry the most weight, followed by Cumulative Layout Shift, with First Contentful Paint and Speed Index making up the rest. That's why heavy JavaScript, which drives Total Blocking Time, drags mobile scores down so much.",
      },
      { h2: "How to improve your PageSpeed score" },
      {
        ol: [
          "Resize and compress images, and serve WebP or AVIF. See our [image optimisation guide](/blog/image-optimisation-for-website-speed).",
          "Lazy-load images below the fold, but never the main hero image. See [lazy loading](/fix/no-lazy).",
          "Turn on Gzip or Brotli compression. See [enabling compression](/fix/no-compression).",
          "Cut server response time with caching and better hosting. See [slow server response](/fix/slow-response).",
          "Remove third-party scripts you don't need, and delay the rest until after the page loads.",
          "Set width and height on images and embeds so the layout doesn't jump.",
        ],
      },
      {
        tip: "Chasing 100 is rarely worth it. Aim to pass Core Web Vitals in field data, and get the lab score into the green or high orange.",
      },
    ],
    faq: [
      [
        "Is a PageSpeed score of 50 bad?",
        "It means there's room to improve, especially on mobile. But the score is a lab test. What matters for Google rankings is whether your real-user Core Web Vitals pass.",
      ],
      [
        "Does PageSpeed Insights score affect SEO?",
        "Not directly. Google uses Core Web Vitals from real users as a ranking signal, not the Lighthouse score. Improving the score usually improves real-user speed too, though.",
      ],
      [
        "Why is my field data different from my lab data?",
        "Field data reflects many real visitors on different devices and networks over 28 days. Lab data is one simulated test on a slow phone. Real visitors are often faster than the lab simulation.",
      ],
      [
        "Why does PageSpeed Insights say there isn't enough real-world data?",
        "Your site doesn't yet have enough Chrome visitors to be included in the Chrome User Experience Report. Use the lab data instead, or measure real users with your own monitoring.",
      ],
      [
        "Can I get a 100 PageSpeed score on mobile?",
        "Yes, on a simple, lightweight page. Sites with adverts, chat widgets and lots of tracking scripts rarely reach it, and usually don't need to.",
      ],
    ],
    related: ["core-web-vitals-explained", "image-optimisation-for-website-speed"],
  },

  {
    slug: "spf-dkim-dmarc-explained",
    tag: "Security",
    title: "SPF, DKIM and DMARC Explained: Stop Your Emails Going to Spam",
    description:
      "Emails going to spam? Learn what SPF, DKIM and DMARC are, see example records, and follow a safe step-by-step plan to set up DMARC for Gmail, Yahoo and Outlook.",
    h1: "SPF, DKIM and DMARC explained: stop your emails going to spam.",
    lead: "Three DNS records decide whether Gmail and Outlook trust email from your domain. Here's what each one does and how to set them up without breaking anything.",
    keywords: [
      "SPF DKIM DMARC explained",
      "what is DMARC",
      "how to set up DMARC",
      "SPF record example",
      "emails going to spam",
      "Gmail sender requirements",
      "DMARC p=none",
    ],
    body: [
      { h2: "Why your emails are going to spam" },
      {
        p: "Email was designed with no way to prove who sent a message, which is why spoofing and phishing are so easy. SPF, DKIM and DMARC fix that. Gmail, Yahoo and Microsoft Outlook now require them for anyone sending in bulk (roughly 5,000 or more messages a day to their users), and they treat unauthenticated mail with suspicion even from small senders. Since late 2025, Gmail has been rejecting non-compliant bulk mail outright rather than just sending it to spam.",
      },
      { h2: "What is SPF?" },
      {
        p: "**SPF (Sender Policy Framework)** is a DNS TXT record that lists the servers allowed to send email for your domain. When a message arrives, the receiving server checks whether it came from one of those servers.",
      },
      {
        code: "v=spf1 include:_spf.google.com include:sendgrid.net ~all",
      },
      {
        ul: [
          "Each **include** adds a service that sends for you, such as your mailbox provider, newsletter tool or invoicing software.",
          "**~all** (soft fail) marks anything else as suspicious. **-all** (hard fail) says reject it.",
          "You can only have **one** SPF record per domain. Merge services into one line rather than adding a second record.",
          "SPF allows at most 10 DNS lookups. Too many includes break it silently.",
        ],
      },
      { h2: "What is DKIM?" },
      {
        p: "**DKIM (DomainKeys Identified Mail)** adds a digital signature to every email. Your email provider signs outgoing messages with a private key, and you publish the matching public key in DNS. Receivers check the signature to confirm the message really came from your domain and wasn't altered on the way.",
      },
      {
        p: "You don't write DKIM records yourself. Each sending service (Google Workspace, Microsoft 365, Mailchimp and so on) gives you a record to add, usually at an address like selector._domainkey.yourdomain.com. Turn it on in **every** service that sends as your domain.",
      },
      { h2: "What is DMARC?" },
      {
        p: "**DMARC** ties SPF and DKIM together. It tells receivers what to do when a message claiming to be from your domain fails those checks, and where to send reports about it. Crucially, it requires **alignment**: the domain that passes SPF or DKIM must match the domain in the From address people see.",
      },
      {
        code: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com",
      },
      {
        p: "This record lives at _dmarc.yourdomain.com. The **p** value is your policy: none (monitor only), quarantine (send failures to spam) or reject (block them).",
      },
      { h2: "How to set up DMARC safely" },
      {
        ol: [
          "Publish a DMARC record with **p=none** and a reporting address. Nothing is blocked yet.",
          "Read the reports for two to four weeks. A DMARC reporting tool makes them readable. You'll find every service sending as your domain, including ones you'd forgotten, such as your CRM, booking system or website contact form.",
          "Fix SPF and DKIM for each legitimate sender until they all pass and align.",
          "Move to **p=quarantine**, and watch for problems.",
          "Once everything is clean, move to **p=reject**. Now nobody can send convincing email pretending to be you.",
        ],
      },
      {
        tip: "Jumping straight to p=reject can block your own invoices and newsletters. Always start with p=none and work up.",
      },
      { h2: "Do I need these if I don't send email from my domain?" },
      {
        p: "Yes. Unused domains are a favourite target for spoofing because nobody is watching them. For a domain that never sends email, publish an SPF record of **v=spf1 -all** and a DMARC record with **p=reject**. That tells every receiver that any email claiming to be from this domain is fake.",
      },
      { h2: "How to check your SPF, DKIM and DMARC" },
      {
        p: "Send an email to a Gmail address, open it, and choose **Show original**. Gmail shows PASS or FAIL for SPF, DKIM and DMARC. Pagelyt's security check also looks up your SPF and DMARC records on every scan. See [how to add SPF](/fix/no-spf) and [how to add DMARC](/fix/no-dmarc), or [run a free scan](/).",
      },
    ],
    faq: [
      [
        "Can I have two SPF records?",
        "No. Two SPF records make SPF fail completely. Combine all your sending services into a single record with several include entries.",
      ],
      [
        "What is the difference between ~all and -all in SPF?",
        "~all is a soft fail: unlisted senders are treated as suspicious. -all is a hard fail: they should be rejected. Most domains start with ~all and rely on DMARC to set the final policy.",
      ],
      [
        "Does DMARC stop spam in my inbox?",
        "No. DMARC stops other people sending email that pretends to be from your domain. It doesn't filter the email you receive.",
      ],
      [
        "Is p=none enough for Gmail and Yahoo?",
        "For their bulk sender rules, a DMARC record with p=none is the minimum. It doesn't protect your domain from spoofing, though, so plan to move to quarantine or reject.",
      ],
      [
        "How long do SPF, DKIM and DMARC changes take to work?",
        "DNS changes usually take effect within minutes to a few hours, and can take up to 48 hours depending on your DNS settings.",
      ],
    ],
    related: ["website-security-checklist", "free-website-audit-what-to-check"],
  },

  {
    slug: "image-optimisation-for-website-speed",
    tag: "Speed",
    title: "How to Optimise Images for the Web: Formats, Sizes and Lazy Loading",
    description:
      "Learn how to optimise images for your website: WebP vs AVIF, the right image sizes, how to compress images, lazy loading, and how to speed up your LCP image.",
    h1: "How to optimise images for a faster website.",
    lead: "Images are usually the heaviest part of a web page and often the slowest thing to appear. Get them right and most speed problems shrink with them.",
    keywords: [
      "image optimisation for web",
      "WebP vs AVIF",
      "how to compress images for website",
      "best image size for website",
      "lazy loading images",
      "LCP image",
      "image SEO",
    ],
    body: [
      { h2: "Why image optimisation matters" },
      {
        p: "On most websites, images make up more of the page weight than anything else. The biggest image, usually the hero banner or a product photo, is very often the element Google measures for **Largest Contentful Paint (LCP)**, the loading part of Core Web Vitals. Slow images mean a slow-feeling site and a worse Core Web Vitals score.",
      },
      { h2: "Which image format should I use?" },
      {
        ul: [
          "**AVIF:** usually the smallest files for photos. Supported by all major current browsers, though slower to create.",
          "**WebP:** slightly larger than AVIF but still much smaller than JPEG, with near-universal browser support. The safe default.",
          "**JPEG:** the fallback for photos when you can't use the formats above.",
          "**PNG:** only for screenshots or graphics that need transparency and sharp edges. Never for photos.",
          "**SVG:** for logos, icons and simple illustrations. Tiny files that stay sharp at any size.",
        ],
      },
      {
        p: "The best approach is to serve AVIF where it's supported, with WebP or JPEG as a fallback. Many image CDNs and website platforms do this for you automatically. By hand, it looks like this:",
      },
      {
        code: '<picture>\n  <source srcset="hero.avif" type="image/avif">\n  <source srcset="hero.webp" type="image/webp">\n  <img src="hero.jpg" alt="Plumber fixing a boiler"\n       width="1600" height="900" fetchpriority="high">\n</picture>',
      },
      { h2: "What size should website images be?" },
      {
        p: "Never upload a 5,000-pixel photo straight from a camera or phone to show it 800 pixels wide. Resize images to roughly the largest size they're displayed at, or about twice that for sharp results on high-resolution screens.",
      },
      {
        ul: [
          "Full-width hero images: around 1,600 to 2,000 pixels wide.",
          "Content and blog images: around 1,200 pixels wide.",
          "Thumbnails and cards: the displayed size, times two.",
        ],
      },
      {
        p: "Use **srcset** and **sizes** so phones download a smaller version than desktops. As a rule of thumb, aim for most images to be well under 200 KB.",
      },
      { h2: "How to compress images" },
      {
        p: "Compression removes data you can't see. A quality setting around 70 to 80 usually looks identical to the original at a fraction of the size. Good options include free tools like Squoosh, an image compression plugin for your CMS, or an image CDN that compresses and converts on the fly.",
      },
      { h2: "Lazy loading: what it is and when to use it" },
      {
        p: "Lazy loading tells the browser to wait before downloading images until the visitor scrolls near them. Add **loading=\"lazy\"** to images below the fold and the first view of the page loads faster. See [how to add lazy loading](/fix/no-lazy).",
      },
      {
        tip: "Never lazy-load the main image at the top of the page. It delays your LCP and makes your Core Web Vitals worse, not better.",
      },
      { h2: "How to speed up your LCP image" },
      {
        ol: [
          "Add **fetchpriority=\"high\"** to the main above-the-fold image, and only that one image.",
          "Make sure it isn't lazy-loaded.",
          "If it's a CSS background image, preload it with a link rel=\"preload\" tag, because the browser finds background images late.",
          "Serve it from your own domain or a fast CDN, at the right size and in a modern format.",
        ],
      },
      { h2: "Stop images making the page jump" },
      {
        p: "Always set **width** and **height** on images, or give their container a CSS aspect-ratio. The browser then reserves the right space before the image arrives, so text doesn't jump down the page. That jumping is what Cumulative Layout Shift (CLS) measures.",
      },
      { h2: "Image SEO basics" },
      {
        ul: [
          "Use descriptive file names, such as boiler-repair-leeds.webp rather than IMG_2041.jpg.",
          "Write alt text that describes the image for people who can't see it. See [how to write alt text](/fix/a11y-alt).",
          "Put images near related text, so search engines understand the context.",
        ],
      },
      {
        p: "Want to see which of your images are slowing you down? [Run a free scan](/) and Pagelyt lists your page weight, LCP and missing lazy loading.",
      },
    ],
    faq: [
      [
        "Is WebP or AVIF better?",
        "AVIF usually makes smaller files, while WebP has slightly wider support and is faster to create. Serving AVIF with a WebP or JPEG fallback gives you the best of both.",
      ],
      [
        "What is the best image size for a website?",
        "Resize each image to about the largest size it's displayed at, or twice that for sharp screens. Around 1,600 to 2,000 pixels wide is plenty for a full-width hero image.",
      ],
      [
        "Does image compression reduce quality?",
        "Lossy compression removes some data, but at quality settings around 70 to 80 the difference is usually invisible while the file is much smaller.",
      ],
      [
        "Should I lazy-load all images?",
        "No. Lazy-load images below the fold, but load the main image at the top of the page straight away, ideally with fetchpriority set to high.",
      ],
      [
        "Do images affect SEO?",
        "Yes, in two ways. Heavy images slow your page and hurt Core Web Vitals, and good file names and alt text help your images appear in image search.",
      ],
    ],
    related: ["pagespeed-insights-score-explained", "why-is-my-website-slow"],
  },

  {
    slug: "meta-title-and-description-guide",
    tag: "SEO",
    title: "How to Write Title Tags and Meta Descriptions That Get Clicks",
    description:
      "How long should a title tag be? What's the ideal meta description length? Learn how to write titles and descriptions that get clicks, and why Google rewrites them.",
    h1: "How to write title tags and meta descriptions that get clicks.",
    lead: "Your title and description are your advert in Google's results. Here's how long they should be, what to put in them, and why Google sometimes ignores them.",
    keywords: [
      "title tag length",
      "meta description length",
      "how to write a meta description",
      "SEO title tag",
      "why Google changes my title",
      "meta title best practices",
      "meta description character limit",
    ],
    body: [
      { h2: "What are title tags and meta descriptions?" },
      {
        p: "The **title tag** is the page's name in the HTML. Google usually shows it as the clickable blue headline in search results, and browsers show it in the tab. The **meta description** is a short summary that Google often, but not always, shows underneath.",
      },
      {
        p: "The title tag is one of the clearest signals of what a page is about. The meta description doesn't affect rankings directly, but a good one can earn more clicks.",
      },
      { h2: "How long should a title tag be?" },
      {
        p: "Google cuts titles off by pixel width, at roughly 600 pixels on desktop. In practice that's about **50 to 60 characters**. There's no penalty for longer titles, but the end gets cut off and long titles are more likely to be rewritten.",
      },
      { h2: "How to write a good title tag" },
      {
        ol: [
          "Put the main topic or keyword near the start.",
          "Make it unique. Every page needs its own title.",
          "Match what the searcher wants, such as a price, a guide, a location or a comparison.",
          "Put your brand at the end, after a separator, if there's room.",
          "Write for people. Don't stuff it with keyword variations.",
          "Keep it consistent with the page's main heading (H1).",
        ],
      },
      {
        ul: [
          "**Weak:** Home | Welcome to Our Website",
          "**Stuffed:** Plumber Leeds, Leeds Plumber, Plumbing Leeds, Cheap Plumber",
          "**Good:** Emergency Plumber in Leeds, 24/7 Call-Outs | Acme Plumbing",
        ],
      },
      { h2: "Why does Google change my title?" },
      {
        p: "Google builds the headline it shows (it calls it a 'title link') mainly from your title tag, but it can also use your H1, other headings, link text pointing to the page and more. Studies have estimated that Google changes the title for anywhere from a third to over three quarters of results, depending on how they were measured. Google has also tested AI-written titles in search results.",
      },
      {
        p: "Rewrites are more likely when a title is too long, stuffed with keywords, the same boilerplate on every page, or doesn't match what the page is about. Concise, accurate titles that match the H1 get rewritten least.",
      },
      { h2: "How long should a meta description be?" },
      {
        p: "Aim for about **140 to 160 characters**. Google truncates longer descriptions, and shows less on mobile, so put the most important words first.",
      },
      {
        p: "Google rewrites meta descriptions even more often than titles. One large study found it showed its own snippet in most cases, pulling text from the page that better matches the search. Writing a good description still pays off: it's used for many searches, and social networks and AI tools read it too.",
      },
      { h2: "How to write a meta description that gets clicks" },
      {
        ol: [
          "Summarise what the page offers in one or two sentences.",
          "Answer the searcher's likely question, or promise the answer.",
          "Include the main keyword naturally. Google often bolds words that match the search.",
          "Give a reason to click: a price, a guarantee, a free tool, a time saving.",
          "Make it unique for every page.",
        ],
      },
      {
        tip: "Don't copy the same description onto every page. A missing description is better than a duplicated one, because Google will at least pick relevant text from the page.",
      },
      { h2: "Check your titles and descriptions" },
      {
        p: "Pagelyt flags missing titles, missing descriptions and missing social sharing tags on every scan. See how to fix a [missing title](/fix/no-title), a [missing meta description](/fix/no-description) and [missing Open Graph tags](/fix/no-og), or [run a free audit](/).",
      },
    ],
    faq: [
      [
        "What is the ideal title tag length?",
        "About 50 to 60 characters, or under roughly 600 pixels wide. Longer titles aren't penalised, but they get cut off in search results and are more likely to be rewritten.",
      ],
      [
        "What is the ideal meta description length?",
        "About 140 to 160 characters. Put the most important information first, because mobile results show less.",
      ],
      [
        "Do meta descriptions affect SEO rankings?",
        "Not directly. Google doesn't use the meta description as a ranking factor, but a compelling one can increase clicks from search results.",
      ],
      [
        "Why is Google not showing my meta description?",
        "Google shows its own snippet when it thinks text from your page better matches the search. This is common and isn't an error. Make sure your description accurately summarises the page.",
      ],
      [
        "Should the title tag and H1 be the same?",
        "They don't have to be identical, but they should describe the same topic. Consistency makes it less likely that Google rewrites your title.",
      ],
    ],
    related: ["technical-seo-checklist", "schema-markup-guide"],
  },
];
