/* Every technology the scan can recognise, grouped for the dashboard's "What we detect" modal.
   Keep in step with RULES in extras.ts (that file holds the actual detection tests). */
export const TECH_CATALOG: { category: string; names: string[] }[] = [
  { category: "CMS", names: ["WordPress", "Wix", "Squarespace", "Webflow", "Drupal", "Ghost", "Framer"] },
  { category: "Page builder", names: ["Elementor", "Divi"] },
  { category: "E-commerce", names: ["Shopify", "WooCommerce", "Magento"] },
  { category: "Framework", names: ["Next.js", "Nuxt", "Gatsby", "Astro", "Remix", "Shopify Hydrogen"] },
  { category: "JavaScript", names: ["React", "Vue", "Angular", "jQuery", "Svelte"] },
  { category: "CSS", names: ["Bootstrap", "Tailwind CSS"] },
  { category: "Fonts", names: ["Google Fonts", "Font Awesome"] },
  { category: "CDN", names: ["Cloudflare", "AWS CloudFront", "Fastly", "Akamai"] },
  { category: "Hosting", names: ["Netlify", "Vercel"] },
  { category: "Server", names: ["nginx", "Apache"] },
  { category: "Language", names: ["PHP", "Laravel", "Django", "Ruby on Rails"] },
  { category: "Analytics", names: ["Google Analytics", "Plausible", "Hotjar", "Microsoft Clarity", "Mixpanel", "Segment"] },
  { category: "Tag manager", names: ["Google Tag Manager"] },
  { category: "Advertising", names: ["Meta Pixel", "TikTok Pixel", "LinkedIn Insight"] },
  { category: "Payments", names: ["Stripe", "Razorpay", "PayPal"] },
  { category: "Marketing", names: ["HubSpot", "Mailchimp"] },
  { category: "Support chat", names: ["Intercom", "Crisp", "Drift", "Zendesk"] },
  { category: "Security", names: ["reCAPTCHA"] },
  { category: "Monitoring", names: ["Sentry"] },
];
