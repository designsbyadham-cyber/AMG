// IMPORTANT: this module is server-only — it reads the provider API key
// from the environment, which must never reach the browser bundle. Only
// import it from route handlers. (Following the same convention as
// src/lib/auth/account.ts, the project doesn't pull in the `server-only`
// package for this.)

/**
 * The one place that talks to a model.
 *
 * Groq and Ollama both speak the OpenAI chat-completions shape, so a
 * single code path covers "free hosted open-weight model today" and
 * "self-hosted on our own box later" — swapping providers is an env
 * change, not a rewrite. Feature code never imports a vendor SDK.
 *
 * Two deliberate properties:
 *  - **It never throws.** Callers get a tagged result. An outage or a
 *    missing key degrades to a disabled button, not a 500.
 *  - **It always times out.** A hung upstream must not hold a serverless
 *    function open until the platform kills it; that is exactly how this
 *    app produced MIDDLEWARE_INVOCATION_TIMEOUT before.
 */

const TIMEOUT_MS = 20_000;

export type AiFailure =
  | 'not_configured'
  | 'timeout'
  | 'rate_limited'
  | 'upstream_error'
  | 'empty_response';

export type AiResult =
  | { ok: true; text: string }
  | { ok: false; reason: AiFailure; detail?: string };

interface ChatOptions {
  system: string;
  user: string;
  maxTokens?: number;
  /** Lower for extraction, higher for prose. */
  temperature?: number;
  /** Ask the model for a JSON object rather than prose. */
  json?: boolean;
}

interface ProviderConfig {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  /** Ollama serves local models without auth. */
  requiresKey: boolean;
}

function resolveConfig(): ProviderConfig {
  const provider = (process.env.AI_PROVIDER ?? 'groq').toLowerCase();

  if (provider === 'ollama') {
    return {
      baseUrl: (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434') + '/v1',
      apiKey: process.env.OLLAMA_API_KEY ?? 'ollama',
      model: process.env.AI_MODEL ?? 'llama3.1',
      requiresKey: false,
    };
  }

  return {
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY ?? null,
    model: process.env.AI_MODEL ?? 'llama-3.3-70b-versatile',
    requiresKey: true,
  };
}

/** True when the server has what it needs to call a model. */
export function isAiConfigured(): boolean {
  const cfg = resolveConfig();
  return !cfg.requiresKey || Boolean(cfg.apiKey);
}

export async function chat(options: ChatOptions): Promise<AiResult> {
  const cfg = resolveConfig();
  if (cfg.requiresKey && !cfg.apiKey) {
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey ?? ''}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 500,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    if (res.status === 429) return { ok: false, reason: 'rate_limited' };

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      console.error('[ai] upstream error', res.status, detail);
      return { ok: false, reason: 'upstream_error', detail: `HTTP ${res.status}` };
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, reason: 'empty_response' };

    return { ok: true, text };
  } catch (err) {
    // AbortSignal.timeout surfaces as TimeoutError.
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, reason: 'timeout' };
    }
    console.error('[ai] request failed:', err);
    return { ok: false, reason: 'upstream_error' };
  }
}

/** Human-readable copy for each failure, shown in the UI. */
export const AI_FAILURE_MESSAGE: Record<AiFailure, string> = {
  not_configured: 'AI is not set up yet — add a provider key to enable it.',
  timeout: 'The model took too long to answer. Try again.',
  rate_limited: 'Hit the free-tier limit. Wait a minute and try again.',
  upstream_error: 'The AI provider is unavailable right now.',
  empty_response: 'The model returned nothing. Try again.',
};
