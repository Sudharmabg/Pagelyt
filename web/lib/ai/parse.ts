/* Turns each provider's raw API response into { answer, citations }. Pure, so the response shapes
   are covered by tests with fixtures. These shapes follow each provider's public docs at the time
   of writing; if a provider changes its format, the failing run records an error instead of
   a false "not mentioned". */

export type Raw = { answer: string; citations: string[] };

type Json = Record<string, unknown>;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const urls = (xs: unknown[]) => [...new Set(xs.map((x) => (typeof x === "string" ? x : str((x as Json)?.url))).filter((u) => /^https?:\/\//.test(u)))];

/** Perplexity chat completions: `citations` (strings) and/or `search_results` ({url}). */
export function parsePerplexity(j: Json): Raw {
  const msg = (arr(j.choices)[0] as Json | undefined)?.message as Json | undefined;
  return { answer: str(msg?.content), citations: urls([...arr(j.citations), ...arr(j.search_results)]) };
}

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

/** Anthropic Messages API with the web search tool: text blocks (with citations) and search results. */
export function parseAnthropic(j: Json): Raw {
  let answer = "";
  const found: unknown[] = [];
  for (const b of arr(j.content) as Json[]) {
    if (b.type === "text") {
      answer += str(b.text);
      for (const c of arr(b.citations) as Json[]) found.push(c.url);
    } else if (b.type === "web_search_tool_result") {
      for (const r of arr(b.content) as Json[]) found.push(r.url);
    }
  }
  return { answer, citations: urls(found) };
}
