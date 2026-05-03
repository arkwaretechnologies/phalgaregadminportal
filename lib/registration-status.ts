/** Stored on `regh.status` when an award conference (`conference.is_award = Y`) is approved. */
export const APPROVED_PARTICIPANT_AND_ACCOMPANYING =
  'APPROVED PARTICIPANT AND ACCOMPANYING' as const;

/**
 * Award-flow label: shown in admin when `is_award = Y` and status is pending-like **or**
 * already stored on `regh.status` exactly as this string (e.g. from the registration portal).
 */
export const APPROVED_REPRESENTATIVE_ONLY =
  'APPROVED REPRESENTATIVE ONLY' as const;

export const APPROVED_STATUS_VALUES: readonly string[] = [
  'APPROVED',
  APPROVED_PARTICIPANT_AND_ACCOMPANYING,
];

export function isApprovedStatus(status: string | null | undefined): boolean {
  if (status == null) return false;
  return APPROVED_STATUS_VALUES.includes(status);
}

export function conferenceIsAward(is_award: string | null | undefined): boolean {
  return String(is_award ?? '').toUpperCase() === 'Y';
}

/** Still awaiting reviewer action (`regh` pending / empty). */
export function isPendingLikeRegistrationStatus(
  status: string | null | undefined
): boolean {
  if (status == null) return true;
  const s = String(status).trim();
  if (s === '') return true;
  return s.toUpperCase() === 'PENDING';
}

/**
 * When `conference.is_award = Y`, admin lists/details show {@link APPROVED_REPRESENTATIVE_ONLY}
 * for these database status values (pending **or** already stored representative-only).
 */
export function isAwardRepresentativePhaseDbStatus(
  status: string | null | undefined
): boolean {
  if (isPendingLikeRegistrationStatus(status)) return true;
  return (
    String(status ?? '').trim().toUpperCase() === APPROVED_REPRESENTATIVE_ONLY
  );
}
