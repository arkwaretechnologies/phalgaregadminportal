/** Stored on `regh.status` when an award conference (`conference.is_award = Y`) is approved. */
export const APPROVED_PARTICIPANT_AND_ACCOMPANYING =
  'APPROVED PARTICIPANT AND ACCOMPANYING' as const;

export const APPROVED_STATUS_VALUES: readonly string[] = [
  'APPROVED',
  APPROVED_PARTICIPANT_AND_ACCOMPANYING,
];

export function isApprovedStatus(status: string | null | undefined): boolean {
  if (status == null) return false;
  return APPROVED_STATUS_VALUES.includes(status);
}
