/* Turns the OpenAI Responses API reply into { answer, citations }. Pure, so the response shape
   is covered by tests with fixtures. It follows OpenAI's public docs at the time of writing; if
   the format changes, the failing run records an error instead of a false "not mentioned". */

export type Raw = { answer: string; citations: string[] };

type Json = Record<string, unknown>;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const urls = (xs: unknown[]) => [...new Set(xs.map((x) => (typeof x === "string" ? x : str((x as Json)?.url))).filter((u) => /^https?:\/\//.test(u)))];

/** OpenAI Responses API with web search: output[].content[].text and url_citation annotations. */
export function parseOpenAI(j: Json): Raw {
  let answer = "";
  const found: unknown[] = [];
  for (const item of arr(j.output) as Json[]) {
    if (item.type !== "message") continue;
    for (const c of arr(item.content) as Json[]) {
      answer += str(c.text);
      for (const a of arr(c.annotations) as Json[]) if (a.type === "url_citation") found.push(a.url);
    }
  }
  return { answer: answer || str(j.output_text), citations: urls(found) };
}
