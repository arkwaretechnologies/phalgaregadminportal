/** Canonical options for editing `regd.food_preference`. */
export const FOOD_PREFERENCE_OPTIONS = ['ANY DISH', 'NON Pork'] as const;

/** True when regd.food_preference has a non-empty trimmed value. */
export function hasFoodPreference(value: unknown): boolean {
  if (value == null) return false;
  return String(value).trim().length > 0;
}

/** Trimmed preference text, or null when empty. */
export function formatFoodPreference(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

export type FoodPreferenceKind = 'ALL' | 'ANY_DISH' | 'NON_PORK';

/** Normalize preference text for comparison. */
function normalizeFoodPreference(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Match food_preference text against report filter.
 * ANY_DISH / NON_PORK are case-insensitive; punctuation variants accepted for Non Pork.
 */
export function matchesFoodPreferenceFilter(
  value: unknown,
  filter: FoodPreferenceKind | string | null | undefined
): boolean {
  if (!hasFoodPreference(value)) return false;
  const kind = String(filter ?? 'ALL').trim().toUpperCase() as FoodPreferenceKind;
  if (kind === 'ALL' || !kind) return true;

  const normalized = normalizeFoodPreference(value);
  if (kind === 'ANY_DISH') {
    return normalized === 'ANY DISH';
  }
  if (kind === 'NON_PORK') {
    return (
      normalized === 'NON PORK' ||
      normalized === 'NONPORK' ||
      normalized === 'NO PORK'
    );
  }
  return true;
}
