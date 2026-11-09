import Link from "next/link";
import type { Block } from "../blog-data";

// Inline markup: **bold** and [text](/internal-path).
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  return (
    <>
      {parts.map((s, i) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(s);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(s);
        if (link) return <Link key={i} href={link[2]}>{link[1]}</Link>;
        return s;
      })}
    </>
  );
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function Body({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if ("h2" in b) return <h2 key={i} id={slugify(b.h2)}>{b.h2}</h2>;
        if ("h3" in b) return <h3 key={i}>{b.h3}</h3>;
        if ("p" in b) return <p key={i}><Inline text={b.p} /></p>;
        if ("tip" in b) return <aside key={i} className="post-tip"><Inline text={b.tip} /></aside>;
        if ("code" in b) return <pre key={i} className="post-code"><code>{b.code}</code></pre>;
        const items = "ul" in b ? b.ul : b.ol;
        const Tag = "ul" in b ? "ul" : "ol";
        return (
          <Tag key={i}>
            {items.map((t) => (
              <li key={t}><Inline text={t} /></li>
            ))}
          </Tag>
        );
      })}
    </>
  );
}

export const toc = (blocks: Block[]) =>
  blocks.flatMap((b) => ("h2" in b ? [{ id: slugify(b.h2), text: b.h2 }] : []));
