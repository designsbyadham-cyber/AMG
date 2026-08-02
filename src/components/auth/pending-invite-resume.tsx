'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getPendingInvite } from '@/lib/auth/pending-invite';

/**
 * Resumes an interrupted invite acceptance.
 *
 * If a teammate signed up through an invite link but the email
 * confirmation dropped them into the app instead of back on
 * `/join/<token>`, the token is still in localStorage. On the first
 * authenticated page load we send them to the join page so they can
 * accept — otherwise they'd sit silently in their own empty account.
 *
 * Renders nothing. Established users never have the key set, so this is
 * inert for everyone except a mid-flight invitee. The join page clears
 * the token on redeem (and on a terminal peek failure), so this fires
 * at most once and can't trap anyone in a redirect loop.
 */
export function PendingInviteResume() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Already on the join page — let it run its own flow.
    if (pathname?.startsWith('/join')) return;
    const token = getPendingInvite();
    if (!token) return;
    router.replace(`/join/${encodeURIComponent(token)}`);
  }, [pathname, router]);

  return null;
}
