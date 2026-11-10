import { TOOL_LIST } from "./tools/catalog";

// Summary of the free tools, shown under Features. The tools themselves live at /tools/<slug>.
export const FREE_TOOLS: { name: string; blurb: string }[] = TOOL_LIST.map((t) => ({ name: t.name, blurb: t.blurb }));
