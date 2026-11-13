import { parseOpenAI, type Raw } from "./parse";

/* AI visibility asks ChatGPT only (OpenAI Responses API with web search). It is switched on when
   OPENAI_API_KEY is set as a server secret. Results vary by model, prompt, location and time, and
   the API is not identical to the consumer app, so the product always presents them as samples. */

export const PROVIDER = { id: "openai", label: "ChatGPT" } as const;

/** Earlier runs may hold other providers; every view counts ChatGPT runs only. */
export const isTracked = (provider: string) => provider === PROVIDER.id;

export const configuredProviders = () => (process.env.OPENAI_API_KEY ? [{ ...PROVIDER }] : []);
export const providerLabel = (id: string) => (id === PROVIDER.id ? PROVIDER.label : id);

export async function askChatGpt(prompt: string): Promise<Raw> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45_000);
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", tools: [{ type: "web_search_preview" }], input: prompt }),
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
    return parseOpenAI((await r.json()) as Record<string, unknown>);
  } finally {
    clearTimeout(t);
  }
}
