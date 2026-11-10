/* Every free tool: its own page at /tools/<slug>, grouped on the /tools directory.
   Plain data, used by the server pages (titles, copy, FAQ) and the client (names, links). */

export type ToolSlug =
  | "llms-txt-generator"
  | "ai-bot-checker"
  | "robots-txt-generator"
  | "robots-txt-tester"
  | "hreflang-checker"
  | "serp-preview"
  | "schema-markup-generator"
  | "security-headers-generator"
  | "domain-age-checker"
  | "google-review-link-generator";

export type ToolCategory = "AI visibility" | "Crawling & indexing" | "Search appearance" | "Security & domain" | "Local business";

export type ToolInfo = {
  slug: ToolSlug;
  name: string;
  category: ToolCategory;
  /** One line for cards. */
  blurb: string;
  /** <title> and meta description. */
  title: string;
  description: string;
  h1: string;
  lead: string;
  /** Short "why it matters / how it works" paragraphs under the tool. */
  about: string[];
  faq: [string, string][];
  /** Runs entirely in the browser (generators) or asks our server to fetch a site (checkers). */
  kind: "generator" | "checker";
};

export const CATEGORIES: { name: ToolCategory; text: string }[] = [
  { name: "AI visibility", text: "Make sure ChatGPT, Claude, Perplexity and Gemini can read and recommend your site." },
  { name: "Crawling & indexing", text: "Check what search engines are allowed to crawl, and in which language." },
  { name: "Search appearance", text: "Control how your pages look in Google's results." },
  { name: "Security & domain", text: "Protect visitors and keep your domain in good standing." },
  { name: "Local business", text: "Small tools for businesses that serve customers in person." },
];

export const TOOL_LIST: ToolInfo[] = [
  {
    slug: "ai-bot-checker",
    name: "AI bot access checker",
    category: "AI visibility",
    kind: "checker",
    blurb: "See whether GPTBot, ClaudeBot, PerplexityBot and 11 other AI crawlers can reach your site.",
    title: "AI Bot Access Checker: Can ChatGPT, Claude and Perplexity Read Your Site?",
    description: "Free checker for 14 AI crawlers including GPTBot, ClaudeBot and PerplexityBot. See what your robots.txt allows and whether your server or firewall actually lets each bot in.",
    h1: "Can AI assistants read your website?",
    lead: "Check 14 AI crawlers at once: what your robots.txt tells each one, and how your server really answers when it visits.",
    about: [
      "AI assistants can only recommend pages they are allowed to read. A single line in robots.txt, or a CDN setting such as \"block AI bots\", can quietly keep you out of ChatGPT, Claude and Perplexity answers.",
      "This checker reads your robots.txt the way the bots do (RFC 9309), then requests your page with each bot's name to see whether your server or firewall turns it away. Training bots and answer bots are listed separately, so you can block training while staying visible in answers.",
    ],
    faq: [
      ["Should I block AI bots?", "Blocking training bots (GPTBot, ClaudeBot, CCBot) keeps your content out of future models. Blocking search and user bots (OAI-SearchBot, Claude-User, PerplexityBot) also removes you from AI answers and citations, which most businesses want to avoid."],
      ["Why does the server test differ from robots.txt?", "robots.txt is a request; firewalls enforce rules. Some CDNs block AI user agents outright. Our test uses the bot's name but not its network, so a firewall that verifies real bots may treat the genuine crawler differently."],
    ],
  },
  {
    slug: "llms-txt-generator",
    name: "llms.txt generator",
    category: "AI visibility",
    kind: "generator",
    blurb: "A short guide that helps AI assistants understand your site.",
    title: "llms.txt Generator: Create an llms.txt File for AI Assistants",
    description: "Free llms.txt generator. Describe your site and key pages in plain language and download a ready-to-upload llms.txt file. Runs in your browser.",
    h1: "llms.txt generator",
    lead: "Write a plain-language guide to your site that AI assistants can read in one go, then upload it to /llms.txt.",
    about: [
      "llms.txt is a proposed standard: a short Markdown file at the root of your site that tells AI tools what you do and which pages matter most. It saves them guessing from menus and footers.",
      "It doesn't replace good pages or structured data, but it is quick to add and gives assistants a clean summary to quote.",
    ],
    faq: [
      ["Do AI assistants read llms.txt?", "Support is growing but not universal. It costs nothing to publish and does no harm, so it is worth adding alongside a crawlable site."],
      ["Where does the file go?", "At the root of your domain, so it opens at https://yourdomain.com/llms.txt."],
    ],
  },
  {
    slug: "robots-txt-tester",
    name: "robots.txt tester",
    category: "Crawling & indexing",
    kind: "checker",
    blurb: "Test whether a URL is allowed or blocked for Googlebot, Bingbot or any AI crawler.",
    title: "robots.txt Tester: Check if a URL Is Blocked for Googlebot or AI Bots",
    description: "Free robots.txt tester. Load your live robots.txt, edit it, and test any URL against Googlebot, Bingbot, GPTBot or any user agent using the official RFC 9309 rules.",
    h1: "robots.txt tester",
    lead: "Load your live robots.txt, test any URL against any crawler, and try edits safely before you publish them.",
    about: [
      "One wrong Disallow line can hide a whole section of your site from Google. This tester applies the same rules search engines use: the most specific matching rule wins, and Allow wins a tie.",
      "Each result shows the exact line that decided it, so you know what to change. Edits here are only in your browser until you copy them to your site.",
    ],
    faq: [
      ["Does Disallow remove a page from Google?", "No. It stops crawling, not indexing: a blocked page can still appear in results if other sites link to it. Use a noindex tag on a crawlable page to keep it out."],
      ["Which rule wins when two match?", "The one with the longest path. If they are the same length, Allow wins. A bot that has its own User-agent group ignores the * group entirely."],
    ],
  },
  {
    slug: "robots-txt-generator",
    name: "robots.txt generator",
    category: "Crawling & indexing",
    kind: "generator",
    blurb: "Decide which search and AI crawlers may visit, and download the file.",
    title: "robots.txt Generator: Allow or Block Search and AI Crawlers",
    description: "Free robots.txt generator. Choose which AI crawlers to block, keep private paths out of search, add your sitemap and download a valid robots.txt.",
    h1: "robots.txt generator",
    lead: "Build a clean robots.txt: keep private paths out of crawlers, choose which AI bots may visit, and point to your sitemap.",
    about: [
      "robots.txt is the first file every crawler reads. A short, correct one keeps admin and checkout pages out of search and tells crawlers where your sitemap is.",
      "Test the result with the robots.txt tester before you upload it.",
    ],
    faq: [
      ["Can robots.txt keep a page secret?", "No. The file is public and only polite bots follow it. Protect private pages with a login instead."],
      ["Do I need a robots.txt at all?", "Without one, crawlers assume everything is allowed, which is fine for many sites. Adding one is still the easiest way to list your sitemap."],
    ],
  },
  {
    slug: "hreflang-checker",
    name: "hreflang checker",
    category: "Crawling & indexing",
    kind: "checker",
    blurb: "Validate language tags and confirm every alternate links back.",
    title: "hreflang Checker: Validate Language Tags and Return Links",
    description: "Free hreflang checker. Validate language and region codes, find missing self-references and x-default, and confirm each alternate page loads and links back.",
    h1: "hreflang checker",
    lead: "Check a page's language versions: valid codes, a self-reference, x-default, and that every alternate loads and links back.",
    about: [
      "hreflang tells Google which language or country version of a page to show each visitor. It only works when every version lists all the others, including itself, with full URLs and valid codes.",
      "This checker opens up to 12 alternates and checks each one for a return link, a direct 200 response and a canonical that points to itself.",
    ],
    faq: [
      ["Is it en-UK or en-GB?", "en-GB. Region codes follow ISO 3166-1, where the United Kingdom is GB. Google ignores en-UK."],
      ["Do I need x-default?", "It is optional but recommended: it tells search engines which page to show visitors whose language you don't have, usually a language picker or your main version."],
    ],
  },
  {
    slug: "serp-preview",
    name: "Search preview",
    category: "Search appearance",
    kind: "generator",
    blurb: "See your title and description as Google shows them, on desktop and mobile.",
    title: "SERP Preview Tool: See Your Title and Meta Description in Google",
    description: "Free SERP preview. Type a page title and meta description and see how they look in Google's results on desktop and mobile, with length guides.",
    h1: "Search result preview",
    lead: "See how your title and description look in Google on desktop and mobile, and keep them within the length that shows in full.",
    about: [
      "Your title and description are your advert in search results. Clear, specific text that fits without being cut off gets more clicks from the same ranking.",
      "Google sometimes rewrites them, usually when they don't match the page well, so describe what the page really offers.",
    ],
    faq: [
      ["How long should a title be?", "About 50–60 characters. Google cuts by pixel width, so wide letters use more room."],
      ["How long should a meta description be?", "Roughly 120–160 characters. Put the most important words first, since mobile shows less."],
    ],
  },
  {
    slug: "schema-markup-generator",
    name: "Schema markup generator",
    category: "Search appearance",
    kind: "generator",
    blurb: "JSON-LD structured data for your organisation, local business or FAQ.",
    title: "Schema Markup Generator: JSON-LD for Organization, LocalBusiness and FAQ",
    description: "Free schema markup generator. Create valid JSON-LD structured data for an Organization, LocalBusiness or FAQ page and paste it into your site.",
    h1: "Schema markup generator",
    lead: "Create JSON-LD structured data that tells search engines and AI assistants exactly who you are and what you offer.",
    about: [
      "Structured data is a machine-readable summary of a page. It can earn rich results in Google and helps AI assistants state facts about your business correctly.",
      "Paste the generated block into the page it describes, then check it with Google's Rich Results Test.",
    ],
    faq: [
      ["Will schema improve my rankings?", "Not directly, but it can make your result richer and more clickable, and it helps search engines and AI tools understand your business."],
      ["Which type should I use?", "Organization for most companies, LocalBusiness if customers visit you or you serve a local area, and FAQPage on a page that shows questions and answers."],
    ],
  },
  {
    slug: "security-headers-generator",
    name: "Security headers generator",
    category: "Security & domain",
    kind: "generator",
    blurb: "Copy-paste security headers for Netlify, Vercel, Nginx or Apache.",
    title: "Security Headers Generator: HSTS, CSP and More for Your Host",
    description: "Free security headers generator. Pick the headers you need and copy ready-made config for Netlify, Vercel, Nginx or Apache.",
    h1: "Security headers generator",
    lead: "Pick the protections you need and copy ready-made configuration for your host.",
    about: [
      "Security headers tell browsers to force HTTPS, refuse to be framed by other sites and stop guessing file types. They block whole classes of attack with a few lines of config.",
      "Turn on HSTS only once every page works on HTTPS, and test a Content-Security-Policy before enforcing it.",
    ],
    faq: [
      ["Can headers break my site?", "A strict Content-Security-Policy can block scripts you rely on, so test it first. The other headers here are safe for almost every site."],
      ["How do I check they work?", "Run a free Pagelyt scan after deploying: the Security area lists any header that is still missing."],
    ],
  },
  {
    slug: "domain-age-checker",
    name: "Domain age checker",
    category: "Security & domain",
    kind: "checker",
    blurb: "Registration date, age, expiry and registrar for up to 10 domains.",
    title: "Domain Age Checker: Registration Date, Expiry and Registrar",
    description: "Free domain age checker. Look up when up to 10 domains were registered, when they expire, their registrar and status, using official RDAP registry data.",
    h1: "Domain age checker",
    lead: "Find out when a domain was registered, when it expires and who it's registered with. Up to 10 at a time.",
    about: [
      "Domain age is a quick trust signal: scam sites are usually days or weeks old. Expiry matters even more for your own domains, because a lapsed domain takes your website and email offline.",
      "We read the registry's own records through RDAP, the official replacement for WHOIS. Some country domains don't publish dates.",
    ],
    faq: [
      ["Does domain age affect SEO?", "Not directly. Google has said age itself isn't a ranking factor, but older sites have usually had more time to earn links and trust."],
      ["Why is a date missing?", "Some registries, especially for country domains, don't publish every date over RDAP, or hide them for privacy."],
    ],
  },
  {
    slug: "google-review-link-generator",
    name: "Google review link generator",
    category: "Local business",
    kind: "generator",
    blurb: "A direct link that opens the review box for your Google business listing.",
    title: "Google Review Link Generator: Direct Link to Leave a Review",
    description: "Free Google review link generator. Turn your Place ID into a link that opens the review box for your business, ready for emails, receipts and QR codes.",
    h1: "Google review link generator",
    lead: "Make a link that takes customers straight to the review box for your business on Google.",
    about: [
      "Every extra step loses reviewers. A direct link skips searching for your business and opens the star rating straight away.",
      "Share it in follow-up emails, on receipts or behind a QR code at the till. Ask every customer the same way: Google doesn't allow offering rewards for reviews.",
    ],
    faq: [
      ["Where do I find my Place ID?", "Search your business on Google's Place ID Finder (linked above the tool). It's the code starting with ChIJ in most cases."],
      ["Is there an official short link?", "Yes: in your Google Business Profile, choose \"Ask for reviews\" to get a g.page link. This tool gives the same result when you can't access the profile."],
    ],
  },
];

export const TOOLS_BY_SLUG = new Map(TOOL_LIST.map((t) => [t.slug, t]));
