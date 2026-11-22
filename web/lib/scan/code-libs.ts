/* Bundled list of popular browser JavaScript libraries with publicly known vulnerabilities, used by the Code security
   checks (./code.ts). Each library is found by its file URL (CDN path or file name with a version) or by the
   version banner inside the file. Each rule says which versions are affected, the CVE, and what to upgrade to.
   Sources: the NVD entries for each CVE and the libraries' own release notes. Review this list when a big CVE lands
   in one of these libraries; anything not listed here is simply not reported. */

export type LibRule = {
  /** Affected when the version is at least `from` (default: any) and below `below`. */
  from?: string;
  below: string;
  cve: string;
  severity: "high" | "medium" | "low";
  /** What the flaw lets an attacker do, in plain words. */
  risk: string;
};

export type Lib = {
  name: string;
  /** Names used in CDN paths and file names (e.g. "jquery" in /jquery@3.4.1/ or jquery-3.4.1.min.js). */
  files: string[];
  /** Version banners or bundled markers inside the file; group 1 is the version. */
  body: RegExp[];
  /** Extra URL patterns (group 1 is the version) for paths that don't follow the name@version or name-version form. */
  url?: RegExp[];
  rules: LibRule[];
  /** The version to upgrade to (the oldest one with every listed fix). */
  fixed: string;
  /** Whole major lines that no longer get security fixes, e.g. "1" for AngularJS 1.x. */
  eol?: { major: string; note: string };
};

const V = String.raw`(\d+\.\d+\.\d+)`;

export const LIBS: Lib[] = [
  {
    name: "jQuery",
    files: ["jquery"],
    body: [new RegExp(String.raw`\bjQuery (?:JavaScript Library )?v${V}`), new RegExp(String.raw`\bjquery:\s*["']${V}["']`)],
    url: [new RegExp(String.raw`/wp-includes/js/jquery/jquery(?:\.min)?\.js\?ver=${V}`)],
    rules: [
      { below: "1.9.0", cve: "CVE-2012-6708", severity: "medium", risk: "cross-site scripting through selectors built from page input" },
      { below: "3.0.0", cve: "CVE-2015-9251", severity: "medium", risk: "cross-site scripting when loading content from another site" },
      { below: "3.4.0", cve: "CVE-2019-11358", severity: "medium", risk: "prototype pollution through jQuery.extend" },
      { below: "3.5.0", cve: "CVE-2020-11022", severity: "medium", risk: "cross-site scripting when HTML from untrusted sources is inserted into the page" },
    ],
    fixed: "3.5.0",
  },
  {
    name: "jQuery UI",
    files: ["jquery-ui", "jqueryui"],
    body: [new RegExp(String.raw`jQuery UI - v${V}`)],
    url: [new RegExp(String.raw`code\.jquery\.com/ui/${V}/`)],
    rules: [
      { below: "1.13.0", cve: "CVE-2021-41184", severity: "medium", risk: "cross-site scripting through widget options" },
      { below: "1.13.2", cve: "CVE-2022-31160", severity: "medium", risk: "cross-site scripting in checkbox and radio widgets" },
    ],
    fixed: "1.13.2",
  },
  {
    name: "jQuery Validation",
    files: ["jquery-validate", "jquery.validate"],
    body: [new RegExp(String.raw`jQuery Validation Plugin - v${V}`)],
    rules: [{ below: "1.19.3", cve: "CVE-2021-21252", severity: "low", risk: "a crafted value can freeze the page (ReDoS)" }],
    fixed: "1.19.3",
  },
  {
    name: "Bootstrap",
    files: ["bootstrap", "twitter-bootstrap"],
    body: [new RegExp(String.raw`Bootstrap v${V}`)],
    rules: [
      { below: "3.4.0", cve: "CVE-2018-14042", severity: "medium", risk: "cross-site scripting through tooltip and popover options" },
      { below: "3.4.1", cve: "CVE-2019-8331", severity: "medium", risk: "cross-site scripting through tooltip and popover options" },
      { from: "4.0.0", below: "4.3.1", cve: "CVE-2019-8331", severity: "medium", risk: "cross-site scripting through tooltip and popover options" },
    ],
    fixed: "4.3.1",
  },
  {
    name: "AngularJS",
    files: ["angular.js", "angularjs", "angular"],
    body: [new RegExp(String.raw`@license AngularJS v${V}`)],
    rules: [
      { below: "1.6.9", cve: "CVE-2019-10768", severity: "medium", risk: "prototype pollution" },
      { below: "1.8.0", cve: "CVE-2020-7676", severity: "medium", risk: "cross-site scripting when sanitising HTML" },
    ],
    fixed: "1.8.3",
    eol: { major: "1", note: "AngularJS stopped getting security fixes at the end of 2021" },
  },
  {
    name: "Lodash",
    files: ["lodash"],
    body: [new RegExp(String.raw`@license\s+(?:Lo-Dash|lodash)\s+${V}`, "i")],
    rules: [
      { below: "4.17.12", cve: "CVE-2019-10744", severity: "high", risk: "prototype pollution through defaultsDeep" },
      { below: "4.17.21", cve: "CVE-2021-23337", severity: "high", risk: "code injection through the template function" },
    ],
    fixed: "4.17.21",
  },
  {
    name: "Underscore",
    files: ["underscore"],
    body: [new RegExp(String.raw`(?:^|\n)\s*(?:\/\/|\/\*!?|\*)\s*Underscore\.js\s+${V}`)],
    rules: [{ from: "1.3.2", below: "1.12.1", cve: "CVE-2021-23358", severity: "high", risk: "code injection through the template function" }],
    fixed: "1.12.1",
  },
  {
    name: "Moment.js",
    files: ["moment"],
    body: [new RegExp(String.raw`//! moment\.js\s*\n//! version : ${V}`)],
    rules: [{ below: "2.29.4", cve: "CVE-2022-31129", severity: "low", risk: "long crafted date strings can freeze the page (ReDoS)" }],
    fixed: "2.29.4",
  },
  {
    name: "Handlebars",
    files: ["handlebars"],
    body: [new RegExp(String.raw`@license\s+handlebars v${V}`, "i")],
    rules: [{ below: "4.7.7", cve: "CVE-2021-23369", severity: "high", risk: "code execution when compiling templates from untrusted sources" }],
    fixed: "4.7.7",
  },
  {
    name: "DOMPurify",
    files: ["dompurify"],
    body: [new RegExp(String.raw`@license DOMPurify ${V}`)],
    rules: [
      { below: "2.0.17", cve: "CVE-2020-26870", severity: "high", risk: "sanitised HTML can still run scripts (mutation XSS)" },
      { below: "2.5.4", cve: "CVE-2024-45801", severity: "medium", risk: "deeply nested HTML can get past the sanitiser" },
      { from: "3.0.0", below: "3.1.3", cve: "CVE-2024-45801", severity: "medium", risk: "deeply nested HTML can get past the sanitiser" },
    ],
    fixed: "3.1.3",
  },
  {
    name: "Vue",
    files: ["vue"],
    body: [new RegExp(String.raw`Vue\.js v${V}`)],
    rules: [],
    fixed: "3.4.0",
    eol: { major: "2", note: "Vue 2 stopped getting security fixes at the end of 2023" },
  },
  {
    name: "Knockout",
    files: ["knockout"],
    body: [new RegExp(String.raw`Knockout JavaScript library v${V}`)],
    rules: [{ below: "3.5.0", cve: "CVE-2019-14862", severity: "medium", risk: "cross-site scripting through attribute bindings" }],
    fixed: "3.5.0",
  },
  {
    name: "Chart.js",
    files: ["chart.js", "chartjs"],
    body: [new RegExp(String.raw`Chart\.js v${V}`)],
    rules: [{ below: "2.9.4", cve: "CVE-2020-7746", severity: "medium", risk: "prototype pollution through chart options" }],
    fixed: "2.9.4",
  },
  {
    name: "Select2",
    files: ["select2"],
    body: [new RegExp(String.raw`Select2 ${V}`)],
    rules: [{ below: "4.0.6", cve: "CVE-2016-10744", severity: "medium", risk: "cross-site scripting through option labels" }],
    fixed: "4.0.6",
  },
  {
    name: "Swiper",
    files: ["swiper"],
    body: [new RegExp(String.raw`\* Swiper ${V}`)],
    rules: [{ below: "6.5.1", cve: "CVE-2021-23370", severity: "medium", risk: "prototype pollution" }],
    fixed: "6.5.1",
  },
  {
    name: "Axios",
    files: ["axios"],
    body: [new RegExp(String.raw`axios v${V}`, "i")],
    rules: [{ from: "0.8.1", below: "1.6.0", cve: "CVE-2023-45857", severity: "medium", risk: "the XSRF-TOKEN cookie is sent to other sites, which can lead to cross-site request forgery" }],
    fixed: "1.6.0",
  },
  {
    name: "Highlight.js",
    files: ["highlight.js", "highlightjs"],
    body: [new RegExp(String.raw`Highlight\.js v${V}`)],
    rules: [{ below: "10.4.1", cve: "CVE-2020-26237", severity: "low", risk: "prototype pollution with crafted code blocks" }],
    fixed: "10.4.1",
  },
  {
    name: "Marked",
    files: ["marked"],
    body: [new RegExp(String.raw`marked v${V}`)],
    rules: [{ below: "4.0.10", cve: "CVE-2022-21681", severity: "low", risk: "crafted Markdown can freeze the page (ReDoS)" }],
    fixed: "4.0.10",
  },
  {
    name: "TinyMCE",
    files: ["tinymce"],
    body: [new RegExp(String.raw`TinyMCE version ${V}`)],
    rules: [{ below: "5.10.7", cve: "CVE-2022-23494", severity: "medium", risk: "cross-site scripting through pasted or loaded content" }],
    fixed: "5.10.7",
  },
  {
    name: "Video.js",
    files: ["video.js", "videojs"],
    body: [new RegExp(String.raw`Video\.js ${V}`)],
    rules: [{ below: "7.14.3", cve: "CVE-2021-23414", severity: "medium", risk: "cross-site scripting through track labels" }],
    fixed: "7.14.3",
  },
  {
    name: "PDF.js",
    files: ["pdfjs-dist", "pdf.js"],
    body: [new RegExp(String.raw`pdfjsVersion\s*=\s*["']${V}["']`)],
    rules: [{ below: "4.2.67", cve: "CVE-2024-4367", severity: "high", risk: "opening a crafted PDF can run scripts on your site" }],
    fixed: "4.2.67",
  },
  {
    name: "Prototype",
    files: ["prototype"],
    body: [new RegExp(String.raw`Prototype JavaScript framework, version ${V}`)],
    rules: [{ below: "1.7.4", cve: "CVE-2020-27511", severity: "low", risk: "crafted strings can freeze the page (ReDoS)" }],
    fixed: "1.7.4",
    eol: { major: "1", note: "Prototype is no longer maintained" },
  },
];

/** -1, 0 or 1. Versions are dotted numbers; missing parts count as 0. */
export function cmpVersion(a: string, b: string): number {
  const x = a.split(".").map((n) => parseInt(n, 10) || 0);
  const y = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** The rules a version is affected by. */
export function affected(lib: Lib, version: string): LibRule[] {
  return lib.rules.filter((r) => cmpVersion(version, r.below) < 0 && (!r.from || cmpVersion(version, r.from) >= 0));
}
