// Google guides: setting up Search Console, Analytics 4 and Google Ads, connecting each to Pagelyt, what to use it
// for and tips. Same format as POSTS in blog-data.ts, which appends these. Linked from the dashboard's Google data
// tabs and the Google integrations feature page; the assistant reads them like every other post.
import type { Post } from "./blog-data";

export const GOOGLE_GUIDE_TAG = "Google guides";

export const GOOGLE_POSTS: Post[] = [
  {
    slug: "google-search-console-setup-guide",
    tag: GOOGLE_GUIDE_TAG,
    title: "Google Search Console Setup Guide: Verify, Connect and Use It",
    description:
      "How to set up Google Search Console step by step: add and verify your site, submit a sitemap, read the reports that matter, connect it to Pagelyt and get more clicks from Google.",
    h1: "How to set up Google Search Console (and actually use it)",
    lead: "Search Console is Google telling you, for free, how your site does in Google Search. Here's how to set it up properly, connect it to Pagelyt and turn the numbers into fixes.",
    keywords: [
      "Google Search Console setup",
      "how to set up Google Search Console",
      "verify website Google Search Console",
      "domain property vs URL prefix",
      "submit sitemap to Google",
      "Search Console performance report",
      "Search Console tips",
    ],
    body: [
      { h2: "What Google Search Console is for" },
      {
        p: "Google Search Console is Google's free tool for site owners. It shows which searches your pages appear for, how often people click, which pages Google has indexed and why others aren't, and any problems Google found on your site, such as security issues or penalties.",
      },
      {
        p: "It's different from Google Analytics. Search Console covers what happens **in Google Search, before the click**. Analytics covers what visitors do **on your site, after the click**. You want both. See our [Google Analytics 4 setup guide](/blog/google-analytics-4-setup-guide).",
      },
      { h2: "Step 1: add your site" },
      {
        ol: [
          "Go to **search.google.com/search-console** and sign in with the Google account you want to own the property. Use a company account rather than a personal one, so access doesn't leave when a person does.",
          "Click **Add property**. Google offers two types: **Domain** and **URL prefix**.",
          "Choose **Domain** if you can edit your DNS. It covers every version of your site in one place: http and https, with and without www, and every subdomain.",
          "Choose **URL prefix** if you can't touch DNS. It only covers the exact address you type, for example https://www.example.com/, so type the version your site really uses.",
        ],
      },
      {
        tip: "Not sure which address your site uses? Open your homepage and copy it from the browser's address bar after any redirects. Pagelyt's free audit shows the final address too.",
      },
      { h2: "Step 2: verify that you own it" },
      {
        p: "**Domain property:** Google gives you a TXT record that starts with google-site-verification. Add it in your DNS provider (your domain registrar, Cloudflare or your host), then click Verify. DNS changes can take from a few minutes to a few hours to show up, so if verification fails at first, wait and try again.",
      },
      {
        p: "**URL prefix property:** the easiest methods are uploading the HTML file Google gives you to your site's root folder, or adding a meta tag to your homepage's head section. If Google Analytics or Google Tag Manager is already installed with the same Google account, you can verify through those in one click.",
      },
      {
        p: "Keep the verification in place. If the TXT record, file or tag is removed later, you lose access.",
      },
      { h2: "Step 3: submit your sitemap" },
      {
        p: "Open **Indexing, Sitemaps**, enter your sitemap's address (often /sitemap.xml or /sitemap_index.xml) and click Submit. A sitemap helps Google find every page you want in search, especially new pages and pages with few links. No sitemap yet? See [how to add an XML sitemap](/fix/no-sitemap) or build one with Pagelyt's [sitemap generator](/tools/sitemap-generator).",
      },
      { h2: "Step 4: add your team" },
      {
        p: "Under **Settings, Users and permissions**, add the people who need access. **Full** users can see everything and take most actions. **Restricted** users can see most data but can't change settings. Only give **Owner** to people who should be able to add and remove other users.",
      },
      { h2: "The reports worth checking" },
      {
        ul: [
          "**Performance:** clicks, impressions, click-through rate and average position, by search query, page, country and device, for up to 16 months.",
          "**Pages (indexing):** which pages are indexed and the reason each other page isn't. Read [why your website isn't showing on Google](/blog/why-is-my-website-not-showing-on-google) for what each reason means.",
          "**URL Inspection:** paste any URL to see whether it's on Google, when it was last crawled and which canonical Google chose. After fixing a page, use Request indexing.",
          "**Core Web Vitals:** real-user speed data, grouped into poor, needs improvement and good. See our [Core Web Vitals guide](/blog/core-web-vitals-explained).",
          "**Manual actions and Security issues:** should both say no issues. If not, fix them first, before anything else.",
        ],
      },
      { h2: "Connect Search Console to Pagelyt" },
      {
        p: "On its own, Search Console tells you which pages get traffic. Pagelyt tells you what's wrong with them. Connected, you see the real Google clicks behind every issue in your report, so you fix the problems that cost you the most searches first.",
      },
      {
        ol: [
          "Run a free scan of your site at [pagelyt.dev](/) and save it to your account under **Save & monitor**.",
          "Open **Google data** in your dashboard and choose the **Search Console** tab.",
          "Click **Connect** and sign in with a Google account that has access to your Search Console property. Pagelyt asks for read-only access: it can't change anything in Google.",
          "Pagelyt finds the property that matches your site. If you have several, pick the right one from the list.",
          "Your numbers appear within a minute and refresh every 24 hours. Switch between 7, 28 and 90 days at the top.",
        ],
      },
      {
        p: "Google data comes with the Professional and Business plans. You can disconnect any time from your account page, which deletes the stored data and access.",
      },
      { h2: "What you can do with it in Pagelyt" },
      {
        ul: [
          "**Clicks on every issue.** Each finding shows how many Google clicks and impressions the affected pages get, and Top fixes ranks problems by real traffic.",
          "**Searches close to page one.** Searches where you rank around positions 8 to 20 with real impressions. A small improvement to these pages can move them onto page one, where most clicks happen.",
          "**Seen but not clicked.** Pages on page one that get far fewer clicks than their position suggests. Usually the title or description needs work. See [how to write title tags and meta descriptions](/blog/meta-title-and-description-guide).",
          "**Pages losing clicks.** Pages with the biggest drop against the previous period, next to any issues found on them.",
          "**Indexing check.** Google's own verdict on your top pages, straight from URL Inspection.",
          "**Analyse with AI.** A short list of insights from your numbers, each with a next step and a link to the page or issue it's about.",
        ],
      },
      { h2: "Tips to get more out of Search Console" },
      {
        ul: [
          "**Compare date ranges.** In Performance, use Date, Compare to see what changed. A drop that lines up with a site change usually points to the cause.",
          "**Split brand from non-brand.** Filter queries that don't contain your brand name. Non-brand clicks show how well you win new customers.",
          "**Fix titles on high-impression, low-click pages first.** It's the fastest win: no new content, just a better reason to click.",
          "**Data is two to three days behind.** Don't panic about yesterday's numbers.",
          "**Average position is an average.** A page can rank first for one search and fortieth for another. Look at positions per query, not just per page.",
          "**Some searches are hidden.** Google leaves out very rare queries for privacy, so query totals are lower than page totals. That's normal.",
          "**Check the Pages report after every big change,** such as a redesign, migration or new CMS. Problems show up there first.",
          "**Turn on email notifications** so Google tells you about new problems without you having to log in.",
        ],
      },
      { h2: "Next steps" },
      {
        p: "Connect [Google Analytics 4](/blog/google-analytics-4-setup-guide) to see what visitors do once they arrive, and [Google Ads](/blog/google-ads-setup-guide) if you pay for search traffic. Or [run a free audit](/) and see which issues sit on your busiest pages.",
      },
    ],
    faq: [
      [
        "Is Google Search Console free?",
        "Yes. Search Console is completely free. You only need a Google account and a way to prove you own the site.",
      ],
      [
        "Should I use a Domain property or a URL prefix property?",
        "Use a Domain property if you can edit your DNS. It covers http, https, www, non-www and all subdomains in one place. Use URL prefix only when DNS access isn't possible.",
      ],
      [
        "How long until data appears in Search Console?",
        "Usually within a few days of verifying. Performance data then runs two to three days behind real time.",
      ],
      [
        "Does connecting Search Console to Pagelyt give Pagelyt control of my account?",
        "No. Pagelyt asks for read-only access. It can read your search data and inspection results but can't change settings, submit sitemaps or remove pages. You can disconnect any time.",
      ],
      [
        "Why do Search Console and Google Analytics show different numbers?",
        "They measure different things. Search Console counts clicks from Google Search. Analytics counts visits from every source and depends on the tag loading and on cookie consent, so the two never match exactly.",
      ],
    ],
    related: ["google-analytics-4-setup-guide", "google-ads-setup-guide", "why-is-my-website-not-showing-on-google"],
  },
  {
    slug: "google-analytics-4-setup-guide",
    tag: GOOGLE_GUIDE_TAG,
    title: "Google Analytics 4 Setup Guide: Install, Configure and Use GA4",
    description:
      "Set up Google Analytics 4 step by step: create a property and web stream, install the Google tag, the settings to change on day one, connecting GA4 to Pagelyt and tips for reading your data.",
    h1: "How to set up Google Analytics 4 the right way",
    lead: "GA4 tells you who visits your site, where they come from and whether they stay. Setting it up takes about fifteen minutes. Here's every step, the settings most people miss, and how to connect it to Pagelyt.",
    keywords: [
      "Google Analytics 4 setup",
      "how to set up GA4",
      "install Google Analytics",
      "GA4 measurement ID",
      "GA4 data retention",
      "GA4 key events",
      "Google Analytics tips",
    ],
    body: [
      { h2: "What Google Analytics 4 is for" },
      {
        p: "Google Analytics 4 (GA4) measures what happens on your website: how many people visit, which pages they see, where they came from (Google, social media, email, ads or typing your address) and whether they do what you want, such as buying, booking or filling in a form.",
      },
      {
        p: "It pairs with Google Search Console, which shows what happens in Google Search before the click. If you haven't set that up yet, start with our [Google Search Console setup guide](/blog/google-search-console-setup-guide).",
      },
      { h2: "Step 1: create your account and property" },
      {
        ol: [
          "Go to **analytics.google.com** and sign in with a company Google account.",
          "Click **Start measuring** (or **Admin, Create, Account** if you already use Analytics). Name the account after your business.",
          "Create a **property** for your website. Pick your reporting time zone and currency carefully: they decide where each day starts and how revenue is shown.",
          "Answer the business questions and choose your objectives. These only change which reports show by default.",
        ],
      },
      { h2: "Step 2: add a web data stream" },
      {
        p: "Choose **Web**, enter your website address and a name for the stream. Leave **Enhanced measurement** switched on: it tracks page views, scrolls, outbound clicks, site search, video plays, file downloads and form interactions without any extra code.",
      },
      {
        p: "Google then shows your **Measurement ID**, which starts with G-. You'll need it in the next step.",
      },
      { h2: "Step 3: install the Google tag" },
      {
        p: "GA4 only collects data once its tag is on every page of your site. Pick the method that suits your site:",
      },
      {
        ul: [
          "**Website builders (Shopify, Wix, Squarespace and similar):** paste your Measurement ID into the built-in Google Analytics setting. No code needed.",
          "**WordPress:** use Google's Site Kit plugin or your theme's analytics setting. Use one method only, or every visit is counted twice.",
          "**Google Tag Manager:** if you already use it, add a Google tag with your Measurement ID and publish the container.",
          "**By hand:** copy the Google tag code from the stream's **View tag instructions** and paste it straight after the opening head tag on every page.",
        ],
      },
      {
        p: "Then open your site in another tab and check **Reports, Realtime**. You should see yourself as an active user within a minute.",
      },
      {
        tip: "If you need visitor consent for cookies (in the UK and EU, for example), set up a cookie banner with Google's consent mode before going live. Pagelyt flags a missing cookie banner under Privacy & compliance.",
      },
      { h2: "Step 4: the settings to change on day one" },
      {
        ul: [
          "**Data retention:** under **Admin, Data collection and modification, Data retention**, change it from 2 months to **14 months**. It only affects detailed reports (Explorations), but you can't get older data back later.",
          "**Key events:** under **Admin, Events**, mark the actions that matter (a purchase, a booking, a contact form sent) as key events. Google used to call these conversions.",
          "**Internal traffic:** define your office IP addresses under the data stream's tag settings and switch on the internal traffic filter, so your own visits don't skew the numbers.",
          "**Product links:** under **Admin, Product links**, link Search Console and Google Ads. Ads can then import your key events and use them for bidding.",
          "**Users:** add your team under **Admin, Access management** with the lowest role they need. Viewer is enough to read reports.",
        ],
      },
      { h2: "Connect Google Analytics to Pagelyt" },
      {
        p: "Analytics tells you which pages get visitors. Pagelyt tells you what's broken on them. Connected, every issue in your report shows the visits it affects, so you know which fixes protect the most traffic.",
      },
      {
        ol: [
          "Scan your site at [pagelyt.dev](/) and save it under **Save & monitor**.",
          "In your dashboard, open **Google data** and choose the **Analytics** tab.",
          "Click **Connect** and sign in with a Google account that can view your GA4 property. Pagelyt asks for read-only access.",
          "Pagelyt matches the property whose web stream points at your site. If there's more than one, pick it from the list.",
          "Your numbers load in under a minute and refresh every 24 hours, with 7, 28 and 90-day views.",
        ],
      },
      {
        p: "Google data comes with the Professional and Business plans. Disconnect any time from your account page.",
      },
      { h2: "What you can do with it in Pagelyt" },
      {
        ul: [
          "**Visits on every issue.** Each finding shows the visits and engagement on the pages it affects, so a broken page with 5,000 visits a month comes before one with 50.",
          "**Channels, devices and countries.** Where visitors come from, at a glance, with a table you can sort and download.",
          "**The drop detective.** Pages losing the most visitors against the previous period, with any issues on those pages next to them.",
          "**Pages that don't hold visitors.** Busy pages where a much smaller share of visits is engaged than on the rest of your site. Slow loading is a common cause. See [why your website is slow](/blog/why-is-my-website-slow).",
          "**Analyse with AI.** A short list of insights from your numbers, each with a next step and a link to the page or issue.",
          "**In your PDF report.** Visitors, channels and AI insights can go in the branded report you send to clients.",
        ],
      },
      { h2: "Tips for reading GA4" },
      {
        ul: [
          "**Engagement rate beats bounce rate.** An engaged session lasted over 10 seconds, viewed two or more pages, or included a key event. Bounce rate is simply the opposite.",
          "**Tag your campaign links.** Add UTM tags (utm_source, utm_medium, utm_campaign) to links in emails, social posts and ads, or those visits land in the wrong channel.",
          "**Data is up to a day behind** in standard reports. Use Realtime to check something you just changed.",
          "**Small numbers may be hidden.** GA4 sometimes withholds rows with very few users for privacy. That's normal, not a tracking fault.",
          "**Never send personal data** such as email addresses or names into Analytics, for example in page addresses or event names. It's against Google's terms.",
          "**Compare like with like.** Compare a month with the same month last year when your business is seasonal, not just with the month before.",
          "**Check the tag after every redesign.** A new theme or template is the most common reason Analytics quietly stops counting.",
        ],
      },
      { h2: "Next steps" },
      {
        p: "Set up [Search Console](/blog/google-search-console-setup-guide) for the searches behind your visits, and [Google Ads](/blog/google-ads-setup-guide) if you pay for traffic. Or [run a free audit](/) and see which issues sit on your most visited pages.",
      },
    ],
    faq: [
      [
        "Is Google Analytics 4 free?",
        "Yes, the standard version of GA4 is free. A paid version, Analytics 360, exists for very large companies.",
      ],
      [
        "What is a GA4 Measurement ID?",
        "It's the ID that starts with G- and tells the Google tag which property to send data to. Find it under Admin, Data streams, then your web stream.",
      ],
      [
        "Why is GA4 showing no data?",
        "Usually the tag isn't on the page, it's installed twice, or a cookie banner blocks it until visitors accept. Open your site and check Reports, Realtime. Data in standard reports can take up to a day to appear.",
      ],
      [
        "Can Pagelyt change my Google Analytics settings?",
        "No. Pagelyt asks for read-only access. It reads your reports but can't change settings, tags or users. Disconnect any time from your account page.",
      ],
      [
        "What's the difference between key events and conversions?",
        "In GA4, key events are the actions you mark as important. Google renamed GA4 conversions to key events; in Google Ads, imported key events are still called conversions.",
      ],
    ],
    related: ["google-search-console-setup-guide", "google-ads-setup-guide", "why-is-my-website-slow"],
  },
  {
    slug: "google-ads-setup-guide",
    tag: GOOGLE_GUIDE_TAG,
    title: "Google Ads Setup Guide: First Campaign, Tracking and Tips",
    description:
      "Set up Google Ads step by step: create the account in Expert mode, conversion tracking, your first Search campaign, connecting Google Ads to Pagelyt and tips to stop wasting ad spend.",
    h1: "How to set up Google Ads without wasting money",
    lead: "Google Ads can bring customers the same day, or burn through your budget on the wrong searches. Here's how to set it up properly, connect it to Pagelyt and spot the spend that isn't working.",
    keywords: [
      "Google Ads setup",
      "how to set up Google Ads",
      "Google Ads expert mode",
      "Google Ads conversion tracking",
      "first Google Ads campaign",
      "negative keywords",
      "Google Ads landing page experience",
    ],
    body: [
      { h2: "What Google Ads is for" },
      {
        p: "Google Ads puts your business at the top of Google for the searches you choose, and you pay when someone clicks. Unlike SEO, it works from day one. Unlike SEO, it stops the moment you stop paying. Most businesses do best with both: ads for fast, targeted traffic, and SEO for clicks you don't pay for.",
      },
      {
        p: "Before you spend anything, make sure the pages you'll send people to load fast and work well. Every click on a slow or broken page is money spent for nothing. [Run a free audit](/) of your landing pages first.",
      },
      { h2: "Step 1: create your account in Expert mode" },
      {
        ol: [
          "Go to **ads.google.com** and sign in with a company Google account.",
          "Google suggests a simplified Smart campaign. For full control over keywords, budgets and reporting, look for **Switch to Expert Mode** at the bottom of the first screen.",
          "If you'd rather set up the campaign later, choose **Create an account without a campaign**.",
          "Confirm your country, time zone and currency. These can't be changed later.",
          "Add your billing details so ads can run.",
        ],
      },
      {
        tip: "Agencies and freelancers: create a **manager account** first and link client accounts to it. You see every client in one place, and clients keep ownership of their own accounts.",
      },
      { h2: "Step 2: set up conversion tracking first" },
      {
        p: "Without conversion tracking, Google Ads can only optimise for clicks, not customers. Set it up before your first campaign:",
      },
      {
        ul: [
          "**From Google Analytics (simplest):** link GA4 and Google Ads, then import your GA4 key events under **Goals, Conversions**. See our [GA4 setup guide](/blog/google-analytics-4-setup-guide).",
          "**With the Google tag:** create a conversion action in Google Ads (a purchase, lead form or call) and add the event code to your thank-you page or button.",
          "**Leave auto-tagging on,** so each ad click carries an ID that links it to what happens on your site.",
        ],
      },
      { h2: "Step 3: build your first Search campaign" },
      {
        ol: [
          "Choose **New campaign**, pick your goal (Sales or Leads usually) and choose **Search**.",
          "**Networks:** untick the Display Network for a Search campaign. It shows banner ads on other sites, which tend to get cheaper but lower-quality clicks.",
          "**Locations:** pick where your customers are, and under Location options choose **Presence**, so only people physically in those places see your ads.",
          "**Budget and bidding:** start with a daily budget you're comfortable losing while you learn. Use Maximise clicks or Maximise conversions until you have around 30 conversions a month, then consider a target cost per conversion.",
          "**Ad groups and keywords:** group keywords by theme, one ad group per service or product. Use phrase match (\"emergency plumber\") and exact match ([emergency plumber]) to start, rather than broad match.",
          "**Ads:** write a responsive search ad with up to 15 headlines and 4 descriptions. Include the main keyword, a clear benefit and a reason to act now.",
          "**Final URL:** send each ad group to the most relevant page, not the homepage. Someone searching for boiler repair should land on your boiler repair page.",
        ],
      },
      { h2: "Connect Google Ads to Pagelyt" },
      {
        p: "Google Ads tells you what you spend. Pagelyt tells you what's wrong with the pages you're paying to send people to. Connected, you see the ad spend landing on pages with issues, and the searches where you pay for clicks you'd get for free.",
      },
      {
        ol: [
          "Scan your site at [pagelyt.dev](/) and save it under **Save & monitor**.",
          "In your dashboard, open **Google data** and choose the **Google Ads** tab.",
          "Click **Connect** and sign in with a Google account that can see your Ads account. Pagelyt asks for read-only access: it can't change campaigns, bids or budgets.",
          "Pagelyt finds the account whose ads point at your site, including client accounts under a manager account. If there's more than one, pick it from the list.",
          "Your last 28 days of spend load in under a minute and refresh every 24 hours.",
        ],
      },
      {
        p: "Google data comes with the Professional and Business plans. Disconnect any time from your account page.",
      },
      { h2: "What you can do with it in Pagelyt" },
      {
        ul: [
          "**Ad spend on pages with issues.** Every finding shows the ad clicks and spend landing on the pages it affects. Fixing a slow landing page you pay to send people to is the quickest return there is.",
          "**Keywords with a below-average landing page.** Google rates landing page experience for each keyword. A below-average rating raises your cost per click, so these pages are worth fixing first.",
          "**Paid searches you already rank for.** Searches where you pay for ads while already ranking in the top 3 organically, with what they cost. Test pausing some of them and watch whether total clicks hold.",
          "**Organic clicks priced as ads.** What your free Google clicks would cost if you bought them as ads. Handy for showing what SEO is worth (needs Search Console too).",
          "**Searches with spend and no conversions.** Search terms that cost real money and never converted. Most become negative keywords.",
          "**Analyse with AI.** A short list of insights from your numbers, each with a next step.",
        ],
      },
      { h2: "Tips to stop wasting ad spend" },
      {
        ul: [
          "**Check the search terms report every week.** It shows the actual searches that triggered your ads. Add irrelevant ones (\"free\", \"jobs\", \"DIY\", competitors you don't want) as negative keywords.",
          "**Fix landing pages before raising bids.** A faster, clearer page lowers your cost per click and raises conversions. See [why your website is slow](/blog/why-is-my-website-slow).",
          "**Watch the Quality Score columns.** Add Quality Score, Expected CTR, Ad relevance and Landing page experience to your keywords view. Below average in any of them means you pay more per click.",
          "**Match the ad to the page.** The headline people click should match the headline they land on. Mismatches waste clicks.",
          "**Don't change everything at once.** Smart bidding needs a week or two to settle after big changes. Change one thing, then wait.",
          "**Use ad schedule and location reports.** Cut bids at hours and in places that never convert.",
          "**Keep an eye on brand campaigns.** If no competitor bids on your name and you already rank first, test whether the ads add any clicks you wouldn't get anyway.",
        ],
      },
      { h2: "Next steps" },
      {
        p: "Connect [Search Console](/blog/google-search-console-setup-guide) to see paid and organic side by side, and [Google Analytics 4](/blog/google-analytics-4-setup-guide) for what visitors do after the click. Then [run a free audit](/) of the pages your ads send people to.",
      },
    ],
    faq: [
      [
        "How much does Google Ads cost?",
        "You set the budget. You pay per click, and the price depends on how competitive the search is. Start with a small daily budget, measure conversions, then grow what works.",
      ],
      [
        "What is Google Ads Expert mode?",
        "Expert mode is the full Google Ads interface, with control over campaign types, keywords, bidding and reporting. Smart mode is a simplified version with less control. Switch to Expert mode when you first set up the account.",
      ],
      [
        "What is landing page experience in Google Ads?",
        "It's Google's rating of how useful, relevant and easy to use the page after the click is. A below-average rating lowers your Quality Score and raises your cost per click. Speed, mobile usability and relevance all count.",
      ],
      [
        "Can Pagelyt change my Google Ads campaigns?",
        "No. Pagelyt asks for read-only access. It reads spend, keywords and search terms but can't change campaigns, bids or budgets. Disconnect any time from your account page.",
      ],
      [
        "Should I run Google Ads if I already rank on Google?",
        "Sometimes. Ads can take extra space on the results page and cover searches you don't rank for. But paying for searches where you're already in the top 3 can waste money. Pagelyt shows those overlaps so you can test pausing them.",
      ],
    ],
    related: ["google-search-console-setup-guide", "google-analytics-4-setup-guide", "why-is-my-website-slow"],
  },
];
