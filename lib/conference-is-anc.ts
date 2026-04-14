/** True when conference `is_anc` is Y (ANC flow). */
export function conferenceIsAnc(value: string | null | undefined): boolean {
  return String(value ?? '').toUpperCase() === 'Y';
}
