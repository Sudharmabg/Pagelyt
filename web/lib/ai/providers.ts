import { parseAnthropic, parseOpenAI, parsePerplexity, type Raw } from "./parse";

/* The AI systems we ask. Each is enabled only when its API key is set as a server secret.
   Results vary by model, prompt, location and time, and these APIs are not identical to the
   consumer apps, so the product always presents them as samples, not rankings. */

export type ProviderId = "perplexity" | "openai" | "anthropic";

type Provider = { id: ProviderId; label: string; key: () => string | undefined; call: (prompt: string, key: string, signal: AbortSignal) => Promise<Raw> };

const post = async (url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal) => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return (await r.json()) as Record<string, unknown>;
};

const PROVIDERS: Provider[] = [
  {
    id: "perplexity",
    label: "Perplexity",
    key: () => process.env.PERPLEXITY_API_KEY,
    call: async (prompt, key, signal) =>
      parsePerplexity(await post("https://api.perplexity.ai/chat/completions", { authorization: `Bearer ${key}` }, { model: process.env.PERPLEXITY_MODEL || "sonar", messages: [{ role: "user", content: prompt }] }, signal)),
  },
  {
    id: "openai",
    label: "ChatGPT",
    key: () => process.env.OPENAI_API_KEY,
    call: async (prompt, key, signal) =>
      parseOpenAI(await post("https://api.openai.com/v1/responses", { authorization: `Bearer ${key}` }, { model: process.env.OPENAI_MODEL || "gpt-4.1-mini", tools: [{ type: "web_search_preview" }], input: prompt }, signal)),
  },
  {
    id: "anthropic",
    label: "Claude",
    key: () => process.env.ANTHROPIC_API_KEY,
    call: async (prompt, key, signal) =>
      parseAnthropic(
        await post(
          "https://api.anthropic.com/v1/messages",
          { "x-api-key": key, "anthropic-version": "2023-06-01" },
          {
            model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
            max_tokens: 1024,
            tools: [{ type: process.env.ANTHROPIC_WEB_SEARCH_TOOL || "web_search_20250305", name: "web_search", max_uses: 3 }],
            messages: [{ role: "user", content: prompt }],
          },
          signal
        )
      ),
  },
];

export const configuredProviders = () => PROVIDERS.filter((p) => !!p.key()).map((p) => ({ id: p.id, label: p.label }));
export const providerLabel = (id: string) => PROVIDERS.find((p) => p.id === id)?.label ?? id;

export async function askProvider(id: ProviderId, prompt: string): Promise<Raw> {
  const p = PROVIDERS.find((x) => x.id === id);
  const key = p?.key();
  if (!p || !key) throw new Error("Provider not configured");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45_000);
  try {
    return await p.call(prompt, key, ctl.signal);
  } finally {
    clearTimeout(t);
  }
}
