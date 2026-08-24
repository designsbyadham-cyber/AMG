/**
 * Pull a JSON object out of a model reply.
 *
 * Preferred over a provider's strict JSON mode: that mode turns a
 * truncated answer into a hard 400, and self-hosted models vary in
 * whether they support it at all. Models also like to wrap JSON in code
 * fences or add a sentence of preamble, so take the first balanced
 * object rather than assuming the whole reply parses.
 *
 * Returns `null` when nothing parseable is present; callers treat that
 * as "the model failed", never as "no suggestions".
 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Not a bare object — scan for the first balanced one below.
  }

  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}
