/** Award + ≥1 billable accompanying (non-representative) row on approve. */
export const APPROVED_REPRESENTATIVE_AND_ACCOMPANYING =
  'APPROVED REPRESENTATIVE AND ACCOMPANYING' as const;

/** Legacy DB value; treated like {@link APPROVED_REPRESENTATIVE_AND_ACCOMPANYING} in queries and UI copy. */
export const APPROVED_PARTICIPANT_AND_ACCOMPANYING_LEGACY =
  'APPROVED PARTICIPANT AND ACCOMPANYING' as const;

/** Award conference: representative only (no paid accompanying rows). */
export const ACCEPTED_AWARD_STATUS = 'ACCEPTED' as const;

/**
 * Award-flow label: shown in admin when `is_award = Y` and status is pending-like **or**
 * already stored on `regh.status` exactly as this string (e.g. from the registration portal).
 */
export const APPROVED_REPRESENTATIVE_ONLY =
  'APPROVED REPRESENTATIVE ONLY' as const;

/** Portal marks the free representative row with this first name. */
export const REPRESENTATIVE_FIRSTNAME = 'REPRESENTATIVE' as const;

export function isRepresentativeRegdFirstname(firstname: string | null | undefined): boolean {
  return String(firstname ?? '').trim().toUpperCase() === REPRESENTATIVE_FIRSTNAME;
}

/** Billable / “accompanying” count for award conferences (excludes representative row). */
export function countAwardAccompanyingOnly(
  regd: ReadonlyArray<{ firstname?: string | null }> | null | undefined
): number {
  if (!regd?.length) return 0;
  return regd.reduce(
    (n, row) => (isRepresentativeRegdFirstname(row.firstname) ? n : n + 1),
    0
  );
}

export function maxRegdLinenum(
  regd: ReadonlyArray<{ linenum?: number | null }> | null | undefined
): number {
  if (!regd?.length) return 0;
  return regd.reduce((max, row) => {
    const n = Number(row?.linenum);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

/**
 * `linenum` for a REPRESENTATIVE row synthesized from `regh` on award exports.
 * When the registration has accompanying `regd` rows: max(`linenum`) + 1; otherwise `0`.
 */
export function linenumForReghRepresentativeExport(
  regdRowsForRegid: ReadonlyArray<{ linenum?: number | null; firstname?: string | null }>
): number {
  const hasAccompanying = regdRowsForRegid.some(
    (row) => !isRepresentativeRegdFirstname(row.firstname)
  );
  if (!hasAccompanying) return 0;
  return maxRegdLinenum(regdRowsForRegid) + 1;
}

export const APPROVED_STATUS_VALUES: readonly string[] = [
  'APPROVED',
  APPROVED_REPRESENTATIVE_AND_ACCOMPANYING,
  APPROVED_PARTICIPANT_AND_ACCOMPANYING_LEGACY,
  ACCEPTED_AWARD_STATUS,
];

export function isApprovedStatus(status: string | null | undefined): boolean {
  if (status == null) return false;
  return APPROVED_STATUS_VALUES.includes(status);
}

export function conferenceIsAward(is_award: string | null | undefined): boolean {
  return String(is_award ?? '').toUpperCase() === 'Y';
}

/** Stored statuses for award final approval emails (portal-style template). */
export function isAwardConfirmationEmailStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim();
  return (
    s === APPROVED_REPRESENTATIVE_AND_ACCOMPANYING ||
    s === ACCEPTED_AWARD_STATUS ||
    s === APPROVED_PARTICIPANT_AND_ACCOMPANYING_LEGACY
  );
}

/** Admin/email line: map legacy DB string to current wording. */
export function displayAwardFinalApprovalLabel(status: string | null | undefined): string {
  const u = String(status ?? '').trim();
  if (u.toUpperCase() === APPROVED_PARTICIPANT_AND_ACCOMPANYING_LEGACY) {
    return APPROVED_REPRESENTATIVE_AND_ACCOMPANYING;
  }
  return u;
}

/** Section heading above `regd` rows on registration detail (award → ACCOMPANYING). */
export function registrationDetailParticipantsSectionTitle(
  is_award: string | null | undefined
): string {
  return conferenceIsAward(is_award) ? 'ACCOMPANYING' : 'Participants';
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
