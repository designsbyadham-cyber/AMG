/**
 * Pending-invite persistence.
 *
 * An invited teammate's token has to survive: /join/<token> → signup →
 * email confirmation → back into the app. Supabase only returns them to
 * `/join/<token>` if that URL is in the project's Auth redirect
 * allowlist; otherwise the confirmation link drops them on the site root
 * with the token gone, they land in their own fresh personal account,
 * and the invite is never redeemed.
 *
 * Stashing the token in localStorage closes that gap: whatever the
 * redirect does, the app can resume the join on the next authenticated
 * page load. Belt-and-braces alongside the allowlist entry, not a
 * replacement for it.
 */

const KEY = 'amg.pendingInvite';
/** Invites are short-lived; don't let a stale token hijack a later session. */
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface StoredInvite {
  token: string;
  savedAt: number;
}

export function setPendingInvite(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    const payload: StoredInvite = { token, savedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode / storage disabled — the allowlist path still works.
  }
}

/** Returns the pending token, or null when absent, malformed, or expired. */
export function getPendingInvite(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredInvite>;
    if (typeof parsed?.token !== 'string' || typeof parsed?.savedAt !== 'number') {
      window.localStorage.removeItem(KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // No-op — nothing to clean up if storage is unavailable.
  }
}
