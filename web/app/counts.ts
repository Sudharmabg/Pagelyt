/* Shared counts for copy, so every page says the same number. Areas come from the scan's MODULE_NAMES, tools from
   TOOL_LIST. Plain data, safe to import anywhere (features-data, content, server and client components). */
import { MODULE_NAMES } from "@/lib/scan/types";
import { TOOL_LIST } from "./tools/catalog";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
/** "nine" for 9; digits past fifteen. */
export const inWords = (n: number) => WORDS[n] ?? String(n);
export const capWords = (n: number) => inWords(n).replace(/^./, (c) => c.toUpperCase());

/** Scored areas in every scan, in report order. */
export const AREA_NAMES: string[] = Object.values(MODULE_NAMES);
export const AREA_COUNT = AREA_NAMES.length;
/** "health, speed, …, privacy and code security": every area in a sentence. */
export const AREA_LIST = (() => {
  // Keep acronyms (SEO, GEO) as they are; lower-case the first letter of the rest.
  const n = AREA_NAMES.map((a) => (/^[A-Z]{2}/.test(a) ? a : a.charAt(0).toLowerCase() + a.slice(1)));
  return `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
})();

/** Every tool is free with a Pagelyt account. */
export const TOOL_COUNT = TOOL_LIST.length;

/** A page title that stays within 60 characters: adds the " | Pagelyt" template only when it fits. */
export const fitTitle = (t: string) => (t.length + " | Pagelyt".length > 60 ? { absolute: t } : t);
