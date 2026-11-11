import Link from "next/link";
import { Arrow } from "../arrow";
import { TOOL_LIST, type ToolInfo } from "./catalog";
import { TONE, ToolIcon } from "./icons";
import { ToolSample } from "./samples";

type CardTool = Pick<ToolInfo, "slug" | "name" | "blurb" | "category" | "paid">;

/** One tool as a card with an example result. Hover or focus replays the example (CSS: .tf-card).
    Used on the home page, the /tools directory and each tool page's "More free tools". */
export function ToolCard({ t }: { t: CardTool }) {
  return (
    <Link href={`/tools/${t.slug}`} className={`tf-card ${TONE[t.category]}`}>
      <span className="tf-top">
        <span className="tf-ic">
          <ToolIcon slug={t.slug} size={22} />
        </span>
        <span className="tf-cat">{t.category}</span>
        <span className={`tf-free${t.paid ? " paid" : ""}`}>{t.paid ? "Paid" : "Free"}</span>
      </span>
      <ToolSample slug={t.slug} compact />
      <b>{t.name}</b>
      <span className="tf-txt">{t.blurb}</span>
      <span className="tf-go">
        {t.paid ? "See the tool" : "Try it free"} <Arrow />
      </span>
    </Link>
  );
}

/** A wide banner linking to the /tools directory, with a floating icon for every tool. The whole banner is the link. */
export function AllToolsBanner() {
  return (
    <Link href="/tools" className="tall-band">
      <span className="tall-copy">
        <b>{TOOL_LIST.length} tools. One free account.</b>
        <span>Check AI access, crawling, how you look in Google, security and more. Nothing to install.</span>
      </span>
      <span className="tall-icons" aria-hidden="true">
        {TOOL_LIST.map((t, i) => (
          <span key={t.slug} className={`tall-ic ${TONE[t.category]}`} style={{ ["--i" as string]: i }}>
            <ToolIcon slug={t.slug} size={18} />
          </span>
        ))}
      </span>
      <span className="btn tall-btn">
        Browse all tools <Arrow />
      </span>
    </Link>
  );
}
