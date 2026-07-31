export function normalizeParticipantField(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).trim();
}

export type ParticipantDuplicateFields = {
  confcode?: string | null;
  lastname?: string | null;
  firstname?: string | null;
  province?: string | null;
  lgu?: string | null;
};

export function participantDuplicateKey(p: ParticipantDuplicateFields): string {
  const c = normalizeParticipantField(p.confcode);
  const last = normalizeParticipantField(p.lastname);
  const first = normalizeParticipantField(p.firstname);
  const prov = normalizeParticipantField(p.province);
  const lgu = normalizeParticipantField(p.lgu);
  return `${c}\t${last}\t${first}\t${prov}\t${lgu}`;
}

export type DuplicateRegistrationMatch = {
  regid: string;
  status: string | null;
  regdate: string | null;
};

/** PENDING / APPROVED (and award variants) are comparable; REJECTED is never a duplicate match. */
export function isDuplicateComparableStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toUpperCase();
  if (s === 'REJECTED') return false;
  return true;
}

export type RegdWithRegistration = ParticipantDuplicateFields & {
  regid?: string | null;
  linenum?: number | null;
  registration?: {
    regid?: string | null;
    status?: string | null;
    regdate?: string | null;
  } | null;
};

export function groupRegdByDuplicateKey<T extends ParticipantDuplicateFields>(
  participants: T[]
): Record<string, T[]> {
  const keyToParticipants: Record<string, T[]> = {};
  for (const p of participants) {
    const key = participantDuplicateKey(p);
    if (!keyToParticipants[key]) keyToParticipants[key] = [];
    keyToParticipants[key].push(p);
  }
  return keyToParticipants;
}

/**
 * For each participant row on the current registration, find matching participants
 * on other registrations (same conference, name, province, LGU).
 * Only PENDING/APPROVED (non-REJECTED) registrations are considered.
 */
export function buildParticipantDuplicateMap(
  currentRegid: string,
  participants: ReadonlyArray<{ linenum: number } & ParticipantDuplicateFields>,
  allConferenceRegdWithReg: RegdWithRegistration[]
): Map<number, DuplicateRegistrationMatch[]> {
  const currentKey = String(currentRegid).trim();
  const keyToOtherRegistrations = new Map<string, DuplicateRegistrationMatch[]>();

  for (const row of allConferenceRegdWithReg) {
    const regid = String(row.regid ?? row.registration?.regid ?? '').trim();
    if (!regid || regid === currentKey) continue;
    if (!isDuplicateComparableStatus(row.registration?.status)) continue;

    const key = participantDuplicateKey(row);
    const matches = keyToOtherRegistrations.get(key) ?? [];

    if (!matches.some((m) => m.regid === regid)) {
      matches.push({
        regid,
        status: row.registration?.status ?? null,
        regdate: row.registration?.regdate ?? null,
      });
    }
    keyToOtherRegistrations.set(key, matches);
  }

  const result = new Map<number, DuplicateRegistrationMatch[]>();
  for (const p of participants) {
    const key = participantDuplicateKey(p);
    result.set(p.linenum, keyToOtherRegistrations.get(key) ?? []);
  }
  return result;
}

export function buildParticipantDuplicateRecord(
  map: Map<number, DuplicateRegistrationMatch[]>
): Record<string, DuplicateRegistrationMatch[]> {
  const record: Record<string, DuplicateRegistrationMatch[]> = {};
  for (const [linenum, matches] of map.entries()) {
    record[String(linenum)] = matches;
  }
  return record;
}
