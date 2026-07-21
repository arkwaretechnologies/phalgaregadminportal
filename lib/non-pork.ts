/** True when regd.non_pork is stored as boolean true or common Y/1/true strings. */
export function isNonPorkFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value == null) return false;
  const s = String(value).trim().toUpperCase();
  return s === 'Y' || s === 'TRUE' || s === '1';
}
